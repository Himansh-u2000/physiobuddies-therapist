/**
 * Backend → app domain mappers (Phase 5 integration).
 *
 * The physiobuddies-web backend returns display-shaped JSON whose field names and structure
 * differ from the app's domain types (`src/types`). These pure functions translate the real
 * responses into the shapes the screens already consume, so the UI is untouched by the wire
 * format. Kept separate from `services.ts` so they're unit-testable without the network.
 *
 * Documented lossy spots (backend simply doesn't return the data):
 *  - Appointment.amount: `my-bookings` carries no per-booking price → 0.
 *  - Appointment payment/coords/distance: not provided → omitted.
 * These are tracked in the Phase 5 backend gap list in progress.md.
 */
import type {
  ActivityEntry,
  AppNotification,
  Appointment,
  AppointmentSession,
  AppointmentStatus,
  AvailabilityDay,
  BlogPost,
  BlogReview,
  ClinicalAssessmentInput,
  ClinicalAssessmentRecord,
  DashboardStats,
  EarningsSummary,
  LoginSession,
  Patient,
  PaymentRecord,
  Payout,
  ScheduleOverride,
  SessionDocument,
  SessionType,
  SlotShift,
  SupportComplaint,
  Therapist,
  TherapistArticle,
  TherapistFaq,
  TherapistReview,
  Transaction,
  WalletInfo,
  WeekdaySchedule,
  WeeklySchedule,
} from "@/types";
import { toIsoDate } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Backend response shapes (what the live API actually returns)
// ---------------------------------------------------------------------------

/** GET /user */
export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  image?: string | null;
  createdAt?: string;
  therapistStatus?: {
    isOnboardingFilled?: boolean;
    isVerified?: boolean;
    isFinalOnboardingFilled?: boolean;
  } | null;
  therapistProfile?: {
    id: string;
    about?: string | null;
    displayAddress?: string | null;
    location?: { lat: number; lng: number } | null;
  } | null;
}

/** GET /therapist/:id */
export interface BackendTherapistPublic {
  id: string;
  name: string;
  specializations?: string[];
  experience?: number | null;
  rating?: number | null;
  totalReviews?: number;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  displayAddress?: string | null;
  image?: string | null;
  about?: string | null;
  distance?: number | null;
}

/** GET /therapist/sessions/my-bookings — one element */
export interface BackendBooking {
  id: string;
  patientID: string;
  patientName: string;
  patientGender?: "MALE" | "FEMALE" | "OTHER" | string;
  patientAge?: number | null;
  treatmentMode?: string;
  status: string; // BLOCKED | UPCOMING | COMPLETED | CANCELLED | ...
  lastSessionDate?: string; // "July 26, 2026"
  lastSessionTime?: string; // "02:00 PM - 03:00 PM"
}

/** One element of `sessions` in the booking detail. */
export interface BackendBookingSession {
  id: string;
  /** ISO. */
  date?: string;
  /** "06:00 AM - 06:40 AM". */
  scheduledTime?: string;
  status?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  isRescheduled?: boolean;
  rescheduleCount?: number;
}

/** One element of `documents` (a `TreatmentPlanDocRecord`). */
export interface BackendDocRecord {
  id?: string;
  url?: string;
  name?: string;
  fileType?: string;
  uploadedBy?: string;
  createdAt?: string;
}

/**
 * A stored `ClinicalAssessment`. The conditional blocks come back NESTED here even though the
 * write payload is flat — the backend's mapper packs them on the way in and Prisma hands them
 * back as composite types on the way out. `mapAssessment` flattens them again.
 */
export interface BackendAssessment {
  id: string;
  treatmentPlanId?: string;
  assessmentType?: string;
  chiefComplaint?: string[];
  durationOfSymptoms?: string;
  painScore?: number;
  painCharacteristics?: string[];
  rom?: string;
  muscleStrength?: string;
  mobilityDetails?: {
    mobilityStatus?: string | null;
    assistiveDevice?: string | null;
    fallRisk?: string | null;
    functionalLimitations?: string[];
  } | null;
  surgicalDetails?: { dateOfSurgery?: string | null; surgeryType?: string | null } | null;
  sportsDetails?: { sportPlayed?: string | null; mechanismOfInjury?: string | null } | null;
  neurologicalDetails?: { cognitiveStatus?: string | null; muscleTone?: string | null } | null;
  cardiopulmonaryVitals?: {
    heartRateBpm?: number | null;
    bloodPressureSys?: number | null;
    bloodPressureDia?: number | null;
    spo2Percentage?: number | null;
    oxygenSupportType?: string | null;
  } | null;
  problemsIdentified?: string[];
  /** Note the name difference: written as `treatmentPlan`, read back as `treatmentPlanItems`. */
  treatmentPlanItems?: string[];
  visitFrequency?: string;
  suggestedTreatmentDays?: number | null;
  hepGiven?: boolean;
  therapistNotes?: string | null;
  documentUrls?: string[];
  createdAt?: string;
}

/** GET /therapist/sessions/my-bookings/:id */
export interface BackendBookingDetail {
  id: string;
  mode?: string;
  overallStatus: string;
  patient: {
    id: string;
    name: string;
    dob?: string;
    gender?: string;
    phone?: string;
    image?: string | null;
  };
  condition?: { title?: string };
  problemDescription?: string;
  location?: {
    address?: string;
    landmark?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    /**
     * ⚠️ Not sent on the therapist route today (verified live 2026-08-20). The record has the
     * point — `PatientLocation.location` is `Json { lat, lng }`, and the therapist query even
     * selects it — but `formatTherapistBookingDetail` omits it when it builds the response.
     * The PATIENT's copy of the same booking (`GET /patient/my-bookings/:id`) does return it,
     * under this name, which is why the field is typed to match: the moment the backend copies
     * that line across, navigation starts using real coordinates with no further app change.
     * Until then the route screen falls back to searching maps for the address string, which is
     * what the web app does. Tracked in BACKEND_TODO.md.
     */
    coords?: { lat?: number; lng?: number } | null;
  };
  sessions?: BackendBookingSession[];
  documents?: BackendDocRecord[];
  clinicalAssessments?: BackendAssessment[];
  improvementRecords?: unknown[];
}

