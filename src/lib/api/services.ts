import { client, USE_MOCK, toAuthTokens } from "./client";
import {
  mockTherapist,
  mockDashboardStats,
  mockAppointments,
  mockPatients,
  mockTransactions,
  mockEarnings,
  mockNotifications,
} from "./mock";
import type {
  Therapist,
  DashboardStats,
  Appointment,
  Patient,
  Transaction,
  EarningsSummary,
  AppNotification,
  AuthTokens,
  Treatment,
} from "@/types";
import { OTP_CONFIG, USE_MOCK_AUTH } from "@/constants/config";
import { getTokens } from "@/lib/storage/secure";

function delay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/** Shape returned by GET /user/ — the backend's authenticated "me" endpoint. */
interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt?: string;
}

/**
 * Map the backend user record onto the app's Therapist shape. The `/user` endpoint only
 * returns identity fields; therapist-specific fields (specialization, rating, verification…)
 * are enriched in Phase 5 via the therapist profile endpoint.
 */
function userToTherapist(u: BackendUser): Therapist {
  return {
    id: u.id,
    name: u.name ?? "",
    email: u.email,
    phone: "",
    specialization: "",
    qualifications: "",
    experienceYears: 0,
    rating: 0,
    isOnline: false,
    isVerified: false,
  };
}

/** Unwrap the backend's uniform { success, message, data } envelope. */
function unwrap<T>(res: { data: unknown }): T {
  const body = res.data as { data?: T } | null;
  return (body && typeof body === "object" && "data" in body ? body.data : (res.data as T)) as T;
}

