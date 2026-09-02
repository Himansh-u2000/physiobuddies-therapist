import * as Notifications from "expo-notifications";
import { useEffect, useRef, useCallback } from "react";
import { useRouter, useRootNavigationState } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/stores/auth.store";
import { toAppHref } from "@/lib/notifications/links";
import { registerDeviceToken, syncRotatedToken } from "@/lib/notifications/push";

/**
 * How an arriving notification behaves while the app is in the foreground. Without a handler
 * expo-notifications shows nothing at all when the app is open, so a therapist mid-session would
 * miss a cancellation until they next pulled the list.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Read the deep link out of a push payload.
 *
 * The backend's notification catalog puts it on the push body as `url` — the same web path its
 * `metadata.url` carries for the in-app row (`/therapist/my-bookings/<planId>`). FCM hands the
 * message's `data` map through to `content.data` unchanged. `actionUrl` and `link` are accepted
 * too so the app does not break if the sender renames the field; `toAppHref` handles the
 * unknown-link case, so a miss here is not fatal.
 */
function readLink(notification: Notifications.Notification): string | undefined {
  const data = notification.request.content.data as Record<string, unknown> | undefined;
  for (const key of ["url", "actionUrl", "link"]) {
    const value = data?.[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/**
 * Present a data-only push ourselves.
 *
 * The server sends through FCM as **web push**, and a web-push payload puts its title and body
 * inside `webpush.notification` rather than the common `notification` block. A message that
 * reaches this device carrying only a `data` map therefore displays nothing, even though the
 * text is right there — so re-emit it as a local notification.
 *
 * Limited to the foreground on purpose: a data-only message delivered while the app is killed
 * never reaches JS at all, and rescuing that case needs a background task (`expo-task-manager`,
 * not a dependency here) *and* the sender setting the FCM `data` payload deliberately. The real
 * fix is server-side — see BACKEND_TODO.md — this only keeps an open app from silently dropping
 * an alert.
 */
async function presentIfSilent(notification: Notifications.Notification): Promise<void> {
  const content = notification.request.content;
  if (content.title || content.body) return; // already displayable
  const data = content.data as Record<string, unknown> | undefined;
  const title = typeof data?.title === "string" ? data.title : undefined;
  const body = typeof data?.body === "string" ? data.body : undefined;
  if (!title && !body) return;

  await Notifications.scheduleNotificationAsync({
    content: { title: title ?? "Physiobuddies", body: body ?? "", data: data ?? {} },
    trigger: null,
  }).catch(() => {});
}

export function useNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const navState = useRootNavigationState();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isLocked = useAuthStore((s) => s.isLocked);

  /**
   * Covers the cold-start tap as well as taps while running: the hook replays the most recent
   * response once the JS context exists, which a plain `addNotificationResponseReceivedListener`
   * subscribed inside an effect would already have missed.
   */
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);

  /**
   * Deliberately returns the result rather than holding it in state. This hook runs in the ROOT
   * layout, so a `useState` here re-renders every screen in the app — and the registration
   * outcome is read only by the notification settings screen, which calls
   * `registerDeviceToken` directly and keeps its own copy.
   */
  const register = useCallback(() => registerDeviceToken(), []);

  /**
   * A token can roll while the app is running; the old one stops delivering the moment it does.
   *
   * Uses the token the event carries, via `syncRotatedToken`. Re-fetching it here instead (what
   * this did) re-enters `getDevicePushTokenAsync`, whose Android implementation emits this very
   * event on success — an unbounded loop of `POST /notifications/device-token` that starved
   * every other request in the app. See the header comment in `lib/notifications/push.ts`.
   */
  useEffect(() => {
    const sub = Notifications.addPushTokenListener((token) => {
      if (!useAuthStore.getState().isAuthenticated) return;
      void syncRotatedToken(String(token.data)).catch(() => {});
    });
    return () => sub.remove();
  }, []);

  // An arriving push means the server-side list has a new row — refresh it and the badge count
  // so the bell and the notifications screen agree with the tray.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      void presentIfSilent(notification);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    });
    return () => sub.remove();
  }, [queryClient]);

  /**
   * Route on tap.
   *
   * Held back until the router exists and the app is past its gates: navigating while the auth
   * or biometric-lock redirect in `_layout` is still resolving gets the push destination
   * replaced a frame later, which looks exactly like a tap that did nothing. The response is
   * cleared once consumed so a later re-render cannot navigate a second time.
   */
  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    if (!navState?.key || !isHydrated || !isAuthenticated || isLocked) return;

    const id = lastResponse.notification.request.identifier;
    if (handledResponse.current === id) return;
    handledResponse.current = id;

    const href = toAppHref(readLink(lastResponse.notification));
    Notifications.clearLastNotificationResponse();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    router.push(href);
  }, [lastResponse, navState?.key, isHydrated, isAuthenticated, isLocked, router, queryClient]);

  return { registerForPushNotifications: register };
}
