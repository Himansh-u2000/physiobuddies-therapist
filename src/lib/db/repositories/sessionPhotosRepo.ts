import { and, asc, eq, isNull, lte } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { sessionPhotos } from "../schema";

export type SessionPhotoRow = typeof sessionPhotos.$inferSelect;

/** What the queue holds: a camera capture, or a clinical file picked from device storage. */
export type SessionFileKind = "photo" | "document";

interface EnqueuePhotoInput {
  id: string;
  sessionId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
  kind?: SessionFileKind;
}

/** The file is already safely on-device the moment this returns — capture and attach both
 *  succeed independent of connectivity, same as the session/treatment draft-persist path. */
export async function enqueuePhotoUpload(db: DrizzleDB, input: EnqueuePhotoInput): Promise<void> {
  await db.insert(sessionPhotos).values({
    id: input.id,
    sessionId: input.sessionId,
    localUri: input.localUri,
    fileName: input.fileName,
    mimeType: input.mimeType,
    kind: input.kind ?? "photo",
    syncStatus: "pending",
    createdAt: Date.now(),
  });
}

/** Every photo captured during one session, uploaded or not — what the treatment form's
 *  attachments list shows, in capture order. */
export async function getPhotosForSession(db: DrizzleDB, sessionId: string): Promise<SessionPhotoRow[]> {
  return db
    .select()
    .from(sessionPhotos)
    .where(eq(sessionPhotos.sessionId, sessionId))
    .orderBy(asc(sessionPhotos.createdAt));
}

/**
 * Rows still owed to the server. `remoteDocId IS NULL` is the de-duplication guard, not just
 * tidiness: `POST /treatment-session/:id/add-docs` accepts no `Idempotency-Key`, so if a
 * response is lost after the server stored the file, re-sending would attach the same
 * photograph to the patient's plan twice. Any row that came back with an id is done, whatever
 * its `syncStatus` says.
 */
export async function getPendingPhotoUploads(db: DrizzleDB, now: number): Promise<SessionPhotoRow[]> {
  return db
    .select()
    .from(sessionPhotos)
    .where(
      and(
        eq(sessionPhotos.syncStatus, "pending"),
        lte(sessionPhotos.nextRetryAt, now),
        isNull(sessionPhotos.remoteDocId),
      ),
    );
}

export async function markPhotoSyncResult(
  db: DrizzleDB,
  id: string,
  result: {
    syncStatus: "synced" | "pending" | "error";
    syncAttempts: number;
    nextRetryAt: number;
    remoteUrl?: string;
    remoteDocId?: string;
  },
): Promise<void> {
  await db.update(sessionPhotos).set(result).where(eq(sessionPhotos.id, id));
}
