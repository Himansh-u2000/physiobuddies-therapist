import { isRetryable, normalizeError } from "@/lib/api/errors";
import { sessionApi, treatmentApi } from "@/lib/api/services";
import type { DrizzleDB } from "../provider";
import {
  getPendingSyncTreatments,
  markTreatmentSyncResult,
  treatmentRowToDomain,
  getPendingSyncSessions,
  markSessionSyncResult,
  getSessionById,
  getTreatmentBySessionId,
  requeueErroredSessions,
  requeueErroredTreatments,
  getPendingPhotoUploads,
  markPhotoSyncResult,
} from "../repositories";

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 30 * 60_000;

/** `attempts` is the failure count going INTO this attempt (0 on the first try). */
export function nextBackoffMs(attempts: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attempts, MAX_BACKOFF_MS);
}

export interface SyncResult {
  treatmentsSynced: number;
  sessionsSynced: number;
  failed: number;
}

type SyncStatusUpdate = { syncStatus: "pending" | "error"; syncAttempts: number; nextRetryAt: number };

/** Persist the outcome of one sync attempt — retryable failures stay "pending" with a
 *  backed-off `nextRetryAt`; anything else (validation, 404 — the record was deleted
 *  server-side, etc.) is parked as "error" so the queue stops hammering it forever. */
function resultFor(err: unknown, attempts: number): SyncStatusUpdate {
  const apiErr = normalizeError(err);
  const retryable = isRetryable(apiErr);
  return {
    syncStatus: retryable ? "pending" : "error",
    syncAttempts: attempts + 1,
    nextRetryAt: retryable ? Date.now() + nextBackoffMs(attempts) : 0,
  };
}

/**
 * Flushes locally-queued treatment submissions and session completions to the server.
 * Treatments are synced before sessions, and a session is only pushed once its treatment
 * is actually confirmed `synced` — not merely attempted in the same pass — so the server
 * can never end up with a completed session and no treatment record. Each row carries its
 * own client-generated idempotency key (set once, at creation), so a retry after a dropped
 * response — offline, app killed mid-request — can never double-submit *on the client side*
 * (the backend doesn't dedupe on it yet — see `progress.md` blocker #4).
 *
 * Single-flighted: `useSyncEngine` can trigger this from three independent places (an
 * immediate post-submit call, a reconnect edge, a periodic safety net) that can easily
 * overlap. Without this, two overlapping flushes would both select the same pending row
 * before either marks it synced, sending the same submission twice.
 */
