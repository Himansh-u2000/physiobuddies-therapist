import { useEffect } from "react";
import { useDatabase } from "@/lib/db/provider";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { flushPendingSync, flushPendingPhotoUploads, requeueErroredSync } from "@/lib/db/sync/syncEngine";

const SAFETY_NET_INTERVAL_MS = 60_000;

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

  useEffect(() => {
    if (!ready || !db || !isOnline) return;
    flushPendingSync(db).catch(() => {});
    flushPendingPhotoUploads(db).catch(() => {});
  }, [ready, db, isOnline]);

  useEffect(() => {
    if (!ready || !db || !isOnline) return;
    const interval = setInterval(() => {
      flushPendingSync(db).catch(() => {});
      flushPendingPhotoUploads(db).catch(() => {});
    }, SAFETY_NET_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, db, isOnline]);

  useEffect(() => {
    if (!ready || !db || !isAuthenticated) return;
    requeueErroredSync(db)
      .then(() => flushPendingSync(db))
      .catch(() => {});
  }, [ready, db, isAuthenticated]);
}
