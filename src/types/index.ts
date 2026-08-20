export type SessionType = "home" | "clinic" | "online";
/**
 * Normalised from the backend's `SessionStatus` enum (uppercased on the wire) plus the
 * `UPCOMING` value `resolveBookingStatus` derives for a future booked plan. `no_show` folds
 * the three backend variants (`patient_no_show`, `therapist_no_show`, `no_show`) together —
 * the therapist UI shows them identically and the distinction is only ever set server-side.
 */
export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "completed"
  | "cancelled"
  | "in_progress"
  | "no_show"
  | "expired";
export type PaymentStatus = "paid" | "pending" | "failed";
export type SessionStatus = "draft" | "active" | "completed" | "paused";
export type SyncStatus = "synced" | "pending" | "error";

export interface Therapist {
  id: string;
  name: string;
  phone: string;
  email?: string;
  specialization: string;
  qualifications: string;
  experienceYears: number;
  rating: number;
  avatarUrl?: string;
  isOnline: boolean;
  isVerified: boolean;
  clinicName?: string;
}

export interface DashboardStats {
  todaySessions: number;
  earnedToday: number;
  rating: number;
  weeklyEarnings: number;
  weeklyChangePercent: number;
  weeklyChart: { day: string; amount: number; isToday: boolean }[];
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: "male" | "female" | "other";
  phone: string;
  condition: string;
  avatarUrl?: string;
  address?: string;
  totalSessions: number;
  lastVisit?: string;
  tags: string[];
}

/**
 * One visit inside a treatment plan. The plan is what the therapist sees as an "appointment";
 * the *sessions* are what every lifecycle endpoint acts on — `generate-otp`, `verify-otp`,
 * `end`, `cancel`, `reschedule-slot` and `assessment` all take a session id, never the plan id.
 */
export interface AppointmentSession {
  id: string;
  /** ISO date of the visit. */
  date: string;
  /** "06:00 AM - 06:40 AM", as the backend formats it. */
  scheduledTime: string;
  /** Start clock only — "06:00". */
  timeLabel: string;
  meridiem: "AM" | "PM";
  /** "Wed, 12 Aug". */
  dateLabel: string;
  status: AppointmentStatus;
  /** The backend's own uppercase status, kept verbatim for anything status-specific. */
  rawStatus: string;
  actualStartTime?: string;
  actualEndTime?: string;
  isRescheduled: boolean;
  rescheduleCount: number;
}

/**
 * A file attached to a treatment plan (GET booking detail `documents`, POST add-docs).
 *
 * ⚠️ `url` is NOT publicly fetchable. The server stores these in `private-uploads` and returns
 * `/file/<id>`, which resolves only through the authenticated `GET /api/v1/file/:id` — 401
 * without a token, and 404 (same as a missing id) for anyone who isn't the patient concerned,
 * the assigned therapist, or an admin. `sessionApi.addDocument` absolutises it with
 * `privateFileUrl`, which KEEPS the `/api/v1` prefix; rendering or downloading one has to
 * attach the bearer token via `lib/utils/privateFile.ts`.
 */
export interface SessionDocument {
  id: string;
  url: string;
  name: string;
  fileType: string;
  uploadedBy?: string;
  createdAt?: string;
  dateLabel?: string;
}

export interface Appointment {
  /** The treatment-plan id — what `/therapist/sessions/my-bookings/:id` is keyed by. */
  id: string;
  patientId: string;
  patientName: string;
  patientAvatarUrl?: string;
  patientAge?: number;
  patientGender?: string;
  patientPhone?: string;
  time: string;
  timeLabel: string;
  meridiem: "AM" | "PM";
  /** ISO date of the session this row is showing, when known. */
  date?: string;
  /** "Today" / "Tomorrow" / "Wed, 12 Aug". */
  dateLabel?: string;
  type: SessionType;
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  amount: number;
  condition: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  etaMin?: number;
  notes?: string;
  insurance?: string;
  workflowStep: number;
  /** Every visit in the plan, earliest first. Only populated by the detail endpoint. */
  sessions?: AppointmentSession[];
  /**
   * The session the therapist would act on right now: the one already `active`, else the
   * earliest not-yet-finished one. This — not `id` — is what the OTP/end/assessment calls take.
   */
  currentSessionId?: string;
  /** Files uploaded against the plan. */
  documents?: SessionDocument[];
  /** Clinical assessments recorded for the plan, newest first. */
  assessments?: ClinicalAssessmentRecord[];
  sessionCount?: number;
  completedSessionCount?: number;
}

