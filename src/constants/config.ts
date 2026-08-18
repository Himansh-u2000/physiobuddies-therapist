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

/** Resolve a boolean env flag: unset -> fallback; else anything but "false" is true. */
function envFlag(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value !== "false";
}

/** Global mock switch — mocks every API domain unless a per-domain flag overrides it. */
export const USE_MOCK_API = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_API, true);

/**
 * Auth-specific mock switch. Phase 2 wires the real auth endpoints (they exist on the
 * backend) while dashboard/session/etc. stay on mock. Set EXPO_PUBLIC_USE_MOCK_AUTH=false
 * to exercise real auth against the backend while the rest of the app remains mocked.
 * Falls back to the global flag when unset.
 */
export const USE_MOCK_AUTH = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_AUTH, USE_MOCK_API);

/**
 * Per-domain mock switches (Phase 5 backend integration). Domains whose backend endpoints
 * are implemented fall back to the global flag, so `EXPO_PUBLIC_USE_MOCK_API=false` turns them
 * all real at once. Each can also be pinned independently for staged rollout / debugging.
 */
export const USE_MOCK_PROFILE = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_PROFILE, USE_MOCK_API);
export const USE_MOCK_DASHBOARD = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_DASHBOARD, USE_MOCK_API);
export const USE_MOCK_APPOINTMENTS = envFlag(
  process.env.EXPO_PUBLIC_USE_MOCK_APPOINTMENTS,
  USE_MOCK_API,
);
export const USE_MOCK_EARNINGS = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_EARNINGS, USE_MOCK_API);
/** Payouts: GET /therapist/payout (+ /:id) and POST /therapist/payout/request — all verified live. */
export const USE_MOCK_PAYOUTS = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_PAYOUTS, USE_MOCK_API);
/** Uploads: POST /file-upload/single (multer field `file`) — verified live. */
export const USE_MOCK_UPLOAD = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_UPLOAD, USE_MOCK_API);
/** Availability: GET /therapist/:id/availability, POST/DELETE /therapist/slots/block, /leaves. */
export const USE_MOCK_AVAILABILITY = envFlag(
  process.env.EXPO_PUBLIC_USE_MOCK_AVAILABILITY,
  USE_MOCK_API,
);
/** Therapist-authored content: /therapist/articles + /therapist/faqs CRUD, read via /therapist/:id/*. */
export const USE_MOCK_CONTENT = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_CONTENT, USE_MOCK_API);

/**
 * Session lifecycle — REAL as of the `api.dev.physiobuddies.in` backend. The whole chain is
 * implemented and was probed live: PATCH /therapist/sessions/my-bookings/:id/accept,
 * POST .../generate-otp, .../verify-otp (flips the session to `active`), .../end, plus
 * POST /treatment-session/:id/{start,complete,cancel,no-show,add-docs}. Follows the global flag.
 */
export const USE_MOCK_SESSION = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_SESSION, USE_MOCK_API);
/**
 * Clinical assessment — REAL: `GET`/`POST /treatment-plan/:planId/assessment` against the
 * `ClinicalAssessment` model. Note the base path and the id type: it is keyed by the treatment
 * PLAN, not the session — the old `/treatment-session/:id/assessment` now 404s (verified live
 * 2026-08-17). The form's option lists are app-side (`constants/clinical.ts`), mirroring the
 * backend's Prisma enums — there is no form-config endpoint and never was.
 */
export const USE_MOCK_TREATMENT = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_TREATMENT, USE_MOCK_API);
/**
 * Patients — no dedicated therapist-patients endpoint exists, but the therapist's own patient
 * roster is derivable from GET /therapist/sessions/my-bookings (one treatment plan per patient
 * engagement, with visit counts and last-visit dates). Follows the global flag; the derivation
 * lives in `mappers.buildPatientsFromBookings`.
 */
export const USE_MOCK_PATIENTS = envFlag(process.env.EXPO_PUBLIC_USE_MOCK_PATIENTS, USE_MOCK_API);

/**
 * Notifications — **REAL as of 2026-08-17**, and no longer pinned to mock.
 *
 * The old note here said the controllers were empty method bodies that hung the request. That
 * was true of `/notification/*` (singular) and still is — it answers 500. The backend has since
 * implemented the domain under `/notifications/*` (plural), which the app now calls:
 * list, unread-count, mark-read, mark-all-read and preferences all return real data against
 * api.dev.physiobuddies.in. Follows the global flag like every other live domain.
 *
 * Push is a separate question and still impossible: no route accepts a device token, so the
 * list is polled, not pushed.
 */
export const USE_MOCK_NOTIFICATIONS = envFlag(
  process.env.EXPO_PUBLIC_USE_MOCK_NOTIFICATIONS,
  USE_MOCK_API,
);

/**
 * In-app network log (`/network-log`, entry point in Profile → Support).
 *
 * Defaults to ON in dev and OFF otherwise, but the local review APK
 * (`scripts/build-local-apk.ps1`) turns it on explicitly: that build is a *release* build with
 * no Metro attached, so `console.log` and Chrome DevTools are both unavailable — the in-app log
 * is the only way to see a request payload on the device. Keep it OFF for store builds: it
 * holds patient data in memory, and the screen can share it out.
 */
export const NETWORK_LOG_ENABLED = envFlag(
  process.env.EXPO_PUBLIC_ENABLE_NETWORK_LOG,
  typeof __DEV__ !== "undefined" && __DEV__,
);

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
  sessionOtpLength: 4,
  resendCooldownSec: 30,
  demoOtp: "123456",
  demoSessionOtp: "1234",
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
