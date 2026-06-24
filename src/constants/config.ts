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
  process.env.EXPO_PUBLIC_API_URL ?? "https://api.physiobuddies.in/api/therapist";

export const STORAGE_KEYS = {
  accessToken: "pb_access_token",
  refreshToken: "pb_refresh_token",
  tokenExpiry: "pb_token_expiry",
  therapistProfile: "pb_therapist_profile",
  biometricEnabled: "pb_biometric_enabled",
  phone: "pb_phone",
  pushToken: "pb_push_token",
  preferences: "pb_preferences",
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