/** GET /user/sessions/ — one element */
export interface BackendLoginSession {
  id: string;
  agent?: string;
  location?: string;
  ip?: string;
  lastLoggedAt?: string;
  createdAt?: string;
  /** ⚠️ Comes back `false` for every row, including the caller's own — do not trust it. */
  isCurrentSession?: boolean;
}

/** GET /activity/ — one element */
export interface BackendActivity {
  id: string;
  userId?: string;
  title?: string;
  /** Either a sentence, or a JSON blob of the logged request (including its body). */
  data?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  type?: string;
  createdAt?: string;
}

/** GET /payment/ — one element */
export interface BackendPayment {
  id: string;
  invoiceId?: string;
  amount?: number;
  status?: string;
  purpose?: string;
  paidAt?: string | null;
  failedAt?: string | null;
  refundedAt?: string | null;
  createdAt?: string;
  subscriptionId?: string | null;
}

/** GET /blog/ (+ /:slug) — one element. `content`/`likes`/`reviews` only on the detail fetch. */
export interface BackendBlogPost {
  id: string;
  title?: string;
  summary?: string;
  content?: string;
  /** Comma-separated string, e.g. "back,stretching,wellness". */
  tags?: string;
  thumbnail?: string;
  slug?: string;
  readTime?: string;
  views?: number;
  likes?: number;
  createdAt?: string;
  reviews?: BackendBlogReview[];
}

/** GET /notifications/ — cursor-paginated envelope. */
export interface BackendNotificationPage {
  items?: BackendNotification[];
  nextCursor?: string | null;
  hasMore?: boolean;
  unreadCount?: number;
}

/** One row of `GET /notifications/`. */
export interface BackendNotification {
  id: string;
  userId?: string;
  title?: string;
  description?: string;
  isRead?: boolean;
  priority?: "low" | "medium" | "high";
  status?: "queued" | "sent" | "delivered" | "failed";
  event?: string | null;
  /** The server's delivery channel, NOT the app's subject category. */
  type?: "transactional" | "activity" | "promotional";
  metadata?: unknown;
  readAt?: string | null;
  createdAt?: string;
  time?: string;
}

/** One comment, as returned inside `GET /blog/:slug` and by `POST /blog/:id/review`. */
export interface BackendBlogReview {
  id?: string;
  userName?: string;
  comment?: string;
  createdAt?: string;
}

/** GET /complaint — one element */
export interface BackendComplaint {
  id: string;
  type?: string;
  description?: string;
  status?: string;
  createdAt?: string;
  reply?: { id?: string; role?: string; message?: string; createdAt?: string }[];
}

/** GET /therapist/slots/schedule */
export interface BackendWeeklySchedule {
  schedule?: Record<string, string[] | { shifts?: string[]; disabledHours?: number[] }>;
}

/** GET /therapist/slots/overrides — one element */
export interface BackendScheduleOverride {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  blockedHours?: number[];
  isOff?: boolean;
}

/** GET /therapist/earnings — one element (a commission record) */
export interface BackendCommission {
  id: string;
  billId?: string;
  therapistId?: string;
  therapistName?: string;
  sessionDate: string;
  patientName: string;
  sessionAmount: number;
  platformFee: number;
  therapistAmount: number;
  platformRateUsed?: number;
  calculatedAt?: string;
}

/** GET /therapist/wallet */
export interface BackendWallet {
  balance: number;
  entries?: {
    id: string;
    amount: number;
    type: string;
    referenceId?: string;
    balanceAfter?: number;
    createdAt?: string;
  }[];
}

/** GET /therapist/payout (+ /:id) — one element */
export interface BackendPayout {
  id: string;
  therapistId?: string;
  amount: number;
  status?: string;
  transactionRef?: string | null;
  processedBy?: string | null;
  processedAt?: string | null;
  requestedFromIp?: string | null;
  accountSnapshotJson?: { upi?: string; bankName?: string } | null;
  createdAt?: string;
}

/** GET /therapist/:id/reviews — one element */
export interface BackendReview {
  rating: number;
  comment?: string;
  createdAt?: string;
  reviewerName?: string;
  reviewerImage?: string | null;
}

/** GET /therapist/:id/availability — one element */
export interface BackendAvailabilityDay {
  /** `DD-MM-YYYY` — note this is NOT ISO, and NOT the format the block endpoint takes. */
  date: string;
  /**
   * The live server describes a slot as `startMinute` + `durationMinutes` (minutes from
   * midnight, so 360 = 6 AM). An earlier revision sent `startHour`/`startTime`/`endTime`
   * instead; both are accepted here because the hour is the only thing the app can act on —
   * `/therapist/slots/block` takes `startHours` — and reading the wrong pair silently yields
   * `startHour: undefined`, which drops every slot out of the shift grid.
   */
  timeSlots?: {
    startMinute?: number;
    durationMinutes?: number;
    startHour?: number;
    startTime?: number;
    endTime?: number;
    category?: string;
    status?: string;
  }[];
}

/** GET /therapist/:id/articles — one element */
export interface BackendArticle {
  id?: string;
  title: string;
  content: string;
  createdAt?: string;
}

