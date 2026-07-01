export type SessionType = "home" | "clinic" | "online";
export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "completed"
  | "cancelled"
  | "in_progress";
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
  pendingTasks: number;
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

export interface Appointment {
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
  painRegions: string[];
  painScale: number;
  assessmentFindings: AssessmentFinding[];
  treatmentsGiven: TreatmentGiven[];
  exercises: ExercisePrescribed[];
  clinicalNotes: string;
  precautions: string;
  followUpRequired: boolean;
  followUpDate?: string;
  attachments: string[];
  syncStatus: SyncStatus;
  createdAt: number;
  updatedAt: number;
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
