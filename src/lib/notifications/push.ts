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
 * Acquire the device's FCM token and register it with the backend.
 *
 * Idempotent by design: the last registered value is kept in SecureStore and a POST is skipped
 * when it has not changed, so the common case (every authenticated app launch) is local-only.
 * `force` bypasses that for the token-refresh listener, where the value genuinely is new.
 */
export async function registerDeviceToken(force = false): Promise<PushRegistrationResult> {
  if (Platform.OS !== "android") {
    return { state: "unsupported-platform", token: null };
  }

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
