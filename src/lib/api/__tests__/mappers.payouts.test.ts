/**
 * Mappers for the Phase 5b domains (payouts, wallet, reviews, availability, authored content),
 * exercised against the REAL response bodies captured from the deployed backend at
 * https://api.pb.premraj.online/api/v1 with a seeded therapist account.
 *
 * These pin the shapes the swagger doc does NOT describe — every response there is typed only as
 * `data: any`, so the wire format is verified here against captured JSON rather than trusted.
 */
import {
  mapPayout,
  mapPayouts,
  mapWallet,
  mapReviews,
  mapAvailability,
  parseAvailabilityDate,
  mapArticles,
  mapFaqs,
  type BackendPayout,
  type BackendWallet,
  type BackendReview,
  type BackendAvailabilityDay,
} from "@/lib/api/mappers";

// Captured verbatim from GET /therapist/payout
const realPayout: BackendPayout = {
  id: "6a60cebd77a6fdaf79a22dd4",
  therapistId: "6a60ceb577a6fdaf79a22d9b",
  amount: 639,
  status: "processed",
  transactionRef: "UTR-SEED-0001",
  processedBy: "6a60ceb477a6fdaf79a22d8e",
  processedAt: "2026-07-22T14:07:57.641Z",
  requestedFromIp: "127.0.0.1",
  accountSnapshotJson: { upi: "therapist1@upi", bankName: "HDFC Bank" },
  createdAt: "2026-07-22T14:07:57.643Z",
};

describe("mapPayout", () => {
  it("maps the real payout record", () => {
    const p = mapPayout(realPayout);
    expect(p.id).toBe("6a60cebd77a6fdaf79a22dd4");
    expect(p.amount).toBe(639);
    expect(p.status).toBe("processed");
    expect(p.transactionRef).toBe("UTR-SEED-0001");
    expect(p.account).toEqual({ upi: "therapist1@upi", bankName: "HDFC Bank" });
  });

  it("falls back to 'requested' for an unrecognised status rather than leaking it through", () => {
    // The screen indexes a status→style map; an unmapped value would render as undefined.
    expect(mapPayout({ ...realPayout, status: "SOMETHING_NEW" }).status).toBe("requested");
    expect(mapPayout({ ...realPayout, status: undefined }).status).toBe("requested");
  });

  it("normalises status casing", () => {
    expect(mapPayout({ ...realPayout, status: "PROCESSED" }).status).toBe("processed");
  });

  it("survives a payout with no timestamps at all", () => {
    const p = mapPayout({ id: "x", amount: 10 });
    expect(p.dateLabel).toBe("");
    expect(p.status).toBe("requested");
  });

  it("sorts newest-requested first", () => {
    const list = mapPayouts([
      { id: "old", amount: 1, createdAt: "2026-07-01T00:00:00.000Z" },
      { id: "new", amount: 2, createdAt: "2026-07-20T00:00:00.000Z" },
    ]);
    expect(list.map((p) => p.id)).toEqual(["new", "old"]);
  });
});

describe("mapWallet", () => {
  // Captured from GET /therapist/wallet
  const realWallet: BackendWallet = {
    balance: 0,
    entries: [
      { id: "w1", amount: 639, type: "credit", balanceAfter: 639, createdAt: "2026-07-22T14:07:57.500Z" },
      { id: "w2", amount: -639, type: "payout", balanceAfter: 0, createdAt: "2026-07-22T14:07:57.700Z" },
    ],
  };

  it("maps balance and entries", () => {
    const w = mapWallet(realWallet);
    expect(w.balance).toBe(0);
    expect(w.entries).toHaveLength(2);
    expect(w.entries[1].amount).toBe(-639);
  });

  it("defaults a missing balance to 0 instead of undefined", () => {
    // The payout screen does arithmetic on this; undefined would render "NaN" as the balance.
    expect(mapWallet({} as BackendWallet).balance).toBe(0);
    expect(mapWallet({} as BackendWallet).entries).toEqual([]);
  });
});

describe("mapReviews", () => {
  // Captured from GET /therapist/:id/reviews
  const realReviews: BackendReview[] = [
    {
      rating: 5,
      comment: "Excellent care, noticeable improvement after a few sessions.",
      createdAt: "2026-07-22T14:07:58.600Z",
      reviewerName: "Priya Sharma",
      reviewerImage: null,
    },
  ];

  it("maps the real review shape", () => {
    const [r] = mapReviews(realReviews);
    expect(r.rating).toBe(5);
    expect(r.reviewerName).toBe("Priya Sharma");
    expect(r.comment).toContain("Excellent care");
  });

  it("names an anonymous reviewer rather than rendering blank", () => {
    expect(mapReviews([{ rating: 4 }])[0].reviewerName).toBe("Patient");
  });
});

describe("availability", () => {
  // Captured from GET /therapist/:id/availability — note DD-MM-YYYY, which is NOT ISO.
  const realDay: BackendAvailabilityDay = {
    date: "29-07-2026",
    timeSlots: [
      { startHour: 6, startTime: 360, endTime: 400, category: "morning", status: "open" },
      { startHour: 8, startTime: 480, endTime: 520, category: "morning", status: "booked" },
    ],
  };

  it("parses DD-MM-YYYY as day-first, not month-first", () => {
    // `new Date("29-07-2026")` is Invalid Date, and a padded US read would give 7 Jan.
    // Getting this backwards would block the wrong day's slots.
    const d = parseAvailabilityDate("29-07-2026");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6); // July, 0-indexed
    expect(d!.getDate()).toBe(29);
  });

  it("returns null for an unparseable date instead of an Invalid Date object", () => {
    expect(parseAvailabilityDate("2026-07-29")).toBeNull();
    expect(parseAvailabilityDate("")).toBeNull();
  });

  it("maps a day to ISO while keeping the original string for round-tripping", () => {
    const [day] = mapAvailability([realDay]);
    expect(day.date).toBe("2026-07-29");
    expect(day.rawDate).toBe("29-07-2026");
    expect(day.slots).toHaveLength(2);
    expect(day.slots[1].status).toBe("booked");
  });

  it("keeps startHour verbatim — it is the value the block endpoint takes", () => {
    const [day] = mapAvailability([realDay]);
    expect(day.slots.map((s) => s.startHour)).toEqual([6, 8]);
  });

  it("handles a day with no timeSlots array", () => {
    expect(mapAvailability([{ date: "29-07-2026" }])[0].slots).toEqual([]);
  });
});

describe("authored content", () => {
  it("maps articles captured from GET /therapist/:id/articles", () => {
    const [a] = mapArticles([
      {
        title: "Sports Physio: Recovery Tips",
        content: "Consistent movement and guided exercises accelerate recovery.",
        createdAt: "2026-07-22T14:07:50.295Z",
      },
    ]);
    expect(a.title).toBe("Sports Physio: Recovery Tips");
    // The read endpoint returns no id — the screen relies on this to block an unaddressable edit.
    expect(a.id).toBeUndefined();
  });

  it("maps faqs captured from GET /therapist/:id/faqs", () => {
    const [f] = mapFaqs([
      {
        question: "How many sessions will I need?",
        answer: "It depends on your condition, typically 6-10 sessions.",
      },
    ]);
    expect(f.question).toContain("How many sessions");
  });

  it("tolerates null lists", () => {
    expect(mapArticles(null as never)).toEqual([]);
    expect(mapFaqs(null as never)).toEqual([]);
    expect(mapReviews(null as never)).toEqual([]);
    expect(mapPayouts(null as never)).toEqual([]);
  });
});
