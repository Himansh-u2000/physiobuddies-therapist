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
import { signOutGoogle } from "@/lib/auth/googleSignIn";

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
  setBiometric: (enabled: boolean) => Promise<void>;
  lock: () => void;
  unlock: () => void;
  logout: () => Promise<void>;
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
    // Best-effort server + native sign-out, then clear all local state.
    await authApi.logout().catch(() => {});
    await signOutGoogle();
    await clearAllSecureData();
    set({
      isAuthenticated: false,
      therapist: null,
      tokens: null,
      biometricEnabled: false,
      phone: null,
      isLocked: false,
    });
  },
}));
