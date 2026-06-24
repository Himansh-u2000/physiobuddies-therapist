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

export async function isTokenExpired(): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens) return true;
  return Date.now() >= tokens.expiresAt - 60_000;
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
}
