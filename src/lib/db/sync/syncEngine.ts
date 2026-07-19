import { isRetryable, normalizeError } from "@/lib/api/errors";
import { sessionApi, treatmentApi, uploadApi } from "@/lib/api/services";
import type { DrizzleDB } from "../provider";
import {
  getPendingSyncTreatments,
  markTreatmentSyncResult,
  treatmentRowToDomain,
  getPendingSyncSessions,
  markSessionSyncResult,
  sessionRowToDomain,
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
    const session = sessionRowToDomain(row);
    try {
      await sessionApi.complete(session.id, row.idempotencyKey);
      await markSessionSyncResult(db, row.id, { syncStatus: "synced", syncAttempts: row.syncAttempts, nextRetryAt: 0 });
      sessionsSynced++;
    } catch (e) {
      await markSessionSyncResult(db, row.id, resultFor(e, row.syncAttempts));
      failed++;
    }
  }

  return { treatmentsSynced, sessionsSynced, failed };
}

/**
 * Flushes locally-queued session photo uploads. Deliberately separate from
 * `flushPendingSync` — a photo has no completion-ordering constraint (it can upload any
 * time during a live session, not just after submission) and no idempotency-key-on-payout
 * stakes; it's "get this file to the server eventually", not "never double-charge". Same
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
      const result = await uploadApi.uploadSessionPhoto(row.sessionId, row.localUri, row.fileName, row.mimeType);
      await markPhotoSyncResult(db, row.id, {
        syncStatus: "synced",
        syncAttempts: row.syncAttempts,
        nextRetryAt: 0,
        remoteUrl: result.url,
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
