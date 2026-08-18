import { client, toAuthTokens } from "./client";
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
  SessionDocument,
  SupportComplaint,
  TherapistFaq,
  WeeklySchedule,
} from "@/types";
import { API_BASE_URL, SUBSCRIPTION_PAYMENT_ENABLED } from "@/constants/config";
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
   * Apple login — STUB. Backend has no /auth/apple endpoint yet (App Store Guideline 4.8), so
   * this throws rather than pretending: `appleSignIn` can obtain the credential natively, but
   * there is nothing to exchange it with. Wire the call below once the endpoint lands.
   */
  async loginWithApple(
    identityToken: string,
    fullName?: string | null,
  ): Promise<{ tokens: AuthTokens; therapist: Therapist }> {
    // TODO(backend): POST /auth/apple { identityToken, fullName } — endpoint pending.
    void identityToken;
    void fullName;
    throw new Error("Apple Sign-In isn't available yet — backend endpoint pending.");
  },

  /** Fetch the authenticated user (GET /user) + therapist enrichment, mapped to Therapist. */
  async getMyProfile(): Promise<Therapist> {
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
    try {
      const current = await getTokens();
      await client.post("/auth/logout", { refresh: current?.refreshToken });
    } catch {
      // ignore — local sign-out proceeds regardless
    }
  },

  /** Email-OTP: send a 6-digit verification code (POST /auth/send-email-before-signup). */
  async sendEmailOtp(email: string): Promise<void> {
    await client.post("/auth/send-email-before-signup", { email });
  },

  /** Verify an email OTP (POST /auth/verify-email). */
  async verifyEmail(email: string, token: string): Promise<void> {
    await client.post("/auth/verify-email", { email, token });
  },

  /** Request a password-reset OTP (POST /auth/forgot-password). */
  async forgotPassword(email: string): Promise<void> {
    await client.post("/auth/forgot-password", { email });
  },

  /** Complete a password reset (POST /auth/reset-password). */
  async resetPassword(email: string, token: string, newPassword: string): Promise<void> {
    await client.post("/auth/reset-password", { email, token, newPassword });
  },

  /**
   * In-app account deletion (store-mandated).
   * STUB: no backend endpoint exists yet — the call below 404s until the backend adds it.
   */
  async deleteAccount(reason?: string): Promise<void> {
    // TODO(backend): implement DELETE /account (soft-delete + token revocation per DPDP).
    await client.delete("/account", { data: { reason } });
  },

  // REMOVED: the phone-OTP pair (`login` / `verifyOtp`). They accepted any 6-digit code and
  // returned a fabricated access token — against a live backend that meant the app's most
  // prominent login button produced a session every real endpoint answered with 401. There is
  // no phone-OTP login server-side and there never was; login is email/password.
};

export const therapistApi = {
  async getProfile(): Promise<Therapist> {
    const { data } = await client.get<BackendUser>("/user");
    const pub = await fetchTherapistPublic(data.therapistProfile?.id);
    return mapUserToTherapist(data, pub);
  },

  /** Update editable identity fields (PATCH /user accepts { name, mobile }), then re-fetch. */
  async updateProfile(updates: Partial<Therapist>): Promise<Therapist> {
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
    await client.patch("/user/avatar", { avatar: absoluteFileUrl(avatarUrl) });
    return therapistApi.getProfile();
  },

  /** Change the account password (PATCH /user/password). */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await client.patch("/user/password", { currentPassword, newPassword });
  },

  /** Patient reviews for the signed-in therapist (GET /therapist/:id/reviews). */
  async getReviews(): Promise<TherapistReview[]> {
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
 * Both endpoints are real and were probed live; neither had an app surface before.
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
    await client.delete(`/user/sessions/${id}`);
  },

  /** Audit log (GET /activity/) — logins plus API calls made on the account. */
  async listActivity(): Promise<ActivityEntry[]> {
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
    const { data } = await client.get<BackendBlogPost[]>("/blog");
    return mapBlogPosts(data ?? []);
  },

  /** Keyed by SLUG, not id. Note the backend increments `views` on each read. */
  async getBySlug(slug: string): Promise<BlogPost> {
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
    const { data } = await client.post<{ liked: boolean; likes: number }>(`/blog/${postId}/like`);
    return { liked: !!data?.liked, likes: data?.likes ?? 0 };
  },

  /** Post a comment (POST /blog/:id/review, body `{ comment }`) and get the stored row back. */
  async addComment(postId: string, comment: string): Promise<BlogReview> {
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
    const { data } = await client.get<BackendComplaint[]>("/complaints/");
    return mapComplaints(data ?? []);
  },

  /** `type` is a free-text bucket the admin console filters on ("payout", "session", …). */
  async create(type: string, description: string): Promise<void> {
    await client.post("/complaints/", { type, description });
  },

  async reply(complaintId: string, message: string): Promise<void> {
    await client.post(`/complaints/${complaintId}/reply`, { message });
  },
};

