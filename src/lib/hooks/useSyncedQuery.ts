import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "@/lib/db/provider";
import type { DrizzleDB } from "@/lib/db/provider";

interface SyncedQueryOptions<T> {
  queryKey: readonly unknown[];
  /** The real fetch — whatever `services.ts` already does (mock or live). */
  queryFn: () => Promise<T>;
  /** Read the last-known-good snapshot out of SQLite. `null`/`undefined` means no cache yet. */
  readCache: (db: DrizzleDB) => Promise<T | null | undefined>;
  /** Replace the SQLite snapshot with a fresh one after a successful fetch. */
  writeCache: (db: DrizzleDB, data: T) => Promise<void>;
}

interface SyncedQueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * SQLite-first read: the cached snapshot renders immediately while the network fetch runs
 * in the background and refreshes both the on-screen data and the cache once it lands.
 * `data` falls back to the cache whenever the network hasn't returned anything newer yet —
 * including after a failed refresh, so a therapist who goes offline mid-session keeps
 * seeing their last-known appointments/patients/etc. instead of an error wall. `isError`
 * is still exposed (and each screen still wires it to an ErrorState + retry) for the case
 * that actually needs it: first-ever launch, no cache yet, and the network fails too — the
 * one case with nothing to fall back on.
 *
 * Deliberately narrow return type (not TanStack's full `UseQueryResult`) — a generic
 * wrapper can't cleanly satisfy that discriminated union's `placeholderData` typing without
 * fighting `NonFunctionGuard<T>` on every call site; this exposes only what the screens
 * that use it actually read.
 */
export function useSyncedQuery<T>({ queryKey, queryFn, readCache, writeCache }: SyncedQueryOptions<T>): SyncedQueryResult<T> {
  const { db, ready } = useDatabase();
  const [cachedData, setCachedData] = useState<T | undefined>(undefined);

  useEffect(() => {
    if (!ready || !db) return;
    let cancelled = false;
    readCache(db)
      .then((data) => {
        if (!cancelled) setCachedData(data ?? undefined);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // readCache/writeCache are stable module-level functions per call site, not state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, db]);

  const query = useQuery({ queryKey, queryFn });

  useEffect(() => {
    if (query.isSuccess && db && query.data !== undefined) {
      writeCache(db, query.data).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.data, db]);

  return {
    data: query.data ?? cachedData,
    // Only show a loading state if there's truly nothing to show yet — a warm cache means
    // the network refresh happens quietly in the background, no skeleton flash.
    isLoading: query.isLoading && cachedData === undefined,
    isError: query.isError,
    refetch: () => query.refetch(),
  };
}
