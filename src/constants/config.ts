export const COLORS = {
  bg: "#e9f6fe",
  surface: "#f5fffe",
  surfaceStrong: "#ffffff",
  fg: "#021526",
  muted: "#5e6b77",
  border: "#cfd9df",
  accent: "#004060",
  accentLight: "#004e71",
  accentDark: "#003d5e",
  success: "#239149",
  successLight: "#349e54",
  successDark: "#138840",
  warning: "#d19a12",
  danger: "#cf4238",
  info: "#0086a8",
  tint: "#e8fbfa",
  nav: "#003554",
  primarySoft: "#d7f2ff",
  mintSoft: "#e0fbef",
} as const;

export const GRADIENTS = {
  accent: ["#004e71", "#003d5e"],
  success: ["#349e54", "#138840"],
  earning: ["#00486b", "#006071"],
  nav: ["#003554", "#006071"],
} as const;

export const RADII = {
  sm: 8,
  md: 12,
  lg: 18,
} as const;

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.physiobuddies.in/api/v1";

/** `__DEV__` is injected by Metro and is absent under Jest/node — probe before reading it. */
const IS_DEV = typeof __DEV__ !== "undefined" && __DEV__;

/** Resolve a boolean env flag: unset -> fallback; else anything but "false" is true. */
function envFlag(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value !== "false";
}

/**
 * In-app network log (`/network-log`, entry point in Profile → Support).
 *
 * Defaults to ON in dev and OFF otherwise, but the local review APK
 * (`scripts/build-local-apk.ps1`) turns it on explicitly: that build is a *release* build with
 * no Metro attached, so `console.log` and Chrome DevTools are both unavailable — the in-app log
 * is the only way to see a request payload on the device. Keep it OFF for store builds: it
 * holds patient data in memory, and the screen can share it out.
 */
export const NETWORK_LOG_ENABLED = envFlag(process.env.EXPO_PUBLIC_ENABLE_NETWORK_LOG, IS_DEV);

/**
 * Show the session OTP the backend echoes back to the therapist.
 *
 * `POST /treatment-session/:id/send-otp` currently returns the generated code in its own
 * response so the flow can be tested on a single handset — the therapist doesn't need the
 * patient's phone to try it. That is a TESTING affordance and a real one-time-password leak:
 * anyone holding the therapist's device could start a visit the patient never consented to.
 *
 * So it is gated here rather than rendered whenever the field happens to be present. Defaults
 * to `__DEV__`; `.env` turns it on for local + review builds and `.env.production` pins it
 * `false`. When the backend stops echoing the code this flag simply stops having anything to
 * show — no app change needed.
 */
export const SHOW_TEST_OTP = envFlag(process.env.EXPO_PUBLIC_SHOW_TEST_OTP, IS_DEV);

/**
 * In-app subscription billing switch. OFF because the backend does not yet charge for or activate
 * a therapist subscription: it's created for free during final onboarding (a literal
 * `// TODO: payment for subscription` in `therapistMeta.service`), and `payment.verifyPayment` only
 * finalizes patient session bookings — a `purpose:"subscription"` payment would take money and
 * activate nothing. The subscription screen's checkout is scaffolded behind this single flag so no
 * therapist is ever charged for a subscription that wouldn't turn on. Flip to `true` only once the
 * backend links a subscription-purpose payment to creating/extending the `Subscription` record.
 */
export const SUBSCRIPTION_PAYMENT_ENABLED = false;

/**
 * Auth configuration.
 *
 * `googleWebClientId` is gone with the Google Sign-In removal (2026-08-17) — along with the
 * `@react-native-google-signin` native module, its `app.json` plugin entry, and the Google
 * Cloud Android-OAuth-client blocker that was holding that button up. Sign-in is
 * email/password only; `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` is no longer read anywhere.
 */
export const AUTH_CONFIG = {
  /** Re-lock the app (require biometric again) after this long in the background. */
  biometricRelockMs: 2 * 60 * 1000,
} as const;

/** Where "Help & support" writes to. Single source so the address can't drift between screens. */
export const SUPPORT_EMAIL = "support@physiobuddies.in";

/**
 * The backend's slot grid, mirrored from `src/core/constants/slots.ts` server-side.
 * 16 slots a day, each 40 min of session + 20 min break, starting on the hour from 06:00 to
 * 21:00. `startHour` is the identifier every slot endpoint speaks in.
 */
export const SLOT_CONFIG = {
  startHour: 6,
  endHour: 21,
  durationMin: 40,
  /** Shift buckets, matching the backend's `getCategoryForHour`. */
  shifts: [
    { id: "morning", label: "Morning", from: 6, to: 11 },
    { id: "evening", label: "Afternoon", from: 12, to: 17 },
    { id: "night", label: "Evening", from: 18, to: 21 },
  ],
} as const;

export type SlotShiftId = (typeof SLOT_CONFIG.shifts)[number]["id"];

/** Weekday keys as the weekly-schedule endpoint spells them, Monday-first for display. */
export const WEEKDAYS = [
  { id: "monday", short: "Mon" },
  { id: "tuesday", short: "Tue" },
  { id: "wednesday", short: "Wed" },
  { id: "thursday", short: "Thu" },
  { id: "friday", short: "Fri" },
  { id: "saturday", short: "Sat" },
  { id: "sunday", short: "Sun" },
] as const;

export type WeekdayId = (typeof WEEKDAYS)[number]["id"];

export const STORAGE_KEYS = {
  accessToken: "pb_access_token",
  refreshToken: "pb_refresh_token",
  tokenExpiry: "pb_token_expiry",
  therapistProfile: "pb_therapist_profile",
  biometricEnabled: "pb_biometric_enabled",
  phone: "pb_phone",
  email: "pb_email",
  pushToken: "pb_push_token",
  preferences: "pb_preferences",
  /** SQLCipher key for the local SQLite cache — device-scoped, survives logout/login. */
  dbEncryptionKey: "pb_db_key",
} as const;

export const OTP_CONFIG = {
  authOtpLength: 6,
  /**
   * The start-of-session code the patient reads out — **6 digits**, corrected 2026-08-18.
   *
   * It was 4 here, which silently broke the whole flow rather than failing visibly: `OTPInput`
   * rendered four boxes, so a therapist could never enter the last two digits of a real code,
   * and the "Verify & start session" button unlocked at four — submitting a truncated code that
   * the server could only reject. Every screen that mentions the length now interpolates this
   * value instead of hardcoding a numeral, so the two can't drift apart again.
   */
  sessionOtpLength: 6,
  resendCooldownSec: 30,
} as const;

export const SESSION_CONFIG = {
  defaultDurationSec: 45 * 60,
  checklistDefaults: [
    { id: "assessment", label: "Assessment and pain mapping", done: false },
    { id: "manual", label: "Manual therapy / manipulation", done: false },
    { id: "exercises", label: "Exercises explained to patient", done: false },
    { id: "photo", label: "Session photo uploaded", done: false },
  ],
} as const;