export interface SessionChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface Session {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  condition: string;
  type: SessionType;
  status: SessionStatus;
  startedAt?: number;
  endedAt?: number;
  elapsedSeconds: number;
  checklist: SessionChecklistItem[];
  quickNote?: string;
  syncStatus: SyncStatus;
}

// ---------------------------------------------------------------------------
// Clinical assessment — mirrors the backend `ClinicalAssessment` model 1:1
// (prisma/assessment.prisma + treatment-plan/assessment.helper.ts).
// ---------------------------------------------------------------------------

export type AssessmentType =
  | "ORTHO"
  | "POST_SURGICAL"
  | "SPORTS"
  | "NEURO"
  | "GERIATRIC"
  | "CARDIOPULMONARY"
  | "GENERAL";

export type DurationOfSymptoms =
  | "LESS_THAN_ONE_WEEK"
  | "ONE_TO_FOUR_WEEKS"
  | "ONE_TO_THREE_MONTHS"
  | "THREE_TO_SIX_MONTHS"
  | "GREATER_THAN_SIX_MONTHS";

export type RangeOfMotion =
  | "Full"
  | "Mild_Restriction"
  | "Moderate_Restriction"
  | "Severe_Restriction";

export type MuscleStrength =
  | "Normal"
  | "Mild_Weakness"
  | "Moderate_Weakness"
  | "Severe_Weakness";

export type FallRisk = "Low" | "Moderate" | "High";

export type VisitFrequency =
  | "Daily"
  | "Alternate_Days"
  | "Three_Times_Week"
  | "Two_Times_Week"
  | "Weekly";

/**
 * The assessment as the app collects it. Deliberately flat: the backend's own
 * `AssessmentInputPayload` is flat too and re-nests the conditional blocks itself based on
 * `assessmentType`, so nesting here would only mean packing and unpacking twice.
 *
 * Note `treatmentPlanItems` — on the wire that field is called `treatmentPlan`. The rename
 * happens in `mapAssessmentToPayload`, not here, because a field called `treatmentPlan` on a
 * client type would read as "the plan this belongs to" rather than "the techniques chosen".
 */
export interface ClinicalAssessmentInput {
  assessmentType: AssessmentType;
  chiefComplaint: string[];
  durationOfSymptoms: DurationOfSymptoms;
  /** 0–10 VAS. */
  painScore: number;
  painCharacteristics: string[];
  rom: RangeOfMotion;
  muscleStrength: MuscleStrength;

  // Mobility — collected for every assessment type.
  mobilityStatus?: string;
  assistiveDevice?: string;
  fallRisk?: FallRisk;
  functionalLimitations?: string[];

  // POST_SURGICAL only.
  dateOfSurgery?: string;
  surgeryType?: string;
  // SPORTS only.
  sportPlayed?: string;
  mechanismOfInjury?: string;
  // NEURO only.
  cognitiveStatus?: string;
  muscleTone?: string;
  // CARDIOPULMONARY only.
  heartRateBpm?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  spo2Percentage?: number;
  oxygenSupportType?: string;

  problemsIdentified: string[];
  treatmentPlanItems: string[];
  visitFrequency: VisitFrequency;
  suggestedTreatmentDays?: number;
  hepGiven: boolean;
  therapistNotes?: string;
  documentUrls?: string[];
}

/** A stored assessment as it comes back from GET /treatment-session/:id/assessment. */
export interface ClinicalAssessmentRecord extends ClinicalAssessmentInput {
  id: string;
  treatmentPlanId: string;
  createdAt?: string;
  dateLabel?: string;
}

