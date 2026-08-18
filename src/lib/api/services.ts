import { client, toAuthTokens } from "./client";
import {
  mockTherapist,
  mockDashboardStats,
  mockAppointments,
  mockPatients,
  mockTransactions,
  mockEarnings,
  mockNotifications,
  mockPayouts,
  mockWallet,
  mockReviews,
  mockAvailability,
  mockArticles,
  mockFaqs,
} from "./mock";
import type {
  Therapist,
  DashboardStats,
  Appointment,
  Patient,
  Transaction,
  EarningsSummary,
  AppNotification,
  ActivityEntry,
  AuthTokens,
  BlogPost,
  BlogReview,
  ClinicalAssessmentInput,
  ClinicalAssessmentRecord,
  LoginSession,
  PaymentRecord,
  ScheduleOverride,
  Treatment,
  Payout,
  WalletInfo,
  TherapistReview,
  AvailabilityDay,
  TherapistArticle,
  SupportComplaint,
  TherapistFaq,
  WeeklySchedule,
} from "@/types";
import {
  API_BASE_URL,
  OTP_CONFIG,
  USE_MOCK_AUTH,
  USE_MOCK_PROFILE,
  USE_MOCK_DASHBOARD,
  USE_MOCK_APPOINTMENTS,
  USE_MOCK_EARNINGS,
  USE_MOCK_SESSION,
  USE_MOCK_TREATMENT,
  USE_MOCK_NOTIFICATIONS,
  USE_MOCK_UPLOAD,
  USE_MOCK_PATIENTS,
  USE_MOCK_PAYOUTS,
  USE_MOCK_AVAILABILITY,
  USE_MOCK_CONTENT,
  SUBSCRIPTION_PAYMENT_ENABLED,
} from "@/constants/config";
import { SUBSCRIPTION_PLANS, type SubscriptionPlan } from "@/lib/subscription/plans";
import { getTokens, saveTokens } from "@/lib/storage/secure";
import {
  mapUserToTherapist,
  mapBookings,
  mapBookingDetailToAppointment,
  mapCommissions,
  buildEarningsSummary,
  buildDashboardStats,
  buildPatientsFromBookings,
  mapActivity,
  mapAssessments,
  mapAssessmentToPayload,
  mapBlogPost,
  mapBlogReview,
  mapBlogPosts,
  mapNotifications,
  mapLoginSessions,
  mapPayments,
  mapPayout,
  mapPayouts,
  mapWallet,
  mapReviews,
  mapAvailability,
  mapArticles,
  mapComplaints,
  mapFaqs,
  mapScheduleOverrides,
  mapWeeklySchedule,
  type BackendUser,
  type BackendTherapistPublic,
  type BackendActivity,
  type BackendAssessment,
  type BackendBlogPost,
  type BackendBlogReview,
  type BackendBooking,
  type BackendBookingDetail,
  type BackendComplaint,
  type BackendCommission,
  type BackendLoginSession,
  type BackendNotificationPage,
  type BackendPayment,
  type BackendWallet,
  type BackendPayout,
  type BackendReview,
  type BackendAvailabilityDay,
  type BackendArticle,
  type BackendFaq,
  type BackendScheduleOverride,
  type BackendWeeklySchedule,
} from "./mappers";

