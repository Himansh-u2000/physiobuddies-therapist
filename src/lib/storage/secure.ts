import * as SecureStore from "expo-secure-store";
import { STORAGE_KEYS } from "@/constants/config";
import type { AuthTokens, Therapist } from "@/types";

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.accessToken, tokens.accessToken);
  await SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, tokens.refreshToken);
  await SecureStore.setItemAsync(
    STORAGE_KEYS.tokenExpiry,
    String(tokens.expiresAt),
  );
}

export async function getTokens(): Promise<AuthTokens | null> {
  const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.accessToken);
  const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.refreshToken);
  const expiryStr = await SecureStore.getItemAsync(STORAGE_KEYS.tokenExpiry);
  if (!accessToken || !refreshToken || !expiryStr) return null;
  return { accessToken, refreshToken, expiresAt: Number(expiryStr) };
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORAGE_KEYS.accessToken);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.tokenExpiry);
}

/**
 * Refresh this far ahead of the real expiry, so a request never departs holding a token
 * that expires mid-flight.
 */
export const TOKEN_EXPIRY_SKEW_MS = 60_000;

/**
 * Pure expiry predicate — no I/O, so the client's request path can call it on every
 * request and it stays unit-testable.
 *
 * Fails CLOSED: a missing or non-finite `expiresAt` counts as expired. (A corrupt value
 * yields `NaN`, and `Date.now() >= NaN - skew` is `false`, which would otherwise treat an
 * unreadable token as indefinitely valid.)
 */
export function isExpired(
  tokens: AuthTokens | null,
  skewMs: number = TOKEN_EXPIRY_SKEW_MS,
): boolean {
  if (!tokens?.accessToken) return true;
  if (!Number.isFinite(tokens.expiresAt)) return true;
  return Date.now() >= tokens.expiresAt - skewMs;
}

export async function isTokenExpired(): Promise<boolean> {
  return isExpired(await getTokens());
}

export async function saveTherapistProfile(profile: Therapist): Promise<void> {
  await SecureStore.setItemAsync(
    STORAGE_KEYS.therapistProfile,
    JSON.stringify(profile),
  );
}

export async function getTherapistProfile(): Promise<Therapist | null> {
  const raw = await SecureStore.getItemAsync(STORAGE_KEYS.therapistProfile);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Therapist;
  } catch {
    return null;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.biometricEnabled, String(enabled));
}

export async function getBiometricEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(STORAGE_KEYS.biometricEnabled);
  return val === "true";
}

export async function savePhone(phone: string): Promise<void> {
  await SecureStore.setItemAsync(STORAGE_KEYS.phone, phone);
}

export async function getPhone(): Promise<string | null> {
  return SecureStore.getItemAsync(STORAGE_KEYS.phone);
}

export async function clearAllSecureData(): Promise<void> {
  await clearTokens();
  await SecureStore.deleteItemAsync(STORAGE_KEYS.therapistProfile);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.biometricEnabled);
  await SecureStore.deleteItemAsync(STORAGE_KEYS.phone);
  // The push token is per-account, not per-device: it records which therapist this handset is
  // registered as. `logout` unregisters it server-side first (see the store); this also covers
  // `sessionExpired`, where the credential to do that is exactly what just died — dropping the
  // local copy is what makes the next sign-in re-register instead of matching the stale value
  // and skipping the POST.
  await SecureStore.deleteItemAsync(STORAGE_KEYS.pushToken);
}
