import { useEffect } from "react";
import { useDatabase } from "@/lib/db/provider";
import { useAppStore } from "@/lib/stores/app.store";
import { flushPendingSync } from "@/lib/db/sync/syncEngine";

const SAFETY_NET_INTERVAL_MS = 60_000;

/**
 * Drives the offline sync queue. Mounted once in the root layout (alongside `useAppLock`,
 * `useNetwork`), not per-screen. Two triggers:
 *  - Edge-triggered: fires whenever the DB becomes ready or connectivity flips to online —
 *    covers cold start-while-online and the reconnect moment itself.
 *  - Periodic safety net while online: catches rows whose exponential-backoff window has
 *    elapsed since the last edge trigger, without needing another connectivity flip.
 * Failures are swallowed here — `flushPendingSync` already persists per-row outcomes
 * (pending-with-backoff or error) to SQLite; there's nothing further to do with the promise.
 */
export function useSyncEngine() {
  const { db, ready } = useDatabase();
  const isOnline = useAppStore((s) => s.isOnline);

  useEffect(() => {
    if (!ready || !db || !isOnline) return;
    flushPendingSync(db).catch(() => {});
  }, [ready, db, isOnline]);

  useEffect(() => {
    if (!ready || !db || !isOnline) return;
    const interval = setInterval(() => {
      flushPendingSync(db).catch(() => {});
    }, SAFETY_NET_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [ready, db, isOnline]);
}
