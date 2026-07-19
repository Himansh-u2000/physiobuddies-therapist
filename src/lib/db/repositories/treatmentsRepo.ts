import { and, eq, lte } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { treatments } from "../schema";
import type { Treatment } from "@/types";

type TreatmentRow = typeof treatments.$inferSelect;

export function treatmentRowToDomain(row: TreatmentRow): Treatment {
  return {
    id: row.id,
    sessionId: row.sessionId,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    patientName: row.patientName,
    chiefComplaint: row.chiefComplaint,
    painRegions: row.painRegions ? JSON.parse(row.painRegions) : [],
    painScale: row.painScale,
    assessmentFindings: row.assessmentFindings ? JSON.parse(row.assessmentFindings) : [],
    treatmentsGiven: row.treatmentsGiven ? JSON.parse(row.treatmentsGiven) : [],
    exercises: row.exercises ? JSON.parse(row.exercises) : [],
    clinicalNotes: row.clinicalNotes,
    precautions: row.precautions,
    followUpRequired: row.followUpRequired,
    followUpDate: row.followUpDate ?? undefined,
    attachments: row.attachments ? JSON.parse(row.attachments) : [],
    syncStatus: row.syncStatus as Treatment["syncStatus"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getTreatmentBySessionId(db: DrizzleDB, sessionId: string): Promise<Treatment | null> {
  const rows = await db.select().from(treatments).where(eq(treatments.sessionId, sessionId)).limit(1);
  return rows[0] ? treatmentRowToDomain(rows[0]) : null;
}

type UpsertTreatmentInput = Omit<Treatment, "createdAt" | "updatedAt"> & { idempotencyKey?: string };

/** Keyed by sessionId, not id — a session has exactly one treatment record, and re-saving
 *  the draft (autosave, "Save draft", submit) should update the same row, not create new ones. */
export async function upsertTreatmentDraft(db: DrizzleDB, input: UpsertTreatmentInput): Promise<void> {
  const existing = await getTreatmentBySessionId(db, input.sessionId);
  const now = Date.now();
  const id = existing?.id ?? input.id;

  const shared = {
    sessionId: input.sessionId,
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    patientName: input.patientName,
    chiefComplaint: input.chiefComplaint,
    painRegions: JSON.stringify(input.painRegions),
    painScale: input.painScale,
    assessmentFindings: JSON.stringify(input.assessmentFindings),
    treatmentsGiven: JSON.stringify(input.treatmentsGiven),
    exercises: JSON.stringify(input.exercises),
    clinicalNotes: input.clinicalNotes,
    precautions: input.precautions,
    followUpRequired: input.followUpRequired,
    followUpDate: input.followUpDate ?? null,
    attachments: JSON.stringify(input.attachments),
    syncStatus: input.syncStatus,
    updatedAt: now,
  };

  if (existing) {
    await db.update(treatments).set(shared).where(eq(treatments.id, id));
    return;
  }

  await db.insert(treatments).values({
    id,
    ...shared,
    idempotencyKey: input.idempotencyKey ?? "",
    createdAt: now,
  });
}

export async function getPendingSyncTreatments(db: DrizzleDB, now: number): Promise<TreatmentRow[]> {
  return db
    .select()
    .from(treatments)
    .where(and(eq(treatments.syncStatus, "pending"), lte(treatments.nextRetryAt, now)));
}

export async function markTreatmentSyncResult(
  db: DrizzleDB,
  id: string,
  result: { syncStatus: Treatment["syncStatus"]; syncAttempts: number; nextRetryAt: number },
): Promise<void> {
  await db.update(treatments).set(result).where(eq(treatments.id, id));
}

/** Gives "error"-parked rows another chance on re-auth — see `syncEngine.ts`'s `requeueErroredSync`. */
export async function requeueErroredTreatments(db: DrizzleDB): Promise<void> {
  await db.update(treatments).set({ syncStatus: "pending", nextRetryAt: 0 }).where(eq(treatments.syncStatus, "error"));
}
