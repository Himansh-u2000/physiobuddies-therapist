import { haversineKm, formatDistance, regionFor } from "@/lib/utils/geo";

/**
 * Distance is shown to a therapist deciding how long a visit will take to reach, so the two
 * things pinned hardest here are that the arithmetic is right against known real-world pairs,
 * and that the label never states more precision than a straight-line estimate can carry.
 */

const DELHI = { latitude: 28.61, longitude: 77.21 }; // the seed patient's recorded point
const PITAMPURA = { latitude: 28.698, longitude: 77.13 }; // the seed therapist's clinic

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm(DELHI, DELHI)).toBe(0);
  });

  it("matches a known separation", () => {
    // Pitampura → central Delhi is a little over 12 km as the crow flies.
    expect(haversineKm(PITAMPURA, DELHI)).toBeCloseTo(12.4, 0);
  });

  it("is symmetric", () => {
    expect(haversineKm(PITAMPURA, DELHI)).toBeCloseTo(haversineKm(DELHI, PITAMPURA), 10);
  });

  it("handles antipodal points without NaN from floating-point overshoot", () => {
    // sqrt(a) can drift just past 1 here; unclamped, asin returns NaN and the label vanishes.
    const d = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
    expect(Number.isNaN(d)).toBe(false);
    expect(d).toBeCloseTo(20015, -1);
  });

  it("crosses the antimeridian by the short way", () => {
    const d = haversineKm({ latitude: 0, longitude: 179.5 }, { latitude: 0, longitude: -179.5 });
    expect(d).toBeCloseTo(111.2, 0);
  });
});

describe("formatDistance", () => {
  it("always marks the number as approximate", () => {
    // Straight-line distance is a lower bound on the drive. Without the tilde a therapist
    // budgets travel time against a number that is always optimistic.
    expect(formatDistance(3.2)).toContain("~");
    expect(formatDistance(0.4)).toContain("~");
  });

  it("uses metres below a kilometre, rounded to 50 m", () => {
    expect(formatDistance(0.42)).toBe("~400 m away");
    expect(formatDistance(0.43)).toBe("~450 m away");
  });

  it("never claims sub-50 m precision, which handset GPS cannot support", () => {
    expect(formatDistance(0.004)).toBe("~50 m away");
  });

  it("keeps one decimal under 10 km and drops it above", () => {
    expect(formatDistance(4.26)).toBe("~4.3 km away");
    expect(formatDistance(12.4)).toBe("~12 km away");
  });

  it("returns empty for values that cannot be rendered honestly", () => {
    expect(formatDistance(Number.NaN)).toBe("");
    expect(formatDistance(-1)).toBe("");
  });
});

describe("regionFor", () => {
  it("centres between the two points", () => {
    const r = regionFor([
      { latitude: 0, longitude: 0 },
      { latitude: 2, longitude: 4 },
    ]);
    expect(r.latitude).toBeCloseTo(1);
    expect(r.longitude).toBeCloseTo(2);
  });

  it("pads the span so both pins clear the edges and their callouts", () => {
    const r = regionFor([
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    ]);
    expect(r.latitudeDelta).toBeCloseTo(2.2);
  });

  it("floors the zoom for a single point, which would otherwise span zero", () => {
    const r = regionFor([DELHI]);
    expect(r.latitudeDelta).toBeGreaterThan(0);
    expect(r.longitudeDelta).toBeGreaterThan(0);
    expect(r.latitude).toBeCloseTo(DELHI.latitude);
  });
});
