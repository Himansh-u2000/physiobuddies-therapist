import type { Href } from "expo-router";

/**
 * Backend deep link → app route.
 *
 * Every notification the server emits carries a link built for the **web** client: the
 * notification catalog's `therapistBookingPath()` yields `/therapist/my-bookings/<planId>`,
 * `payout.*` events point at `/therapist/commission-history`, and so on. Those paths do not
 * exist in this app's router, so following one verbatim lands on `+not-found` — which is why
 * translation happens here, in one place, shared by the in-app list row and the push tap.
 *
 * The id in a booking path is the **treatment-plan** id (`planId || sessionId` server-side),
 * which is exactly what `/session/appointment/[id]` and `appointmentApi.getById` speak — see
 * the note in `services.ts` about the lifecycle endpoints taking a *session* id instead.
 *
 * Unknown or patient-only links resolve to the notifications list rather than `null`: the user
 * has already tapped, and a tap that goes nowhere reads as a broken app.
 */
const FALLBACK: Href = "/(app)/notifications";

/** Strip an absolute `https://app.physiobuddies.in/...` down to its path. Email CTAs are absolute. */
function toPath(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  // No URL polyfill assumptions — take everything from the first slash after the host.
  const afterScheme = trimmed.replace(/^https?:\/\//i, "");
  const slash = afterScheme.indexOf("/");
  return slash === -1 ? "/" : afterScheme.slice(slash);
}

export function toAppHref(link: string | undefined | null): Href {
  if (!link) return FALLBACK;
  const path = toPath(link).split(/[?#]/)[0].replace(/\/+$/, "") || "/";

  // A therapist's booking — the only link that carries an id worth routing on.
  const booking = /^\/therapist\/my-bookings\/([^/]+)$/.exec(path);
  if (booking) return `/session/appointment/${booking[1]}` as Href;

  switch (path) {
    case "/therapist/my-bookings":
      return "/(app)/appointments";
    case "/therapist/commission-history":
      return "/(app)/earnings";
    case "/therapist/dashboard":
      return "/(app)";
    default:
      // Patient-side links (`/patient/my-bookings/...`, `/search`) can reach a therapist
      // account through a promotional campaign, and there is no therapist screen for them.
      return FALLBACK;
  }
}
