import { create } from "zustand";
import type { AuthTokens, Therapist } from "@/types";
import {
  saveTokens,
  clearTokens,
  saveTherapistProfile,
  getTherapistProfile,
  getTokens,
  setBiometricEnabled,
  getBiometricEnabled,
  savePhone,
  getPhone,
  clearAllSecureData,
} from "@/lib/storage/secure";

interface AuthStore {
  isAuthenticated: boolean;
  isHydrated: boolean;
  therapist: Therapist | null;
  tokens: AuthTokens | null;
  biometricEnabled: boolean;
  phone: string | null;

  hydrate: () => Promise<void>;
  setSession: (tokens: AuthTokens, therapist: Therapist, phone: string) => Promise<void>;
  setBiometric: (enabled: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  isAuthenticated: false,
  isHydrated: false,
  therapist: null,
  tokens: null,
  biometricEnabled: false,
  phone: null,

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
      isHydrated: true,
    });
  },

  setSession: async (tokens, therapist, phone) => {
    await saveTokens(tokens);
    await saveTherapistProfile(therapist);
    await savePhone(phone);
    set({ tokens, therapist, phone, isAuthenticated: true });
  },

  setBiometric: async (enabled) => {
    await setBiometricEnabled(enabled);
    set({ biometricEnabled: enabled });
  },

  logout: async () => {
    await clearAllSecureData();
    set({
      isAuthenticated: false,
      therapist: null,
      tokens: null,
      biometricEnabled: false,
      phone: null,
    });
  },
}));