export const payoutApi = {
  /** Payout history (GET /therapist/payout). */
  async list(): Promise<Payout[]> {
    const { data } = await client.get<BackendPayout[]>("/therapist/payout");
    return mapPayouts(data);
  },

  async getById(id: string): Promise<Payout> {
    const { data } = await client.get<BackendPayout>(`/therapist/payout/${id}`);
    return mapPayout(data);
  },

  /** Wallet balance + ledger (GET /therapist/wallet) — the withdrawable figure. */
  async getWallet(): Promise<WalletInfo> {
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
    const { data } = await client.post<BackendPayout>("/therapist/payout/request", { amount });
    return mapPayout(data);
  },
};

export const availabilityApi = {
  /** The therapist's own bookable slots (GET /therapist/:id/availability). */
  async getAvailability(): Promise<AvailabilityDay[]> {
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
    const { data } = await client.get<BackendWeeklySchedule>("/therapist/slots/schedule");
    return mapWeeklySchedule(data);
  },

  /** Replace the weekly defaults (PUT /therapist/slots/schedule). */
  async updateWeeklySchedule(schedule: WeeklySchedule): Promise<void> {
    await client.put("/therapist/slots/schedule", { schedule });
  },

  /**
   * Upcoming dates that deviate from the weekly defaults (GET /therapist/slots/overrides).
   * A day with all 16 slots blocked comes back flagged `isOff`.
   */
  async getOverrides(): Promise<ScheduleOverride[]> {
    const { data } = await client.get<BackendScheduleOverride[]>("/therapist/slots/overrides");
    return mapScheduleOverrides(data ?? []);
  },

  /** Apply for leave over a date range (POST /therapist/leaves). */
  async applyLeave(startIsoDate: string, endIsoDate: string, reason?: string): Promise<void> {
    await client.post("/therapist/leaves", {
      startDate: new Date(`${startIsoDate}T00:00:00.000Z`).toISOString(),
      endDate: new Date(`${endIsoDate}T00:00:00.000Z`).toISOString(),
      ...(reason ? { reason } : {}),
    });
  },
};

/**
 * Therapist-authored content: articles and FAQs shown on the public profile.
 *
 * The write routes were missing for a stretch (every POST/PATCH/DELETE answered Express's
 * unmatched-route 404) and the app was made read-only behind a flag. They are live again as of
 * 2026-08-18 — all six verified against api.dev.physiobuddies.in — so the flag is gone.
 *
 * ⚠️ One gap remains: **the list reads still omit `id`.** `POST`/`PATCH` return the full row
 * including its id, but `GET /therapist/:id/{articles,faqs}` returns only
 * `{ title|question, content|answer, createdAt }`. So a row that came back from a list refetch
 * has nothing to address a `PATCH`/`DELETE` to, and the screens mark those rows read-only rather
 * than offering controls that would fail on tap. Tracked in BACKEND_TODO §1.8.
 */
export const contentApi = {
  /** The therapist's published articles (GET /therapist/:id/articles). */
  async listArticles(): Promise<TherapistArticle[]> {
    const { data: user } = await client.get<BackendUser>("/user");
    const therapistId = user.therapistProfile?.id;
    if (!therapistId) return [];
    const { data } = await client.get<BackendArticle[]>(`/therapist/${therapistId}/articles`);
    return mapArticles(data);
  },

  async createArticle(title: string, content: string): Promise<void> {
    await client.post("/therapist/articles", { title, content });
  },

  async updateArticle(id: string, updates: { title?: string; content?: string }): Promise<void> {
    await client.patch(`/therapist/articles/${id}`, updates);
  },

  async deleteArticle(id: string): Promise<void> {
    await client.delete(`/therapist/articles/${id}`);
  },

  /** The therapist's FAQs (GET /therapist/:id/faqs). */
  async listFaqs(): Promise<TherapistFaq[]> {
    const { data: user } = await client.get<BackendUser>("/user");
    const therapistId = user.therapistProfile?.id;
    if (!therapistId) return [];
    const { data } = await client.get<BackendFaq[]>(`/therapist/${therapistId}/faqs`);
    return mapFaqs(data);
  },

  async createFaq(question: string, answer: string): Promise<void> {
    await client.post("/therapist/faqs", { question, answer });
  },

  async updateFaq(id: string, updates: { question?: string; answer?: string }): Promise<void> {
    await client.patch(`/therapist/faqs/${id}`, updates);
  },

  async deleteFaq(id: string): Promise<void> {
    await client.delete(`/therapist/faqs/${id}`);
  },
};

