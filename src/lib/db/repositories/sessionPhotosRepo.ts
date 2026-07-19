import { and, eq, lte } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { sessionPhotos } from "../schema";

type SessionPhotoRow = typeof sessionPhotos.$inferSelect;

interface EnqueuePhotoInput {
  id: string;
  sessionId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
}

/** The photo file is already safely on-device the moment this returns — capture succeeds
 *  independent of connectivity, same as the session/treatment draft-persist path. */
export async function enqueuePhotoUpload(db: DrizzleDB, input: EnqueuePhotoInput): Promise<void> {
  await db.insert(sessionPhotos).values({
    id: input.id,
    sessionId: input.sessionId,
    localUri: input.localUri,
    fileName: input.fileName,
    mimeType: input.mimeType,
    syncStatus: "pending",
    createdAt: Date.now(),
  });
}

export async function getPendingPhotoUploads(db: DrizzleDB, now: number): Promise<SessionPhotoRow[]> {
  return db
    .select()
    .from(sessionPhotos)
    .where(and(eq(sessionPhotos.syncStatus, "pending"), lte(sessionPhotos.nextRetryAt, now)));
}

export async function markPhotoSyncResult(
  db: DrizzleDB,
  id: string,
  result: { syncStatus: "synced" | "pending" | "error"; syncAttempts: number; nextRetryAt: number; remoteUrl?: string },
): Promise<void> {
  await db.update(sessionPhotos).set(result).where(eq(sessionPhotos.id, id));
}