let inFlight: Promise<SyncResult> | null = null;
export function flushPendingSync(db: DrizzleDB): Promise<SyncResult> {
  inFlight ??= runFlush(db).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runFlush(db: DrizzleDB): Promise<SyncResult> {
  const now = Date.now();
  let treatmentsSynced = 0;
  let sessionsSynced = 0;
  let failed = 0;

  const pendingTreatments = await getPendingSyncTreatments(db, now);
  for (const row of pendingTreatments) {
    const treatment = treatmentRowToDomain(row);
    const session = await getSessionById(db, treatment.sessionId);
    // `syncStatus: pending` is set the moment a draft is autosaved, not just on submit —
    // the gate for actually calling the network is the session being "completed", not the
    // treatment row's own status, otherwise an in-progress draft would get submitted early.
    if (session?.status !== "completed") continue;
    try {
      await treatmentApi.submit(
        {
          ...treatment,
          elapsedSeconds: session?.elapsedSeconds ?? 0,
          checklist: session?.checklist ?? [],
          quickNote: session?.quickNote,
        },
        row.idempotencyKey,
      );
      await markTreatmentSyncResult(db, row.id, { syncStatus: "synced", syncAttempts: row.syncAttempts, nextRetryAt: 0 });
      treatmentsSynced++;
    } catch (e) {
      await markTreatmentSyncResult(db, row.id, resultFor(e, row.syncAttempts));
      failed++;
    }
  }

  const pendingSessions = await getPendingSyncSessions(db, now);
  for (const row of pendingSessions) {
    // A session still "active" locally has nothing to sync yet — it's just a live draft,
    // not a completion. Only "completed" sessions represent a real outbound call.
    if (row.status !== "completed") continue;
    // Ordering above (treatments looped first) is only an attempt order, not a guarantee —
    // a treatment can fail or park as "error" in the same pass. Require its actual synced
    // state before pushing the completion, or the server can end up with a completed
    // session and no treatment record. Every completed session has exactly one treatment
    // by construction (handleSubmit writes both) — a missing one here is treated the same
    // as "not synced yet", not as "nothing to wait for".
    const treatment = await getTreatmentBySessionId(db, row.id);
    if (treatment?.syncStatus !== "synced") continue;
    // No second network call: **the assessment POST above IS the completion.**
    // `POST /treatment-plan/:planId/assessment` flips the plan's `active` session to
    // `completed` and writes the status log server-side, so by the time the treatment row is
    // `synced` the session is already closed on the server.
    //
    // This used to POST `.../my-bookings/:id/end` (`sessionApi.complete`), a route that
    // has never existed (verified 2026-08-18: Express answers its unmatched-route 404). Every
    // completed visit therefore failed here and retried until the row parked as `error`, which
    // is what surfaced as a permanently "unsynced" session in the UI despite the server having
    // the record.
    //
    // The API's other completion route, `POST /treatment-session/:id/improvement-record`, is
    // NOT a drop-in replacement: it requires `painScoreAfter` and `improvementNotes`, and
    // nothing in the app collects either. Synthesising them here would write invented numbers
    // into a patient's clinical record. It needs a screen first — tracked in BACKEND_TODO §1.9.
    await markSessionSyncResult(db, row.id, { syncStatus: "synced", syncAttempts: row.syncAttempts, nextRetryAt: 0 });
    sessionsSynced++;
  }

  return { treatmentsSynced, sessionsSynced, failed };
}

/**
 * Flushes locally-queued session photo uploads. Deliberately separate from
 * `flushPendingSync` — a file has no completion-ordering constraint (it can upload any
 * time during a live session, not just after submission) and no payout stakes; it's "get this
 * file to the server eventually", not "never double-charge". It does still need de-duplication,
 * which is enforced by the stored document id rather than an idempotency key — see below. Same
 * backoff policy and single-flight guard as the main queue, for the same reasons: capture
 * (`active.tsx`'s handleCapturePhoto) can trigger an immediate flush that races
 * `useSyncEngine`'s edge/interval triggers.
 */
export interface PhotoSyncResult {
  uploaded: number;
  failed: number;
}

let photoInFlight: Promise<PhotoSyncResult> | null = null;
export function flushPendingPhotoUploads(db: DrizzleDB): Promise<PhotoSyncResult> {
  photoInFlight ??= runPhotoFlush(db).finally(() => {
    photoInFlight = null;
  });
  return photoInFlight;
}

async function runPhotoFlush(db: DrizzleDB): Promise<PhotoSyncResult> {
  const now = Date.now();
  let uploaded = 0;
  let failed = 0;

  const pending = await getPendingPhotoUploads(db, now);
  for (const row of pending) {
    try {
      // `sessionApi.addDocument`, NOT the generic uploader. These are photographs of a patient
      // and their clinical documents: `add-docs` stores them in the server's private area behind
      // `GET /api/v1/file/:id`, whereas `/file-upload/single` — what this used to call — puts
      // them on an ungated static path. The server id is persisted alongside the url because the
      // endpoint has no `Idempotency-Key`, and `getPendingPhotoUploads` refuses to hand back a
      // row that already has one; without that a lost response means the same photo is attached
      // to the plan twice.
      const doc = await sessionApi.addDocument(
        row.sessionId,
        row.localUri,
        row.fileName,
        row.mimeType,
      );
      await markPhotoSyncResult(db, row.id, {
        syncStatus: "synced",
        syncAttempts: row.syncAttempts,
        nextRetryAt: 0,
        remoteUrl: doc.url,
        remoteDocId: doc.id,
      });
      uploaded++;
    } catch (e) {
      await markPhotoSyncResult(db, row.id, resultFor(e, row.syncAttempts));
      failed++;
    }
  }

  return { uploaded, failed };
}

/**
 * Non-retryable failures (validation, 404, and — the one that matters here — 401 from a
 * dead refresh token) park a row as `syncStatus: "error"` so the queue stops hammering it.
 * But a 401 during an offline-then-reconnect completion isn't really permanent — it just
 * means the session died before the app could refresh it. Re-queuing "error" rows whenever
 * the user successfully (re-)authenticates gives them another chance instead of leaving a
 * payout silently stuck forever with no UI surfacing it.
 */
export async function requeueErroredSync(db: DrizzleDB): Promise<void> {
  await Promise.all([requeueErroredSessions(db), requeueErroredTreatments(db)]);
}