function delay<T>(data: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

/**
 * Enrich the identity record with the therapist's public profile (GET /therapist/:id) —
 * specialization, rating, experience. Best-effort: returns null on any failure so a missing
 * or parked public profile never blocks login or the identity fetch.
 */
async function fetchTherapistPublic(therapistId?: string): Promise<BackendTherapistPublic | null> {
  if (!therapistId) return null;
  try {
    const { data } = await client.get<BackendTherapistPublic>(`/therapist/${therapistId}`);
    return data;
  } catch {
    return null;
  }
}

// NOTE: `res.data` is already the *payload*, not the backend envelope — `client.ts`'s response
// interceptor peels `{ success, message, data }` once, for every service in this file. Do not
// unwrap again here.

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
    const { data } = await client.post<{ accessToken: string; refreshToken: string }>("/auth/login", {
      email,
      password,
    });
    const tokens = toAuthTokens(data);
    const therapist = await authApi.getMyProfile();
    return { tokens, therapist };
  },

  // Google login was removed from the app on 2026-08-17 (product decision). `POST /auth/google`
  // still exists server-side and is used by the web client — this app simply no longer offers
  // it, so the native SDK, the Web/Android OAuth clients and the `DEVELOPER_ERROR` failure mode
  // that came with them are all gone. Sign-in is email/password only.

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

  /** Fetch the authenticated user (GET /user) + therapist enrichment, mapped to Therapist. */
  async getMyProfile(): Promise<Therapist> {
    if (USE_MOCK_AUTH) return delay(mockTherapist);
    const { data } = await client.get<BackendUser>("/user");
    const pub = await fetchTherapistPublic(data.therapistProfile?.id);
    return mapUserToTherapist(data, pub);
  },

  /**
   * Rotate tokens via POST /auth/refresh. The axios interceptor refreshes
   * transparently (pre-emptively on expiry, and once on a 401); this is for explicit
   * refreshes.
   *
   * MUST persist what it receives. The backend ROTATES the refresh token, so returning the
   * new pair without saving it would leave secure storage holding a refresh token the server
   * has already invalidated — bricking the session at the next refresh.
   */
  async refresh(): Promise<AuthTokens | null> {
    if (USE_MOCK_AUTH) return null;
    const current = await getTokens();
    if (!current?.refreshToken) return null;
    const { data } = await client.post<{ accessToken: string; refreshToken?: string }>(
      "/auth/refresh",
      { refresh: current.refreshToken },
    );
    if (!data?.accessToken) return null;
    const tokens = toAuthTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? current.refreshToken,
    });
    await saveTokens(tokens);
    return tokens;
  },

  /**
   * Best-effort server-side logout (POST /auth/logout).
   * The refresh token is sent in the body because RN has no cookie jar. NOTE(backend gap):
   * the endpoint currently revokes via the refresh COOKIE only (`req.cookies.refresh_token`),
   * so this is a no-op server-side until it also reads the body — at which point revocation
   * starts working with no further app change. Local session is cleared regardless by the
   * caller. Tracked in api_contract.md §2.4.
   */
  async logout(): Promise<void> {
    if (USE_MOCK_AUTH) return;
    try {
      const current = await getTokens();
      await client.post("/auth/logout", { refresh: current?.refreshToken });
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

  // REMOVED: the phone-OTP pair (`login` / `verifyOtp`). They ignored `USE_MOCK_AUTH`
  // entirely, accepted any 6-digit code, and returned a literal `mock-access-token` — against
  // a live backend that meant the app's most prominent login button produced a session every
  // real endpoint answered with 401. There is no phone-OTP login server-side and there never
  // was; login is email/password (+ Google). Deleted rather than gated so it cannot come back
  // by flipping a flag.
};

export const therapistApi = {
  async getProfile(): Promise<Therapist> {
    if (USE_MOCK_PROFILE) return delay(mockTherapist);
    const { data } = await client.get<BackendUser>("/user");
    const pub = await fetchTherapistPublic(data.therapistProfile?.id);
    return mapUserToTherapist(data, pub);
  },

  /** Update editable identity fields (PATCH /user accepts { name, mobile }), then re-fetch. */
  async updateProfile(updates: Partial<Therapist>): Promise<Therapist> {
    if (USE_MOCK_PROFILE) return delay({ ...mockTherapist, ...updates });
    const body: { name?: string; mobile?: string } = {};
    if (updates.name !== undefined) body.name = updates.name;
    if (updates.phone !== undefined) body.mobile = updates.phone;
    await client.patch("/user", body);
    return therapistApi.getProfile();
  },

  /**
   * Set the profile photo (PATCH /user/avatar), then re-fetch so the store holds the URL the
   * server actually kept. Takes an already-uploaded URL rather than a local file: upload and
   * avatar-set are two separate backend calls, and splitting them means a failed PATCH doesn't
   * cost the therapist the upload.
   *
   * The endpoint validates with `z.string().url()`, so the value MUST be absolute — pass what
   * `uploadApi.uploadDocument` returned, which `absoluteFileUrl` has already resolved.
   */
  async updateAvatar(avatarUrl: string): Promise<Therapist> {
    if (USE_MOCK_PROFILE) return delay({ ...mockTherapist, avatarUrl });
    await client.patch("/user/avatar", { avatar: absoluteFileUrl(avatarUrl) });
    return therapistApi.getProfile();
  },

  /** Change the account password (PATCH /user/password). */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (USE_MOCK_PROFILE) {
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");
      return delay(undefined, 600);
    }
    await client.patch("/user/password", { currentPassword, newPassword });
  },

  /** Patient reviews for the signed-in therapist (GET /therapist/:id/reviews). */
  async getReviews(): Promise<TherapistReview[]> {
    if (USE_MOCK_PROFILE) return delay(mockReviews);
    const { data: user } = await client.get<BackendUser>("/user");
    const therapistId = user.therapistProfile?.id;
    if (!therapistId) return [];
    const { data } = await client.get<BackendReview[]>(`/therapist/${therapistId}/reviews`);
    return mapReviews(data);
  },

  /**
   * No backend `/dashboard` endpoint exists — compose it client-side from the earnings list
   * (weekly chart + today's earnings), the bookings list (today's session count) and the
   * public profile (rating).
   */
  async getDashboard(): Promise<DashboardStats> {
    if (USE_MOCK_DASHBOARD) return delay(mockDashboardStats);
    const [user, commissions, bookings] = await Promise.all([
      client.get<BackendUser>("/user"),
      client.get<BackendCommission[]>("/therapist/earnings"),
      client.get<BackendBooking[]>("/therapist/sessions/my-bookings"),
    ]);
    const pub = await fetchTherapistPublic(user.data.therapistProfile?.id);
    return buildDashboardStats(commissions.data, bookings.data, pub?.rating ?? 0);
  },
};

/**
 * Account security — active login sessions and the audit log.
 *
 * Both endpoints are real and were probed live; neither had an app surface before. Follows the
 * profile mock flag since it's account data, not a domain of its own.
 */
export const accountApi = {
  /**
   * Devices/browsers currently holding a session (GET /user/sessions/).
   *
   * ⚠️ The backend's `isCurrentSession` is `false` on every row — including the one making the
   * request — so this cannot tell you which device you're on. `mapLoginSessions` takes an
   * override, and the caller has nothing better to pass, so `isCurrent` is `false` throughout and
   * the UI must warn that revoking might sign you out. Tracked as BACKEND_TODO §1.4.
   */
  async listSessions(): Promise<LoginSession[]> {
    if (USE_MOCK_PROFILE) return delay([]);
    const { data } = await client.get<BackendLoginSession[]>("/user/sessions");
    return mapLoginSessions(data ?? []);
  },

  /**
   * Revoke one session (DELETE /user/sessions/:id) — verified: 202, and the row disappears.
   *
   * If the revoked session happens to be this device's, the next request 401s and the refresh
   * fails, which `client.ts`'s `sessionDeadHandler` already turns into a clean forced sign-out.
   * So the destructive case degrades correctly even though we can't predict it.
   */
  async revokeSession(id: string): Promise<void> {
    if (USE_MOCK_PROFILE) return delay(undefined, 400);
    await client.delete(`/user/sessions/${id}`);
  },

  /** Audit log (GET /activity/) — logins plus API calls made on the account. */
  async listActivity(): Promise<ActivityEntry[]> {
    if (USE_MOCK_PROFILE) return delay([]);
    const { data } = await client.get<BackendActivity[]>("/activity");
    return mapActivity(data ?? []);
  },
};

