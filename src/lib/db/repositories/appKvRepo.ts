import { eq } from "drizzle-orm";
import type { DrizzleDB } from "../provider";
import { appKv } from "../schema";

/** Generic key-value escape hatch (last-synced timestamps, small flags) that doesn't
 *  warrant its own table. Not yet consumed by any screen — ready for the pending-sync-badge
 *  / stale-timestamp UI work Phase 3/4 flagged but didn't build. */
export async function getKv(db: DrizzleDB, key: string): Promise<string | null> {
  const rows = await db.select().from(appKv).where(eq(appKv.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setKv(db: DrizzleDB, key: string, value: string): Promise<void> {
  await db.insert(appKv).values({ key, value }).onConflictDoUpdate({ target: appKv.key, set: { value } });
}
