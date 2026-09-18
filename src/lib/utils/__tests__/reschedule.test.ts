import {
  canReschedule,
  currentSessionOf,
  isBookableSlot,
  minuteLabel,
  RESCHEDULE_REASON_MAX,
  rescheduleBody,
  slotRangeLabel,
} from "@/lib/utils/reschedule";
import { mapRescheduleOptions, type BackendRescheduleOptions } from "@/lib/api/mappers";
import type { Appointment, AppointmentSession } from "@/types";

const session = (id: string, rawStatus: string): AppointmentSession =>
  ({ id, rawStatus, status: "confirmed", date: "", scheduledTime: "", timeLabel: "", meridiem: "AM", dateLabel: "", isRescheduled: false, rescheduleCount: 0 }) as AppointmentSession;

const appt = (sessions: AppointmentSession[], currentSessionId?: string) =>
  ({ id: "plan-1", sessions, currentSessionId }) as unknown as Appointment;

describe("canReschedule", () => {
  it.each(["PENDING", "CONFIRMED"])("offers it for a %s session — the server's own allow-list", (status) => {
    expect(canReschedule(appt([session("s1", status)], "s1"), false)).toBe(true);
  });

  it.each(["ACTIVE", "COMPLETED", "SETTLED", "CANCELLED", "NO_SHOW", "EXPIRED"])(
    "withholds it for %s, which the server rejects with a 400",
    (status) => {
      expect(canReschedule(appt([session("s1", status)], "s1"), false)).toBe(false);
    },
  );

  it("withholds it while this visit's session is running on the device", () => {
    expect(canReschedule(appt([session("s1", "CONFIRMED")], "s1"), true)).toBe(false);
  });

  it("uses the CURRENT session, not whichever comes first", () => {
    const a = appt([session("done", "COMPLETED"), session("next", "CONFIRMED")], "next");
    expect(currentSessionOf(a)?.id).toBe("next");
    expect(canReschedule(a, false)).toBe(true);
  });

  it("withholds it when there is no session id to call the endpoint with", () => {
    expect(canReschedule(appt([session("s1", "CONFIRMED")]), false)).toBe(false);
  });
});

describe("labels", () => {
  it.each([
    [0, "12:00 AM"],
    [360, "6:00 AM"],
    [720, "12:00 PM"],
    [780, "1:00 PM"],
    [1290, "9:30 PM"],
  ])("minute %p reads as %p", (m, label) => {
    expect(minuteLabel(m)).toBe(label);
  });

  it("formats a slot range", () => {
    expect(slotRangeLabel(480, 40)).toBe("8:00 AM – 8:40 AM");
  });
});

describe("isBookableSlot", () => {
  it("accepts only open slots", () => {
    expect(isBookableSlot({ status: "open" })).toBe(true);
    for (const status of ["booked", "hold", "blocked"]) {
      expect(isBookableSlot({ status })).toBe(false);
    }
  });
});

describe("rescheduleBody", () => {
  it("sends the day at UTC midnight and the minute untouched", () => {
    // The server does new Date(date).setUTCHours(0,0,0,0); any other instant risks the wrong day.
    expect(rescheduleBody({ isoDate: "2026-09-19", startMinute: 540 })).toEqual({
      date: "2026-09-19T00:00:00.000Z",
      startMinute: 540,
    });
  });

  it("includes a valid duration and a trimmed reason", () => {
    expect(
      rescheduleBody({ isoDate: "2026-09-19", startMinute: 540, durationMinutes: 40, reason: "  Traffic  " }),
    ).toEqual({ date: "2026-09-19T00:00:00.000Z", startMinute: 540, durationMinutes: 40, reason: "Traffic" });
  });

  it("drops a duration outside the contract's 5–120 and a blank reason", () => {
    const body = rescheduleBody({ isoDate: "2026-09-19", startMinute: 540, durationMinutes: 0, reason: "   " });
    expect(body).not.toHaveProperty("durationMinutes");
    expect(body).not.toHaveProperty("reason");
  });

  it("caps the reason length", () => {
    const body = rescheduleBody({ isoDate: "2026-09-19", startMinute: 540, reason: "x".repeat(500) });
    expect(body.reason).toHaveLength(RESCHEDULE_REASON_MAX);
  });
});

describe("mapRescheduleOptions", () => {
  // Captured from GET /treatment-session/6aac213af9c441b4430c6fe4/reschedule-slots on 2026-09-17,
  // with one open and one lead-time-blocked slot added to the (then empty) days.
  const live: BackendRescheduleOptions = {
    sessionId: "6aac213af9c441b4430c6fe4",
    treatmentPlanId: "6aac213af9c441b4430c6fe2",
    therapistId: "6a9431ce0a61c5ffd0ffc9d1",
    currentDate: "2026-09-18T00:00:00.000Z",
    currentStartTime: "2026-09-18T08:00:00.000Z",
    currentDurationMinutes: 40,
    availableSlots: [
      {
        date: "19-09-2026",
        timeSlots: [
          { startMinute: 540, durationMinutes: 40, category: "morning", status: "open" },
          { startMinute: 360, durationMinutes: 40, category: "morning", status: "blocked" },
        ],
      },
    ],
  };

  it("reads the current slot's IST time from the UTC fields — 08:00Z is 8 AM", () => {
    const o = mapRescheduleOptions(live);
    expect(o.currentDate).toBe("2026-09-18");
    expect(o.currentStartMinute).toBe(480);
    expect(o.currentDurationMinutes).toBe(40);
  });

  it("normalises days and keeps each slot's minute, duration and status", () => {
    const [day] = mapRescheduleOptions(live).days;
    expect(day.date).toBe("2026-09-19");
    expect(day.slots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ startTime: 540, endTime: 580, startHour: 9, status: "open" }),
        expect.objectContaining({ startTime: 360, status: "blocked" }),
      ]),
    );
  });

  it("tolerates a missing current start time", () => {
    expect(mapRescheduleOptions({ ...live, currentStartTime: null }).currentStartMinute).toBeNull();
  });
});
