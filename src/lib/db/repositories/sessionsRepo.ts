import { and, desc, eq, inArray, lte } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { sessions } from "../schema";
import type { Session } from "@/types";

type SessionRow = typeof sessions.$inferSelect;

export function sessionRowToDomain(row: SessionRow): Session {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    patientName: row.patientName,
    condition: row.condition,
    type: row.type as Session["type"],
    status: row.status as Session["status"],
    startedAt: row.startedAt ?? undefined,
    endedAt: row.endedAt ?? undefined,
    elapsedSeconds: row.elapsedSeconds,
    checklist: row.checklist ? JSON.parse(row.checklist) : [],
    quickNote: row.quickNote ?? undefined,
    syncStatus: row.syncStatus as Session["syncStatus"],
  };
}

/** Draft/active session to resume on cold start, if the app was killed mid-session. */
export async function getResumableSession(db: DrizzleDB): Promise<Session | null> {
  const rows = await db.select().from(sessions).where(eq(sessions.status, "active")).limit(1);
  return rows[0] ? sessionRowToDomain(rows[0]) : null;
}

/**
 * The most recently touched session the therapist never finished — killed mid-session
 * (`active`) or explicitly paused. Unlike `getResumableSession` this includes `paused`,
 * because those are precisely the ones no screen could reach: "Pause / Emergency stop"
 * persisted them safely and then left them sitting in SQLite with no way back in.
 *
 * Ordered by `updatedAt` so the newest wins if more than one is somehow open.
 */
export async function getInterruptedSession(db: DrizzleDB): Promise<Session | null> {
  const rows = await db
    .select()
    .from(sessions)
    .where(inArray(sessions.status, ["active", "paused"]))
    .orderBy(desc(sessions.updatedAt))
    .limit(1);
  return rows[0] ? sessionRowToDomain(rows[0]) : null;
}

export async function getSessionById(db: DrizzleDB, id: string): Promise<Session | null> {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  return rows[0] ? sessionRowToDomain(rows[0]) : null;
}

interface UpsertSessionInput {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  condition: string;
  type: Session["type"];
  status: Session["status"];
  startedAt?: number;
  endedAt?: number;
  elapsedSeconds: number;
  checklist: Session["checklist"];
  quickNote?: string;
  syncStatus: Session["syncStatus"];
  /** Only set on first insert — the same key must survive every later update/retry. */
  idempotencyKey?: string;
}

export async function upsertSessionDraft(db: DrizzleDB, input: UpsertSessionInput): Promise<void> {
  const existing = await getSessionById(db, input.id);
  // The DB is the durability boundary, not the caller. Once a session is completed locally,
  // nothing should be able to silently revert it — e.g. a background screen's timer tick
  // that never got torn down still calling this with a stale "active" status. Only a write
  // that keeps it completed is allowed through; everything else here is a no-op.
  if (existing?.status === "completed" && input.status !== "completed") return;

  const now = Date.now();
  const values = {
    id: input.id,
    appointmentId: input.appointmentId,
    patientId: input.patientId,
    patientName: input.patientName,
    condition: input.condition,
    type: input.type,
    status: input.status,
    startedAt: input.startedAt ?? null,
    endedAt: input.endedAt ?? null,
    elapsedSeconds: input.elapsedSeconds,
    checklist: JSON.stringify(input.checklist),
    quickNote: input.quickNote ?? null,
    syncStatus: input.syncStatus,
    idempotencyKey: input.idempotencyKey ?? "",
    updatedAt: now,
  };
  await db
    .insert(sessions)
    .values(values)
    .onConflictDoUpdate({
      target: sessions.id,
      // Never overwrite an already-generated idempotency key with a blank one on update.
      set: {
        appointmentId: values.appointmentId,
        patientId: values.patientId,
        patientName: values.patientName,
        condition: values.condition,
        type: values.type,
        status: values.status,
        startedAt: values.startedAt,
        endedAt: values.endedAt,
        elapsedSeconds: values.elapsedSeconds,
        checklist: values.checklist,
        quickNote: values.quickNote,
        syncStatus: values.syncStatus,
        updatedAt: values.updatedAt,
      },
    });
}

export async function deleteSession(db: DrizzleDB, id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function getPendingSyncSessions(db: DrizzleDB, now: number): Promise<SessionRow[]> {
  return db
    .select()
    .from(sessions)
    .where(and(eq(sessions.syncStatus, "pending"), lte(sessions.nextRetryAt, now)));
}

export async function markSessionSyncResult(
  db: DrizzleDB,
  id: string,
  result: { syncStatus: Session["syncStatus"]; syncAttempts: number; nextRetryAt: number },
): Promise<void> {
  await db.update(sessions).set(result).where(eq(sessions.id, id));
}

/** Gives "error"-parked rows another chance on re-auth — see `syncEngine.ts`'s `requeueErroredSync`. */
export async function requeueErroredSessions(db: DrizzleDB): Promise<void> {
  await db.update(sessions).set({ syncStatus: "pending", nextRetryAt: 0 }).where(eq(sessions.syncStatus, "error"));
}