export const authApi = {
  /** Real email/password login → tokens + profile (backend: POST /auth/login). */
  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<{ tokens: AuthTokens; therapist: Therapist }> {
    if (USE_MOCK_AUTH) {
      if (!email.includes("@") || password.length < 6) throw new Error("Invalid email or password");
      const tokens: AuthTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresAt: Date.now() + 3600_000,
      };
      return delay({ tokens, therapist: { ...mockTherapist, email } }, 600);
    }
    const res = await client.post("/auth/login", { email, password });
    const tokens = toAuthTokens(unwrap<{ accessToken: string; refreshToken: string }>(res));
    const therapist = await authApi.getMyProfile();
    return { tokens, therapist };
  },

  /**
   * Real Google login — authorization-code flow (backend: POST /auth/google?code=…).
   * `serverAuthCode` comes from the native Google SDK (configured with the Web client ID).
   */
  async loginWithGoogle(
    serverAuthCode: string,
  ): Promise<{ tokens: AuthTokens; therapist: Therapist }> {
    if (USE_MOCK_AUTH) {
      const tokens: AuthTokens = {
        accessToken: "mock-google-access-token",
        refreshToken: "mock-google-refresh-token",
        expiresAt: Date.now() + 3600_000,
      };
      return delay({ tokens, therapist: mockTherapist }, 600);
    }
    const res = await client.post("/auth/google", null, { params: { code: serverAuthCode } });
    const tokens = toAuthTokens(unwrap<{ accessToken: string; refreshToken: string }>(res));
    const therapist = await authApi.getMyProfile();
    return { tokens, therapist };
  },

  /**
   * Apple login — STUB. Backend has no /auth/apple endpoint yet (App Store Guideline 4.8).
   * Mock establishes a session so the flow is testable end-to-end; the real exchange is
   * left ready to wire once the backend adds it.
   */
  async loginWithApple(
    identityToken: string,
    fullName?: string | null,
  ): Promise<{ tokens: AuthTokens; therapist: Therapist }> {
    if (USE_MOCK_AUTH) {
      const tokens: AuthTokens = {
        accessToken: "mock-apple-access-token",
        refreshToken: "mock-apple-refresh-token",
        expiresAt: Date.now() + 3600_000,
      };
      return delay({ tokens, therapist: { ...mockTherapist, name: fullName || mockTherapist.name } }, 600);
    }
    // TODO(backend): POST /auth/apple { identityToken, fullName } — endpoint pending.
    void identityToken;
    throw new Error("Apple Sign-In isn't available yet — backend endpoint pending.");
  },

  /** Fetch the authenticated user (GET /user/) and map to Therapist. */
  async getMyProfile(): Promise<Therapist> {
    if (USE_MOCK_AUTH) return delay(mockTherapist);
    const res = await client.get("/user");
    return userToTherapist(unwrap<BackendUser>(res));
  },

  /**
   * Rotate tokens via POST /auth/refresh-token. The axios interceptor also refreshes
   * transparently on 401; this is for explicit/manual refreshes.
   */
  async refresh(): Promise<AuthTokens | null> {
    if (USE_MOCK_AUTH) return null;
    const current = await getTokens();
    if (!current?.refreshToken) return null;
    const res = await client.post("/auth/refresh-token", { refresh: current.refreshToken });
    return toAuthTokens(unwrap<{ accessToken: string; refreshToken: string }>(res));
  },

  /**
   * Best-effort server-side logout (POST /auth/logout).
   * NOTE(backend gap): the endpoint revokes via the refresh COOKIE only, so a header-based
   * RN client cannot revoke the refresh token server-side yet. Local session is cleared
   * regardless by the caller. Tracked in api_contract.md.
   */
  async logout(): Promise<void> {
    if (USE_MOCK_AUTH) return;
    try {
      await client.post("/auth/logout");
    } catch {
      // ignore — local sign-out proceeds regardless
    }
  },

  /** Email-OTP: send a 6-digit verification code (POST /auth/send-email-before-signup). */
  async sendEmailOtp(email: string): Promise<void> {
    if (USE_MOCK_AUTH) return delay(undefined, 400);
    await client.post("/auth/send-email-before-signup", { email });
  },

  /** Verify an email OTP (POST /auth/verify-email). */
  async verifyEmail(email: string, token: string): Promise<void> {
    if (USE_MOCK_AUTH) {
      if (token.length !== OTP_CONFIG.authOtpLength) throw new Error("Invalid OTP");
      return delay(undefined, 400);
    }
    await client.post("/auth/verify-email", { email, token });
  },

  /** Request a password-reset OTP (POST /auth/forgot-password). */
  async forgotPassword(email: string): Promise<void> {
    if (USE_MOCK_AUTH) return delay(undefined, 400);
    await client.post("/auth/forgot-password", { email });
  },

  /** Complete a password reset (POST /auth/reset-password). */
  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    if (USE_MOCK_AUTH) return delay(undefined, 400);
    await client.post("/auth/reset-password", { email, token, newPassword });
  },

  /**
   * In-app account deletion (store-mandated).
   * STUB: no backend endpoint exists yet — mock resolves; the real call is left ready to wire.
   */
  async deleteAccount(reason?: string): Promise<void> {
    if (USE_MOCK_AUTH) return delay(undefined, 700);
    // TODO(backend): implement DELETE /account (soft-delete + token revocation per DPDP).
    await client.delete("/account", { data: { reason } });
  },

  // ---- Legacy phone-OTP (mock-only; retained until the phone-vs-email login decision) ----
  async login(_phone: string): Promise<{ success: boolean }> {
    return delay({ success: true }, 600);
  },

  async verifyOtp(
    phone: string,
    otp: string,
  ): Promise<{ tokens: AuthTokens; therapist: Therapist }> {
    const valid = otp === OTP_CONFIG.demoOtp || otp.length === OTP_CONFIG.authOtpLength;
    if (!valid) throw new Error("Invalid OTP");
    const tokens: AuthTokens = {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: Date.now() + 3600_000,
    };
    return delay({ tokens, therapist: { ...mockTherapist, phone } }, 600);
  },
};

export const therapistApi = {
  async getProfile(): Promise<Therapist> {
    if (USE_MOCK) return delay(mockTherapist);
    const { data } = await client.get<Therapist>("/profile");
    return data;
  },

  async updateProfile(updates: Partial<Therapist>): Promise<Therapist> {
    if (USE_MOCK) return delay({ ...mockTherapist, ...updates });
    const { data } = await client.put<Therapist>("/profile", updates);
    return data;
  },

  async getDashboard(): Promise<DashboardStats> {
    if (USE_MOCK) return delay(mockDashboardStats);
    const { data } = await client.get<DashboardStats>("/dashboard");
    return data;
  },
};

export const appointmentApi = {
  async list(): Promise<Appointment[]> {
    if (USE_MOCK) return delay(mockAppointments);
    const { data } = await client.get<Appointment[]>("/appointments");
    return data;
  },

  async getById(id: string): Promise<Appointment> {
    if (USE_MOCK) {
      const found = mockAppointments.find((a) => a.id === id) ?? mockAppointments[0];
      return delay(found);
    }
    const { data } = await client.get<Appointment>(`/appointments/${id}`);
    return data;
  },
};

