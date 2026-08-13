export const MIGRATION_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS therapist_profile (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  specialization TEXT NOT NULL,
  qualifications TEXT NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 0,
  avatar_url TEXT,
  is_online INTEGER NOT NULL DEFAULT 0,
  is_verified INTEGER NOT NULL DEFAULT 0,
  clinic_name TEXT,
  cached_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  age INTEGER NOT NULL DEFAULT 0,
  gender TEXT NOT NULL DEFAULT 'male',
  phone TEXT NOT NULL,
  condition TEXT NOT NULL,
  avatar_url TEXT,
  address TEXT,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  last_visit TEXT,
  tags TEXT,
  cached_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  patient_avatar_url TEXT,
  patient_age INTEGER,
  patient_gender TEXT,
  patient_phone TEXT,
  time TEXT NOT NULL,
  time_label TEXT NOT NULL,
  meridiem TEXT NOT NULL DEFAULT 'AM',
  type TEXT NOT NULL DEFAULT 'home',
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL,
  address TEXT,
  latitude REAL,
  longitude REAL,
  distance_km REAL,
  eta_min INTEGER,
  notes TEXT,
  insurance TEXT,
  workflow_step INTEGER NOT NULL DEFAULT 1,
  cached_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  appointment_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  condition TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'home',
  status TEXT NOT NULL DEFAULT 'draft',
  started_at INTEGER,
  ended_at INTEGER,
  elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  checklist TEXT,
  quick_note TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL DEFAULT '',
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_appointment ON sessions(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sessions_sync ON sessions(sync_status);

CREATE TABLE IF NOT EXISTS treatments (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  chief_complaint TEXT NOT NULL,
  pain_regions TEXT,
  pain_scale INTEGER NOT NULL DEFAULT 0,
  pain_scales TEXT,
  assessment_findings TEXT,
  treatments_given TEXT,
  exercises TEXT,
  clinical_notes TEXT NOT NULL DEFAULT '',
  precautions TEXT NOT NULL DEFAULT '',
  follow_up_required INTEGER NOT NULL DEFAULT 0,
  follow_up_date TEXT,
  attachments TEXT,
  clinical TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL DEFAULT '',
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_treatments_session ON treatments(session_id);
CREATE INDEX IF NOT EXISTS idx_treatments_sync ON treatments(sync_status);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  patient_name TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'session',
  status TEXT NOT NULL DEFAULT 'pending',
  date TEXT NOT NULL,
  date_label TEXT NOT NULL,
  session_type TEXT,
  cached_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  action_url TEXT,
  cached_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_photos (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  remote_url TEXT,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  next_retry_at INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_session_photos_session ON session_photos(session_id);
CREATE INDEX IF NOT EXISTS idx_session_photos_sync ON session_photos(sync_status);
`;

/**
 * Columns added after the initial `treatments` table shipped. `CREATE TABLE IF NOT EXISTS`
 * above is a no-op on a device that already has the table, so a fresh column needs its own
 * `ALTER TABLE` here. Each is run individually and its "duplicate column" error swallowed
 * (SQLite has no `ADD COLUMN IF NOT EXISTS`) — see provider.tsx.
 */
export const POST_MIGRATION_ALTERS = [
  "ALTER TABLE treatments ADD COLUMN pain_scales TEXT;",
  // The structured clinical assessment the backend stores, as one JSON blob rather than ~25
  // columns. It's written and read whole (the form fills it, the sync queue posts it) and never
  // queried by field, so columns would buy nothing and cost an ALTER per future clinical field.
  "ALTER TABLE treatments ADD COLUMN clinical TEXT;",
];
