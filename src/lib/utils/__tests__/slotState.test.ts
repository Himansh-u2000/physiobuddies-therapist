import {
  affectedSlotCount,
  isSelectableKind,
  slotKind,
  unavailableReason,
} from "@/lib/utils/slotState";

/**
 * The availability screen's reopen bug in one sentence: the API calls a slot "blocked" both when
 * the therapist blocked it and when it is merely too soon to book, and only the first can be
 * reopened. These pin the classification that tells them apart.
 */

describe("slotKind", () => {
  const real = new Set([9, 14]);

  it("treats a blocked slot with a real reservation as reopenable", () => {
    expect(slotKind({ startHour: 9, status: "blocked" }, real)).toBe("blocked");
  });

  it("demotes a blocked slot with NO reservation to unavailable — the reported bug", () => {
    // Lead-time "blocked": DELETE would match no row and answer `Unblocked 0 slot(s)`.
    expect(slotKind({ startHour: 7, status: "blocked" }, real)).toBe("unavailable");
  });

  it("trusts `blocked` while the real-block list is unknown, so a genuine block stays reopenable", () => {
    expect(slotKind({ startHour: 7, status: "blocked" }, undefined)).toBe("blocked");
  });

  it("recognises a Redis checkout hold instead of rendering it as open", () => {
    expect(slotKind({ startHour: 10, status: "hold" }, real)).toBe("held");
  });

  it("maps booked and open through unchanged", () => {
    expect(slotKind({ startHour: 11, status: "booked" }, real)).toBe("booked");
    expect(slotKind({ startHour: 12, status: "open" }, real)).toBe("open");
  });

  it("is case-insensitive, since the backend lowercases reservation statuses but not always", () => {
    expect(slotKind({ startHour: 9, status: "BLOCKED" }, real)).toBe("blocked");
  });
});

describe("isSelectableKind", () => {
  it("allows only the two kinds an action exists for", () => {
    expect(isSelectableKind("open")).toBe(true);
    expect(isSelectableKind("blocked")).toBe(true);
    expect(isSelectableKind("booked")).toBe(false);
    expect(isSelectableKind("held")).toBe(false);
    expect(isSelectableKind("unavailable")).toBe(false);
  });
});

describe("unavailableReason", () => {
  // 2026-09-20 09:00 IST == 2026-09-20 03:30 UTC
  it("says Past once the IST start has gone by", () => {
    expect(unavailableReason("2026-09-20", 9, new Date("2026-09-20T03:30:00Z"))).toBe("Past");
  });

  it("says Too soon before it", () => {
    expect(unavailableReason("2026-09-20", 9, new Date("2026-09-20T03:29:00Z"))).toBe("Too soon");
  });

  it("anchors on IST, not UTC — 09:00 UTC would be wrongly 'Too soon' here", () => {
    expect(unavailableReason("2026-09-20", 9, new Date("2026-09-20T05:00:00Z"))).toBe("Past");
  });
});

describe("affectedSlotCount", () => {
  it("reads the count from both block and unblock messages", () => {
    expect(affectedSlotCount("Unblocked 3 slot(s).")).toBe(3);
    expect(affectedSlotCount("Blocked 1 slot(s).")).toBe(1);
  });

  it("returns an explicit zero — the silent no-op signature", () => {
    expect(affectedSlotCount("Unblocked 0 slot(s).")).toBe(0);
  });

  it("returns null for anything unrecognised, so callers trust the 200 rather than inventing a failure", () => {
    expect(affectedSlotCount("All requested slots are already blocked.")).toBeNull();
    expect(affectedSlotCount(undefined)).toBeNull();
    expect(affectedSlotCount({ message: 1 })).toBeNull();
  });
});
