import { create } from "zustand";
import Toast from "react-native-toast-message";
// Type-only on purpose: a value import would drag drizzle-orm and the whole schema into the
// import graph of every component that touches this store (Toast, TopBar, …).
import type { SyncQueueCounts } from "@/lib/db/repositories/syncQueueRepo";

const NO_PENDING_SYNC: SyncQueueCounts = { pendingRecords: 0, failedRecords: 0, pendingPhotos: 0 };

/**
 * `"default"` is kept as an accepted alias for `"info"`. Roughly a third of the ~130 call sites
 * pass no type at all and a handful pass `"default"` explicitly; mapping rather than renaming
 * means none of them had to change when toasts moved to `react-native-toast-message`.
 */
export type ToastType = "default" | "success" | "error" | "info";

/** How long a toast stays up. */
export const TOAST_DURATION_MS = 3000;

function toastTypeFor(type: ToastType): "success" | "error" | "info" {
  return type === "default" ? "info" : type;
}

interface AppStore {
  isOnline: boolean;
  /** How much completed work is still sitting in SQLite. Refreshed by `useSyncEngine`. */
  syncCounts: SyncQueueCounts;
  setOnline: (online: boolean) => void;
  showToast: (message: string, type?: ToastType) => void;
  setSyncCounts: (counts: SyncQueueCounts) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  isOnline: true,
  syncCounts: NO_PENDING_SYNC,

  setOnline: (online) => set({ isOnline: online }),

  // Keep the previous object when the numbers haven't moved. The sync engine republishes
  // these on a 60s timer, and subscribers select the object itself — a fresh identity every
  // minute would re-render the dashboard forever for a queue that is empty and idle.
  setSyncCounts: (counts) => {
    const prev = get().syncCounts;
    if (
      prev.pendingRecords === counts.pendingRecords &&
      prev.failedRecords === counts.failedRecords &&
      prev.pendingPhotos === counts.pendingPhotos
    ) {
      return;
    }
    set({ syncCounts: counts });
  },

  /**
   * Show a toast. Stays on the store (rather than callers importing `Toast` directly) so the
   * ~130 existing call sites are untouched and there remains exactly one place to change if
   * the presentation layer moves again.
   *
   * `autoHide` + `visibilityTime` are set explicitly rather than left to the library defaults
   * so the timing matches what the app had before.
   */
  showToast: (message, type = "default") => {
    Toast.show({
      type: toastTypeFor(type),
      text1: message,
      position: "top",
      visibilityTime: TOAST_DURATION_MS,
      autoHide: true,
    });
  },
}));
