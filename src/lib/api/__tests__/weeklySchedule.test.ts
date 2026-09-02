import { buildWeeklySchedulePayload } from "@/lib/api/services";
import { WEEKDAYS } from "@/constants/config";
import type { WeeklySchedule } from "@/types";

/**
 * `PUT /therapist/slots/schedule` **replaces** the whole week; it does not merge the days it was
 * sent, despite documenting that "days omitted from the payload are left unchanged". Probed live
 * 2026-08-25: a PUT of `{ sunday: ["morning"] }` reads back as a schedule containing only sunday.
 *
 * So an omitted day is a deleted day, and the request has to be total. That mattered in two
 * ordinary cases, both of which produced silent data loss:
 *
 *   - the schedule was unreadable (the server's own 500 on GET), so the editor's draft started
 *     empty and the first tap saved a one-day week;
 *   - a previous partial save had already shrunk what GET returned, so every later save shrank
 *     it again.
 */
describe("buildWeeklySchedulePayload", () => {
  it("sends all seven days even when the therapist only touched one", () => {
    const draft: WeeklySchedule = { monday: { shifts: ["morning"], disabledHours: [] } };

    const body = buildWeeklySchedulePayload(draft);

    expect(Object.keys(body).sort()).toEqual(WEEKDAYS.map((d) => d.id).sort());
    expect(body.monday).toEqual(["morning"]);
    // The six untouched days must be present and explicitly empty, not absent.
    expect(body.sunday).toEqual([]);
    expect(body.saturday).toEqual([]);
  });

  it("sends a full empty week for an empty draft rather than an empty object", () => {
    // This is the unreadable-schedule case: `{}` used to go out as `{}`.
    const body = buildWeeklySchedulePayload({});

    expect(Object.keys(body)).toHaveLength(7);
    expect(Object.values(body).every((v) => Array.isArray(v) && v.length === 0)).toBe(true);
  });

  it("preserves a full week unchanged", () => {
    const draft: WeeklySchedule = Object.fromEntries(
      WEEKDAYS.map(({ id }) => [id, { shifts: ["morning", "evening"], disabledHours: [] }]),
    );

    const body = buildWeeklySchedulePayload(draft);

    expect(Object.values(body).every((v) => v.length === 2)).toBe(true);
  });

  it("emits bare shift arrays, never the object form the GET cannot serve back", () => {
    const draft: WeeklySchedule = {
      // `disabledHours` is deliberately dropped: sending `{ shifts, disabledHours }` is stored
      // verbatim and then makes every later GET 500 permanently.
      tuesday: { shifts: ["night"], disabledHours: [9, 10] },
    };

    const body = buildWeeklySchedulePayload(draft);

    expect(body.tuesday).toEqual(["night"]);
    expect(Array.isArray(body.tuesday)).toBe(true);
  });

  it("ignores a day key the app does not know about", () => {
    const draft = {
      monday: { shifts: ["morning"], disabledHours: [] },
      someday: { shifts: ["night"], disabledHours: [] },
    } as unknown as WeeklySchedule;

    expect(Object.keys(buildWeeklySchedulePayload(draft))).not.toContain("someday");
  });
});