export const appointmentApi = {
  async list(): Promise<Appointment[]> {
    const { data } = await client.get<BackendBooking[]>("/therapist/sessions/my-bookings");
    return mapBookings(data);
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await client.get<BackendBookingDetail>(
      `/therapist/sessions/my-bookings/${id}`,
    );
    return mapBookingDetailToAppointment(data);
  },
};

/**
 * `POST /treatment-session/:id/send-otp` — the documented half is `{ message, expiresInMinutes }`.
 * The echoed code is undocumented, so every field it might plausibly arrive under is declared
 * rather than assuming one and silently getting `undefined`.
 */
interface BackendSendOtp {
  message?: string;
  expiresInMinutes?: number;
  otpCode?: string;
  otp?: string | { code?: string };
  code?: string;
  testOtp?: string;
  devOtp?: string;
}

/**
 * Pull the echoed test OTP out of a send-otp response, whatever the backend chose to call it.
 * Returns `undefined` when the response carries no code — the expected steady state once the
 * echo is removed for production, and the reason the caller must treat this as optional.
 */
function pickEchoedOtp(data: BackendSendOtp | null | undefined): string | undefined {
  if (!data) return undefined;
  const nested = typeof data.otp === "object" ? data.otp?.code : data.otp;
  const raw = data.otpCode ?? nested ?? data.code ?? data.testOtp ?? data.devOtp;
  // Numeric codes arrive as numbers often enough to be worth coercing rather than dropping.
  const value = typeof raw === "number" ? String(raw) : raw;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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
   * Confirm a pending booking (POST /treatment-session/confirm, body `{ sessionId }`).
   *
   * NOT `PATCH /therapist/sessions/my-bookings/:id/accept`, which this used to call and which
   * has never existed — Express answered it with its own unmatched-route 404
   * ("Cannot PATCH /api/v1/therapist/sessions/my-bookings/…/accept"), so accepting a booking
   * failed every time. Note the id travels in the BODY here, not the path, unlike every other
   * call in this object.
   */
  async accept(sessionId: string): Promise<void> {
    await client.post("/treatment-session/confirm", { sessionId });
  },

  /**
   * Ask the backend to send the patient a start-OTP
   * (POST /treatment-session/:id/send-otp — no request body).
   *
   * The old path (`.../my-bookings/:id/generate-otp`) did not exist and 404'd on every tap;
   * this is the route the API actually serves. Server-side rules worth surfacing rather than
   * discovering at the patient's door: the window is 30 minutes before the scheduled start to
   * 2 hours after — outside it the call 400s with a readable message, which the caller shows
   * verbatim — and three wrong verify attempts invalidate the code, requiring a resend.
   *
   * ⚠️ **The deployed backend does not echo the code back.** Probed live 2026-08-18 against a
   * real confirmed session: the 200 body is exactly `{ message: "OTP sent to patient
   * successfully.", expiresInMinutes: 5 }` and nothing else, and `GET /treatment-session/:id`
   * reports `otpCode: null` / `otpExpiresAt: null` straight afterwards. So the code reaches the
   * patient only, and `pickEchoedOtp` correctly returns `undefined` today.
   *
   * The reader is kept because the echo is expected to be added for testing (and `otpCode` is
   * what the backend's own session model calls the field, so that is the name to expect). It
   * accepts the plausible spellings rather than assuming one, and returning nothing is a
   * supported outcome, not a failure — the OTP screen simply shows no hint. Whether an arriving
   * code is ever *displayed* is a separate decision made by `SHOW_TEST_OTP` at the call site:
   * never render a one-time password just because it turned up in a payload.
   */
  async generateOtp(
    sessionId: string,
  ): Promise<{ otpCode?: string; expiresInMinutes?: number; message?: string }> {
    const { data } = await client.post<BackendSendOtp>(
      `/treatment-session/${sessionId}/send-otp`,
    );
    return {
      otpCode: pickEchoedOtp(data),
      expiresInMinutes: data?.expiresInMinutes,
      message: data?.message,
    };
  },

  /**
   * Verify the patient's OTP, which is what actually starts the session (status → `active`).
   * POST /treatment-session/:id/verify-otp, body `{ otp }` — the field name is confirmed by the
   * server's own validation error (`details.field === "otp"`). Answers 202 with `data: null`,
   * so there is no server-side session id to read back; the caller keeps the one it passed in.
   */
  async start(sessionId: string, otp: string): Promise<{ sessionId: string }> {
    await client.post(`/treatment-session/${sessionId}/verify-otp`, { otp });
    return { sessionId };
  },

  // `startFlagged` (emergency start with no patient OTP) was deleted on 2026-08-17. There was
  // never a backend endpoint for it: nothing server-side flipped the session to `active`, so the
  // therapist was shown a running timer for a visit the server still had as pending, and the
  // "supervisor notified" toast was untrue. It is also what produced the fabricated
  // `flagged-session-<planId>` id that killed assessment submission at the very end of a visit
  // (fixed 2026-08-13, now moot). A verified OTP is the only way into a session.

  // REMOVED (2026-08-18): `complete()` — `POST /therapist/sessions/my-bookings/:id/end`.
  // That route has never existed; the server answers Express's unmatched-route 404, so every
  // call failed and the offline sync queue retried it until the row parked as `error`. It was
  // also redundant: `POST /treatment-plan/:planId/assessment` already flips the plan's active
  // session to `completed` server-side, which is what actually ends the visit, and the sync
  // engine now marks the session synced off the back of that.
  //
  // The API's own "complete the session" route is `POST /treatment-session/:id/improvement-record`
  // — already implemented here as `treatmentApi.submitImprovementRecord`, but not yet called by
  // anything, because it REQUIRES `painScoreAfter` and `improvementNotes` and no screen collects
  // them. Wiring it means building that step, not defaulting the numbers. See BACKEND_TODO §1.9.

  /** Cancel a scheduled session (POST /treatment-session/:id/cancel). */
  async cancel(sessionId: string, reason?: string): Promise<void> {
    await client.post(`/treatment-session/${sessionId}/cancel`, reason ? { reason } : {});
  },

  /** Record that the patient didn't show (POST /treatment-session/:id/no-show). */
  async markNoShow(sessionId: string): Promise<void> {
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
    await client.post(`/therapist/sessions/plan/${planId}/complete`, payload ?? {});
  },

  /**
   * Attach ONE clinical document to the session (POST /treatment-session/:id/add-docs).
   *
   * **This is a multipart upload that carries the file itself** — not a JSON reference to a file
   * uploaded elsewhere. The previous version posted `{ documents: [{ url, name, fileType }] }`
   * and was rejected outright with `400 "No file uploaded"`; it was never called by anything, so
   * the breakage stayed latent. Swagger is wrong here too, declaring an `application/json` body
   * of `{ name, fileType }` with no file part at all — the shape below is what the running server
   * actually accepts (probed 2026-08-18). Multer's field name is `file`, matching
   * `/file-upload/single`; `name` and `fileType` ride along as ordinary form fields.
   *
   * Singular by design: one call per document. The old array parameter suggested a batch endpoint
   * that does not exist.
   *
   * Why this endpoint rather than `/file-upload/single`: the bytes land in the server's
   * `private-uploads` directory and the returned `url` (`/file/<id>`) resolves **only** through
   * the authenticated `GET /api/v1/file/:id`, which 401s without a token and answers 404 — the
   * same as a missing id — to anyone who isn't the patient concerned, the assigned therapist, or
   * an admin. `/file-upload/single` writes to a public static path instead, which is fine for an
   * avatar and wrong for an X-ray.
   */
  async addDocument(
    sessionId: string,
    uri: string,
    fileName: string,
    mimeType: string,
  ): Promise<SessionDocument> {
    const data = await uploadMultipart<BackendSessionDocument>(
      `/treatment-session/${sessionId}/add-docs`,
      uri,
      fileName,
      mimeType,
      { name: fileName, fileType: mimeType },
    );
    if (!data?.id) throw new Error("Upload succeeded but the server returned no document id.");
    return {
      id: data.id,
      name: data.name ?? fileName,
      url: privateFileUrl(data.url ?? `/file/${data.id}`),
      fileType: data.fileType ?? mimeType,
      createdAt: data.createdAt,
    };
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
    const { data } = await client.get<BackendBooking[]>("/therapist/sessions/my-bookings");
    return buildPatientsFromBookings(data ?? []);
  },

  /** `id` is the treatment-plan id the roster row carries. */
  async getById(id: string): Promise<Patient> {
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
    const [commissions, wallet] = await Promise.all([
      client.get<BackendCommission[]>("/therapist/earnings"),
      client.get<BackendWallet>("/therapist/wallet"),
    ]);
    return buildEarningsSummary(commissions.data, wallet.data);
  },

  async getTransactions(): Promise<Transaction[]> {
    const { data } = await client.get<BackendCommission[]>("/therapist/earnings");
    return mapCommissions(data);
  },
};

