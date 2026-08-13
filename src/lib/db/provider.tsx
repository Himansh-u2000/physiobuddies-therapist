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
      setDb(createDrizzle(sqlite));
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
