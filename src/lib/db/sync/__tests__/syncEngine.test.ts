import { flushPendingSync, flushPendingPhotoUploads, nextBackoffMs } from "@/lib/db/sync/syncEngine";
import { sessionApi, treatmentApi } from "@/lib/api/services";
import {
  getPendingSyncTreatments,
  markTreatmentSyncResult,
  getPendingSyncSessions,
  markSessionSyncResult,
  getSessionById,
  getTreatmentBySessionId,
  getPendingPhotoUploads,
  markPhotoSyncResult,
} from "@/lib/db/repositories";

/**
 * The queue exists to close a real bug: submitting a treatment / completing a session
 * offline used to just throw and lose the draft. These tests pin the properties that
 * actually matter for money — a session's completion is never pushed before its treatment
 * is *confirmed synced* server-side (not merely attempted in the same pass), overlapping
 * flush triggers share one execution instead of double-submitting, and a failed push is
 * retried with backoff, never dropped or hammered.
 */

jest.mock("@/lib/api/services", () => ({
  treatmentApi: { submit: jest.fn() },
  sessionApi: { addDocument: jest.fn() },
}));

jest.mock("@/lib/db/repositories", () => ({
  getPendingSyncTreatments: jest.fn(async () => []),
  markTreatmentSyncResult: jest.fn(async () => {}),
  treatmentRowToDomain: jest.fn((row) => row),
  getPendingSyncSessions: jest.fn(async () => []),
  markSessionSyncResult: jest.fn(async () => {}),
  getSessionById: jest.fn(async () => null),
  getTreatmentBySessionId: jest.fn(async () => ({ syncStatus: "synced" })),
  requeueErroredSessions: jest.fn(async () => {}),
  requeueErroredTreatments: jest.fn(async () => {}),
  getPendingPhotoUploads: jest.fn(async () => []),
  markPhotoSyncResult: jest.fn(async () => {}),
}));

const FAKE_DB = {} as never;

const treatmentRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "t1",
  sessionId: "s1",
  syncAttempts: 0,
  idempotencyKey: "idem-t1",
  ...overrides,
});

const sessionRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "s1",
  status: "completed",
  syncAttempts: 0,
  idempotencyKey: "idem-s1",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  (getTreatmentBySessionId as jest.Mock).mockResolvedValue({ syncStatus: "synced" });
});

describe("nextBackoffMs", () => {
  it("doubles from a 30s base", () => {
    expect(nextBackoffMs(0)).toBe(30_000);
    expect(nextBackoffMs(1)).toBe(60_000);
    expect(nextBackoffMs(2)).toBe(120_000);
  });

  it("caps at 30 minutes so a stuck row doesn't back off forever", () => {
    expect(nextBackoffMs(10)).toBe(30 * 60_000);
    expect(nextBackoffMs(30)).toBe(30 * 60_000);
  });
});

describe("flushPendingSync — treatments", () => {
  it("does not submit a treatment whose session hasn't been completed yet", async () => {
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow()]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "active" });

    const result = await flushPendingSync(FAKE_DB);

    expect(treatmentApi.submit).not.toHaveBeenCalled();
    expect(markTreatmentSyncResult).not.toHaveBeenCalled();
    expect(result.treatmentsSynced).toBe(0);
  });

  it("submits with the row's idempotency key once its session is completed, and marks it synced", async () => {
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow()]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "completed", elapsedSeconds: 900, checklist: [], quickNote: "" });
    (treatmentApi.submit as jest.Mock).mockResolvedValue({ id: "server-t1" });

    const result = await flushPendingSync(FAKE_DB);

    expect(treatmentApi.submit).toHaveBeenCalledWith(expect.anything(), "idem-t1");
    expect(markTreatmentSyncResult).toHaveBeenCalledWith(
      FAKE_DB,
      "t1",
      expect.objectContaining({ syncStatus: "synced", nextRetryAt: 0 }),
    );
    expect(result.treatmentsSynced).toBe(1);
  });

  it("on a retryable failure, stays pending with attempts incremented and a future retry time", async () => {
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow({ syncAttempts: 1 })]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "completed" });
    (treatmentApi.submit as jest.Mock).mockRejectedValue(Object.assign(new Error("network"), { isAxiosError: true }));

    const before = Date.now();
    const result = await flushPendingSync(FAKE_DB);

    expect(markTreatmentSyncResult).toHaveBeenCalledWith(
      FAKE_DB,
      "t1",
      expect.objectContaining({ syncStatus: "pending", syncAttempts: 2 }),
    );
    const [, , update] = (markTreatmentSyncResult as jest.Mock).mock.calls[0];
    expect(update.nextRetryAt).toBeGreaterThan(before);
    expect(result.failed).toBe(1);
  });
});

