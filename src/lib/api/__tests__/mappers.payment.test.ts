/**
 * Whether a booking reads as paid.
 *
 * Patients pay at booking, so a therapist's list is almost entirely paid bookings. The app used to
 * derive payment from whether the *visit had happened* (`completed ? "paid" : "pending"`), which
 * badged every upcoming and in-progress booking "Unpaid" on the session details screen. No test
 * covered it, which is how it shipped. These pin the replacement to the backend's own
 * `SessionStatus`, where only `pending` ("slot locked, payment pending") and `expired` ("payment
 * not completed") are pre-payment.
 */
import {
  mapBookingDetailToAppointment,
  mapBookingToAppointment,
  paymentStatusFor,
  type BackendBooking,
  type BackendBookingDetail,
} from "@/lib/api/mappers";

describe("paymentStatusFor", () => {
  it.each(["CONFIRMED", "ACTIVE", "COMPLETED", "SETTLED", "UPCOMING", "ONGOING"])(
    "treats %s as paid — everything after confirmation is post-payment",
    (status) => {
      expect(paymentStatusFor(status)).toBe("paid");
    },
  );

  it.each(["PENDING", "EXPIRED", "pending", "expired"])(
    "treats %s as unpaid — the only two pre-payment states the backend defines",
    (status) => {
      expect(paymentStatusFor(status)).toBe("pending");
    },
  );

  it("does not call a status it has never seen unpaid", () => {
    // `mapBookingStatus` folds unknown strings into "pending"; deriving from it would regress
    // straight back to the reported bug the first time the backend adds a status.
    expect(paymentStatusFor("SOME_NEW_STATE")).toBe("paid");
    expect(paymentStatusFor(undefined)).toBe("paid");
  });

  it("does not treat the plan-level CREATED as unpaid — it is set at reservation and outlives payment", () => {
    expect(paymentStatusFor("CREATED")).toBe("paid");
  });
});

describe("booking mappers", () => {
  const row = (status: string) =>
    ({
      id: "b1",
      patientID: "PAT-1",
      patientName: "Priya Sharma",
      treatmentMode: "home_visit",
      status,
      lastSessionDate: "September 20, 2026",
      lastSessionTime: "09:00 AM - 09:40 AM",
    }) as BackendBooking;

  it("marks an upcoming list row paid — the screen that showed 'Unpaid'", () => {
    expect(mapBookingToAppointment(row("UPCOMING"))?.paymentStatus).toBe("paid");
  });

  it("still marks a held-but-unpaid list row unpaid", () => {
    expect(mapBookingToAppointment(row("PENDING"))?.paymentStatus).toBe("pending");
  });

  const detail = (sessionStatuses: string[], overallStatus = "ONGOING") =>
    ({
      id: "p1",
      mode: "home_visit",
      overallStatus,
      sessions: sessionStatuses.map((status, i) => ({
        id: `s${i}`,
        status,
        date: `2026-09-${String(20 + i).padStart(2, "0")}T03:30:00.000Z`,
        scheduledTime: "09:00 AM - 09:40 AM",
      })),
    }) as BackendBookingDetail;

  it("reads payment from the session being shown, not from the plan", () => {
    // Plan is ONGOING (no payment meaning); the visit on screen is confirmed, i.e. paid.
    expect(mapBookingDetailToAppointment(detail(["COMPLETED", "CONFIRMED"])).paymentStatus).toBe(
      "paid",
    );
  });

  it("shows unpaid when the session on screen is still awaiting payment", () => {
    expect(mapBookingDetailToAppointment(detail(["PENDING"], "CREATED")).paymentStatus).toBe(
      "pending",
    );
  });
});
