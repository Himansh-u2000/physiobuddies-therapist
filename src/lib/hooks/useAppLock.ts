import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuthStore } from "@/lib/stores/auth.store";
import { AUTH_CONFIG } from "@/constants/config";

/**
 * Re-lock the app after it has spent longer than `biometricRelockMs` in the background.
 * On resume, if the threshold is exceeded, `lock()` flips `isLocked` and the root router
 * redirects to the biometric-unlock screen. Brief interruptions (control center, permission
 * dialogs) stay under the threshold and don't re-lock.
 */
export function useAppLock() {
  const lock = useAuthStore((s) => s.lock);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "background" || next === "inactive") {
        if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
      } else if (next === "active") {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since !== null && Date.now() - since >= AUTH_CONFIG.biometricRelockMs) {
          lock();
        }
      }
    });
    return () => sub.remove();
  }, [lock]);
}
