/**
 * The backend → app deep-link translation, pinned against the links the server's notification
 * catalog actually emits (`therapistBookingPath`, `sessionPath`, and the literal paths on the
 * payout, dashboard and campaign events). A wrong answer here is a tap that lands on
 * `+not-found`, which is exactly what shipping the server's web paths verbatim would do.
 */
import { toAppHref } from "@/lib/notifications/links";

describe("toAppHref", () => {
  it("routes a therapist booking to the appointment screen, keyed by the plan id", () => {
    // `booking.therapist_assigned`, `session.cancelled`, `session.rescheduled`,
    // `session.reminder` — all resolve to this path with `planId || sessionId`.
    expect(toAppHref("/therapist/my-bookings/6a8301146f7babf1a5b475ee")).toBe(
      "/session/appointment/6a8301146f7babf1a5b475ee",
    );
  });

  it("accepts an absolute link, as the email CTAs build them", () => {
    expect(toAppHref("https://app.physiobuddies.in/therapist/my-bookings/abc123")).toBe(
      "/session/appointment/abc123",
    );
  });

  it("ignores a query string and a fragment", () => {
    expect(toAppHref("/therapist/my-bookings/abc123?from=email#top")).toBe(
      "/session/appointment/abc123",
    );
  });

  it("tolerates a trailing slash", () => {
    expect(toAppHref("/therapist/my-bookings/abc123/")).toBe("/session/appointment/abc123");
  });

  it("maps the collection and the standalone therapist paths", () => {
    expect(toAppHref("/therapist/my-bookings")).toBe("/(app)/appointments");
    expect(toAppHref("/therapist/commission-history")).toBe("/(app)/earnings");
    expect(toAppHref("/therapist/dashboard")).toBe("/(app)");
  });

  it("falls back to the notifications list rather than nowhere", () => {
    // A promotional campaign sends `/`, and a patient-side link has no therapist screen at all.
    expect(toAppHref("/")).toBe("/(app)/notifications");
    expect(toAppHref("/patient/my-bookings/abc123")).toBe("/(app)/notifications");
    expect(toAppHref("/search")).toBe("/(app)/notifications");
    expect(toAppHref(undefined)).toBe("/(app)/notifications");
    expect(toAppHref("")).toBe("/(app)/notifications");
  });

  it("does not mistake a deeper booking path for a booking id", () => {
    expect(toAppHref("/therapist/my-bookings/abc123/session/9")).toBe("/(app)/notifications");
  });
});
