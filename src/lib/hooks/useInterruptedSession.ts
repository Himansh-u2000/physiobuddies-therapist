import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { useDatabase } from "@/lib/db/provider";
import { getInterruptedSession } from "@/lib/db/repositories";
import { useSessionStore } from "@/lib/stores/session.store";
import type { Session } from "@/types";

/**
 * Finds a session the therapist started but never finished, and gives them a way back into
 * it. Both halves were missing: a session killed mid-flight was restored into the store but
 * never routed to, and a *paused* one wasn't even restored — "Pause / Emergency stop"
 * persisted it safely to SQLite and no screen has ever been able to reach it since.
 *
 * Re-reads whenever the live session id changes, so the prompt disappears the moment the
 * therapist resumes (or completes) rather than lingering as a stale offer.
 */
export function useInterruptedSession() {
  const { db, ready } = useDatabase();
  const router = useRouter();
  const sessionId = useSessionStore((s) => s.sessionId);
  const isActive = useSessionStore((s) => s.isActive);
  const [draft, setDraft] = useState<Session | null>(null);

  useEffect(() => {
    if (!ready || !db) return;
    let cancelled = false;
    getInterruptedSession(db)
      .then((found) => {
        if (!cancelled) setDraft(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready, db, sessionId, isActive]);

  const resume = useCallback(() => {
    if (!draft) return;
    const store = useSessionStore.getState();
    // The cold-start restore in `useSessionSync` may already hold this session; re-hydrating
    // from the same row is harmless and covers the case where it doesn't (a paused session,
    // which that restore deliberately skips).
    if (store.sessionId !== draft.id) store.resumeFromDraft(draft);
    useSessionStore.getState().resumeSession();
    router.push("/session/active");
  }, [draft, router]);

  return { draft, resume };
}
