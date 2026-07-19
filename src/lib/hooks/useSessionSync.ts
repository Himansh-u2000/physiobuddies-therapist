import { useEffect, useRef } from "react";
import { useDatabase } from "@/lib/db/provider";
import { getResumableSession } from "@/lib/db/repositories";
import { useSessionStore, setSessionDb } from "@/lib/stores/session.store";

/**
 * Bridges the session Zustand store to SQLite. Mounted once in the root layout.
 *
 * Gives the store its DB handle (Zustand actions are plain functions, not hooks, so they
 * can't call `useDatabase()` themselves) and, on cold start, checks for a session that was
 * left "active" in SQLite — i.e. the app was killed mid-session — and repopulates the store
 * from it. This only restores the *data*; it doesn't navigate anywhere. The active-session
 * screen renders whatever the store holds whenever the user is next on it, so a resumed
 * draft shows up naturally without a separate "restore" step in the UI.
 */
export function useSessionSync() {
  const { db, ready } = useDatabase();
  const resumeChecked = useRef(false);

  useEffect(() => {
    if (!ready || !db) return;
    setSessionDb(db);
    if (resumeChecked.current) return;
    resumeChecked.current = true;

    (async () => {
      // Don't clobber a session that already started fresh this app-launch.
      if (useSessionStore.getState().sessionId) return;
      const draft = await getResumableSession(db);
      if (draft) useSessionStore.getState().resumeFromDraft(draft);
    })().catch(() => {});
  }, [ready, db]);
}