/** GET /therapist/:id/faqs — one element */
export interface BackendFaq {
  id?: string;
  question: string;
  answer: string;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Mon=0 … Sun=6 (JS getDay is Sun=0). */
function weekdayIndexMon0(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function startOfWeekMon(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - weekdayIndexMon0(s));
  return s;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function parseSessionType(mode?: string): SessionType {
  switch (mode) {
    case "home_visit":
      return "home";
    case "clinic":
      return "clinic";
    case "online":
      return "online";
    default:
      return "home";
  }
}

/**
 * Backend booking status → app AppointmentStatus. BLOCKED slots are filtered out upstream.
 *
 * The vocabulary is the `SessionStatus`/`TreatmentPlanStatus` Prisma enums uppercased, plus
 * `UPCOMING`, which `resolveBookingStatus` synthesises for a future `BOOKED` plan. CONFIRMED
 * is the single most common value on the wire — a paid, scheduled visit — so falling through
 * to "pending" (as this did before the enums were known) mislabelled almost every appointment.
 */
export function mapBookingStatus(status?: string): AppointmentStatus {
  switch ((status ?? "").toUpperCase()) {
    case "UPCOMING":
    case "BOOKED":
    case "CONFIRMED":
    case "ONGOING":
    case "TREATMENT_PLANNED":
      return "confirmed";
    case "COMPLETED":
    case "SETTLED":
      return "completed";
    case "CANCELLED":
    case "CANCELED":
    case "ABANDONED":
      return "cancelled";
    case "ACTIVE":
    case "IN_PROGRESS":
      return "in_progress";
    case "NO_SHOW":
    case "PATIENT_NO_SHOW":
    case "THERAPIST_NO_SHOW":
      return "no_show";
    case "EXPIRED":
      return "expired";
    default:
      // PENDING (slot held, payment not completed) and CREATED land here.
      return "pending";
  }
}

/** A session that still needs the therapist to do something — the OTP/end flow applies. */
const OPEN_SESSION_STATUSES: AppointmentStatus[] = ["confirmed", "in_progress", "pending"];

/** "02:00 PM - 03:00 PM" → { time, timeLabel, meridiem }. Defaults are safe for a missing value. */
function parseTimeRange(range?: string): { time: string; timeLabel: string; meridiem: "AM" | "PM" } {
  const start = (range ?? "").split(" - ")[0]?.trim() ?? "";
  const [clock, ap] = start.split(/\s+/);
  const meridiem: "AM" | "PM" = ap === "AM" ? "AM" : "PM";
  const time = clock || "00:00";
  return { time, timeLabel: time, meridiem };
}

/** Parse a display date like "July 26, 2026" → Date, or null when unparseable. */
function parseDisplayDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ageFromDob(dob?: string): number | undefined {
  const d = parseDisplayDate(dob);
  if (!d) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : undefined;
}

/** "Today" / "Yesterday" / "24 Jun" for a transaction/earnings date. */
function relativeDateLabel(date: Date): string {
  const today = new Date();
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yest)) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Forward-looking sibling of `relativeDateLabel` — appointments are usually ahead, not behind. */
function scheduleDateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export function mapUserToTherapist(
  user: BackendUser,
  pub?: BackendTherapistPublic | null,
): Therapist {
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    phone: user.phone ?? "",
    specialization: pub?.specializations?.length
      ? pub.specializations.join(", ")
      : "",
    qualifications: "",
    experienceYears: pub?.experience ?? 0,
    rating: pub?.rating ?? 0,
    avatarUrl: user.image ?? pub?.image ?? undefined,
    isOnline: false,
    isVerified: !!user.therapistStatus?.isVerified,
    clinicName: user.therapistProfile?.displayAddress ?? pub?.displayAddress ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

/** Map a booking list row. Returns null for non-appointment rows (therapist-blocked slots). */
export function mapBookingToAppointment(b: BackendBooking): Appointment | null {
  if ((b.status ?? "").toUpperCase() === "BLOCKED") return null;
  const { time, timeLabel, meridiem } = parseTimeRange(b.lastSessionTime);
  const status = mapBookingStatus(b.status);
  const date = parseDisplayDate(b.lastSessionDate);
  return {
    id: b.id,
    patientId: b.patientID,
    patientName: b.patientName,
    patientAge: b.patientAge ?? undefined,
    patientGender: b.patientGender ? b.patientGender.toLowerCase() : undefined,
    time,
    timeLabel,
    meridiem,
    date: date ? toIsoDate(date) : undefined,
    dateLabel: date ? scheduleDateLabel(date) : b.lastSessionDate,
    type: parseSessionType(b.treatmentMode),
    status,
    paymentStatus: status === "completed" ? "paid" : "pending",
    amount: 0, // backend list carries no per-booking price (documented gap)
    condition: "Therapy session",
    workflowStep: workflowStepFor(status),
  };
}

/**
 * Where the visit sits in the Route → OTP → Care → Note flow the cards render. Derived from
 * status rather than stored: the backend has no notion of the app's workflow steps, and a
 * hardcoded `1` (what this was) made every completed appointment look like it hadn't started.
 */
function workflowStepFor(status: AppointmentStatus): number {
  switch (status) {
    case "in_progress":
      return 3;
    case "completed":
      return 5;
    case "cancelled":
    case "no_show":
    case "expired":
      return 0;
    default:
      return 1;
  }
}

/** Map a booking list into appointments, dropping blocked/unmappable rows. */
export function mapBookings(list: BackendBooking[]): Appointment[] {
  return list
    .map(mapBookingToAppointment)
    .filter((a): a is Appointment => a !== null);
}

export function mapBookingSession(s: BackendBookingSession): AppointmentSession {
  const { time, timeLabel, meridiem } = parseTimeRange(s.scheduledTime);
  const d = s.date ? new Date(s.date) : null;
  const valid = d && !Number.isNaN(d.getTime());
  return {
    id: s.id,
    date: valid ? d.toISOString() : (s.date ?? ""),
    scheduledTime: s.scheduledTime ?? `${time} ${meridiem}`,
    timeLabel,
    meridiem,
    dateLabel: valid ? scheduleDateLabel(d) : "",
    status: mapBookingStatus(s.status),
    rawStatus: (s.status ?? "").toUpperCase(),
    actualStartTime: s.actualStartTime,
    actualEndTime: s.actualEndTime,
    isRescheduled: !!s.isRescheduled,
    rescheduleCount: s.rescheduleCount ?? 0,
  };
}

export function mapDocuments(list?: BackendDocRecord[]): SessionDocument[] {
  return (list ?? [])
    .filter((doc) => !!doc.url)
    .map((doc, i) => {
      const d = doc.createdAt ? new Date(doc.createdAt) : null;
      return {
        id: doc.id ?? `${doc.url}-${i}`,
        url: doc.url as string,
        name: doc.name || "Document",
        fileType: doc.fileType || "file",
        uploadedBy: doc.uploadedBy,
        createdAt: doc.createdAt,
        dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
      };
    });
}

/**
 * Which session the therapist acts on next. An `active` one always wins — it's mid-visit and
 * every other choice would point the OTP/end buttons at the wrong record. Otherwise the
 * earliest still-open session, which is what "start my next appointment" means.
 */
export function pickCurrentSession(sessions: AppointmentSession[]): AppointmentSession | undefined {
  const active = sessions.find((s) => s.status === "in_progress");
  if (active) return active;
  const open = sessions
    .filter((s) => OPEN_SESSION_STATUSES.includes(s.status))
    .sort((a, b) => a.date.localeCompare(b.date));
  return open[0];
}

export function mapBookingDetailToAppointment(d: BackendBookingDetail): Appointment {
  // The backend orders `sessions` newest-first; the therapist reads a course of treatment
  // forwards, and "session 1" must mean the first visit, so re-sort ascending here once.
  const sessions = (d.sessions ?? []).map(mapBookingSession).sort((a, b) => a.date.localeCompare(b.date));
  const current = pickCurrentSession(sessions);
  // Show the session the therapist would act on; fall back to the last one for a finished plan
  // so a completed appointment reads as its final visit rather than as an empty slot.
  const shown = current ?? sessions[sessions.length - 1];
  const status = mapBookingStatus(d.overallStatus);
  const loc = d.location;
  const address = loc
    ? [loc.address, loc.landmark, loc.city, loc.state, loc.postalCode]
        .filter(Boolean)
        .join(", ")
    : undefined;
  // Guarded rather than passed straight through: `coords` is absent on this route today, and a
  // half-populated pair (one of lat/lng present) would send navigation to a point on the equator
  // rather than fall back to the address search.
  const lat = loc?.coords?.lat;
  const lng = loc?.coords?.lng;
  const hasCoords = typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0);
  return {
    id: d.id,
    patientId: d.patient?.id ?? "",
    patientName: d.patient?.name ?? "Patient",
    patientAge: ageFromDob(d.patient?.dob),
    patientGender: d.patient?.gender ? d.patient.gender.toLowerCase() : undefined,
    patientPhone: d.patient?.phone,
    time: shown?.timeLabel ?? "00:00",
    timeLabel: shown?.timeLabel ?? "00:00",
    meridiem: shown?.meridiem ?? "AM",
    date: shown?.date,
    dateLabel: shown?.dateLabel,
    type: parseSessionType(d.mode),
    status,
    paymentStatus: status === "completed" ? "paid" : "pending",
    amount: 0,
    condition: d.condition?.title ?? "Therapy session",
    address,
    latitude: hasCoords ? lat : undefined,
    longitude: hasCoords ? lng : undefined,
    notes: d.problemDescription,
    workflowStep: workflowStepFor(current?.status ?? status),
    sessions,
    currentSessionId: current?.id,
    documents: mapDocuments(d.documents),
    assessments: mapAssessments(d.clinicalAssessments),
    sessionCount: sessions.length,
    completedSessionCount: sessions.filter((s) => s.status === "completed").length,
  };
}

// ---------------------------------------------------------------------------
// Clinical assessment
// ---------------------------------------------------------------------------

/** Coerce a wire string to one of a known set, falling back rather than trusting it blindly. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const ASSESSMENT_TYPES = [
  "ORTHO",
  "POST_SURGICAL",
  "SPORTS",
  "NEURO",
  "GERIATRIC",
  "CARDIOPULMONARY",
  "GENERAL",
] as const;
const DURATIONS = [
  "LESS_THAN_ONE_WEEK",
  "ONE_TO_FOUR_WEEKS",
  "ONE_TO_THREE_MONTHS",
  "THREE_TO_SIX_MONTHS",
  "GREATER_THAN_SIX_MONTHS",
] as const;
const ROMS = ["Full", "Mild_Restriction", "Moderate_Restriction", "Severe_Restriction"] as const;
const STRENGTHS = ["Normal", "Mild_Weakness", "Moderate_Weakness", "Severe_Weakness"] as const;
const FALL_RISKS = ["Low", "Moderate", "High"] as const;
const FREQUENCIES = [
  "Daily",
  "Alternate_Days",
  "Three_Times_Week",
  "Two_Times_Week",
  "Weekly",
] as const;

/** Flatten a stored assessment back into the flat shape the form and the write payload use. */
export function mapAssessment(a: BackendAssessment): ClinicalAssessmentRecord {
  const d = a.createdAt ? new Date(a.createdAt) : null;
  const mobility = a.mobilityDetails ?? undefined;
  const vitals = a.cardiopulmonaryVitals ?? undefined;
  return {
    id: a.id,
    treatmentPlanId: a.treatmentPlanId ?? "",
    assessmentType: oneOf(a.assessmentType, ASSESSMENT_TYPES, "GENERAL"),
    chiefComplaint: a.chiefComplaint ?? [],
    durationOfSymptoms: oneOf(a.durationOfSymptoms, DURATIONS, "ONE_TO_FOUR_WEEKS"),
    painScore: a.painScore ?? 0,
    painCharacteristics: a.painCharacteristics ?? [],
    rom: oneOf(a.rom, ROMS, "Full"),
    muscleStrength: oneOf(a.muscleStrength, STRENGTHS, "Normal"),
    mobilityStatus: mobility?.mobilityStatus ?? undefined,
    assistiveDevice: mobility?.assistiveDevice ?? undefined,
    fallRisk: mobility?.fallRisk ? oneOf(mobility.fallRisk, FALL_RISKS, "Low") : undefined,
    functionalLimitations: mobility?.functionalLimitations ?? [],
    dateOfSurgery: a.surgicalDetails?.dateOfSurgery ?? undefined,
    surgeryType: a.surgicalDetails?.surgeryType ?? undefined,
    sportPlayed: a.sportsDetails?.sportPlayed ?? undefined,
    mechanismOfInjury: a.sportsDetails?.mechanismOfInjury ?? undefined,
    cognitiveStatus: a.neurologicalDetails?.cognitiveStatus ?? undefined,
    muscleTone: a.neurologicalDetails?.muscleTone ?? undefined,
    heartRateBpm: vitals?.heartRateBpm ?? undefined,
    bloodPressureSys: vitals?.bloodPressureSys ?? undefined,
    bloodPressureDia: vitals?.bloodPressureDia ?? undefined,
    spo2Percentage: vitals?.spo2Percentage ?? undefined,
    oxygenSupportType: vitals?.oxygenSupportType ?? undefined,
    problemsIdentified: a.problemsIdentified ?? [],
    treatmentPlanItems: a.treatmentPlanItems ?? [],
    visitFrequency: oneOf(a.visitFrequency, FREQUENCIES, "Daily"),
    suggestedTreatmentDays: a.suggestedTreatmentDays ?? undefined,
    hepGiven: !!a.hepGiven,
    therapistNotes: a.therapistNotes ?? undefined,
    documentUrls: a.documentUrls ?? [],
    createdAt: a.createdAt,
    dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
  };
}

export function mapAssessments(list?: BackendAssessment[]): ClinicalAssessmentRecord[] {
  return (list ?? []).map(mapAssessment);
}

/**
 * App assessment → the flat body POST /treatment-session/:id/assessment expects. Two things
 * the backend's `mapClinicalAssessmentPayload` cares about that aren't obvious from the
 * response shape:
 *  - the techniques array is called `treatmentPlan` on the way in, `treatmentPlanItems` on the
 *    way out;
 *  - the conditional blocks are only persisted when `assessmentType` matches, so sending e.g.
 *    `sportPlayed` on an ORTHO assessment silently drops it. Sending them anyway is harmless
 *    and keeps the caller from having to know the rule.
 */
export function mapAssessmentToPayload(a: ClinicalAssessmentInput): Record<string, unknown> {
  const { treatmentPlanItems, ...rest } = a;
  const payload: Record<string, unknown> = { ...rest, treatmentPlan: treatmentPlanItems };
  // Strip undefined so optional blocks arrive absent rather than as explicit nulls.
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Earnings
// ---------------------------------------------------------------------------

export function mapCommissionToTransaction(c: BackendCommission): Transaction {
  const date = new Date(c.sessionDate);
  return {
    id: c.id,
    patientName: c.patientName,
    amount: c.therapistAmount,
    type: "session",
    status: "paid",
    date: Number.isNaN(date.getTime()) ? c.sessionDate : toIsoDate(date),
    dateLabel: Number.isNaN(date.getTime()) ? c.sessionDate : relativeDateLabel(date),
  };
}

export function mapCommissions(list: BackendCommission[]): Transaction[] {
  return list.map(mapCommissionToTransaction);
}

/** Build the 7-day (Mon–Sun) chart of net earnings for the current week. */
function weeklyChart(commissions: BackendCommission[]): EarningsSummary["weeklyChart"] {
  const weekStart = startOfWeekMon(new Date());
  const todayIdx = weekdayIndexMon0(new Date());
  const buckets = new Array(7).fill(0);
  for (const c of commissions) {
    const d = new Date(c.sessionDate);
    if (Number.isNaN(d.getTime())) continue;
    const diffDays = Math.floor((d.getTime() - weekStart.getTime()) / 86_400_000);
    if (diffDays >= 0 && diffDays < 7) buckets[diffDays] += c.therapistAmount;
  }
  return WEEKDAYS.map((day, i) => ({ day, amount: buckets[i], isToday: i === todayIdx }));
}

function sumInRange(commissions: BackendCommission[], from: Date, to: Date): number {
  return commissions.reduce((sum, c) => {
    const d = new Date(c.sessionDate);
    if (Number.isNaN(d.getTime())) return sum;
    return d >= from && d < to ? sum + c.therapistAmount : sum;
  }, 0);
}

/** Next Monday, formatted "Mon, 27 Jul 2026" — the app pays out weekly. */
function nextPayoutLabel(): string {
  const d = new Date();
  const daysUntilMon = (8 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + daysUntilMon);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildEarningsSummary(
  commissions: BackendCommission[],
  wallet?: BackendWallet | null,
): EarningsSummary {
  const weekStart = startOfWeekMon(new Date());
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek = sumInRange(commissions, weekStart, nextWeek);
  const lastWeek = sumInRange(commissions, lastWeekStart, weekStart);
  const changePercent =
    lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const thisMonth = sumInRange(commissions, monthStart, nextMonth);

  return {
    totalThisWeek: thisWeek,
    changePercent,
    totalThisMonth: thisMonth,
    pendingPayout: wallet?.balance ?? 0,
    nextPayoutDate: nextPayoutLabel(),
    weeklyChart: weeklyChart(commissions),
  };
}

// ---------------------------------------------------------------------------
// Payouts / wallet
// ---------------------------------------------------------------------------

const PAYOUT_STATUSES: Payout["status"][] = [
  "requested",
  "processing",
  "processed",
  "failed",
  "rejected",
];

function mapPayoutStatus(status?: string): Payout["status"] {
  const s = (status ?? "").toLowerCase();
  return (PAYOUT_STATUSES as string[]).includes(s) ? (s as Payout["status"]) : "requested";
}

export function mapPayout(p: BackendPayout): Payout {
  // A processed payout is dated by when it settled; an outstanding one by when it was asked for.
  const stamp = p.processedAt ?? p.createdAt;
  const d = stamp ? new Date(stamp) : null;
  return {
    id: p.id,
    amount: p.amount ?? 0,
    status: mapPayoutStatus(p.status),
    transactionRef: p.transactionRef ?? undefined,
    requestedAt: p.createdAt ?? undefined,
    processedAt: p.processedAt ?? undefined,
    dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
    account: p.accountSnapshotJson ?? undefined,
  };
}

export function mapPayouts(list: BackendPayout[]): Payout[] {
  return (list ?? [])
    .map(mapPayout)
    .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
}

export function mapWallet(w: BackendWallet): WalletInfo {
  return {
    balance: w?.balance ?? 0,
    entries: (w?.entries ?? []).map((e) => {
      const d = e.createdAt ? new Date(e.createdAt) : null;
      return {
        id: e.id,
        amount: e.amount,
        type: e.type,
        balanceAfter: e.balanceAfter,
        createdAt: e.createdAt,
        dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Reviews / availability / authored content
// ---------------------------------------------------------------------------

export function mapReviews(list: BackendReview[]): TherapistReview[] {
  return (list ?? []).map((r) => {
    const d = r.createdAt ? new Date(r.createdAt) : null;
    return {
      rating: r.rating ?? 0,
      comment: r.comment ?? "",
      reviewerName: r.reviewerName ?? "Patient",
      reviewerImage: r.reviewerImage ?? null,
      createdAt: r.createdAt ?? "",
      dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
    };
  });
}

/**
 * The availability endpoint returns `DD-MM-YYYY`, which `new Date()` misparses (it reads
 * `29-07-2026` as an invalid date, and an unpadded variant as a US month/day). Parse the
 * parts explicitly and keep the original string too — block/unblock echo it back.
 */
export function parseAvailabilityDate(raw: string): Date | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw ?? "");
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function mapAvailability(list: BackendAvailabilityDay[]): AvailabilityDay[] {
  return (list ?? []).map((day) => {
    const parsed = parseAvailabilityDate(day.date);
    return {
      date: parsed ? toIsoDate(parsed) : day.date,
      rawDate: day.date,
      label: parsed
        ? parsed.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
        : day.date,
      slots: (day.timeSlots ?? []).map((s) => {
        const startTime = s.startMinute ?? s.startTime ?? 0;
        const endTime =
          s.endTime ?? (s.durationMinutes != null ? startTime + s.durationMinutes : startTime);
        return {
          startHour: s.startHour ?? Math.floor(startTime / 60),
          startTime,
          endTime,
          category: s.category ?? "morning",
          status: s.status ?? "open",
        };
      }),
    };
  });
}

export function mapArticles(list: BackendArticle[]): TherapistArticle[] {
  return (list ?? []).map((a) => {
    const d = a.createdAt ? new Date(a.createdAt) : null;
    return {
      id: a.id,
      title: a.title ?? "",
      content: a.content ?? "",
      createdAt: a.createdAt,
      dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
    };
  });
}

export function mapFaqs(list: BackendFaq[]): TherapistFaq[] {
  return (list ?? []).map((f) => ({
    id: f.id,
    question: f.question ?? "",
    answer: f.answer ?? "",
    createdAt: f.createdAt,
  }));
}

// ---------------------------------------------------------------------------
// Account security: login sessions + activity log
// ---------------------------------------------------------------------------

/**
 * Turn a raw user-agent into something a therapist can recognise.
 *
 * The app itself reports `okhttp/<version>` on Android (React Native's networking layer) — that's
 * the string to look for, not a browser UA. Anything unrecognised falls back to the raw agent
 * rather than a fabricated guess: showing "Unknown device" for a real browser would be worse than
 * showing the string, because the therapist is being asked to decide whether to revoke it.
 */
export function deviceLabelFromAgent(agent?: string): string {
  const ua = agent ?? "";
  if (!ua) return "Unknown device";
  if (/okhttp/i.test(ua)) return "Physiobuddies app (Android)";
  if (/CFNetwork|Darwin/i.test(ua)) return "Physiobuddies app (iOS)";
  if (/curl|PostmanRuntime|insomnia/i.test(ua)) return "API client";
  if (/Edg\//i.test(ua)) return "Microsoft Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Firefox\//i.test(ua)) return "Firefox";
  // Chrome must be tested before Safari: every Chrome UA also contains "Safari".
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua)) return "Safari";
  return ua.length > 40 ? `${ua.slice(0, 40)}…` : ua;
}

/** "Active now" / "12 min ago" / "Yesterday" / "24 Jun" for a last-seen timestamp. */
function lastActiveLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (diffMin < 2) return "Active now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)} h ago`;
  return relativeDateLabel(d);
}

/**
 * `currentSessionId` is supplied by the caller, not read from the payload — the backend's
 * `isCurrentSession` is `false` on every row (see the note on `LoginSession`). Pass `undefined`
 * when it can't be determined, and the UI must then warn that a revoke may sign the user out.
 */
export function mapLoginSessions(
  list: BackendLoginSession[],
  currentSessionId?: string,
): LoginSession[] {
  return (list ?? [])
    .map((s) => ({
      id: s.id,
      agent: s.agent ?? "",
      deviceLabel: deviceLabelFromAgent(s.agent),
      // Strip the IPv6-mapped-IPv4 prefix the server emits (`::ffff:10.1.2.3`).
      ip: (s.ip ?? "").replace(/^::ffff:/, ""),
      location: s.location || undefined,
      lastActiveAt: s.lastLoggedAt,
      lastActiveLabel: lastActiveLabel(s.lastLoggedAt),
      createdAt: s.createdAt,
      isCurrent: currentSessionId ? s.id === currentSessionId : !!s.isCurrentSession,
    }))
    .sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
}

export function mapActivity(list: BackendActivity[]): ActivityEntry[] {
  return (list ?? []).map((a) => {
    const d = a.createdAt ? new Date(a.createdAt) : null;
    return {
      id: a.id,
      title: a.title ?? "Activity",
      detail: summariseActivityData(a.data),
      ip: a.ip || undefined,
      type: a.type ?? "frequent",
      createdAt: a.createdAt,
      dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
    };
  });
}

/**
 * `data` is either a sentence or a JSON blob of the request that was logged. Render the sentence,
 * and reduce the blob to "METHOD /path" — the raw JSON includes request bodies, which is both
 * unreadable in a list row and more than should be casually displayed.
 */
function summariseActivityData(raw?: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return trimmed;
  try {
    const parsed = JSON.parse(trimmed) as { method?: string; path?: string; status?: number };
    if (parsed.method && parsed.path) {
      return `${parsed.method} ${parsed.path}${parsed.status ? ` · ${parsed.status}` : ""}`;
    }
  } catch {
    // fall through
  }
  return "";
}

// ---------------------------------------------------------------------------
// Payments / blog
// ---------------------------------------------------------------------------

export function mapPayments(list: BackendPayment[]): PaymentRecord[] {
  return (list ?? [])
    .map((p) => {
      const stamp = p.paidAt ?? p.createdAt;
      const d = stamp ? new Date(stamp) : null;
      return {
        id: p.id,
        invoiceNumber: p.invoiceId ?? undefined,
        amount: p.amount ?? 0,
        status: (p.status ?? "pending").toLowerCase(),
        purpose: p.purpose ?? "payment",
        paidAt: p.paidAt ?? undefined,
        refundedAt: p.refundedAt ?? undefined,
        dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
      };
    })
    .sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
}

export function mapBlogPost(b: BackendBlogPost): BlogPost {
  const d = b.createdAt ? new Date(b.createdAt) : null;
  return {
    id: b.id,
    slug: b.slug ?? "",
    title: b.title ?? "",
    summary: b.summary ?? "",
    content: b.content ?? undefined,
    // `tags` is a comma-separated STRING on the wire, not an array.
    tags: (b.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    thumbnail: b.thumbnail ?? undefined,
    readTime: b.readTime ?? undefined,
    views: b.views ?? 0,
    likes: b.likes,
    createdAt: b.createdAt,
    dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
    reviews: (b.reviews ?? []).map((r, i) => mapBlogReview(r, `${b.id}-review-${i}`)),
  };
}

/**
 * `POST /blog/:id/review` answers with the created row in the same shape the detail fetch
 * embeds, so one mapper serves both and a just-posted comment renders identically to a
 * reloaded one.
 */
export function mapBlogReview(r: BackendBlogReview, fallbackId = ""): BlogReview {
  return {
    id: r?.id ?? fallbackId,
    userName: r?.userName ?? "Reader",
    comment: r?.comment ?? "",
    createdAt: r?.createdAt,
  };
}

export function mapBlogPosts(list: BackendBlogPost[]): BlogPost[] {
  return (list ?? []).map(mapBlogPost);
}

/**
 * Notification rows → the app's `AppNotification`.
 *
 * Two mismatches worth naming. The server's `type` is a *delivery channel*
 * (transactional / activity / promotional), while the app's `type` is a *subject category* that
 * picks the row's icon and tint (appointment / payment / task / system / message) — so the
 * category is derived from `event` (e.g. `session.reminder`, `payout.processed`) and only falls
 * back to the channel. And the body field is `description`, not `body`.
 */
export function mapNotifications(list: BackendNotification[]): AppNotification[] {
  return (list ?? []).map((n) => {
    const iso = n.time ?? n.createdAt ?? "";
    const at = iso ? new Date(iso) : null;
    return {
      id: n.id,
      type: notificationCategory(n),
      title: n.title ?? "",
      body: n.description ?? "",
      timestamp: at && !Number.isNaN(at.getTime()) ? notificationTimeLabel(at) : "",
      read: !!n.isRead,
      actionUrl: notificationLink(n.metadata),
    };
  });
}

/**
 * The row's deep link lives at `metadata.url` — the backend's notification catalog sets it per
 * event (`therapistBookingPath(...)` → `/therapist/my-bookings/<planId>`, and so on). `metadata`
 * is typed `unknown` because the server stores an arbitrary JSON blob per event, so narrow it
 * here rather than trusting the shape.
 */
function notificationLink(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object") return undefined;
  const url = (metadata as { url?: unknown }).url;
  return typeof url === "string" && url.length > 0 ? url : undefined;
}

/**
 * Notifications are read as a stream, so recency matters more than the calendar date — minutes
 * and hours for today, then `relativeDateLabel`'s Today/Yesterday/date wording. The raw ISO
 * instant used to be rendered verbatim, which put `2026-08-18T13:10:02.647Z` under every row.
 */
function notificationTimeLabel(at: Date): string {
  const diffMin = Math.floor((Date.now() - at.getTime()) / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`;
  return relativeDateLabel(at);
}

function notificationCategory(n: BackendNotification): AppNotification["type"] {
  const key = `${n.event ?? ""}`.toLowerCase();
  if (/session|booking|appointment|slot|reschedul/.test(key)) return "appointment";
  if (/pay|payout|wallet|invoice|refund|commission|subscription/.test(key)) return "payment";
  if (/complaint|message|reply|review/.test(key)) return "message";
  if (/verif|document|kyc|onboard|task/.test(key)) return "task";
  return n.type === "promotional" ? "message" : "system";
}

export function mapComplaints(list: BackendComplaint[]): SupportComplaint[] {
  return (list ?? []).map((c) => {
    const d = c.createdAt ? new Date(c.createdAt) : null;
    return {
      id: c.id,
      type: c.type ?? "general",
      description: c.description ?? "",
      status: (c.status ?? "open").toLowerCase(),
      createdAt: c.createdAt,
      dateLabel: d && !Number.isNaN(d.getTime()) ? relativeDateLabel(d) : "",
      replies: (c.reply ?? []).map((r, i) => ({
        id: r.id ?? `${c.id}-reply-${i}`,
        role: r.role ?? "support",
        message: r.message ?? "",
        createdAt: r.createdAt,
      })),
    };
  });
}

// ---------------------------------------------------------------------------
// Weekly schedule / overrides
// ---------------------------------------------------------------------------

const SHIFTS: readonly SlotShift[] = ["morning", "evening", "night"];

/**
 * The schedule endpoint accepts (and therefore may return) a day as either a bare shift
 * array — the shape final onboarding wrote — or the newer `{ shifts, disabledHours }` object.
 * Normalise to the object form so the UI only ever handles one.
 */
function normaliseDaySchedule(
  raw: string[] | { shifts?: string[]; disabledHours?: number[] } | undefined,
): WeekdaySchedule {
  if (Array.isArray(raw)) {
    return { shifts: raw.filter((s): s is SlotShift => SHIFTS.includes(s as SlotShift)), disabledHours: [] };
  }
  return {
    shifts: (raw?.shifts ?? []).filter((s): s is SlotShift => SHIFTS.includes(s as SlotShift)),
    disabledHours: raw?.disabledHours ?? [],
  };
}

export function mapWeeklySchedule(data: BackendWeeklySchedule | null | undefined): WeeklySchedule {
  const schedule = data?.schedule ?? {};
  const out: WeeklySchedule = {};
  for (const [day, raw] of Object.entries(schedule)) {
    out[day.toLowerCase()] = normaliseDaySchedule(raw);
  }
  return out;
}

export function mapScheduleOverrides(list: BackendScheduleOverride[]): ScheduleOverride[] {
  return (list ?? [])
    .map((o) => {
      const d = o.date ? new Date(`${o.date}T00:00:00`) : null;
      const valid = d && !Number.isNaN(d.getTime());
      return {
        date: o.date,
        blockedHours: [...(o.blockedHours ?? [])].sort((a, b) => a - b),
        isOff: !!o.isOff,
        label: valid ? scheduleDateLabel(d) : o.date,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Patients (derived — there is no therapist-facing patients endpoint)
// ---------------------------------------------------------------------------

/**
 * Roll the booking list up into a patient roster. There is no `/patients` endpoint for
 * therapists (patient records live behind `/patient/*`, which 403s for a therapist token —
 * verified), but a therapist's patients are exactly the people they have treatment plans with,
 * and `my-bookings` carries name, age, gender and the last session date for each.
 *
 * Keyed by name+patientID rather than patientID alone: the seed data reuses one public
 * `patientID` across different people, and collapsing two patients into one row is a much worse
 * failure than showing one person twice.
 */
export function buildPatientsFromBookings(list: BackendBooking[]): Patient[] {
  const byKey = new Map<string, Patient & { _lastDate: number }>();

  for (const b of list) {
    if ((b.status ?? "").toUpperCase() === "BLOCKED") continue;
    const key = `${b.patientID ?? ""}::${b.patientName ?? ""}`;
    const date = parseDisplayDate(b.lastSessionDate);
    const stamp = date ? date.getTime() : 0;
    const existing = byKey.get(key);

    if (existing) {
      existing.totalSessions += 1;
      if (stamp > existing._lastDate) {
        existing._lastDate = stamp;
        existing.lastVisit = date ? toIsoDate(date) : existing.lastVisit;
      }
      continue;
    }

    const gender = (b.patientGender ?? "").toLowerCase();
    byKey.set(key, {
      id: b.id, // the treatment-plan id — what the patient detail screen can actually fetch
      name: b.patientName || "Patient",
      age: b.patientAge ?? 0,
      gender: gender === "female" ? "female" : gender === "other" ? "other" : "male",
      phone: "",
      condition: "Therapy",
      totalSessions: 1,
      lastVisit: date ? toIsoDate(date) : undefined,
      tags: [],
      _lastDate: stamp,
    });
  }

  return [...byKey.values()]
    .sort((a, b) => b._lastDate - a._lastDate)
    .map(({ _lastDate: _drop, ...patient }) => patient);
}

// ---------------------------------------------------------------------------
// Dashboard (composed client-side — the backend has no /dashboard endpoint)
// ---------------------------------------------------------------------------

export function buildDashboardStats(
  commissions: BackendCommission[],
  bookings: BackendBooking[],
  rating: number,
): DashboardStats {
  const today = new Date();

  const todaySessions = bookings.filter((b) => {
    if ((b.status ?? "").toUpperCase() === "BLOCKED") return false;
    const d = parseDisplayDate(b.lastSessionDate);
    return d ? sameDay(d, today) : false;
  }).length;

  const earnedToday = commissions.reduce((sum, c) => {
    const d = new Date(c.sessionDate);
    return !Number.isNaN(d.getTime()) && sameDay(d, today) ? sum + c.therapistAmount : sum;
  }, 0);

  const chart = weeklyChart(commissions);
  const weeklyEarnings = chart.reduce((s, p) => s + p.amount, 0);

  const weekStart = startOfWeekMon(today);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeek = sumInRange(commissions, lastWeekStart, weekStart);
  const weeklyChangePercent =
    lastWeek > 0 ? Math.round(((weeklyEarnings - lastWeek) / lastWeek) * 100) : 0;

  return {
    todaySessions,
    earnedToday,
    rating,
    weeklyEarnings,
    weeklyChangePercent,
    weeklyChart: chart,
  };
}
