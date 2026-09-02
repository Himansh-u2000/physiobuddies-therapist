import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as schema from "./schema";
import { MIGRATION_SQL, POST_MIGRATION_ALTERS } from "./migration";
import { getOrCreateDbKey, sqlCipherKeyPragma } from "./encryption";

const DB_NAME = "physiobuddies.db";

export type DrizzleDB = ReturnType<typeof createDrizzle>;

function createDrizzle(sqlite: SQLiteDatabase) {
  return drizzle(sqlite, { schema });
}

interface DbContextValue {
  db: DrizzleDB | null;
  ready: boolean;
}

const DbContext = createContext<DbContextValue>({ db: null, ready: false });

/**
 * The open connection, also reachable outside React.
 *
 * `auth.store` has to wipe the cache on sign-out and a Zustand store cannot call `useDatabase()`
 * — the same reason `unregisterDeviceToken` lives in a plain module. Kept in sync with the
 * context rather than replacing it: components still read the context, so they re-render when
 * the database becomes ready.
 */
let activeDb: DrizzleDB | null = null;

/** The open database, or `null` before `DatabaseProvider` has finished opening it. */
export function getActiveDatabase(): DrizzleDB | null {
  return activeDb;
}

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DrizzleDB | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const sqlite = await openDatabaseAsync(DB_NAME);
      // Must run before any other statement on this connection — expo-sqlite is built with
      // useSQLCipher (app.json), so the DB file is unreadable without this.
      const key = await getOrCreateDbKey();
      await sqlite.execAsync(sqlCipherKeyPragma(key));
      await sqlite.execAsync(MIGRATION_SQL);
      // Best-effort, one statement at a time: on a fresh DB the column already exists (the
      // CREATE TABLE above just made it) and this errors harmlessly; on an existing DB from
      // before the column was added, this is what actually adds it. Either way must not
      // abort startup — a single execAsync running all of MIGRATION_SQL as one script would.
      for (const alter of POST_MIGRATION_ALTERS) {
        await sqlite.execAsync(alter).catch(() => {});
      }
      if (!mounted) return;
      const instance = createDrizzle(sqlite);
      activeDb = instance;
      setDb(instance);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return <DbContext.Provider value={{ db, ready }}>{children}</DbContext.Provider>;
}

export function useDatabase() {
  return useContext(DbContext);
}
