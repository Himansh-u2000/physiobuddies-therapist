/**
 * The slot-time line on the appointment card, and the rule for which cards get "Start visit".
 *
 * `slotRange` prefers the end time the server sent; the fallback (start + standard slot length)
 * exists for rows read back from the offline cache, which predates the field. Both paths are
 * pinned because the fallback crosses noon and midnight, which is where 12-hour arithmetic breaks.
 */
import { canStartVisit, slotRange } from "@/components/appointments/AppointmentCard";
import { mapBookingToAppointment } from "@/lib/api/mappers";
import { SLOT_CONFIG } from "@/constants/config";
import type { Appointment } from "@/types";

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a1",
    patientId: "p1",
    patientName: "Priya Sharma",
    time: "11:00",
    timeLabel: "11:00",
    meridiem: "AM",
    type: "home",
    status: "confirmed",
    paymentStatus: "paid",
    amount: 0,
    condition: "Therapy session",
    workflowStep: 1,
    ...overrides,
  };
}

describe("slotRange", () => {
  it("uses the end time the server sent", () => {
    expect(slotRange(appt({ endTimeLabel: "12:00 PM" }))).toBe("11:00 AM - 12:00 PM");
  });

  it("falls back to start + slot length for cached rows, crossing noon correctly", () => {
    expect(SLOT_CONFIG.durationMin).toBe(40);
    expect(slotRange(appt({ timeLabel: "11:40", meridiem: "AM" }))).toBe("11:40 AM - 12:20 PM");
    expect(slotRange(appt({ timeLabel: "04:00", meridiem: "PM" }))).toBe("04:00 PM - 04:40 PM");
  });

  it("treats 12 PM as noon, not midnight", () => {
    expect(slotRange(appt({ timeLabel: "12:00", meridiem: "PM" }))).toBe("12:00 PM - 12:40 PM");
  });
});

describe("mapBookingToAppointment end time", () => {
  it("keeps the end of the server's slot string", () => {
    const a = mapBookingToAppointment({
      id: "b1",
      patientID: "p1",
      patientName: "Neha",
      status: "UPCOMING",
      lastSessionDate: "September 17, 2026",
      lastSessionTime: "02:00 PM - 02:40 PM",
    });
    expect(a?.timeLabel).toBe("02:00");
    expect(a?.meridiem).toBe("PM");
    expect(a?.endTimeLabel).toBe("02:40 PM");
  });

  it("leaves it unset when the range has no end", () => {
    const a = mapBookingToAppointment({
      id: "b2",
      patientID: "p1",
      patientName: "Neha",
      status: "UPCOMING",
      lastSessionTime: "02:00 PM",
    });
    expect(a?.endTimeLabel).toBeUndefined();
  });
});

describe("canStartVisit", () => {
  it("offers the action only for visits that can actually be started or resumed", () => {
    expect(canStartVisit("confirmed")).toBe(true);
    expect(canStartVisit("in_progress")).toBe(true);
    // Awaiting payment isn't a confirmed booking yet, so the list doesn't offer to start it.
    expect(canStartVisit("pending")).toBe(false);
    expect(canStartVisit("completed")).toBe(false);
    expect(canStartVisit("cancelled")).toBe(false);
  });
});