/**
 * Payments — money *in* (subscriptions), as opposed to payouts, which are money out.
 *
 * Records exist even though paying doesn't currently activate a subscription (see
 * `SUBSCRIPTION_PAYMENT_ENABLED`), so this is read-only history.
 */
export const billingApi = {
  async listPayments(): Promise<PaymentRecord[]> {
    if (USE_MOCK_PAYOUTS) return delay([]);
    const { data } = await client.get<BackendPayment[]>("/payment");
    return mapPayments(data ?? []);
  },
};

/**
 * Platform-authored patient-education content (`/blog`). Distinct from `/therapist/articles`,
 * which is the therapist's *own* writing — this is material they can read and share with patients.
 */
export const blogApi = {
  async list(): Promise<BlogPost[]> {
    if (USE_MOCK_CONTENT) return delay([]);
    const { data } = await client.get<BackendBlogPost[]>("/blog");
    return mapBlogPosts(data ?? []);
  },

  /** Keyed by SLUG, not id. Note the backend increments `views` on each read. */
  async getBySlug(slug: string): Promise<BlogPost> {
    if (USE_MOCK_CONTENT) throw new Error("Blog content isn't available offline yet.");
    const { data } = await client.get<BackendBlogPost>(`/blog/${slug}`);
    return mapBlogPost(data);
  },

  /**
   * Toggle a like (POST /blog/:id/like). One call both likes and unlikes — the server looks for
   * an existing `BlogLike` for this user and deletes it if present, creates it if not — and
   * answers with the resulting state, so the response is the source of truth rather than
   * whatever the client assumed it was doing.
   *
   * Addressed by **id**, while the article itself is fetched by **slug**; the detail payload
   * carries both, so pass `post.id` here, never the slug.
   *
   * ⚠️ The detail response has no "did I like this" field — only a total count — so a freshly
   * opened article cannot show whether this therapist already liked it. Logged as a backend gap;
   * until it lands, the heart starts unfilled and only reflects likes made in this session.
   */
  async toggleLike(postId: string): Promise<{ liked: boolean; likes: number }> {
    if (USE_MOCK_CONTENT) return delay({ liked: true, likes: 1 }, 300);
    const { data } = await client.post<{ liked: boolean; likes: number }>(`/blog/${postId}/like`);
    return { liked: !!data?.liked, likes: data?.likes ?? 0 };
  },

  /** Post a comment (POST /blog/:id/review, body `{ comment }`) and get the stored row back. */
  async addComment(postId: string, comment: string): Promise<BlogReview> {
    if (USE_MOCK_CONTENT) {
      return delay({ id: `mock-${Date.now()}`, userName: "You", comment, createdAt: new Date().toISOString() }, 400);
    }
    const { data } = await client.post<BackendBlogReview>(`/blog/${postId}/review`, { comment });
    return mapBlogReview(data);
  },
};

/**
 * Support complaints (`/complaint`). Real and verified — a therapist can raise a ticket and
 * read the admin's replies. This is the in-app half of "Help & support"; the profile screen
 * also offers a plain mail-to-support route, which is the one that works with no session.
 */
export const supportApi = {
  async list(): Promise<SupportComplaint[]> {
    if (USE_MOCK_PROFILE) return delay([]);
    const { data } = await client.get<BackendComplaint[]>("/complaints/");
    return mapComplaints(data ?? []);
  },

  /** `type` is a free-text bucket the admin console filters on ("payout", "session", …). */
  async create(type: string, description: string): Promise<void> {
    if (USE_MOCK_PROFILE) return delay(undefined, 600);
    await client.post("/complaints/", { type, description });
  },

  async reply(complaintId: string, message: string): Promise<void> {
    if (USE_MOCK_PROFILE) return delay(undefined, 500);
    await client.post(`/complaints/${complaintId}/reply`, { message });
  },
};

export const payoutApi = {
  /** Payout history (GET /therapist/payout). */
  async list(): Promise<Payout[]> {
    if (USE_MOCK_PAYOUTS) return delay(mockPayouts);
    const { data } = await client.get<BackendPayout[]>("/therapist/payout");
    return mapPayouts(data);
  },

  async getById(id: string): Promise<Payout> {
    if (USE_MOCK_PAYOUTS) {
      const found = mockPayouts.find((p) => p.id === id) ?? mockPayouts[0];
      return delay(found);
    }
    const { data } = await client.get<BackendPayout>(`/therapist/payout/${id}`);
    return mapPayout(data);
  },

  /** Wallet balance + ledger (GET /therapist/wallet) — the withdrawable figure. */
  async getWallet(): Promise<WalletInfo> {
    if (USE_MOCK_PAYOUTS) return delay(mockWallet);
    const { data } = await client.get<BackendWallet>("/therapist/wallet");
    return mapWallet(data);
  },

  /**
   * Request a payout (POST /therapist/payout/request { amount }).
   *
   * NOT idempotent server-side — there is no Idempotency-Key support on this endpoint, so a
   * retry after a dropped response could raise a second request for the same money. The UI
   * therefore never auto-retries this call; it is only ever fired by an explicit tap.
   */
  async request(amount: number): Promise<Payout> {
    if (USE_MOCK_PAYOUTS) {
      if (amount <= 0) throw new Error("Enter an amount greater than zero");
      return delay(
        { id: `payout-${Date.now()}`, amount, status: "requested", dateLabel: "Today" },
        700,
      );
    }
    const { data } = await client.post<BackendPayout>("/therapist/payout/request", { amount });
    return mapPayout(data);
  },
};

