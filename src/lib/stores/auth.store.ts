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
import { useAppStore } from "@/lib/stores/app.store";

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
  /** Re-read the profile from the server. Best-effort; see the implementation. */
  refreshTherapist: () => Promise<void>;
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

  /**
   * Pull the profile fresh from `GET /user` and replace the cached copy.
   *
   * `hydrate` only ever restores the snapshot written at the last sign-in, so anything changed
   * elsewhere since — a photo set from the web console, a name corrected by support, a
   * verification that came through — stayed invisible in the app until the therapist signed out
   * and back in. Called once per launch from the root layout.
   *
   * Best-effort on purpose: a failure here must leave the cached profile and the session alone.
   * Offline is the common case (this runs at launch, often before the network settles), and the
   * cached profile is exactly what the app should keep showing then. A genuinely dead session is
   * handled by the API client's refresh path, not here.
   */
  refreshTherapist: async () => {
    if (!get().isAuthenticated) return;
    try {
      const therapist = await authApi.getMyProfile();
      await saveTherapistProfile(therapist);
      // Re-checked after the await: a sign-out that landed while the request was in flight must
      // not be undone by a late response writing the profile back.
      if (get().isAuthenticated) set({ therapist });
    } catch {
      // keep the cached profile
    }
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
