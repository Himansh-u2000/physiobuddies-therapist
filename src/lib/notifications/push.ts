import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { notificationApi } from "@/lib/api/services";
import { COLORS, STORAGE_KEYS } from "@/constants/config";

/**
 * Device-token lifecycle for remote push, kept out of the React hook on purpose: the auth store
 * has to unregister on logout, and a store cannot call a hook.
 *
 * ## Which token this registers, and why it is not the Expo one
 *
 * The server sends push through **Firebase Cloud Messaging** (the Firebase credentials live in
 * `.env.*` as `NOTIFICATION_*`), so what it needs is an **FCM registration token** — the value
 * `Notifications.getDevicePushTokenAsync()` returns on Android. It is *not* an
 * `ExponentPushToken[…]`: that addresses Expo's own relay service, which is a different
 * delivery path this backend does not use, and handing one to a firebase-admin sender only
 * produces an unregistered-token error. The previous implementation registered exactly that.
 *
 * ## Android only, for now
 *
 * On iOS `getDevicePushTokenAsync()` returns a raw **APNs** token, which FCM cannot address
 * without the Firebase iOS SDK bridging it. Registering one would fill the server's token table
 * with values it can never deliver to, so iOS is skipped explicitly and reports its reason
 * rather than failing silently. See FCM_SETUP.md.
 */

/** Why registration did not happen — surfaced in the notification settings screen. */
export type PushRegistrationState =
  | "registered"
  | "denied" // the OS permission was refused
  | "unsupported-platform" // iOS: APNs token is not addressable by an FCM sender
  | "not-configured" // Android without google-services.json — no FCM project to register against
  | "failed";

export interface PushRegistrationResult {
  state: PushRegistrationState;
  token: string | null;
}

/**
 * Android notification channels. Android 8+ takes importance, sound and vibration from the
 * channel, not the message, so anything not created up front lands in a low-importance default
 * and never heads-up. The ids mirror the backend catalog's event families so a future
 * `android.channelId` on the payload has something to point at; until then everything arrives
 * on `default`.
 */
const CHANNELS = [
  { id: "default", name: "General", importance: Notifications.AndroidImportance.HIGH },
  { id: "sessions", name: "Sessions & bookings", importance: Notifications.AndroidImportance.MAX },
  { id: "reminders", name: "Session reminders", importance: Notifications.AndroidImportance.HIGH },
  { id: "payments", name: "Payments & payouts", importance: Notifications.AndroidImportance.DEFAULT },
  { id: "promotions", name: "Offers & updates", importance: Notifications.AndroidImportance.LOW },
] as const;

export async function configureChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        importance: c.importance,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: COLORS.accent,
      }),
    ),
  );
}

/** Ask only if not already granted — a repeat request is a no-op the OS may never re-prompt for. */
export async function ensurePermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getStoredPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.pushToken);
}

/**
 * Register a token we have ALREADY been handed, without asking the OS for it again.
 *
 * This split exists because of a loop that took the whole app down. On Android
 * `getDevicePushTokenAsync()` does not merely return the token — `PushTokenModule.kt` calls
 * `onNewToken(token)` immediately after resolving the promise, so **every fetch emits the
 * `onDevicePushToken` event**, not just a genuine roll. The push-token listener in
 * `useNotifications` reacted to that event by calling `registerDeviceToken(true)`, which fetches
 * again, which emits again — an unbounded loop, and with `force` set it did a real
 * `POST /notifications/device-token` on every pass.
 *
 * That is not a cosmetic leak. The API allows 10 000 requests per 15 minutes, so the loop burns
 * the whole budget and the server starts 429ing *every other* call in the app; `isRetryable`
 * classes 429 as transient, so React Query then retries into the same wall. It also floods the
 * 80-entry netlog, evicting the very requests anyone would need to diagnose it.
 *
 * So the listener passes the token the event already carried, and this function compares it to
 * the stored one and does nothing when it is unchanged. The cycle terminates after one pass even
 * when something re-fetches deliberately.
 */
export async function syncKnownDeviceToken(
  token: string,
  force = false,
): Promise<PushRegistrationResult> {
  if (!token) return { state: "not-configured", token: null };

  const stored = await getStoredPushToken();
  if (stored === token && !force) return { state: "registered", token };

  try {
    // A rotated token leaves the old row behind, and the server keys by token, not by device —
    // so retire the previous one explicitly or this user accumulates dead tokens that every
    // send still fans out to.
    if (stored && stored !== token) {
      await notificationApi.unregisterPushToken(stored).catch(() => {});
    }
    await notificationApi.registerPushToken(token);
    await SecureStore.setItemAsync(STORAGE_KEYS.pushToken, token);
    return { state: "registered", token };
  } catch {
    return { state: "failed", token };
  }
}

/**
 * In-flight de-duplication.
 *
 * Belt-and-braces against the loop above: the token event is emitted from native and can arrive
 * while a registration is still awaiting its POST, so identity of the *caller* is not enough to
 * serialise this. Concurrent callers share one attempt instead of stacking requests.
 */
let inFlight: Promise<PushRegistrationResult> | null = null;

/**
 * Acquire the device's FCM token and register it with the backend.
 *
 * Idempotent by design: the last registered value is kept in SecureStore and a POST is skipped
 * when it has not changed, so the common case (every authenticated app launch) is local-only.
 * `force` bypasses that for the manual retry on the notification settings screen, where the
 * point is to try the network again after a failure.
 *
 * Prefer `syncKnownDeviceToken` anywhere a token is already in hand — see its note on why
 * fetching has a side effect.
 */
export async function registerDeviceToken(force = false): Promise<PushRegistrationResult> {
  if (Platform.OS !== "android") {
    return { state: "unsupported-platform", token: null };
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    if (!(await ensurePermission())) return { state: "denied", token: null };
    await configureChannels();

    let token: string;
    try {
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      token = String(devicePushToken.data);
    } catch {
      // Thrown when the native Firebase app is missing — i.e. no `google-services.json` was
      // bundled at build time. That is a build-configuration gap, not a runtime error worth
      // retrying, so it gets its own state instead of "failed".
      return { state: "not-configured", token: null };
    }
    return syncKnownDeviceToken(token, force);
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Drop this device's token on sign-out, so the next person to hold the phone does not receive
 * the previous therapist's session and payout alerts.
 *
 * Call this **before** clearing the auth tokens: the DELETE is authenticated, and once the
 * access token is gone there is no credential left to authorize it. The local key is cleared
 * either way — a network failure must not leave a stale token that the next sign-in then skips
 * re-registering because the values happen to match.
 */
export async function unregisterDeviceToken(): Promise<void> {
  const stored = await getStoredPushToken();
  if (!stored) return;
  await notificationApi.unregisterPushToken(stored).catch(() => {});
  await SecureStore.deleteItemAsync(STORAGE_KEYS.pushToken).catch(() => {});
}