export const availabilityApi = {
  /** The therapist's own bookable slots (GET /therapist/:id/availability). */
  async getAvailability(): Promise<AvailabilityDay[]> {
    if (USE_MOCK_AVAILABILITY) return delay(mockAvailability);
    const { data: user } = await client.get<BackendUser>("/user");
    const therapistId = user.therapistProfile?.id;
    if (!therapistId) return [];
    const { data } = await client.get<BackendAvailabilityDay[]>(
      `/therapist/${therapistId}/availability`,
    );
    return mapAvailability(data);
  },

  /**
   * Block or unblock hours on a date (POST / DELETE /therapist/slots/block).
   * The body wants a date-time and a list of *start hours* — the same `startHour` integers the
   * availability response carries, which is why `AvailabilitySlot` keeps that field verbatim.
   */
  async setSlotsBlocked(isoDate: string, startHours: number[], blocked: boolean): Promise<void> {
    if (USE_MOCK_AVAILABILITY) return delay(undefined, 500);
    const body = { date: new Date(`${isoDate}T00:00:00.000Z`).toISOString(), startHours };
    if (blocked) await client.post("/therapist/slots/block", body);
    else await client.delete("/therapist/slots/block", { data: body });
  },

  /**
   * The recurring weekly defaults (GET /therapist/slots/schedule). These are the shifts the
   * therapist works on each weekday — the source the daily availability grid is generated
   * from — and were only settable during onboarding before this endpoint existed.
   */
  async getWeeklySchedule(): Promise<WeeklySchedule> {
    if (USE_MOCK_AVAILABILITY) {
      return delay({
        monday: { shifts: ["morning", "evening"], disabledHours: [] },
        tuesday: { shifts: ["morning", "evening"], disabledHours: [] },
        wednesday: { shifts: ["morning"], disabledHours: [] },
        thursday: { shifts: ["morning", "evening"], disabledHours: [] },
        friday: { shifts: ["morning", "evening", "night"], disabledHours: [] },
        saturday: { shifts: ["morning"], disabledHours: [] },
        sunday: { shifts: [], disabledHours: [] },
      } satisfies WeeklySchedule);
    }
    const { data } = await client.get<BackendWeeklySchedule>("/therapist/slots/schedule");
    return mapWeeklySchedule(data);
  },

  /** Replace the weekly defaults (PUT /therapist/slots/schedule). */
  async updateWeeklySchedule(schedule: WeeklySchedule): Promise<void> {
    if (USE_MOCK_AVAILABILITY) return delay(undefined, 600);
    await client.put("/therapist/slots/schedule", { schedule });
  },

  /**
   * Upcoming dates that deviate from the weekly defaults (GET /therapist/slots/overrides).
   * A day with all 16 slots blocked comes back flagged `isOff`.
   */
  async getOverrides(): Promise<ScheduleOverride[]> {
    if (USE_MOCK_AVAILABILITY) return delay([]);
    const { data } = await client.get<BackendScheduleOverride[]>("/therapist/slots/overrides");
    return mapScheduleOverrides(data ?? []);
  },

  /** Apply for leave over a date range (POST /therapist/leaves). */
  async applyLeave(startIsoDate: string, endIsoDate: string, reason?: string): Promise<void> {
    if (USE_MOCK_AVAILABILITY) return delay(undefined, 600);
    await client.post("/therapist/leaves", {
      startDate: new Date(`${startIsoDate}T00:00:00.000Z`).toISOString(),
      endDate: new Date(`${endIsoDate}T00:00:00.000Z`).toISOString(),
      ...(reason ? { reason } : {}),
    });
  },
};

export const contentApi = {
  /** The therapist's published articles (GET /therapist/:id/articles). */
  async listArticles(): Promise<TherapistArticle[]> {
    if (USE_MOCK_CONTENT) return delay(mockArticles);
    const { data: user } = await client.get<BackendUser>("/user");
    const therapistId = user.therapistProfile?.id;
    if (!therapistId) return [];
    const { data } = await client.get<BackendArticle[]>(`/therapist/${therapistId}/articles`);
    return mapArticles(data);
  },

  async createArticle(title: string, content: string): Promise<void> {
    if (USE_MOCK_CONTENT) return delay(undefined, 600);
    await client.post("/therapist/articles", { title, content });
  },

  async updateArticle(id: string, updates: { title?: string; content?: string }): Promise<void> {
    if (USE_MOCK_CONTENT) return delay(undefined, 600);
    await client.patch(`/therapist/articles/${id}`, updates);
  },

  async deleteArticle(id: string): Promise<void> {
    if (USE_MOCK_CONTENT) return delay(undefined, 500);
    await client.delete(`/therapist/articles/${id}`);
  },

  /** The therapist's FAQs (GET /therapist/:id/faqs). */
  async listFaqs(): Promise<TherapistFaq[]> {
    if (USE_MOCK_CONTENT) return delay(mockFaqs);
    const { data: user } = await client.get<BackendUser>("/user");
    const therapistId = user.therapistProfile?.id;
    if (!therapistId) return [];
    const { data } = await client.get<BackendFaq[]>(`/therapist/${therapistId}/faqs`);
    return mapFaqs(data);
  },

  async createFaq(question: string, answer: string): Promise<void> {
    if (USE_MOCK_CONTENT) return delay(undefined, 600);
    await client.post("/therapist/faqs", { question, answer });
  },

  async updateFaq(id: string, updates: { question?: string; answer?: string }): Promise<void> {
    if (USE_MOCK_CONTENT) return delay(undefined, 600);
    await client.patch(`/therapist/faqs/${id}`, updates);
  },

  async deleteFaq(id: string): Promise<void> {
    if (USE_MOCK_CONTENT) return delay(undefined, 500);
    await client.delete(`/therapist/faqs/${id}`);
  },
};

