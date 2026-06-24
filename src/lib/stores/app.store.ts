import { create } from "zustand";

interface Toast {
  id: string;
  message: string;
  type?: "default" | "success" | "error";
}

interface AppStore {
  isOnline: boolean;
  toasts: Toast[];
  setOnline: (online: boolean) => void;
  showToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  isOnline: true,
  toasts: [],

  setOnline: (online) => set({ isOnline: online }),

  showToast: (message, type = "default") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set({ toasts: [...get().toasts, { id, message, type }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 2400);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
