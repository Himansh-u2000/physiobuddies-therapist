import { useCallback, useEffect } from "react";
import { useDatabase } from "@/lib/db/provider";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { flushPendingSync, flushPendingPhotoUploads, requeueErroredSync } from "@/lib/db/sync/syncEngine";
import { getSyncQueueCounts } from "@/lib/db/repositories";
import type { DrizzleDB } from "@/lib/db/provider";

const SAFETY_NET_INTERVAL_MS = 60_000;

/**
 * Re-read the queue depth into `app.store` so the UI can show it. Called after every flush
 * (a successful one drains it, a failed one doesn't) and on the same triggers as the flush
 * itself, so a stuck record shows up without its own polling loop.
 */
async function refreshCounts(db: DrizzleDB): Promise<void> {
  const counts = await getSyncQueueCounts(db);
  useAppStore.getState().setSyncCounts(counts);
}

/** Flush, then publish the resulting queue depth. Never rejects — see the note below. */
function flushAndRefresh(db: DrizzleDB): Promise<void> {
  return Promise.all([flushPendingSync(db), flushPendingPhotoUploads(db)])
    .then(() => refreshCounts(db))
    .catch(() => {});
}

/**
 * Drives the offline sync queue. Mounted once in the root layout (alongside `useAppLock`,
 * `useNetwork`), not per-screen. Three triggers:
 *  - Edge-triggered: fires whenever the DB becomes ready or connectivity flips to online —
 *    covers cold start-while-online and the reconnect moment itself.
 *  - Periodic safety net while online: catches rows whose exponential-backoff window has
 *    elapsed since the last edge trigger, without needing another connectivity flip.
 *  - On (re-)authentication: a completion that failed with a non-retryable error (most
 *    commonly a 401 from a refresh token that died while offline) is parked as "error" and
 *    the ordinary retry loop won't touch it again. A fresh sign-in is the signal that the
 *    auth problem is resolved, so re-queue those rows for one more try rather than leaving
 *    them stuck forever with no UI surfacing them.
 * Failures are swallowed here — `flushPendingSync` already persists per-row outcomes
 * (pending-with-backoff or error) to SQLite; there's nothing further to do with the promise.
 */
export function useSyncEngine() {
  const { db, ready } = useDatabase();
  const isOnline = useAppStore((s) => s.isOnline);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Read the queue as soon as the DB opens, before any flush. Going offline and relaunching
  // must still show what's waiting, and none of the flush triggers fire in that state.
  useEffect(() => {
    if (!ready || !db) return;
    refreshCounts(db).catch(() => {});
  }, [ready, db]);

  useEffect(() => {
    if (!ready || !db || !isOnline) return;
    flushAndRefresh(db);
  }, [ready, db, isOnline]);

  useEffect(() => {
    if (!ready || !db || !isOnline) return;
    const interval = setInterval(() => flushAndRefresh(db), SAFETY_NET_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, db, isOnline]);

  useEffect(() => {
    if (!ready || !db || !isAuthenticated) return;
    requeueErroredSync(db)
      .then(() => flushAndRefresh(db))
      .catch(() => {});
  }, [ready, db, isAuthenticated]);
}

/**
 * The manual counterpart to the automatic triggers above, for the "Try again" on the
 * sync-status card. Un-parks `error` rows first — the whole point of a manual retry is the
 * rows the automatic loop has given up on — then flushes and republishes the count.
 */
export function useRetrySync() {
  const { db, ready } = useDatabase();

  return useCallback(async () => {
    if (!ready || !db) return;
    await requeueErroredSync(db).catch(() => {});
    await flushAndRefresh(db);
  }, [ready, db]);
}
