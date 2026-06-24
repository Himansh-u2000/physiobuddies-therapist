import { client, USE_MOCK } from "./client";
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
} from "@/types";
import { OTP_CONFIG } from "@/constants/config";

function delay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const authApi = {
  async login(phone: string): Promise<{ success: boolean }> {
    if (USE_MOCK) return delay({ success: true }, 600);
    const { data } = await client.post("/auth/login", { phone });
    return data;
  },

  async verifyOtp(phone: string, otp: string): Promise<{ tokens: AuthTokens; therapist: Therapist }> {
    if (USE_MOCK) {
      const valid = otp === OTP_CONFIG.demoOtp || otp.length === OTP_CONFIG.authOtpLength;
      if (!valid) throw new Error("Invalid OTP");
      const tokens: AuthTokens = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        expiresAt: Date.now() + 3600_000,
      };
      return delay({ tokens, therapist: { ...mockTherapist, phone } }, 600);
    }
    const { data } = await client.post("/auth/verify-otp", { phone, otp });
    return data;
  },

  async refresh(): Promise<AuthTokens | null> {
    if (USE_MOCK) return null;
    const { data } = await client.post("/auth/refresh");
    return data;
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

  async complete(sessionId: string): Promise<{ payoutQueued: boolean }> {
    if (USE_MOCK) return delay({ payoutQueued: true }, 500);
    const { data } = await client.put(`/session/${sessionId}/complete`);
    return data;
  },
};

export const treatmentApi = {
  async submit(payload: unknown): Promise<{ id: string }> {
    if (USE_MOCK) return delay({ id: `treatment-${Date.now()}` }, 600);
    const { data } = await client.post("/treatment", payload);
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