export const appointmentApi = {
  async list(): Promise<Appointment[]> {
    if (USE_MOCK_APPOINTMENTS) return delay(mockAppointments);
    const { data } = await client.get<BackendBooking[]>("/therapist/sessions/my-bookings");
    return mapBookings(data);
  },

  async getById(id: string): Promise<Appointment> {
    if (USE_MOCK_APPOINTMENTS) {
      const found = mockAppointments.find((a) => a.id === id) ?? mockAppointments[0];
      return delay(found);
    }
    const { data } = await client.get<BackendBookingDetail>(
      `/therapist/sessions/my-bookings/${id}`,
    );
    return mapBookingDetailToAppointment(data);
  },
};

/**
 * Session lifecycle, all real against the dev backend.
 *
 * The one thing to keep straight: **every call here takes a `treatmentSession` id, not the
 * treatment-plan id the appointment list is keyed by.** `Appointment.currentSessionId` is the
 * value to pass; `mapBookingDetailToAppointment` derives it. Passing a plan id gets a 404
 * ("Session not found"), which is at least loud.
 */
export const sessionApi = {
  /**
   * Confirm a booking request (PATCH .../my-bookings/:id/accept) — flips the slot reservation
   * to `booked` and the session to `confirmed`.
   */
  async accept(sessionId: string): Promise<void> {
    if (USE_MOCK_SESSION) return delay(undefined, 500);
    await client.patch(`/therapist/sessions/my-bookings/${sessionId}/accept`);
  },

  /**
   * Ask the backend to send the patient a start-OTP (POST .../generate-otp).
   *
   * Two server-side rules worth surfacing rather than discovering at the counter: the window is
   * 30 minutes before the scheduled start to 2 hours after (outside it the call 400s with a
   * readable message, which the caller shows verbatim), and the response echoes `otpCode` back
   * in dev so the flow is testable without a second handset.
   */
  async generateOtp(
    sessionId: string,
  ): Promise<{ otpCode?: string; expiresInMinutes?: number; message?: string }> {
    if (USE_MOCK_SESSION) {
      return delay({ otpCode: OTP_CONFIG.demoSessionOtp, expiresInMinutes: 5 }, 600);
    }
    const { data } = await client.post<{
      otpCode?: string;
      expiresInMinutes?: number;
      message?: string;
    }>(`/therapist/sessions/my-bookings/${sessionId}/generate-otp`);
    return data ?? {};
  },

  /** Verify the patient's OTP, which is what actually starts the session (status → `active`). */
  async start(sessionId: string, otp: string): Promise<{ sessionId: string }> {
    if (USE_MOCK_SESSION) {
      const valid = otp === OTP_CONFIG.demoSessionOtp || otp.length === OTP_CONFIG.sessionOtpLength;
      if (!valid) throw new Error("Invalid session OTP");
      return delay({ sessionId: `session-${sessionId}` }, 600);
    }
    await client.post(`/therapist/sessions/my-bookings/${sessionId}/verify-otp`, { otp });
    return { sessionId };
  },

  // `startFlagged` (emergency start with no patient OTP) was deleted on 2026-08-17. There was
  // never a backend endpoint for it: nothing server-side flipped the session to `active`, so the
  // therapist was shown a running timer for a visit the server still had as pending, and the
  // "supervisor notified" toast was untrue. It is also what produced the fabricated
  // `flagged-session-<planId>` id that killed assessment submission at the very end of a visit
  // (fixed 2026-08-13, now moot). A verified OTP is the only way into a session.

  /**
   * End the visit (POST .../my-bookings/:id/end) — sets `completed` + `actualEndTime` and logs
   * the status change. Returns the server-measured duration.
   *
   * `idempotencyKey` is generated once on the client when the session is first completed
   * locally and persists across retries — a resend after a dropped response (offline, app
   * killed mid-request) must never double-trigger a payout server-side. The backend does not
   * dedupe on it yet, but ending an already-completed session is itself idempotent (it just
   * rewrites the same terminal state), so a replay is harmless today.
   */
  async complete(
    sessionId: string,
    idempotencyKey?: string,
  ): Promise<{ payoutQueued: boolean; durationMinutes?: number }> {
    if (USE_MOCK_SESSION) return delay({ payoutQueued: true }, 500);
    const { data } = await client.post<{ durationMinutes?: number }>(
      `/therapist/sessions/my-bookings/${sessionId}/end`,
      undefined,
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
    );
    return { payoutQueued: true, durationMinutes: data?.durationMinutes };
  },

  /** Cancel a scheduled session (POST /treatment-session/:id/cancel). */
  async cancel(sessionId: string, reason?: string): Promise<void> {
    if (USE_MOCK_SESSION) return delay(undefined, 500);
    await client.post(`/treatment-session/${sessionId}/cancel`, reason ? { reason } : {});
  },

  /** Record that the patient didn't show (POST /treatment-session/:id/no-show). */
  async markNoShow(sessionId: string): Promise<void> {
    if (USE_MOCK_SESSION) return delay(undefined, 500);
    await client.post(`/treatment-session/${sessionId}/no-show`);
  },

  /**
   * Close out the whole course of treatment (POST /therapist/sessions/plan/:id/complete).
   * Takes the PLAN id, unlike everything else here — it's the one endpoint that operates on
   * the plan rather than a single visit.
   */
  async completePlan(
    planId: string,
    payload?: { beforeTherapyImg?: string; afterTherapyImg?: string; finalImprovement?: string },
  ): Promise<void> {
    if (USE_MOCK_SESSION) return delay(undefined, 600);
    await client.post(`/therapist/sessions/plan/${planId}/complete`, payload ?? {});
  },

  /** Attach files to the plan (POST /treatment-session/:id/add-docs). */
  async addDocuments(
    sessionId: string,
    documents: { url: string; name: string; fileType: string }[],
  ): Promise<void> {
    if (USE_MOCK_SESSION) return delay(undefined, 500);
    if (documents.length === 0) return;
    await client.post(`/treatment-session/${sessionId}/add-docs`, { documents });
  },
};