/**
 * Notifications — **real as of 2026-08-17**, and note the path: `/notifications` (plural).
 *
 * The `/notification/*` (singular) mount is a set of empty controllers that never send a
 * response and hang the request — it is dead. Probed live:
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
    const { data } = await client.get<BackendNotificationPage>("/notifications/", {
      params: { limit: 50 },
    });
    return mapNotifications(data?.items ?? []);
  },

  /** Badge count without pulling the list (GET /notifications/unread-count). */
  async unreadCount(): Promise<number> {
    const { data } = await client.get<{ unreadCount?: number }>("/notifications/unread-count");
    return data?.unreadCount ?? 0;
  },

  async markRead(id: string): Promise<void> {
    await client.patch(`/notifications/${id}/read`);
  },

  async markAllRead(): Promise<void> {
    await client.patch("/notifications/read-all");
  },

  async registerPushToken(token: string): Promise<void> {
    // Still genuinely absent: there is no push-token registration route on the server, so a
    // device token has nowhere to go and push cannot be delivered even with FCM configured.
    // The in-app list above works regardless — it is polled, not pushed.
    void token;
  },
};

/**
 * `POST /treatment-session/:id/add-docs`, verified live 2026-08-18. The server also echoes
 * `storagePath` (`/app/private-uploads/<hash>`), `treatmentPlanId`, `uploadedBy` and
 * `uploadedByUserId`; only the fields the app uses are declared. Note `url` is the relative
 * `/file/<id>`, not an absolute one — see `privateFileUrl`.
 */
