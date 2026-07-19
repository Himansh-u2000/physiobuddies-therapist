import { createRelockTracker } from "@/lib/hooks/useAppLock";
import { useAuthStore } from "@/lib/stores/auth.store";
import { AUTH_CONFIG } from "@/constants/config";

/**
 * Background re-lock timing. Wall-clock dependent and only reproducible on a device by
 * literally waiting two minutes, which makes it a poor fit for manual QA and a good fit
 * for a clock-controlled unit test.
 */

const RELOCK_MS = AUTH_CONFIG.biometricRelockMs;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Move the wall clock the tracker reads via Date.now(). */
function advance(ms: number) {
  jest.setSystemTime(Date.now() + ms);
}

describe("createRelockTracker", () => {
  it("locks after longer than the relock window in the background", () => {
    const lock = jest.fn();
    const onChange = createRelockTracker(lock);

    onChange("background");
    advance(RELOCK_MS + 1000);
    onChange("active");

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("does not lock after a brief interruption", () => {
    // Permission dialogs and control centre must not force a biometric prompt.
    const lock = jest.fn();
    const onChange = createRelockTracker(lock);

    onChange("background");
    advance(5_000);
    onChange("active");

    expect(lock).not.toHaveBeenCalled();
  });

  it("locks exactly at the threshold", () => {
    const lock = jest.fn();
    const onChange = createRelockTracker(lock);

    onChange("background");
    advance(RELOCK_MS);
    onChange("active");

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("measures from the FIRST background event, not the last", () => {
    // iOS emits `inactive` then `background` on the way out. Taking the later timestamp
    // would under-count elapsed time and skip a lock that should have fired.
    const lock = jest.fn();
    const onChange = createRelockTracker(lock);

    onChange("inactive");
    advance(RELOCK_MS - 1000);
    onChange("background");
    advance(2_000);
    onChange("active");

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("survives the iOS background→inactive→active resume sequence", () => {
    const lock = jest.fn();
    const onChange = createRelockTracker(lock);

    onChange("background");
    advance(RELOCK_MS + 1000);
    onChange("inactive"); // must not reset the timestamp on the way back in
    onChange("active");

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("resets between cycles, so a later brief background does not re-lock", () => {
    const lock = jest.fn();
    const onChange = createRelockTracker(lock);

    onChange("background");
    advance(RELOCK_MS + 1000);
    onChange("active");
    expect(lock).toHaveBeenCalledTimes(1);

    onChange("background");
    advance(1_000);
    onChange("active");
    expect(lock).toHaveBeenCalledTimes(1); // still just the first
  });

  it("ignores an 'active' event with no preceding background", () => {
    const lock = jest.fn();
    createRelockTracker(lock)("active");
    expect(lock).not.toHaveBeenCalled();
  });

  it("honours a custom threshold", () => {
    const lock = jest.fn();
    const onChange = createRelockTracker(lock, 10_000);

    onChange("background");
    advance(11_000);
    onChange("active");

    expect(lock).toHaveBeenCalledTimes(1);
  });

  it("tracks each instance independently", () => {
    const a = jest.fn();
    const b = jest.fn();
    const trackerA = createRelockTracker(a);
    const trackerB = createRelockTracker(b);

    trackerA("background");
    advance(RELOCK_MS + 1000);
    trackerB("active"); // B never backgrounded

    expect(b).not.toHaveBeenCalled();
    trackerA("active");
    expect(a).toHaveBeenCalledTimes(1);
  });
});

describe("createRelockTracker wired to the real store", () => {
  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false, biometricEnabled: false, isLocked: false });
  });

  it("locks an authenticated user with biometric enabled", () => {
    useAuthStore.setState({ isAuthenticated: true, biometricEnabled: true, isLocked: false });
    const onChange = createRelockTracker(useAuthStore.getState().lock);

    onChange("background");
    advance(RELOCK_MS + 1000);
    onChange("active");

    expect(useAuthStore.getState().isLocked).toBe(true);
  });

  it("does not strand a user who has no biometric enrolled", () => {
    // The store's own guard: locking here would show an unlock screen the user cannot satisfy.
    useAuthStore.setState({ isAuthenticated: true, biometricEnabled: false, isLocked: false });
    const onChange = createRelockTracker(useAuthStore.getState().lock);

    onChange("background");
    advance(RELOCK_MS + 1000);
    onChange("active");

    expect(useAuthStore.getState().isLocked).toBe(false);
  });
});
