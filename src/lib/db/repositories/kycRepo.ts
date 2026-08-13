import type { DrizzleDB } from "../provider";
import { getKv, setKv } from "./appKvRepo";

/**
 * A credential document the therapist has uploaded, tracked against the checklist slot it was
 * uploaded for.
 *
 * This record is LOCAL. The file itself is really on the server (`POST /file-upload/single`
 * returns `url`), but the backend has no per-document endpoint — nothing associates an upload
 * with "this is my degree certificate", and nothing reports a per-document review state. Keeping
 * the association on-device is what lets the checklist show which slots are done without
 * inventing a server-side status that doesn't exist. Cleared with the rest of the local DB on
 * logout, which is correct: the submitted file stays with Physiobuddies either way.
 */
export interface KycDocumentRecord {
  slotId: string;
  url: string;
  name: string;
  mimeType: string;
  uploadedAt: number;
}

const KEY = "kyc_documents";

export async function getKycDocuments(db: DrizzleDB): Promise<Record<string, KycDocumentRecord>> {
  const raw = await getKv(db, KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // A hand-corrupted or half-written value must not take the screen down with it — an empty
    // checklist is recoverable (re-upload), a crash on a verification screen is not.
    return parsed && typeof parsed === "object" ? (parsed as Record<string, KycDocumentRecord>) : {};
  } catch {
    return {};
  }
}

export async function saveKycDocument(db: DrizzleDB, record: KycDocumentRecord): Promise<void> {
  const all = await getKycDocuments(db);
  all[record.slotId] = record;
  await setKv(db, KEY, JSON.stringify(all));
}

export async function removeKycDocument(db: DrizzleDB, slotId: string): Promise<void> {
  const all = await getKycDocuments(db);
  delete all[slotId];
  await setKv(db, KEY, JSON.stringify(all));
}
