import { upsertSessionDraft } from "@/lib/db/repositories/sessionsRepo";
import type { Session } from "@/types";

/**
 * Regression test for the Fable review-gate defect: active.tsx's tick interval survives
 * navigation (the screen stays mounted underneath /session/treatment and /session/complete
 * in the Stack), so it kept calling persistDraft — which called this function — after a
 * session had already been marked "completed". Offline, that silently reverted the queued
 * completion back to "active" before it could ever sync: a payout vanished with no error
 * anywhere. `active.tsx` and `session.store.ts` now stop the tick once the session is
 * inactive, but the DB is the actual durability boundary and shouldn't trust every caller
 * to get that right — this pins the guard that makes it true regardless: once a row is
 * "completed", nothing can silently downgrade it back to "active"/"paused".
 *
 * Exercises the real `upsertSessionDraft` against a hand-built Drizzle query-builder double
 * (not a mock of the repositories module) so the guard itself — not a stand-in for it — is
 * what's under test.
 */

function fakeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "s1",
    appointmentId: "a1",
    patientId: "p1",
    patientName: "Riya Sharma",
    condition: "Lower back pain",
    type: "home",
    status: "completed",
    startedAt: null,
    endedAt: 1_700_000_000_000,
    elapsedSeconds: 2700,
    checklist: JSON.stringify([{ id: "assessment", label: "Assessment", done: true }]),
    quickNote: "responded well",
    syncStatus: "pending",
    idempotencyKey: "idem-s1",
    syncAttempts: 0,
    nextRetryAt: 0,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

function fakeDb(existingRows: ReturnType<typeof fakeRow>[]) {
  const selectChain: { from: jest.Mock; where: jest.Mock; limit: jest.Mock } = {
    from: jest.fn(() => selectChain),
    where: jest.fn(() => selectChain),
    limit: jest.fn(async () => existingRows),
  };
  const onConflictDoUpdate = jest.fn(async () => {});
  const values = jest.fn(() => ({ onConflictDoUpdate }));
  const insertChain = { values };

  return {
    select: jest.fn(() => selectChain),
    insert: jest.fn(() => insertChain),
    _onConflictDoUpdate: onConflictDoUpdate,
    _insertValues: values,
  } as unknown as import("@/lib/db/provider").DrizzleDB & {
    _onConflictDoUpdate: jest.Mock;
    _insertValues: jest.Mock;
  };
}

const draftInput = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "s1",
  appointmentId: "a1",
  patientId: "p1",
  patientName: "Riya Sharma",
  condition: "Lower back pain",
  type: "home" as Session["type"],
  status: "active" as Session["status"],
  elapsedSeconds: 2710,
  checklist: [{ id: "assessment", label: "Assessment", done: true }],
  quickNote: "responded well",
  syncStatus: "synced" as Session["syncStatus"],
  ...overrides,
});

describe("upsertSessionDraft — completed-row downgrade guard", () => {
  it("refuses to revert a completed row back to active — the exact tick-after-submit case", async () => {
    const db = fakeDb([fakeRow({ status: "completed" })]);

    await upsertSessionDraft(db, draftInput({ status: "active" }));

    expect(db._insertValues).not.toHaveBeenCalled();
  });

  it("refuses to revert a completed row to paused either", async () => {
    const db = fakeDb([fakeRow({ status: "completed" })]);

    await upsertSessionDraft(db, draftInput({ status: "paused" }));

    expect(db._insertValues).not.toHaveBeenCalled();
  });

  it("still allows a write that keeps a completed row completed (idempotent re-writes)", async () => {
    const db = fakeDb([fakeRow({ status: "completed" })]);

    await upsertSessionDraft(db, draftInput({ status: "completed" }));

    expect(db._insertValues).toHaveBeenCalled();
  });

  it("allows ordinary writes when the existing row isn't completed yet", async () => {
    const db = fakeDb([fakeRow({ status: "active" })]);

    await upsertSessionDraft(db, draftInput({ status: "active", elapsedSeconds: 20 }));

    expect(db._insertValues).toHaveBeenCalled();
  });

  it("allows the very first write for a session that doesn't exist yet", async () => {
    const db = fakeDb([]);

    await upsertSessionDraft(db, draftInput({ status: "active" }));

    expect(db._insertValues).toHaveBeenCalled();
  });
});