export interface AssessmentFinding {
  id: string;
  type: string;
  label: string;
  details: Record<string, string>;
}

export interface TreatmentGiven {
  id: string;
  type: string;
  label: string;
  details: Record<string, string>;
}

export interface ExercisePrescribed {
  id: string;
  name: string;
  reps: number;
  sets: number;
}

export interface Treatment {
  id: string;
  sessionId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  /** Regions marked on the body map (multi-select). */
  painRegions: string[];
  /**
   * VAS (1-10) severity per pain region — optional per point. A region only appears
   * here once the therapist explicitly scores it; an unscored region is still a valid,
   * saved pain location (just without a severity attached).
   */
  painScales?: Record<string, number>;
  assessmentFindings: AssessmentFinding[];
  treatmentsGiven: TreatmentGiven[];
  exercises: ExercisePrescribed[];
  clinicalNotes: string;
  precautions: string;
  followUpRequired: boolean;
  followUpDate?: string;
  attachments: string[];
  /**
   * The structured clinical assessment the backend actually stores. Optional because drafts
   * saved by an older build won't have it — `mapAssessmentToPayload` fills the required fields
   * from the rest of the treatment (pain regions, findings, notes) when it's absent, so an
   * in-flight draft from before this shipped still syncs rather than being parked as invalid.
   */
  clinical?: ClinicalAssessmentInput;
  syncStatus: SyncStatus;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Availability / slots
// ---------------------------------------------------------------------------

/** Shift buckets the weekly schedule is expressed in (backend: `SlotCategory`). */
export type SlotShift = "morning" | "evening" | "night";

/**
 * One weekday's default availability (GET/PUT /therapist/slots/schedule).
 * The backend accepts either a bare shift array or this object form; the app always sends
 * the object form so `disabledHours` — an hour switched off inside an otherwise-on shift —
 * round-trips instead of being lost.
 */
export interface WeekdaySchedule {
  shifts: SlotShift[];
  disabledHours: number[];
}

export type WeeklySchedule = Record<string, WeekdaySchedule>;

/** What GET /therapist/slots/schedule could actually be read as. */
export interface WeeklyScheduleResult {
  schedule: WeeklySchedule;
  /**
   * The saved schedule exists but the server can't serve it: PUT accepts a day as
   * `{ shifts, disabledHours }` and stores it verbatim, while the GET response contract only
   * permits a bare shift array, so reading it back fails its own validator with a 500. There
   * is nothing to show, but re-saving repairs it — so this is a distinct state from "the
   * request failed", which is retryable and must not be overwritten.
   */
  unreadable: boolean;
}

/** A future date whose default schedule has been overridden (GET /therapist/slots/overrides). */
export interface ScheduleOverride {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  blockedHours: number[];
  /** Every one of the 16 daily slots is blocked. */
  isOff: boolean;
  label: string;
}

export interface Transaction {
  id: string;
  patientName: string;
  amount: number;
  type: "session" | "bonus" | "payout" | "adjustment";
  status: "paid" | "pending" | "failed";
  date: string;
  dateLabel: string;
  sessionType?: SessionType;
}

export interface EarningsSummary {
  totalThisWeek: number;
  changePercent: number;
  totalThisMonth: number;
  pendingPayout: number;
  nextPayoutDate: string;
  weeklyChart: { day: string; amount: number; isToday: boolean }[];
}

/**
 * A payout request/settlement (GET /therapist/payout).
 * `status` mirrors the backend's own lowercase vocabulary rather than being re-mapped —
 * the screen renders it directly and inventing a parallel set would only add a lossy hop.
 */
export interface Payout {
  id: string;
  amount: number;
  status: "requested" | "processing" | "processed" | "failed" | "rejected";
  transactionRef?: string;
  requestedAt?: string;
  processedAt?: string;
  dateLabel: string;
  account?: { upi?: string; bankName?: string };
}

/** Wallet balance + ledger (GET /therapist/wallet). */
export interface WalletInfo {
  balance: number;
  entries: {
    id: string;
    amount: number;
    type: string;
    balanceAfter?: number;
    createdAt?: string;
    dateLabel: string;
  }[];
}

/** A review left by a patient (GET /therapist/:id/reviews). */
export interface TherapistReview {
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerImage?: string | null;
  createdAt: string;
  dateLabel: string;
}

/** One bookable hour in a day's availability (GET /therapist/:id/availability). */
export interface AvailabilitySlot {
  /** Hour-of-day the slot starts, 0-23. This is the value slot-block calls take. */
  startHour: number;
  /** Minutes from midnight — the backend's own representation, kept for exact round-tripping. */
  startTime: number;
  endTime: number;
  category: "morning" | "afternoon" | "evening" | string;
  status: "open" | "booked" | "blocked" | string;
}

export interface AvailabilityDay {
  /** ISO `YYYY-MM-DD`, normalised from the backend's `DD-MM-YYYY` display form. */
  date: string;
  /** The backend's original `DD-MM-YYYY` string, echoed back on block/unblock calls. */
  rawDate: string;
  label: string;
  slots: AvailabilitySlot[];
}

/** A therapist-authored article (GET /therapist/:id/articles, POST /therapist/articles). */
export interface TherapistArticle {
  id?: string;
  title: string;
  content: string;
  createdAt?: string;
  dateLabel: string;
}

/** A therapist-authored FAQ (GET /therapist/:id/faqs, POST /therapist/faqs). */
export interface TherapistFaq {
  id?: string;
  question: string;
  answer: string;
  createdAt?: string;
}

/**
 * An active login session (GET /user/sessions/).
 *
 * `isCurrent` is derived app-side, NOT taken from the backend's `isCurrentSession` — that field
 * comes back `false` for every row including the one making the request, so trusting it would mean
 * never marking the device you're holding.
 */
export interface LoginSession {
  id: string;
  /** Raw user-agent, e.g. "okhttp/4.9.2" (the Android app) or a browser UA string. */
  agent: string;
  /** Human label derived from `agent` — "Physiobuddies app (Android)", "Chrome", … */
  deviceLabel: string;
  ip: string;
  location?: string;
  lastActiveAt?: string;
  lastActiveLabel: string;
  createdAt?: string;
  isCurrent: boolean;
}

/** An audit-log entry (GET /activity/). */
export interface ActivityEntry {
  id: string;
  title: string;
  detail: string;
  ip?: string;
  type: string;
  createdAt?: string;
  dateLabel: string;
}

/** A payment record (GET /payment/). Money *in* — subscriptions — as opposed to payouts. */
export interface PaymentRecord {
  id: string;
  /** Human display number like "INV-SUB-0001". NOT a key for GET /invoice/:id, which wants an ObjectId. */
  invoiceNumber?: string;
  amount: number;
  status: string;
  purpose: string;
  paidAt?: string;
  refundedAt?: string;
  dateLabel: string;
}

/** Platform-authored patient-education content (GET /blog, /blog/:slug). */
export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  /** Only present on the detail fetch. */
  content?: string;
  /** Backend sends a comma-separated STRING; split on the way in. */
  tags: string[];
  thumbnail?: string;
  readTime?: string;
  views: number;
  likes?: number;
  createdAt?: string;
  dateLabel: string;
  reviews?: BlogReview[];
}

/**
 * A reader comment on a blog post (`BlogReview` server-side — the model is named for a review
 * but carries only a comment; there is no rating field).
 *
 * The backend returns the author's display name and nothing that identifies them, so a comment
 * cannot be matched back to the signed-in therapist, and none of edit, delete or "mine" is
 * possible. Posting is the only write.
 */
export interface BlogReview {
  id: string;
  userName: string;
  comment: string;
  createdAt?: string;
}

/** A support ticket the therapist raised (GET/POST /complaint). */
export interface SupportComplaint {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAt?: string;
  dateLabel: string;
  replies: { id: string; role: string; message: string; createdAt?: string }[];
}

export interface AppNotification {
  id: string;
  type: "appointment" | "payment" | "task" | "system" | "message";
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  therapist?: Therapist;
  tokens?: AuthTokens;
  biometricEnabled: boolean;
  phone?: string;
}
