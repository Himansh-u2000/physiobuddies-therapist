/**
 * The clinical-assessment submit path (POST /treatment-session/:id/assessment).
 *
 * Two things here are easy to break and expensive when broken, because the backend coerces
 * rather than rejects — a wrong value is stored as a *different clinical finding* instead of
 * failing loudly:
 *
 *  1. the techniques array is read from `treatmentPlan` on the way in but returned as
 *     `treatmentPlanItems`, so sending the read-name silently stores an empty list;
 *  2. a treatment draft queued by a build from *before* the clinical block existed has no
 *     `clinical` field at all, and must still produce a schema-valid payload rather than
 *     sitting in the sync queue failing forever.
 */
import { treatmentApi, type TreatmentSubmitPayload } from "@/lib/api/services";
import { client } from "@/lib/api/client";

jest.mock("@/constants/config", () => ({
  API_BASE_URL: "https://api.dev.physiobuddies.in/api/v1",
  OTP_CONFIG: { authOtpLength: 6, sessionOtpLength: 4, demoOtp: "123456", demoSessionOtp: "1234" },
  USE_MOCK_AUTH: true,
  USE_MOCK_PROFILE: true,
  USE_MOCK_DASHBOARD: true,
  USE_MOCK_APPOINTMENTS: true,
  USE_MOCK_EARNINGS: true,
  USE_MOCK_SESSION: true,
  USE_MOCK_NOTIFICATIONS: true,
  USE_MOCK_PATIENTS: true,
  USE_MOCK_PAYOUTS: true,
  USE_MOCK_AVAILABILITY: true,
  USE_MOCK_CONTENT: true,
  USE_MOCK_UPLOAD: true,
  // The flag under test — assessments go to the real branch.
  USE_MOCK_TREATMENT: false,
}));

jest.mock("@/lib/api/client", () => ({
  client: { post: jest.fn(), get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  toAuthTokens: jest.fn(),
}));

jest.mock("@/lib/storage/secure", () => ({ getTokens: jest.fn(), saveTokens: jest.fn() }));

const post = client.post as jest.Mock;

/** A draft as the sync queue reads it out of SQLite. */
function draft(overrides: Partial<TreatmentSubmitPayload> = {}): TreatmentSubmitPayload {
  return {
    sessionId: "6a79c0e6f0a3fb9b8f59ab42",
    appointmentId: "6a79a0f2af91e546c60bd28b",
    patientId: "PAT-2026-001",
    patientName: "Prem Raj",
    chiefComplaint: "Lower back pain",
    painRegions: [],
    painScales: {},
    assessmentFindings: [],
    treatmentsGiven: [],
    exercises: [],
    clinicalNotes: "",
    precautions: "",
    followUpRequired: false,
    attachments: [],
    elapsedSeconds: 0,
    checklist: [],
    ...overrides,
  };
}

describe("treatmentApi.submit", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: null });
  });

  /**
   * The plan id, not the session id. The endpoint moved to `/treatment-plan/:planId/assessment`
   * (verified live 2026-08-17: the old `/treatment-session/:id/assessment` now 404s), and the
   * two ids sit side by side on the payload, so posting the wrong one is a one-character
   * mistake that only shows up as a lost clinical form at the end of a visit.
   */
  it("posts to the treatment PLAN's assessment endpoint, keyed by appointmentId", async () => {
    await treatmentApi.submit(draft());
    expect(post.mock.calls[0][0]).toBe("/treatment-plan/6a79a0f2af91e546c60bd28b/assessment");
  });

  it("never addresses the assessment by the session id", async () => {
    await treatmentApi.submit(draft());
    expect(post.mock.calls[0][0]).not.toContain("6a79c0e6f0a3fb9b8f59ab42");
    expect(post.mock.calls[0][0]).not.toContain("/treatment-session/");
  });

  it("renames treatmentPlanItems to treatmentPlan, which is what the backend reads", async () => {
    await treatmentApi.submit(
      draft({
        clinical: {
          assessmentType: "ORTHO",
          chiefComplaint: ["Pain"],
          durationOfSymptoms: "ONE_TO_THREE_MONTHS",
          painScore: 5,
          painCharacteristics: ["Sharp"],
          rom: "Mild_Restriction",
          muscleStrength: "Normal",
          problemsIdentified: ["Decreased ROM"],
          treatmentPlanItems: ["Manual Therapy", "TENS"],
          visitFrequency: "Alternate_Days",
          hepGiven: true,
        },
      }),
    );
    const body = post.mock.calls[0][1];
    expect(body.treatmentPlan).toEqual(["Manual Therapy", "TENS"]);
    expect(body).not.toHaveProperty("treatmentPlanItems");
    expect(body.assessmentType).toBe("ORTHO");
    expect(body.painScore).toBe(5);
  });

  it("forwards the idempotency key as a header when one is supplied", async () => {
    await treatmentApi.submit(draft(), "key-123");
    expect(post.mock.calls[0][2]?.headers["Idempotency-Key"]).toBe("key-123");
  });

  describe("a legacy draft with no clinical block", () => {
    it("still produces every field the schema requires", async () => {
      await treatmentApi.submit(
        draft({
          painScales: { "Lower back": 7, Neck: 4 },
          painRegions: ["Lower back", "Neck"],
          assessmentFindings: [{ id: "rom", type: "rom", label: "Reduced ROM", details: {} }],
          treatmentsGiven: [{ id: "tens", type: "tens", label: "TENS", details: {} }],
          exercises: [{ id: "e1", name: "Bridging", reps: 10, sets: 3 }],
        }),
      );
      const body = post.mock.calls[0][1];
      expect(body.assessmentType).toBe("GENERAL");
      expect(body.durationOfSymptoms).toBe("ONE_TO_FOUR_WEEKS");
      expect(body.rom).toBe("Full");
      expect(body.muscleStrength).toBe("Normal");
      expect(body.visitFrequency).toBe("Weekly");
      expect(typeof body.hepGiven).toBe("boolean");
    });

    it("takes the pain score from the worst-scored region rather than defaulting to zero", async () => {
      await treatmentApi.submit(draft({ painScales: { "Lower back": 7, Neck: 4 } }));
      expect(post.mock.calls[0][1].painScore).toBe(7);
    });

    it("carries the therapist's own writing across instead of dropping it", async () => {
      await treatmentApi.submit(
        draft({
          assessmentFindings: [{ id: "rom", type: "rom", label: "Reduced ROM", details: {} }],
          treatmentsGiven: [{ id: "tens", type: "tens", label: "TENS", details: {} }],
          clinicalNotes: "Responded well",
          precautions: "No forward bending",
        }),
      );
      const body = post.mock.calls[0][1];
      expect(body.chiefComplaint).toEqual(["Lower back pain"]);
      expect(body.problemsIdentified).toEqual(["Reduced ROM"]);
      expect(body.treatmentPlan).toEqual(["TENS"]);
      expect(body.therapistNotes).toContain("Responded well");
      expect(body.therapistNotes).toContain("No forward bending");
    });

    it("marks hepGiven true only when exercises were actually prescribed", async () => {
      await treatmentApi.submit(draft({ exercises: [] }));
      expect(post.mock.calls[0][1].hepGiven).toBe(false);

      post.mockClear();
      await treatmentApi.submit(draft({ exercises: [{ id: "e", name: "Bridging", reps: 10, sets: 2 }] }));
      expect(post.mock.calls[0][1].hepGiven).toBe(true);
    });
  });
});

