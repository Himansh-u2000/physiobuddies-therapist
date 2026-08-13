import { eq, ne } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { sessions, treatments, sessionPhotos } from "../schema";

export interface SyncQueueCounts {
  /** Completed session records that haven't reached the server yet — retrying on their own. */
  pendingRecords: number;
  /** Records parked after a non-retryable failure. These need a nudge; waiting won't fix them. */
  failedRecords: number;
  /** Session photos still queued for upload. */
  pendingPhotos: number;
}

/**
 * How much unsent work is sitting in SQLite, counted in the unit the therapist thinks in:
 * **the session record**, not the rows it's made of.
 *
 * A completed session and its treatment always travel together (`handleSubmit` writes both,
 * and `syncEngine` won't push the session until the treatment is confirmed `synced`), so a
 * treatment parked as `error` means *its session* is stuck — one problem, not two. Counting
 * distinct session ids is what keeps "1 record couldn't be sent" from reading as "2".
 *
 * Sessions still `active`/`paused` are deliberately excluded: those are live local drafts,
 * not queued outbound work, and showing them as "waiting to sync" would alarm a therapist
 * about a session they're still in the middle of.
 */
export async function getSyncQueueCounts(db: DrizzleDB): Promise<SyncQueueCounts> {
  const [completedSessions, erroredTreatments, queuedPhotos] = await Promise.all([
    db
      .select({ id: sessions.id, syncStatus: sessions.syncStatus })
      .from(sessions)
      .where(eq(sessions.status, "completed")),
    db
      .select({ sessionId: treatments.sessionId })
      .from(treatments)
      .where(eq(treatments.syncStatus, "error")),
    db
      .select({ id: sessionPhotos.id })
      .from(sessionPhotos)
      .where(ne(sessionPhotos.syncStatus, "synced")),
  ]);

  const completedById = new Map(completedSessions.map((s) => [s.id, s.syncStatus]));
  const failed = new Set<string>();
  for (const s of completedSessions) if (s.syncStatus === "error") failed.add(s.id);
  // A treatment error only counts if its session is actually completed — an errored draft
  // for a session still in progress isn't outbound work yet.
  for (const t of erroredTreatments) if (completedById.has(t.sessionId)) failed.add(t.sessionId);

  const pending = completedSessions.filter(
    (s) => s.syncStatus === "pending" && !failed.has(s.id),
  ).length;

  return {
    pendingRecords: pending,
    failedRecords: failed.size,
    pendingPhotos: queuedPhotos.length,
  };
}
