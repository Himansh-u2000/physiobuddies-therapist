import type { Appointment, AppointmentSession, AvailabilitySlot } from "@/types";

/**
 * Rescheduling a visit — the rules, kept out of the screen so they can be tested.
 *
 * Endpoints (verified live 2026-09-17, rules read from the backend source):
 *   GET  /treatment-session/:sessionId/reschedule-slots
 *   POST /treatment-session/:sessionId/reschedule-slot   { date, startMinute, durationMinutes?, reason? }
 *
 * Both take a treatment-SESSION id, never the plan id the appointment list is keyed by — a plan id
 * gets a 404. Both refuse any session not in `pending` or `confirmed` (400, "Cannot view reschedule
 * slots: session is in 'no_show' status…"). The server only offers the next 3 days as targets
 * (`getTherapistAvailability(therapistId, daysCount = 3)`), and moving a session touches no money:
 * the payment and commission stay with the session.
 */

/** Backend session statuses from which a visit may be moved. */
const RESCHEDULABLE = new Set(["PENDING", "CONFIRMED"]);

/** The session the screen is showing — the one reschedule acts on. */
export function currentSessionOf(appointment: Appointment): AppointmentSession | undefined {
  const id = appointment.currentSessionId;
  return id ? appointment.sessions?.find((s) => s.id === id) : undefined;
}

/**
 * Whether to offer "Reschedule" at all.
 *
 * Mirrors the server's own guard so the button never leads to a 400. Also withheld while a session
 * for this visit is running on the device: the therapist has already met the patient, and moving
 * the slot from under a live timer would leave the treatment screens pointing at a visit that no
 * longer happens now.
 */
export function canReschedule(appointment: Appointment, sessionRunningHere: boolean): boolean {
  if (sessionRunningHere) return false;
  const session = currentSessionOf(appointment);
  return !!session && RESCHEDULABLE.has(session.rawStatus);
}

/** Minutes past midnight → "9:00 AM". */
export function minuteLabel(minute: number): string {
  const h24 = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "9:00 AM – 9:40 AM". */
export function slotRangeLabel(startMinute: number, durationMinutes: number): string {
  return `${minuteLabel(startMinute)} – ${minuteLabel(startMinute + durationMinutes)}`;
}

export function slotDuration(slot: Pick<AvailabilitySlot, "startTime" | "endTime">): number {
  return Math.max(0, slot.endTime - slot.startTime);
}

/** Only an `open` slot is a valid target; everything else is booked, held, blocked or too soon. */
export function isBookableSlot(slot: Pick<AvailabilitySlot, "status">): boolean {
  return (slot.status ?? "").toLowerCase() === "open";
}

/** Server-side limit on the optional reason; kept generous but bounded so a paste can't balloon. */
export const RESCHEDULE_REASON_MAX = 200;

/**
 * The POST body.
 *
 * `date` is the calendar day at UTC midnight: the server does `new Date(date)` then
 * `setUTCHours(0,0,0,0)`, so any other instant risks landing on the neighbouring day. `startMinute`
 * is the IST wall-clock minute exactly as the slots endpoint reported it — the server stores slot
 * times as IST-written-as-UTC, and the value must round-trip untouched.
 */
export function rescheduleBody(input: {
  isoDate: string;
  startMinute: number;
  durationMinutes?: number;
  reason?: string;
}): { date: string; startMinute: number; durationMinutes?: number; reason?: string } {
  const reason = input.reason?.trim().slice(0, RESCHEDULE_REASON_MAX);
  const duration = input.durationMinutes;
  return {
    date: `${input.isoDate}T00:00:00.000Z`,
    startMinute: input.startMinute,
    // The contract allows 5–120; anything else is dropped and the server applies its default.
    ...(duration != null && duration >= 5 && duration <= 120 ? { durationMinutes: duration } : {}),
    ...(reason ? { reason } : {}),
  };
}