describe("flushPendingSync — sessions", () => {
  it("skips a pending row whose local status isn't completed (a live draft, not a completion)", async () => {
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow({ status: "active" })]);

    const result = await flushPendingSync(FAKE_DB);

    expect(markSessionSyncResult).not.toHaveBeenCalled();
    expect(result.sessionsSynced).toBe(0);
  });

  it("does not complete a session until its treatment is confirmed synced — attempted in the same pass is not enough", async () => {
    // The treatment loop ran (or even "succeeded" per some other bookkeeping) but the row
    // itself isn't actually synced yet — e.g. it parked as "error", or hasn't been reached.
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow()]);
    (getTreatmentBySessionId as jest.Mock).mockResolvedValue({ syncStatus: "pending" });

    const result = await flushPendingSync(FAKE_DB);

    expect(markSessionSyncResult).not.toHaveBeenCalled();
    expect(result.sessionsSynced).toBe(0);
  });

  it("treats a missing treatment record the same as not-yet-synced, not as nothing-to-wait-for", async () => {
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow()]);
    (getTreatmentBySessionId as jest.Mock).mockResolvedValue(null);

    const result = await flushPendingSync(FAKE_DB);

    expect(markSessionSyncResult).not.toHaveBeenCalled();
    expect(result.sessionsSynced).toBe(0);
  });

  // The completion itself is the assessment POST in the treatment loop — there is no separate
  // end-of-session call (the `.../my-bookings/:id/end` route this used to hit does not exist).
  // So "synced" here means: its treatment landed, therefore the server has already closed it.
  it("marks the session synced off its treatment, with no second network call", async () => {
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow()]);
    (getTreatmentBySessionId as jest.Mock).mockResolvedValue({ syncStatus: "synced" });

    const result = await flushPendingSync(FAKE_DB);

    expect(markSessionSyncResult).toHaveBeenCalledWith(
      FAKE_DB,
      "s1",
      expect.objectContaining({ syncStatus: "synced" }),
    );
    expect(result.sessionsSynced).toBe(1);
  });

  it("processes treatments before sessions, so a session is never marked synced ahead of its treatment", async () => {
    const order: string[] = [];
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow()]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "completed" });
    (treatmentApi.submit as jest.Mock).mockImplementation(async () => {
      order.push("treatment");
      return { id: "server-t1" };
    });
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow()]);
    (markSessionSyncResult as jest.Mock).mockImplementation(async () => {
      order.push("session");
    });

    await flushPendingSync(FAKE_DB);

    expect(order).toEqual(["treatment", "session"]);
  });
});

describe("flushPendingSync — single-flight", () => {
  it("shares one execution across overlapping calls instead of double-submitting", async () => {
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow()]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "completed" });
    (treatmentApi.submit as jest.Mock).mockResolvedValue({ id: "server-t1" });

    // Two overlapping triggers, as would happen from treatment.tsx's immediate flush racing
    // useSyncEngine's edge trigger — called back-to-back with no await between them, so the
    // second must hit the in-flight guard rather than starting its own pass.
    const [firstResult, secondResult] = await Promise.all([flushPendingSync(FAKE_DB), flushPendingSync(FAKE_DB)]);

    expect(treatmentApi.submit).toHaveBeenCalledTimes(1);
    expect(firstResult).toBe(secondResult);
  });

  it("runs a fresh flush on the next call once the in-flight one has settled", async () => {
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow()]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "completed" });
    (treatmentApi.submit as jest.Mock).mockResolvedValue({ id: "server-t1" });

    await flushPendingSync(FAKE_DB);
    await flushPendingSync(FAKE_DB);

    expect(treatmentApi.submit).toHaveBeenCalledTimes(2);
  });
});

const photoRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "photo1",
  sessionId: "s1",
  localUri: "file:///photo1.jpg",
  fileName: "session-s1-1.jpg",
  mimeType: "image/jpeg",
  syncAttempts: 0,
  ...overrides,
});

describe("flushPendingPhotoUploads", () => {
  const doc = {
    id: "server-p1",
    name: "session-s1-1.jpg",
    url: "https://api.dev.physiobuddies.in/api/v1/file/server-p1",
    fileType: "image/jpeg",
  };

  // Clinical files go through add-docs (private storage behind GET /file/:id), never through
  // the generic /file-upload/single, which writes to an ungated static path.
  it("uploads a queued file through the private clinical route and stores url + server id", async () => {
    (getPendingPhotoUploads as jest.Mock).mockResolvedValue([photoRow()]);
    (sessionApi.addDocument as jest.Mock).mockResolvedValue(doc);

    const result = await flushPendingPhotoUploads(FAKE_DB);

    expect(sessionApi.addDocument).toHaveBeenCalledWith("s1", "file:///photo1.jpg", "session-s1-1.jpg", "image/jpeg");
    expect(markPhotoSyncResult).toHaveBeenCalledWith(
      FAKE_DB,
      "photo1",
      // The id is what makes a retry safe: add-docs takes no Idempotency-Key, and
      // getPendingPhotoUploads refuses to return a row that already has one.
      expect.objectContaining({ syncStatus: "synced", remoteUrl: doc.url, remoteDocId: "server-p1" }),
    );
    expect(result.uploaded).toBe(1);
  });

  it("on a retryable failure, stays pending with backoff — the file is never dropped", async () => {
    (getPendingPhotoUploads as jest.Mock).mockResolvedValue([photoRow({ syncAttempts: 1 })]);
    (sessionApi.addDocument as jest.Mock).mockRejectedValue(Object.assign(new Error("network"), { isAxiosError: true }));

    const result = await flushPendingPhotoUploads(FAKE_DB);

    expect(markPhotoSyncResult).toHaveBeenCalledWith(
      FAKE_DB,
      "photo1",
      expect.objectContaining({ syncStatus: "pending", syncAttempts: 2 }),
    );
    expect(result.failed).toBe(1);
  });

  it("is single-flighted independently of the session/treatment queue", async () => {
    (getPendingPhotoUploads as jest.Mock).mockResolvedValue([photoRow()]);
    (sessionApi.addDocument as jest.Mock).mockResolvedValue(doc);

    const [first, second] = await Promise.all([flushPendingPhotoUploads(FAKE_DB), flushPendingPhotoUploads(FAKE_DB)]);

    expect(sessionApi.addDocument).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });
});
