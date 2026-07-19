import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const therapistProfile = sqliteTable("therapist_profile", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  specialization: text("specialization").notNull(),
  qualifications: text("qualifications").notNull(),
  experienceYears: integer("experience_years").notNull().default(0),
  rating: real("rating").notNull().default(0),
  avatarUrl: text("avatar_url"),
  isOnline: integer("is_online", { mode: "boolean" }).notNull().default(false),
  isVerified: integer("is_verified", { mode: "boolean" }).notNull().default(false),
  clinicName: text("clinic_name"),
  cachedAt: integer("cached_at").notNull().default(0),
});

export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  age: integer("age").notNull().default(0),
  gender: text("gender").notNull().default("male"),
  phone: text("phone").notNull(),
  condition: text("condition").notNull(),
  avatarUrl: text("avatar_url"),
  address: text("address"),
  totalSessions: integer("total_sessions").notNull().default(0),
  lastVisit: text("last_visit"),
  tags: text("tags"),
  cachedAt: integer("cached_at").notNull().default(0),
});

export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey(),
  patientId: text("patient_id").notNull(),
  patientName: text("patient_name").notNull(),
  patientAvatarUrl: text("patient_avatar_url"),
  patientAge: integer("patient_age"),
  patientGender: text("patient_gender"),
  patientPhone: text("patient_phone"),
  time: text("time").notNull(),
  timeLabel: text("time_label").notNull(),
  meridiem: text("meridiem").notNull().default("AM"),
  type: text("type").notNull().default("home"),
  status: text("status").notNull().default("confirmed"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  amount: integer("amount").notNull().default(0),
  condition: text("condition").notNull(),
  address: text("address"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  distanceKm: real("distance_km"),
  etaMin: integer("eta_min"),
  notes: text("notes"),
  insurance: text("insurance"),
  workflowStep: integer("workflow_step").notNull().default(1),
  cachedAt: integer("cached_at").notNull().default(0),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  appointmentId: text("appointment_id").notNull(),
  patientId: text("patient_id").notNull(),
  patientName: text("patient_name").notNull(),
  condition: text("condition").notNull(),
  type: text("type").notNull().default("home"),
  status: text("status").notNull().default("draft"),
  startedAt: integer("started_at"),
  endedAt: integer("ended_at"),
  elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  checklist: text("checklist"),
  quickNote: text("quick_note"),
  syncStatus: text("sync_status").notNull().default("pending"),
  // Generated once when the row is created, reused on every retry — this is what lets the
  // (eventual) backend dedupe a session-complete call the client had to resend.
  idempotencyKey: text("idempotency_key").notNull(),
  syncAttempts: integer("sync_attempts").notNull().default(0),
  nextRetryAt: integer("next_retry_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const treatments = sqliteTable("treatments", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  appointmentId: text("appointment_id").notNull(),
  patientId: text("patient_id").notNull(),
  patientName: text("patient_name").notNull(),
  chiefComplaint: text("chief_complaint").notNull(),
  painRegions: text("pain_regions"),
  painScale: integer("pain_scale").notNull().default(0),
  assessmentFindings: text("assessment_findings"),
  treatmentsGiven: text("treatments_given"),
  exercises: text("exercises"),
  clinicalNotes: text("clinical_notes").notNull().default(""),
  precautions: text("precautions").notNull().default(""),
  followUpRequired: integer("follow_up_required", { mode: "boolean" }).notNull().default(false),
  followUpDate: text("follow_up_date"),
  attachments: text("attachments"),
  syncStatus: text("sync_status").notNull().default("pending"),
  idempotencyKey: text("idempotency_key").notNull(),
  syncAttempts: integer("sync_attempts").notNull().default(0),
  nextRetryAt: integer("next_retry_at").notNull().default(0),
  createdAt: integer("created_at").notNull().default(0),
  updatedAt: integer("updated_at").notNull().default(0),
});

export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  amount: integer("amount").notNull().default(0),
  type: text("type").notNull().default("session"),
  status: text("status").notNull().default("pending"),
  date: text("date").notNull(),
  dateLabel: text("date_label").notNull(),
  sessionType: text("session_type"),
  cachedAt: integer("cached_at").notNull().default(0),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("system"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  timestamp: text("timestamp").notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  actionUrl: text("action_url"),
  cachedAt: integer("cached_at").notNull().default(0),
});

export const appKv = sqliteTable("app_kv", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type DbTherapistProfile = typeof therapistProfile.$inferSelect;
export type DbPatient = typeof patients.$inferSelect;
export type DbAppointment = typeof appointments.$inferSelect;
export type DbSession = typeof sessions.$inferSelect;
export type DbTreatment = typeof treatments.$inferSelect;
export type DbTransaction = typeof transactions.$inferSelect;
export type DbNotification = typeof notifications.$inferSelect;
