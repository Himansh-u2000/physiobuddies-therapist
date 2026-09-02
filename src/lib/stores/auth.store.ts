import { create } from "zustand";
import type { AuthTokens, Therapist } from "@/types";
import {
  saveTokens,
  saveTherapistProfile,
  getTherapistProfile,
  getTokens,
  setBiometricEnabled,
  getBiometricEnabled,
  savePhone,
  getPhone,
  clearAllSecureData,
} from "@/lib/storage/secure";
import { authApi } from "@/lib/api/services";
import { unregisterDeviceToken } from "@/lib/notifications/push";
import { clearNetLog } from "@/lib/api/netlog";
import { getActiveDatabase } from "@/lib/db/provider";
import { clearLocalCache } from "@/lib/db/repositories";
import { useAppStore } from "@/lib/stores/app.store";

/**
 * Wipe the encrypted SQLite snapshot alongside SecureStore.
 *
 * Best-effort on purpose: a database that failed to open, or a delete that throws, must not be
 * able to strand someone in a signed-in state they are trying to leave. Sign-out has to complete
 * either way, so a failure here is swallowed rather than propagated.
 */
async function clearCachedData(): Promise<void> {
  const db = getActiveDatabase();
  if (!db) return;
  await clearLocalCache(db).catch(() => {});
}

interface AuthStore {
  isAuthenticated: boolean;
  isHydrated: boolean;
  therapist: Therapist | null;
  tokens: AuthTokens | null;
  biometricEnabled: boolean;
  phone: string | null;
  /** True when the app has re-locked (background timeout) and needs biometric re-auth. */
  isLocked: boolean;

  hydrate: () => Promise<void>;
  setSession: (tokens: AuthTokens, therapist: Therapist, phone?: string) => Promise<void>;
  /** Replace the cached therapist profile (persisted) — used after a profile edit. */
  setTherapist: (therapist: Therapist) => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  logout: () => Promise<void>;
  /** The server rejected our refresh token — end the session locally. See `sessionExpired`. */
  sessionExpired: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  isAuthenticated: false,
  isHydrated: false,
  therapist: null,
  tokens: null,
  biometricEnabled: false,
  phone: null,
  isLocked: false,

  hydrate: async () => {
    const tokens = await getTokens();
    const therapist = await getTherapistProfile();
    const biometricEnabled = await getBiometricEnabled();
    const phone = await getPhone();
    set({
      tokens,
      therapist,
      biometricEnabled,
      phone,
      isAuthenticated: !!tokens && !!therapist,
      // If biometric is on, start locked so a cold start requires re-auth.
      isLocked: biometricEnabled && !!tokens && !!therapist,
      isHydrated: true,
    });
  },

  setSession: async (tokens, therapist, phone) => {
    await saveTokens(tokens);
    await saveTherapistProfile(therapist);
    if (phone) await savePhone(phone);
    set({
      tokens,
      therapist,
      phone: phone ?? get().phone,
      isAuthenticated: true,
      isLocked: false,
    });
  },

  setTherapist: async (therapist) => {
    await saveTherapistProfile(therapist);
    set({ therapist });
  },

  setBiometric: async (enabled) => {
    await setBiometricEnabled(enabled);
    set({ biometricEnabled: enabled });
  },

  lock: () => {
    // Only meaningful for an authenticated user with biometric enabled.
    const { isAuthenticated, biometricEnabled } = get();
    if (isAuthenticated && biometricEnabled) set({ isLocked: true });
  },

  unlock: () => set({ isLocked: false }),

  logout: async () => {
    // Retire this device's push token FIRST — the DELETE is authenticated, so once
    // `clearAllSecureData()` has run there is no credential left to authorize it and the token
    // would keep receiving the departing therapist's session and payout alerts on a phone that
    // is now someone else's.
    await unregisterDeviceToken().catch(() => {});
    // Best-effort server + native sign-out, then clear all local state.
    await authApi.logout().catch(() => {});
    await clearAllSecureData();
    // The cached patient list, appointments and session notes are the bulk of what is worth
    // protecting on a shared handset, and SecureStore never held any of it.
    await clearCachedData();
    // The network log holds request/response bodies — i.e. patient data — in memory. Signing
    // out has to drop it too, or handing the phone to the next person leaves it readable.
    clearNetLog();
    set({
      isAuthenticated: false,
      therapist: null,
      tokens: null,
      biometricEnabled: false,
      phone: null,
      isLocked: false,
    });
  },

  /**
   * The refresh token was rejected outright by the server (not merely unreachable — the API
   * client only calls this on a real rejection, so going offline never lands here). Local
   * teardown only: no `authApi.logout()`, because the credential that would authorize it is
   * exactly what just died.
   *
   * Guarded on `isAuthenticated` — a rejected refresh for an already-signed-out user must not
   * re-fire the "session expired" toast on a login screen.
   */
  sessionExpired: async () => {
    if (!get().isAuthenticated) return;
    await clearAllSecureData();
    // Same wipe as a deliberate sign-out. Without it the next therapist to sign in on this
    // handset renders the previous account's rows: `useSyncedQuery` falls back to `cachedData`
    // whenever a fetch has not returned, so stale data outlives the session that fetched it.
    await clearCachedData();
    // The netlog is deliberately NOT cleared here, unlike in `logout`. A session dying is the
    // single thing this log exists to explain — the failed `/auth/refresh` that caused it is the
    // entry someone will be asked for — and a therapist whose session expired has not handed the
    // phone to anyone. `logout` is the point where the device may change hands.
    set({
      isAuthenticated: false,
      therapist: null,
      tokens: null,
      biometricEnabled: false,
      phone: null,
      isLocked: false,
    });
    useAppStore.getState().showToast("Your session expired. Please sign in again.", "error");
  },
}));
