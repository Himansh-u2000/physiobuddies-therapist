import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useQuery } from "@tanstack/react-query";
import { notificationApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";

/**
 * The unread badge number, from `GET /notifications/unread-count`.
 *
 * Deliberately its own endpoint rather than a `filter(n => !n.read).length` over the list: the
 * bell sits in `TopBar` on nearly every screen, and counting locally would mean every one of
 * them pulling 50 notification rows to render a dot.
 *
 * Every `TopBar` instance shares the one query key, so the mounted copies dedupe into a single
 * request. Polling is the only freshness signal available while the app is open — the count has
 * no push of its own — but an arriving notification also invalidates `["notifications"]`, which
 * matches this key by prefix and refreshes it immediately.
 *
 * As a side effect this keeps the OS badge in step, so the launcher icon does not keep showing
 * a count the therapist has already cleared.
 */
export function useUnreadNotifications(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: notificationApi.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unread = data ?? 0;

  useEffect(() => {
    if (!isAuthenticated) return;
    Notifications.setBadgeCountAsync(unread).catch(() => {});
  }, [unread, isAuthenticated]);

  return unread;
}