/**
 * The assessment URL is addressed by the treatment-SESSION id, and nothing in the app may
 * decorate or substitute it.
 *
 * This used to be pinned against `sessionApi.startFlagged` — the emergency no-OTP start, which
 * minted `flagged-session-${appointmentId}` and carried it through the whole visit, so the
 * completed assessment POSTed to `/treatment-session/flagged-session-<id>/assessment` and died
 * on `400 Invalid ObjectId format` at the worst possible moment. That entry point was deleted on
 * 2026-08-17, so the rule is pinned here instead, on the path that remains: whatever session id
 * a submit is handed is the id that reaches the wire.
 */
describe("assessment URL addressing", () => {
  const PLAN_ID = "6a7e0a3e3da564be59d868ad";

  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: null });
  });

  it("posts to the plan id it was given, undecorated", async () => {
    await treatmentApi.submit(draft({ appointmentId: PLAN_ID }));

    const url = post.mock.calls[0][0] as string;
    expect(url).toBe(`/treatment-plan/${PLAN_ID}/assessment`);
    // 24-char hex — what Mongo will accept as an ObjectId. A fabricated id failed both halves.
    expect(url.split("/")[2]).toMatch(/^[0-9a-f]{24}$/);
    expect(url).not.toContain("flagged-session-");
  });
});

/**
 * The visit outcome is SESSION-scoped, the opposite of the assessment above — mixing the two up
 * is the single easiest mistake to make in this module, so both are pinned.
 */
describe("treatmentApi.submitImprovementRecord", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: null });
  });

  it("posts to the SESSION id, and clamps pain scores into the server's 0–10 range", async () => {
    await treatmentApi.submitImprovementRecord("6a79c0e6f0a3fb9b8f59ab42", {
      painScoreBefore: 12.4,
      painScoreAfter: -3,
      improvementNotes: "Better range at the hip",
      exercisesGiven: ["Bridging"],
    });

    expect(post.mock.calls[0][0]).toBe(
      "/treatment-session/6a79c0e6f0a3fb9b8f59ab42/improvement-record",
    );
    const body = post.mock.calls[0][1];
    expect(body.painScoreBefore).toBe(10);
    expect(body.painScoreAfter).toBe(0);
    expect(body.exercisesGiven).toEqual(["Bridging"]);
  });

  it("omits the optional fields rather than sending nulls the validator would reject", async () => {
    await treatmentApi.submitImprovementRecord("6a79c0e6f0a3fb9b8f59ab42", {
      painScoreAfter: 4,
      improvementNotes: "Steady",
    });

    const body = post.mock.calls[0][1];
    expect(body).not.toHaveProperty("painScoreBefore");
    expect(body).not.toHaveProperty("exercisesGiven");
    expect(body.painScoreAfter).toBe(4);
  });
});
