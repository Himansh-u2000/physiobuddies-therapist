import type { AvailabilitySlot } from "@/types";

/**
 * What a slot on the availability screen actually is — as opposed to what its `status` says.
 *
 * ## Why `status` alone is not enough
 *
 * `GET /therapist/:id/availability` reports `"blocked"` for two unrelated things, and the app used
 * to treat them as one:
 *
 *   1. **A block the therapist placed** — a real `SlotReservation` row with `status: 'blocked'`.
 *   2. **Any slot too close to now, or already past.** `therapist.service` sets
 *      `status = 'blocked'` whenever the slot starts inside `MIN_BOOKING_LEAD_MINUTES`, with no row
 *      behind it at all.
 *
 * The second kind cannot be reopened, because there is nothing to delete.
 * `DELETE /therapist/slots/block` matches rows only, so it answered `200 "Unblocked 0 slot(s)"` —
 * the app toasted "reopened", refetched, and the slot came back still blocked. That was the
 * reported bug: "block works, reopen doesn't save". Blocking always worked because an open slot
 * does get a row created.
 *
 * `GET /therapist/slots/overrides` returns ONLY real blocks (the rows), so intersecting the two is
 * what separates "blocked by you" from "too soon to book".
 */
export type SlotKind =
  /** Bookable, and the therapist may block it. */
  | "open"
  /** A patient has booked it. Never changeable here. */
  | "booked"
  /** Blocked by the therapist — the only kind "Reopen" can act on. */
  | "blocked"
  /** A patient is mid-checkout and holds it in Redis. Transient; not changeable. */
  | "held"
  /** Past, or inside the booking lead time. No row exists, so neither block nor reopen applies. */
  | "unavailable";

/**
 * Classify one slot.
 *
 * `realBlockedHours` is `undefined` while the overrides request is loading or if it failed. In
 * that case a `"blocked"` status is trusted as a real block — the previous behaviour — rather than
 * demoted to unavailable: failing open keeps a genuine block reopenable, and the worst case is the
 * old bug on a flaky connection, instead of a new one where no block can ever be undone.
 */
export function slotKind(
  slot: Pick<AvailabilitySlot, "startHour" | "status">,
  realBlockedHours: ReadonlySet<number> | undefined,
): SlotKind {
  switch ((slot.status ?? "").toLowerCase()) {
    case "booked":
      return "booked";
    case "hold":
    case "held":
      return "held";
    case "blocked":
      if (!realBlockedHours) return "blocked";
      return realBlockedHours.has(slot.startHour) ? "blocked" : "unavailable";
    default:
      return "open";
  }
}

/** Only these two kinds can be selected: one gets blocked, the other reopened. */
export function isSelectableKind(kind: SlotKind): boolean {
  return kind === "open" || kind === "blocked";
}

/**
 * "Past" or "Too soon", for an unavailable slot's label.
 *
 * The slot grid is IST wall-clock (the backend formats dates with `timeZone: 'Asia/Kolkata'`), so
 * the start instant is built in IST explicitly rather than from the device's zone — a therapist
 * whose phone is set to another zone would otherwise see the two labels swap at the wrong hour.
 */
const IST_OFFSET_MINUTES = 330;

export function unavailableReason(isoDate: string, startHour: number, now: Date = new Date()): "Past" | "Too soon" {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "Too soon";
  const startUtcMs = Date.UTC(y, m - 1, d, startHour, 0) - IST_OFFSET_MINUTES * 60_000;
  return now.getTime() >= startUtcMs ? "Past" : "Too soon";
}

/**
 * Pull the affected-row count out of a slot-block response message.
 *
 * The endpoint has no numeric field — only `"Unblocked 3 slot(s)."`. Parsing prose is fragile, so
 * this is deliberately forgiving: it returns `null` whenever the shape is unrecognised, and callers
 * treat `null` as "trust the 200". Only an explicit `0` is acted on, because that is the precise
 * signature of the silent no-op this module exists to stop.
 */
export function affectedSlotCount(message: unknown): number | null {
  if (typeof message !== "string") return null;
  const match = /\b(?:un)?blocked\s+(\d+)\s+slot/i.exec(message);
  return match ? Number(match[1]) : null;
}
