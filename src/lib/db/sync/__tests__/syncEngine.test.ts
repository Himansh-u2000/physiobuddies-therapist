import { flushPendingSync, nextBackoffMs } from "@/lib/db/sync/syncEngine";
import { sessionApi, treatmentApi } from "@/lib/api/services";
import {
  getPendingSyncTreatments,
  markTreatmentSyncResult,
  getPendingSyncSessions,
  markSessionSyncResult,
  getSessionById,
} from "@/lib/db/repositories";

/**
 * The queue exists to close a real bug: submitting a treatment / completing a session
 * offline used to just throw and lose the draft. These tests pin the two properties that
 * actually matter for money — a session's completion is never pushed before its treatment
 * record exists server-side, and a failed push is retried with backoff, never dropped or
 * hammered.
 */

jest.mock("@/lib/api/services", () => ({
  sessionApi: { complete: jest.fn() },
  treatmentApi: { submit: jest.fn() },
}));

jest.mock("@/lib/db/repositories", () => ({
  getPendingSyncTreatments: jest.fn(async () => []),
  markTreatmentSyncResult: jest.fn(async () => {}),
  treatmentRowToDomain: jest.fn((row) => row),
  getPendingSyncSessions: jest.fn(async () => []),
  markSessionSyncResult: jest.fn(async () => {}),
  sessionRowToDomain: jest.fn((row) => row),
  getSessionById: jest.fn(async () => null),
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

    await flushPendingSync(FAKE_DB);

    expect(sessionApi.complete).not.toHaveBeenCalled();
  });

  it("completes with the row's idempotency key and marks it synced", async () => {
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow()]);
    (sessionApi.complete as jest.Mock).mockResolvedValue({ payoutQueued: true });

    const result = await flushPendingSync(FAKE_DB);

    expect(sessionApi.complete).toHaveBeenCalledWith("s1", "idem-s1");
    expect(markSessionSyncResult).toHaveBeenCalledWith(
      FAKE_DB,
      "s1",
      expect.objectContaining({ syncStatus: "synced" }),
    );
    expect(result.sessionsSynced).toBe(1);
  });

  it("processes treatments before sessions, so a session-complete never races ahead of its treatment", async () => {
    const order: string[] = [];
    (getPendingSyncTreatments as jest.Mock).mockResolvedValue([treatmentRow()]);
    (getSessionById as jest.Mock).mockResolvedValue({ status: "completed" });
    (treatmentApi.submit as jest.Mock).mockImplementation(async () => {
      order.push("treatment");
      return { id: "server-t1" };
    });
    (getPendingSyncSessions as jest.Mock).mockResolvedValue([sessionRow()]);
    (sessionApi.complete as jest.Mock).mockImplementation(async () => {
      order.push("session");
      return { payoutQueued: true };
    });

    await flushPendingSync(FAKE_DB);

    expect(order).toEqual(["treatment", "session"]);
  });
});