interface BackendSessionDocument {
  id?: string;
  name?: string;
  url?: string;
  fileType?: string;
  mimeType?: string;
  createdAt?: string;
}

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

/**
 * Resolve a PRIVATE document url (`/file/<id>`) returned by `add-docs`.
 *
 * Deliberately NOT `absoluteFileUrl`, and the difference is the whole point: `/uploads/...` is
 * served from the site root, so that helper *strips* the `/api/v1` suffix. `/file/:id` is a
 * versioned API route, so this one *keeps* it. Passing a private url through `absoluteFileUrl`
 * yields a 404 at a public path — which would look like a missing file rather than a wrong URL.
 *
 * The result still needs an `Authorization` header to fetch; see `lib/utils/privateFile.ts`.
 */
export function privateFileUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
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

/**
 * POST a file as `multipart/form-data` to `path`, under multer field `file`, with any extra
 * fields appended alongside it. Shared by the public uploader (`/file-upload/single`) and the
 * private clinical one (`/treatment-session/:id/add-docs`) because both take the same field name
 * — and, more importantly, because both need the Content-Type handling below to be exactly right.
 */
async function uploadMultipart<T>(
  path: string,
  uri: string,
  fileName: string,
  mimeType: string,
  extra?: Record<string, string>,
): Promise<T> {
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
  const { data } = await client.post<T>(path, formData, { headers: { "Content-Type": null } });
  return data;
}

async function uploadSingle(
  uri: string,
  fileName: string,
  mimeType: string,
  extra?: Record<string, string>,
): Promise<{ url: string; id: string }> {
  const data = await uploadMultipart<BackendUpload>(
    "/file-upload/single",
    uri,
    fileName,
    mimeType,
    extra,
  );
  return normalizeUpload(data);
}

/**
 * The PUBLIC uploader. `/file-upload/single` writes to a static path that is not behind the auth
 * middleware, so it is right for a profile photo or a therapist's own credential document and
 * WRONG for anything about a patient.
 *
 * Clinical files — session photos, X-rays, reports — go through `sessionApi.addDocument`
 * instead, which stores them privately. `uploadSessionPhoto` and `uploadTreatmentAttachment`
 * used to live here and were removed on 2026-08-18 for exactly that reason: they put patient
 * photographs on an ungated URL, and the `sessionId`/`treatmentId` form fields they sent to
 * compensate were read by nothing server-side.
 */
export const uploadApi = {
  /** A KYC / credential document or a profile photo — same endpoint, no server-side kind. */
  async uploadDocument(
    uri: string,
    fileName: string,
    mimeType: string,
    kind?: string,
  ): Promise<{ url: string; id: string }> {
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
