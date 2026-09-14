import { barFraction, compactRupees, niceMax } from "@/components/charts/scale";
import { weekOverWeekPercent, weeklyTrend } from "@/lib/api/mappers";

describe("niceMax", () => {
  it.each([
    [639, 1000],
    [1000, 1000],
    [1001, 2000],
    [2317, 2500],
    [4100, 5000],
    [7, 10],
    [0.3, 0.5],
  ])("rounds %p up to %p", (input, expected) => {
    expect(niceMax(input)).toBeCloseTo(expected);
  });

  it("returns 0 for an all-zero week, so the chart shows an empty state instead of a 0–0 axis", () => {
    expect(niceMax(0)).toBe(0);
    expect(niceMax(Number.NaN)).toBe(0);
  });
});

describe("barFraction", () => {
  it("draws a zero day as nothing — the old chart gave it an 18px bar", () => {
    expect(barFraction(0, 1000)).toBe(0);
  });

  it("measures from a zero baseline", () => {
    expect(barFraction(250, 1000)).toBeCloseTo(0.25);
  });

  it("never overshoots the axis", () => {
    expect(barFraction(1200, 1000)).toBe(1);
  });
});

describe("compactRupees", () => {
  it.each([
    [0, "Rs 0"],
    [500, "Rs 500"],
    [1000, "Rs 1k"],
    [1500, "Rs 1.5k"],
    [2500, "Rs 2.5k"],
    [12000, "Rs 12k"],
  ])("formats %p as %p", (input, expected) => {
    expect(compactRupees(input)).toBe(expected);
  });
});

describe("weekOverWeekPercent", () => {
  it("signs a fall as negative — the old badge printed '↑ -12%'", () => {
    expect(weekOverWeekPercent(880, 1000)).toBe(-12);
  });

  it("is null, not 0, when last week earned nothing", () => {
    // "↑ 0% vs last week" on a therapist's first earning week read as a flat week.
    expect(weekOverWeekPercent(639, 0)).toBeNull();
  });

  it("reports a rise", () => {
    expect(weekOverWeekPercent(1500, 1000)).toBe(50);
  });
});

describe("weeklyTrend", () => {
  // Wednesday 2026-09-16, local time.
  const now = new Date(2026, 8, 16, 12, 0, 0);
  const at = (y: number, m: number, d: number, amount: number) => ({
    id: `${y}${m}${d}`,
    billId: "b",
    therapistId: "t",
    therapistName: "T",
    sessionDate: new Date(y, m, d, 10).toISOString(),
    patientName: "P",
    sessionAmount: amount,
    platformFee: 0,
    therapistAmount: amount,
    platformRateUsed: 0,
    calculatedAt: new Date(y, m, d, 10).toISOString(),
  });

  it("returns the requested number of weeks, oldest first, current last", () => {
    const weeks = weeklyTrend([], 8, now);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].isCurrent).toBe(true);
    expect(weeks.slice(0, 7).every((w) => !w.isCurrent)).toBe(true);
    expect(weeks[7].weekStart).toBe("2026-09-14");
    expect(weeks[0].weekStart).toBe("2026-07-27");
  });

  it("buckets each commission into its Monday-to-Sunday week", () => {
    const weeks = weeklyTrend(
      [at(2026, 8, 14, 600), at(2026, 8, 20, 400), at(2026, 8, 13, 250)],
      8,
      now,
    );
    expect(weeks[7].amount).toBe(1000); // Mon 14th + Sun 20th
    expect(weeks[6].amount).toBe(250); // Sun 13th belongs to the previous week
  });

  it("ignores commissions outside the window", () => {
    const weeks = weeklyTrend([at(2026, 0, 5, 999)], 8, now);
    expect(weeks.reduce((s, w) => s + w.amount, 0)).toBe(0);
  });
});
