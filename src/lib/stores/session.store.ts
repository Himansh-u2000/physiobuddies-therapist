import { create } from "zustand";
import * as Crypto from "expo-crypto";
import type { Session, SessionChecklistItem } from "@/types";
import { SESSION_CONFIG } from "@/constants/config";
import { upsertSessionDraft } from "@/lib/db/repositories";
import { debounce } from "@/lib/utils/format";
import type { DrizzleDB } from "@/lib/db/provider";

/**
 * The DB connection is only available inside React via `useDatabase()`, but these are plain
 * Zustand actions, not hooks. `useSessionSync` (mounted once, in the root layout) calls
 * `setSessionDb` as soon as the DB is ready; until then, persistence is a silent no-op — the
 * in-memory store still works, it just isn't durable yet (a window of a few hundred ms on
 * cold start, not the multi-minute background/kill risk this exists to cover).
 */
let dbInstance: DrizzleDB | null = null;
export function setSessionDb(db: DrizzleDB): void {
  dbInstance = db;
}

/** Elapsed time ticks every second; persisting on every tick would hammer SQLite for no
 *  benefit (losing a few seconds of timer state on a kill is not the risk being covered —
 *  losing the checklist, note, or which session was even active is). */
const ELAPSED_PERSIST_INTERVAL_SEC = 10;

interface SessionStore {
  sessionId: string | null;
  appointmentId: string | null;
  patientId: string | null;
  patientName: string | null;
  condition: string | null;
  type: Session["type"];
  isActive: boolean;
  /** Wall-clock anchor `tick()` derives `elapsedSeconds` from — see the comment there for why
   *  this can't just be a per-tick counter. */
  startedAt: number | null;
  elapsedSeconds: number;
  checklist: SessionChecklistItem[];
  quickNote: string;
  idempotencyKey: string | null;

  startSession: (
    sessionId: string,
    appointmentId: string,
    patientName: string,
    condition: string,
    patientId?: string,
    type?: Session["type"],
  ) => void;
  /** Cold-start resume — populates the store from a draft found in SQLite, no fresh persist. */
  resumeFromDraft: (draft: Session) => void;
  tick: () => void;
  toggleChecklistItem: (id: string) => void;
  setQuickNote: (note: string) => void;
  endSession: () => void;
  /** Called once the treatment is submitted and the session is marked completed in SQLite.
   *  Flips `isActive` false so `active.tsx`'s tick interval stops (it doesn't unmount when
   *  the flow navigates on to /session/treatment or /session/complete — it stays mounted
   *  underneath). Deliberately doesn't clear the other fields: /session/complete still needs
   *  patientName/condition/elapsedSeconds to render its summary. */
  completeSession: () => void;
  reset: () => void;
}

function persistDraft(state: SessionStore, overrides: Partial<{ status: Session["status"] }> = {}) {
  if (!dbInstance || !state.sessionId || !state.appointmentId) return;
  upsertSessionDraft(dbInstance, {
    id: state.sessionId,
    appointmentId: state.appointmentId,
    patientId: state.patientId ?? "",
    patientName: state.patientName ?? "",
    condition: state.condition ?? "",
    type: state.type,
    status: overrides.status ?? (state.isActive ? "active" : "paused"),
    startedAt: state.startedAt ?? undefined,
    elapsedSeconds: state.elapsedSeconds,
    checklist: state.checklist,
    quickNote: state.quickNote,
    syncStatus: "synced", // a live draft isn't an outbound operation — nothing for the sync queue yet
    idempotencyKey: state.idempotencyKey ?? undefined,
  }).catch(() => {});
}

const debouncedPersistNote = debounce((state: SessionStore) => persistDraft(state), 500);

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionId: null,
  appointmentId: null,
  patientId: null,
  patientName: null,
  condition: null,
  type: "home",
  isActive: false,
  startedAt: null,
  elapsedSeconds: 0,
  checklist: SESSION_CONFIG.checklistDefaults.map((c) => ({ ...c })),
  quickNote: "",
  idempotencyKey: null,

  startSession: (sessionId, appointmentId, patientName, condition, patientId, type) => {
    set({
      sessionId,
      appointmentId,
      patientId: patientId ?? null,
      patientName,
      condition,
      type: type ?? "home",
      isActive: true,
      startedAt: Date.now(),
      elapsedSeconds: 0,
      checklist: SESSION_CONFIG.checklistDefaults.map((c) => ({ ...c })),
      quickNote: "",
      idempotencyKey: Crypto.randomUUID(),
    });
    persistDraft(get(), { status: "active" });
  },

  resumeFromDraft: (draft) =>
    set({
      sessionId: draft.id,
      appointmentId: draft.appointmentId,
      patientId: draft.patientId,
      patientName: draft.patientName,
      condition: draft.condition,
      type: draft.type,
      isActive: draft.status === "active",
      startedAt: draft.startedAt ?? null,
      elapsedSeconds: draft.elapsedSeconds,
      checklist: draft.checklist,
      quickNote: draft.quickNote ?? "",
    }),

  tick: () => {
    const { startedAt, elapsedSeconds: previous } = get();
    // Derived from the wall clock, not accumulated per tick. RN suspends JS timers while
    // backgrounded, so a plain `+1` per tick would freeze during that time and silently
    // under-count once the interval resumes — this recomputes the true elapsed time on
    // every tick regardless of how long the gap since the last one was.
    const elapsedSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : previous + 1;
    set({ elapsedSeconds });
    if (elapsedSeconds % ELAPSED_PERSIST_INTERVAL_SEC === 0) persistDraft(get());
  },

  toggleChecklistItem: (id) => {
    set({
      checklist: get().checklist.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    });
    persistDraft(get());
  },

  setQuickNote: (note) => {
    set({ quickNote: note });
    debouncedPersistNote(get());
  },

  endSession: () => {
    set({ isActive: false });
    persistDraft(get(), { status: "paused" });
  },

  completeSession: () => set({ isActive: false }),

  reset: () =>
    set({
      sessionId: null,
      appointmentId: null,
      patientId: null,
      patientName: null,
      condition: null,
      type: "home",
      isActive: false,
      startedAt: null,
      elapsedSeconds: 0,
      checklist: SESSION_CONFIG.checklistDefaults.map((c) => ({ ...c })),
      quickNote: "",
      idempotencyKey: null,
    }),
}));