export const sessionApi = {
  async start(appointmentId: string, otp: string): Promise<{ sessionId: string }> {
    if (USE_MOCK) {
      const valid = otp === OTP_CONFIG.demoSessionOtp || otp.length === OTP_CONFIG.sessionOtpLength;
      if (!valid) throw new Error("Invalid session OTP");
      return delay({ sessionId: `session-${appointmentId}` }, 600);
    }
    const { data } = await client.post("/session/start", { appointmentId, otp });
    return data;
  },

  async startFlagged(appointmentId: string): Promise<{ sessionId: string; flagged: boolean }> {
    if (USE_MOCK) return delay({ sessionId: `flagged-session-${appointmentId}`, flagged: true }, 600);
    const { data } = await client.post("/session/start-flagged", { appointmentId });
    return data;
  },

  /**
   * `idempotencyKey` is generated once on the client when the session is first completed
   * locally and persists across retries — a resend after a dropped response (offline, app
   * killed mid-request) must never double-trigger a payout server-side.
   */
  async complete(sessionId: string, idempotencyKey?: string): Promise<{ payoutQueued: boolean }> {
    if (USE_MOCK) return delay({ payoutQueued: true }, 500);
    const { data } = await client.put(
      `/session/${sessionId}/complete`,
      undefined,
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
    );
    return data;
  },
};

/** What the sync queue sends over the wire — the same shape it read back out of SQLite. */
export type TreatmentSubmitPayload = Omit<Treatment, "id" | "createdAt" | "updatedAt" | "syncStatus"> & {
  elapsedSeconds: number;
  checklist: unknown;
  quickNote?: string;
};

export const treatmentApi = {
  async submit(payload: TreatmentSubmitPayload, idempotencyKey?: string): Promise<{ id: string }> {
    if (USE_MOCK) return delay({ id: `treatment-${Date.now()}` }, 600);
    const { data } = await client.post(
      "/treatment",
      payload,
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
    );
    return data;
  },
};

export const patientApi = {
  async list(): Promise<Patient[]> {
    if (USE_MOCK) return delay(mockPatients);
    const { data } = await client.get<Patient[]>("/patients");
    return data;
  },

  async getById(id: string): Promise<Patient> {
    if (USE_MOCK) {
      const found = mockPatients.find((p) => p.id === id) ?? mockPatients[0];
      return delay(found);
    }
    const { data } = await client.get<Patient>(`/patients/${id}`);
    return data;
  },
};

export const earningsApi = {
  async getSummary(): Promise<EarningsSummary> {
    if (USE_MOCK) return delay(mockEarnings);
    const { data } = await client.get<EarningsSummary>("/earnings");
    return data;
  },

  async getTransactions(): Promise<Transaction[]> {
    if (USE_MOCK) return delay(mockTransactions);
    const { data } = await client.get<Transaction[]>("/transactions");
    return data;
  },
};

export const notificationApi = {
  async list(): Promise<AppNotification[]> {
    if (USE_MOCK) return delay(mockNotifications);
    const { data } = await client.get<AppNotification[]>("/notifications");
    return data;
  },

  async registerPushToken(token: string): Promise<void> {
    if (USE_MOCK) return delay(undefined, 200);
    await client.post("/notification/token", { token });
  },
};

export const uploadApi = {
  async uploadSessionPhoto(
    sessionId: string,
    uri: string,
    fileName: string,
    mimeType: string
  ): Promise<{ url: string; id: string }> {
    if (USE_MOCK) return delay({ url: uri, id: `photo-${Date.now()}` }, 800);
    const formData = new FormData();
    formData.append("file", { uri, name: fileName, type: mimeType } as any);
    formData.append("sessionId", sessionId);
    const { data } = await client.post("/upload/session-photo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async uploadTreatmentAttachment(
    treatmentId: string,
    uri: string,
    fileName: string,
    mimeType: string
  ): Promise<{ url: string; id: string }> {
    if (USE_MOCK) return delay({ url: uri, id: `attachment-${Date.now()}` }, 800);
    const formData = new FormData();
    formData.append("file", { uri, name: fileName, type: mimeType } as any);
    formData.append("treatmentId", treatmentId);
    const { data } = await client.post("/upload/treatment-attachment", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },
};