/** What the sync queue sends over the wire — the same shape it read back out of SQLite. */
export type TreatmentSubmitPayload = Omit<Treatment, "id" | "createdAt" | "updatedAt" | "syncStatus"> & {
  elapsedSeconds: number;
  checklist: unknown;
  quickNote?: string;
};

/**
 * Resolve a queued treatment into the assessment the backend stores.
 *
 * Normally `payload.clinical` is present — the form fills it — and this is a passthrough that
 * only backfills the free-text fields the form keeps outside the clinical block. The fallback
 * matters for one real case: a draft queued by a build from before `clinical` existed, sitting
 * in SQLite across an app update. Those rows would otherwise fail validation forever, so the
 * required enum fields get defensible defaults and the therapist's actual writing (complaint,
 * notes, precautions, findings) is carried across rather than dropped.
 */
function buildAssessmentInput(payload: TreatmentSubmitPayload): ClinicalAssessmentInput {
  const notes = [payload.clinicalNotes, payload.precautions && `Precautions: ${payload.precautions}`]
    .filter(Boolean)
    .join("\n\n");

  if (payload.clinical) {
    return {
      ...payload.clinical,
      therapistNotes: payload.clinical.therapistNotes || notes || undefined,
      documentUrls: payload.clinical.documentUrls ?? [],
    };
  }

  // Highest scored region is the best available stand-in for an overall pain score.
  const scores = Object.values(payload.painScales ?? {});
  return {
    assessmentType: "GENERAL",
    chiefComplaint: payload.chiefComplaint ? [payload.chiefComplaint] : [],
    durationOfSymptoms: "ONE_TO_FOUR_WEEKS",
    painScore: scores.length ? Math.max(...scores) : 0,
    painCharacteristics: payload.painRegions ?? [],
    rom: "Full",
    muscleStrength: "Normal",
    functionalLimitations: [],
    problemsIdentified: (payload.assessmentFindings ?? []).map((f) => f.label),
    treatmentPlanItems: (payload.treatmentsGiven ?? []).map((t) => t.label),
    visitFrequency: "Weekly",
    hepGiven: (payload.exercises ?? []).length > 0,
    therapistNotes: notes || undefined,
    documentUrls: [],
  };
}

export const treatmentApi = {
  /**
   * Submit the clinical assessment — **POST /treatment-plan/:planId/assessment**.
   *
   * ⚠️ MOVED. This used to be `POST /treatment-session/:sessionId/assessment`. The backend
   * relocated it to its own `/treatment-plan` base precisely because the id TYPE was ambiguous
   * from the URL: every other `/treatment-session/:id` route takes a session id, while the
   * assessment is plan-scoped, so the same URL shape meant two different things depending on
   * which endpoint you'd memorised. Verified against api.dev.physiobuddies.in on 2026-08-17:
   *
   *   POST /treatment-plan/<planId>/assessment       → 202 "Assessment created or updated"
   *   POST /treatment-session/<sessionId>/assessment → 404   (GET on it → 500)
   *
   * So every clinical form the app submitted was failing outright until this change — the
   * therapist filled the whole assessment and lost it at the last step. The **body is
   * unchanged**; only the path and the id it is keyed by moved.
   *
   * `appointmentId` is the treatment-PLAN id (that is what the appointment list is keyed by);
   * `sessionId` is the treatment-SESSION id. This endpoint takes the former, which is the exact
   * opposite of the lifecycle endpoints (`generate-otp`, `verify-otp`, `end`, `add-docs`,
   * `improvement-record`) — hence the explicit naming here rather than a bare `id`.
   *
   * Side effect worth knowing: the backend does more than store a record — submitting the
   * assessment also completes the plan's `active` session and writes a status log. So this IS
   * the completion for the visit underway; the sync engine's separate `sessionApi.complete`
   * afterwards just re-asserts the same terminal state.
   */
  async submit(payload: TreatmentSubmitPayload, idempotencyKey?: string): Promise<{ id: string }> {
    if (USE_MOCK_TREATMENT) return delay({ id: `treatment-${Date.now()}` }, 600);
    const body = mapAssessmentToPayload(buildAssessmentInput(payload));
    const { data } = await client.post<{ id?: string } | null>(
      `/treatment-plan/${payload.appointmentId}/assessment`,
      body,
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
    );
    // The 202 answers `data: null`, so there is no server id to take — fall back to the plan id
    // rather than inventing one.
    return { id: data?.id ?? payload.appointmentId };
  },

  /**
   * Assessment history for a treatment plan (GET /treatment-plan/:planId/assessment).
   * Returns an array — a plan accumulates one record per assessed visit.
   */
  async getAssessments(planId: string): Promise<ClinicalAssessmentRecord[]> {
    if (USE_MOCK_TREATMENT) return delay([], 300);
    const { data } = await client.get<BackendAssessment[]>(`/treatment-plan/${planId}/assessment`);
    return mapAssessments(Array.isArray(data) ? data : []);
  },

  /**
   * Record the visit's outcome and close the session
   * (POST /treatment-session/:sessionId/improvement-record).
   *
   * Session-scoped, unlike the assessment above. `painScoreAfter` and `improvementNotes` are
   * required — the server rejects a missing `painScoreAfter` with
   * `400 {code:"VALIDATION_ERROR", details:{field:"painScoreAfter"}}` — and both scores are
   * integers clamped to 0–10 here so a slider value can never 400 the request.
   */
  async submitImprovementRecord(
    sessionId: string,
    record: {
      painScoreBefore?: number;
      painScoreAfter: number;
      improvementNotes: string;
      exercisesGiven?: string[];
    },
    idempotencyKey?: string,
  ): Promise<void> {
    // Gated with the rest of `treatmentApi` (clinical data), not with the session lifecycle —
    // it records a clinical outcome and happens to close the session as a side effect.
    if (USE_MOCK_TREATMENT) return delay(undefined, 500);
    const clamp = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
    await client.post(
      `/treatment-session/${sessionId}/improvement-record`,
      {
        ...(record.painScoreBefore != null ? { painScoreBefore: clamp(record.painScoreBefore) } : {}),
        painScoreAfter: clamp(record.painScoreAfter),
        improvementNotes: record.improvementNotes,
        ...(record.exercisesGiven?.length ? { exercisesGiven: record.exercisesGiven } : {}),
      },
      idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined,
    );
  },
};

