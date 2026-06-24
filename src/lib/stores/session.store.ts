import { create } from "zustand";
import type { SessionChecklistItem } from "@/types";
import { SESSION_CONFIG } from "@/constants/config";

interface SessionStore {
  sessionId: string | null;
  appointmentId: string | null;
  patientName: string | null;
  condition: string | null;
  isActive: boolean;
  elapsedSeconds: number;
  checklist: SessionChecklistItem[];
  quickNote: string;

  startSession: (sessionId: string, appointmentId: string, patientName: string, condition: string) => void;
  tick: () => void;
  toggleChecklistItem: (id: string) => void;
  setQuickNote: (note: string) => void;
  endSession: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessionId: null,
  appointmentId: null,
  patientName: null,
  condition: null,
  isActive: false,
  elapsedSeconds: 0,
  checklist: SESSION_CONFIG.checklistDefaults.map((c) => ({ ...c })),
  quickNote: "",

  startSession: (sessionId, appointmentId, patientName, condition) =>
    set({
      sessionId,
      appointmentId,
      patientName,
      condition,
      isActive: true,
      elapsedSeconds: 32 * 60 + 18,
      checklist: SESSION_CONFIG.checklistDefaults.map((c) => ({ ...c })),
      quickNote: "",
    }),

  tick: () => set({ elapsedSeconds: get().elapsedSeconds + 1 }),

  toggleChecklistItem: (id) =>
    set({
      checklist: get().checklist.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    }),

  setQuickNote: (note) => set({ quickNote: note }),

  endSession: () => set({ isActive: false }),

  reset: () =>
    set({
      sessionId: null,
      appointmentId: null,
      patientName: null,
      condition: null,
      isActive: false,
      elapsedSeconds: 0,
      checklist: SESSION_CONFIG.checklistDefaults.map((c) => ({ ...c })),
      quickNote: "",
    }),
}));
