import type { DrizzleDB } from "../provider";
import {
  appKv,
  appointments,
  notifications,
  patients,
  sessionPhotos,
  sessions,
  therapistProfile,
  transactions,
  treatments,
} from "../schema";

/**
 * Every cache table, in one place so a table added later cannot be quietly forgotten by the
 * sign-out path — the failure mode of forgetting one is invisible until someone else's data
 * shows up on the screen.
 */
const ALL_TABLES = [
  therapistProfile,
  patients,
  appointments,
  sessions,
  treatments,
  transactions,
  notifications,
  sessionPhotos,
  appKv,
] as const;

/**
 * Drop the entire local snapshot.
 *
 * `clearAllSecureData()` only ever emptied SecureStore, so the encrypted SQLite cache outlived
 * every sign-out. Two consequences, both seen in the wild:
 *
 *   - **Privacy.** Patient names, addresses, appointments and session notes stayed readable on a
 *     handset after the therapist signed out of it. The device-token unregister in `logout` is
 *     there precisely because the phone may change hands; leaving the clinical data behind
 *     defeated that.
 *   - **Ghost data.** `useSyncedQuery` renders `query.data ?? cachedData`, so rows keyed to the
 *     *previous* account keep showing after a new sign-in, and any failing query silently falls
 *     back to them. When the dev database was re-seeded this is what made a dead session look
 *     like a permanently broken app.
 *
 * One transaction, so a crash midway cannot leave half an account's data behind.
 *
 * **This discards unsynced work** — a session or treatment that never reached the server, and
 * queued photo uploads, are all in these tables. That is the intended trade: the credential
 * needed to flush them is gone by the time this runs, so they were undeliverable anyway, and
 * keeping them would mean holding one therapist's clinical notes on a phone now signed into
 * someone else's account.
 */
export async function clearLocalCache(db: DrizzleDB): Promise<void> {
  await db.transaction(async (tx) => {
    for (const table of ALL_TABLES) {
      await tx.delete(table);
    }
  });
}