/**
 * Therapist-facing patient roster. There is no `/patients` endpoint for therapists — the
 * `/patient/*` routes are the patient's own and 403 for a therapist token (verified against
 * the dev backend) — so the roster is rolled up from the therapist's treatment plans instead.
 */
export const patientApi = {
  async list(): Promise<Patient[]> {
    if (USE_MOCK_PATIENTS) return delay(mockPatients);
    const { data } = await client.get<BackendBooking[]>("/therapist/sessions/my-bookings");
    return buildPatientsFromBookings(data ?? []);
  },

  /** `id` is the treatment-plan id the roster row carries. */
  async getById(id: string): Promise<Patient> {
    if (USE_MOCK_PATIENTS) {
      const found = mockPatients.find((p) => p.id === id) ?? mockPatients[0];
      return delay(found);
    }
    const { data } = await client.get<BackendBookingDetail>(
      `/therapist/sessions/my-bookings/${id}`,
    );
    const appointment = mapBookingDetailToAppointment(data);
    return {
      id,
      name: appointment.patientName,
      age: appointment.patientAge ?? 0,
      gender:
        appointment.patientGender === "female"
          ? "female"
          : appointment.patientGender === "other"
            ? "other"
            : "male",
      phone: appointment.patientPhone ?? "",
      condition: appointment.condition,
      address: appointment.address,
      totalSessions: appointment.sessionCount ?? 0,
      lastVisit: appointment.sessions?.[appointment.sessions.length - 1]?.date,
      tags: [],
    };
  },
};

export const earningsApi = {
  /**
   * Compose the summary from the earnings list + wallet balance — no single backend endpoint
   * matches EarningsSummary (week/month buckets and the weekly chart are derived client-side).
   */
  async getSummary(): Promise<EarningsSummary> {
    if (USE_MOCK_EARNINGS) return delay(mockEarnings);
    const [commissions, wallet] = await Promise.all([
      client.get<BackendCommission[]>("/therapist/earnings"),
      client.get<BackendWallet>("/therapist/wallet"),
    ]);
    return buildEarningsSummary(commissions.data, wallet.data);
  },

  async getTransactions(): Promise<Transaction[]> {
    if (USE_MOCK_EARNINGS) return delay(mockTransactions);
    const { data } = await client.get<BackendCommission[]>("/therapist/earnings");
    return mapCommissions(data);
  },
};

/**
 * Notifications — **real as of 2026-08-17**, and note the path: `/notifications` (plural).
 *
 * This domain was mocked for months because `/notification/*` was a set of empty controllers
 * that never sent a response and hung the request. That is no longer the story. Probed live:
 *
 *   GET /notifications/               → 200 { items, nextCursor, hasMore, unreadCount }
 *   GET /notifications/unread-count   → 200 { unreadCount }
 *   GET /notifications/preferences    → 200 { promotionalEmail, promotionalInApp, … }
 *   GET /notification/  (singular)    → 500
 *
 * So the backend implemented the domain under the plural mount and the singular one is dead —
 * the app was calling the one path that could never work.
 */
export const notificationApi = {
  async list(): Promise<AppNotification[]> {
    if (USE_MOCK_NOTIFICATIONS) return delay(mockNotifications);
    const { data } = await client.get<BackendNotificationPage>("/notifications/", {
      params: { limit: 50 },
    });
    return mapNotifications(data?.items ?? []);
  },

  /** Badge count without pulling the list (GET /notifications/unread-count). */
  async unreadCount(): Promise<number> {
    if (USE_MOCK_NOTIFICATIONS) {
      return delay(mockNotifications.filter((n) => !n.read).length, 200);
    }
    const { data } = await client.get<{ unreadCount?: number }>("/notifications/unread-count");
    return data?.unreadCount ?? 0;
  },

  async markRead(id: string): Promise<void> {
    if (USE_MOCK_NOTIFICATIONS) return delay(undefined, 200);
    await client.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    if (USE_MOCK_NOTIFICATIONS) return delay(undefined, 200);
    await client.patch("/notifications/read-all");
  },

  async registerPushToken(token: string): Promise<void> {
    // Still genuinely absent: there is no push-token registration route on the server, so a
    // device token has nowhere to go and push cannot be delivered even with FCM configured.
    // The in-app list above works regardless — it is polled, not pushed.
    void token;
    return delay(undefined, 200);
  },
};

