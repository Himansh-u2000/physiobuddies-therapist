import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDatabase } from "@/lib/db/provider";
import { getKv, setKv } from "@/lib/db/repositories";

/**
 * Notifications the therapist has removed from their list.
 *
 * ## Why this is local
 *
 * The backend has no delete route that anyone has confirmed: its notification API is list,
 * unread-count, mark-read and mark-all-read (BACKEND_TODO §2), and the `/notifications` mount
 * answers 401 to *every* unauthenticated path — real or not — so the route can't even be probed.
 * Rather than call a guessed `DELETE` and have "delete" silently fail, removal is recorded on this
 * device and the list filters on it. It survives restarts (SQLite, not memory); it does not follow
 * the therapist to another phone. When the server grows a delete endpoint, `removeNotifications`
 * is the one place to call it.
 *
 * Capped, newest kept, so the stored list can't grow without bound over months of use — an ID
 * old enough to fall off the end has long since aged out of the 50-row list it filters.
 */
const KV_KEY = "dismissed_notification_ids";
export const DISMISSED_CAP = 500;
const QUERY_KEY = ["notifications", "dismissed"] as const;

/** Merge newly dismissed ids in, newest last, deduplicated, keeping at most `cap`. */
export function mergeDismissed(existing: string[], added: string[], cap = DISMISSED_CAP): string[] {
  const addedSet = new Set(added);
  const merged = [...existing.filter((id) => !addedSet.has(id)), ...added];
  return merged.slice(Math.max(0, merged.length - cap));
}

export function parseDismissed(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function useDismissedNotifications() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (db ? parseDismissed(await getKv(db, KV_KEY)) : []),
    enabled: !!db,
    staleTime: Infinity,
  });
  const dismissed = useMemo(() => new Set(data ?? []), [data]);

  const dismiss = useCallback(
    async (ids: string[]) => {
      if (!db || ids.length === 0) return;
      // Re-read rather than trust the cached copy: two quick deletes must not overwrite each other.
      const next = mergeDismissed(parseDismissed(await getKv(db, KV_KEY)), ids);
      queryClient.setQueryData(QUERY_KEY, next);
      await setKv(db, KV_KEY, JSON.stringify(next));
    },
    [db, queryClient],
  );

  return { dismissed, dismiss, ready: !!db };
}
