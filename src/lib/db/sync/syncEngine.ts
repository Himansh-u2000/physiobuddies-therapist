import { isRetryable, normalizeError } from "@/lib/api/errors";
import { sessionApi, treatmentApi } from "@/lib/api/services";
import type { DrizzleDB } from "../provider";
import {
  getPendingSyncTreatments,
  markTreatmentSyncResult,
  treatmentRowToDomain,
  getPendingSyncSessions,
  markSessionSyncResult,
  sessionRowToDomain,
  getSessionById,
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
 * Treatments are synced before sessions — a session can only be marked complete
 * server-side once its treatment record exists there. Each row carries its own
 * client-generated idempotency key (set once, at creation), so a retry after a dropped
 * response — offline, app killed mid-request — can never double-submit.
 *
 * Safe to call repeatedly and concurrently-ish: rows already synced or not yet due for
 * retry (`nextRetryAt` in the future) are simply not selected.
 */
export async function flushPendingSync(db: DrizzleDB): Promise<SyncResult> {
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