/**
 * The backend response for POST /file-upload/single. The field naming isn't guaranteed across
 * deployments, so `normalizeUpload` accepts the plausible variants rather than assuming one —
 * an upload that "succeeds" but yields `undefined` for the URL is worse than a clear failure,
 * because the caller would then PATCH an empty avatar or attach a blank photo.
 */
interface BackendUpload {
  url?: string;
  location?: string;
  path?: string;
  filename?: string;
  key?: string;
  id?: string;
}

/**
 * The upload endpoint returns a SERVER-RELATIVE path (`/uploads/1786…-name.jpg`) — multer
 * writes to local disk and the controller hands back `/uploads/${filename}` verbatim. That is
 * unusable as-is in two places: `<Image source={{uri}}>` can't fetch it, and
 * `PATCH /user/avatar` validates its body with `z.string().url()`, so a relative path is
 * rejected outright. Absolutise it against the API origin (base URL minus the `/api/v1`
 * suffix, since `/uploads` is served from the root) so callers always get something fetchable.
 */
export function absoluteFileUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const origin = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function normalizeUpload(data: BackendUpload | string | null | undefined): {
  url: string;
  id: string;
} {
  if (typeof data === "string") return { url: absoluteFileUrl(data), id: data };
  const raw = data?.url ?? data?.location ?? data?.path ?? "";
  if (!raw) throw new Error("Upload succeeded but the server returned no file URL.");
  return { url: absoluteFileUrl(raw), id: data?.id ?? data?.filename ?? data?.key ?? raw };
}

async function uploadSingle(
  uri: string,
  fileName: string,
  mimeType: string,
  extra?: Record<string, string>,
): Promise<{ url: string; id: string }> {
  const formData = new FormData();
  // RN's FormData takes this {uri,name,type} object for a file part; it is not a browser File.
  formData.append("file", { uri, name: fileName, type: mimeType } as unknown as Blob);
  for (const [k, v] of Object.entries(extra ?? {})) formData.append(k, v);
  // Content-Type must be actively CLEARED, not just left alone and not hardcoded:
  //  - hardcoding "multipart/form-data" omits the boundary parameter, so the server parses
  //    zero fields (this is what the previous version of this code did);
  //  - leaving it alone inherits the client's default `application/json`, and axios 1.x's
  //    transformRequest then runs `JSON.stringify(formDataToJSON(data))` on a FormData body —
  //    silently uploading JSON instead of the file.
  // Setting it to null makes axios omit the header entirely, so the runtime supplies
  // `multipart/form-data; boundary=…` itself.
  const { data } = await client.post<BackendUpload>("/file-upload/single", formData, {
    headers: { "Content-Type": null },
  });
  return normalizeUpload(data);
}

export const uploadApi = {
  /**
   * POST /file-upload/single (multer field `file`) — a generic uploader with no session
   * correlation server-side. `sessionId`/`treatmentId` are sent as extra form fields so the
   * association is at least present in the request once the backend starts reading it; today
   * the backend ignores them and the app keeps the linkage locally in SQLite.
   */
  async uploadSessionPhoto(
    sessionId: string,
    uri: string,
    fileName: string,
    mimeType: string
  ): Promise<{ url: string; id: string }> {
    if (USE_MOCK_UPLOAD) return delay({ url: uri, id: `photo-${Date.now()}` }, 800);
    return uploadSingle(uri, fileName, mimeType, { sessionId });
  },

  async uploadTreatmentAttachment(
    treatmentId: string,
    uri: string,
    fileName: string,
    mimeType: string
  ): Promise<{ url: string; id: string }> {
    if (USE_MOCK_UPLOAD) return delay({ url: uri, id: `attachment-${Date.now()}` }, 800);
    return uploadSingle(uri, fileName, mimeType, { treatmentId });
  },

  /** A KYC / credential document or a profile photo — same endpoint, no server-side kind. */
  async uploadDocument(
    uri: string,
    fileName: string,
    mimeType: string,
    kind?: string,
  ): Promise<{ url: string; id: string }> {
    if (USE_MOCK_UPLOAD) return delay({ url: uri, id: `doc-${Date.now()}` }, 900);
    return uploadSingle(uri, fileName, mimeType, kind ? { kind } : undefined);
  },
};

/**
 * Therapist subscription. Plans are client-defined (`SUBSCRIPTION_PLANS`); the backend has no
 * plan-catalog or subscription-status endpoint. Checkout is scaffolded behind
 * `SUBSCRIPTION_PAYMENT_ENABLED` (see the flag's note in config.ts): until it's on, the screen shows
 * the plans and keeps the pay action disabled, so no therapist is charged for a subscription the
 * backend wouldn't actually activate (it's created for free during final onboarding today).
 */
export const subscriptionApi = {
  getPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  },

  /** Whether real in-app billing is available yet (gates the screen's pay button). */
  isBillingEnabled(): boolean {
    return SUBSCRIPTION_PAYMENT_ENABLED;
  },

  /**
   * Create a Razorpay order for a plan (POST /payment/create-intent, purpose "subscription").
   * SCAFFOLD ONLY — guarded so it can't run while billing is disabled: the backend does not activate
   * a Subscription on such a payment yet, and no React Native Razorpay checkout is wired. Do not
   * remove the guard without both of those in place.
   */
  async createOrder(
    plan: SubscriptionPlan,
  ): Promise<{ paymentId?: string; razorpayOrderId: string; amount: number; razorpayKeyId?: string }> {
    if (!SUBSCRIPTION_PAYMENT_ENABLED) {
      throw new Error("Subscription billing isn't available yet.");
    }
    const { data } = await client.post("/payment/create-intent", {
      amount: plan.price,
      currency: "INR",
      purpose: "subscription",
      notes: { planId: plan.id, months: String(plan.months) },
    });
    return data;
  },
};
