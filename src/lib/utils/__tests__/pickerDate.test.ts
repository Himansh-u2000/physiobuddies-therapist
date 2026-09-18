import { fromPickerValue, pickerBound, toPickerValue } from "@/lib/utils/pickerDate";

/**
 * The Time off date picker looped forever on Android because a chosen day did not survive the round
 * trip through Material3. These pin that it now does, in any timezone.
 *
 * `material3RoundTrip` reproduces what `DatePickerView.kt` does to an incoming value: take the UTC
 * calendar day of the instant (`getCanonicalDate`) and report UTC midnight of it
 * (`selectedDateMillis`). It uses only UTC arithmetic, so these tests do not depend on the timezone
 * of the machine running them — the offsets below are applied explicitly instead.
 */
function material3RoundTrip(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/** The instant of local midnight on `iso` in a zone `offsetMinutes` east of UTC. */
function localMidnightAt(iso: string, offsetMinutes: number): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - offsetMinutes * 60_000);
}

/** Reading a UTC instant as calendar fields in a zone `offsetMinutes` east of UTC. */
function isoInZone(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

const IST = 330;
const NEW_YORK = -240;

describe("the bug being fixed", () => {
  it.each([
    ["India", IST],
    ["New York", NEW_YORK],
  ])("the old local-midnight value came back as a different day in %s — the loop", (_, offset) => {
    const sent = localMidnightAt("2026-09-17", offset);
    const echoed = isoInZone(material3RoundTrip(sent), offset);
    expect(echoed).toBe("2026-09-16");
  });
});

describe("Android round trip", () => {
  it.each(["2026-09-17", "2026-01-01", "2026-12-31", "2028-02-29"])(
    "%s comes back unchanged, so React state does not change and the loop cannot start",
    (iso) => {
      const echoed = material3RoundTrip(toPickerValue(iso, "android"));
      expect(fromPickerValue(echoed, "android")).toBe(iso);
    },
  );

  it("sends UTC midnight — the instant Material3 treats as that calendar day", () => {
    expect(toPickerValue("2026-09-17", "android").toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });

  it("reads a real tap (UTC midnight of the tapped day) as that day, whatever the zone", () => {
    const tapped = new Date(Date.UTC(2026, 8, 25));
    expect(fromPickerValue(tapped, "android")).toBe("2026-09-25");
  });
});

describe("iOS round trip", () => {
  it("uses local fields both ways, which SwiftUI returns unchanged", () => {
    const sent = toPickerValue("2026-09-17", "ios");
    expect(sent.getFullYear()).toBe(2026);
    expect(sent.getMonth()).toBe(8);
    expect(sent.getDate()).toBe(17);
    expect(sent.getHours()).toBe(0);
    expect(fromPickerValue(sent, "ios")).toBe("2026-09-17");
  });
});

describe("bounds", () => {
  it("are local midnight, because Android reads minimumDate with local calendar fields", () => {
    const min = pickerBound("2026-09-17")!;
    expect([min.getFullYear(), min.getMonth(), min.getDate(), min.getHours()]).toEqual([2026, 8, 17, 0]);
  });

  it("are undefined when absent or malformed", () => {
    expect(pickerBound(undefined)).toBeUndefined();
    expect(pickerBound("17/09/2026")).toBeUndefined();
  });
});

describe("malformed input", () => {
  it("does not invent a date", () => {
    expect(Number.isNaN(toPickerValue("not-a-date", "android").getTime())).toBe(true);
    expect(fromPickerValue(new Date(Number.NaN), "android")).toBe("");
  });
});
