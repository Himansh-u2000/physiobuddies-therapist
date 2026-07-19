import { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuthStore } from "@/lib/stores/auth.store";
import { AUTH_CONFIG } from "@/constants/config";

/**
 * The re-lock rule as a self-contained state machine.
 *
 * Kept separate from the hook so it can be exercised directly: the behaviour that matters
 * here is wall-clock dependent, and on a device the only way to observe it is to actually
 * wait two minutes.
 */
export function createRelockTracker(
  lock: () => void,
  thresholdMs: number = AUTH_CONFIG.biometricRelockMs,
): (next: AppStateStatus) => void {
  let backgroundedAt: number | null = null;

  return (next: AppStateStatus) => {
    if (next === "background" || next === "inactive") {
      // First transition wins. iOS emits `inactive` then `background` on the way out, and
      // taking the later timestamp would under-count the time actually spent away.
      if (backgroundedAt === null) backgroundedAt = Date.now();
      return;
    }

    if (next === "active") {
      const since = backgroundedAt;
      backgroundedAt = null;
      if (since !== null && Date.now() - since >= thresholdMs) lock();
    }
  };
}

/**
 * Re-lock the app after it has spent longer than `biometricRelockMs` in the background.
 * On resume past the threshold, `lock()` flips `isLocked` and the root router redirects to
 * the biometric-unlock screen. Brief interruptions (control centre, permission dialogs)
 * stay under the threshold and don't re-lock.
 */
export function useAppLock() {
  const lock = useAuthStore((s) => s.lock);

  useEffect(() => {
    const sub = AppState.addEventListener("change", createRelockTracker(lock));
    return () => sub.remove();
  }, [lock]);
}
