import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as schema from "./schema";
import { MIGRATION_SQL } from "./migration";

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
      await sqlite.execAsync(MIGRATION_SQL);
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
