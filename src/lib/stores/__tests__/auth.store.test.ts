import type { AuthTokens, Therapist } from "@/types";
import * as secure from "@/lib/storage/secure";
import { authApi } from "@/lib/api/services";
import ToastMessage from "react-native-toast-message";
import { useAuthStore } from "@/lib/stores/auth.store";

/**
 * The session/lock state machine. This is the exact path the on-device Phase 2 check
 * walks — sign in → kill the app → cold start → biometric unlock — so covering it here
 * means the device pass is confirming integration rather than discovering logic bugs.
 *
 * `jest.mock` calls are hoisted above the imports above by babel-plugin-jest-hoist, so
 * the modules resolve to these stubs despite appearing below.
 */

jest.mock("@/lib/storage/secure", () => ({
  saveTokens: jest.fn(async () => {}),
  saveTherapistProfile: jest.fn(async () => {}),
  getTherapistProfile: jest.fn(async () => null),
  getTokens: jest.fn(async () => null),
  setBiometricEnabled: jest.fn(async () => {}),
  getBiometricEnabled: jest.fn(async () => false),
  savePhone: jest.fn(async () => {}),
  getPhone: jest.fn(async () => null),
  clearAllSecureData: jest.fn(async () => {}),
}));

jest.mock("@/lib/api/services", () => ({
  authApi: { logout: jest.fn(async () => {}) },
}));

jest.mock("@/lib/api/netlog", () => ({
  clearNetLog: jest.fn(),
}));

// Toasts render through react-native-toast-message now, so "did the user get told?" is
// asserted on the imperative call rather than on store state.
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn(), hide: jest.fn() },
}));

const mocked = secure as jest.Mocked<typeof secure>;
const toastShow = ToastMessage.show as jest.Mock;

const TOKENS: AuthTokens = {
  accessToken: "access",
  refreshToken: "refresh",
  expiresAt: Date.now() + 900_000,
};
const THERAPIST = { id: "t_1", name: "Test Therapist" } as unknown as Therapist;

/** The store is a module singleton; reset it between cases. */
function resetStore() {
  useAuthStore.setState({
    isAuthenticated: false,
    isHydrated: false,
    therapist: null,
    tokens: null,
    biometricEnabled: false,
    phone: null,
    isLocked: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetStore();
  mocked.getTokens.mockResolvedValue(null);
  mocked.getTherapistProfile.mockResolvedValue(null);
  mocked.getBiometricEnabled.mockResolvedValue(false);
  mocked.getPhone.mockResolvedValue(null);
});

describe("hydrate (cold start)", () => {
  it("stays unauthenticated when nothing is stored", async () => {
    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isLocked).toBe(false);
    expect(s.isHydrated).toBe(true);
  });

  it("restores an authenticated session from storage", async () => {
    mocked.getTokens.mockResolvedValue(TOKENS);
    mocked.getTherapistProfile.mockResolvedValue(THERAPIST);

    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.tokens).toEqual(TOKENS);
    expect(s.therapist).toEqual(THERAPIST);
  });

  it("cold-starts LOCKED when biometric is enabled — the kill-and-reopen case", async () => {
    mocked.getTokens.mockResolvedValue(TOKENS);
    mocked.getTherapistProfile.mockResolvedValue(THERAPIST);
    mocked.getBiometricEnabled.mockResolvedValue(true);

    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isLocked).toBe(true);
  });

  it("cold-starts unlocked when biometric is off", async () => {
    mocked.getTokens.mockResolvedValue(TOKENS);
    mocked.getTherapistProfile.mockResolvedValue(THERAPIST);
    mocked.getBiometricEnabled.mockResolvedValue(false);

    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isLocked).toBe(false);
  });

  it("does not lock a half-restored session (tokens but no profile)", async () => {
    // Locking here would strand the user on an unlock screen with no way forward.
    mocked.getTokens.mockResolvedValue(TOKENS);
    mocked.getTherapistProfile.mockResolvedValue(null);
    mocked.getBiometricEnabled.mockResolvedValue(true);

    await useAuthStore.getState().hydrate();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.isLocked).toBe(false);
  });

  it("marks hydration complete even with no stored session, so routing can proceed", async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().isHydrated).toBe(true);
  });
});

describe("setSession (sign-in)", () => {
  it("persists and authenticates", async () => {
    await useAuthStore.getState().setSession(TOKENS, THERAPIST);
    expect(mocked.saveTokens).toHaveBeenCalledWith(TOKENS);
    expect(mocked.saveTherapistProfile).toHaveBeenCalledWith(THERAPIST);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("clears any prior lock — a fresh sign-in supersedes it", async () => {
    useAuthStore.setState({ isLocked: true });
    await useAuthStore.getState().setSession(TOKENS, THERAPIST);
    expect(useAuthStore.getState().isLocked).toBe(false);
  });

  it("stores the phone only when supplied", async () => {
    await useAuthStore.getState().setSession(TOKENS, THERAPIST);
    expect(mocked.savePhone).not.toHaveBeenCalled();

    await useAuthStore.getState().setSession(TOKENS, THERAPIST, "9999999999");
    expect(mocked.savePhone).toHaveBeenCalledWith("9999999999");
    expect(useAuthStore.getState().phone).toBe("9999999999");
  });

  it("keeps an existing phone when the next sign-in omits one", async () => {
    await useAuthStore.getState().setSession(TOKENS, THERAPIST, "9999999999");
    await useAuthStore.getState().setSession(TOKENS, THERAPIST);
    expect(useAuthStore.getState().phone).toBe("9999999999");
  });
});

describe("lock / unlock", () => {
  it("locks an authenticated user who has biometric enabled", () => {
    useAuthStore.setState({ isAuthenticated: true, biometricEnabled: true });
    useAuthStore.getState().lock();
    expect(useAuthStore.getState().isLocked).toBe(true);
  });

  it("does not lock when biometric is disabled", () => {
    // Otherwise the user reaches an unlock screen they have no enrolled way to satisfy.
    useAuthStore.setState({ isAuthenticated: true, biometricEnabled: false });
    useAuthStore.getState().lock();
    expect(useAuthStore.getState().isLocked).toBe(false);
  });

  it("does not lock a signed-out user", () => {
    useAuthStore.setState({ isAuthenticated: false, biometricEnabled: true });
    useAuthStore.getState().lock();
    expect(useAuthStore.getState().isLocked).toBe(false);
  });

  it("unlock clears the lock", () => {
    useAuthStore.setState({ isLocked: true });
    useAuthStore.getState().unlock();
    expect(useAuthStore.getState().isLocked).toBe(false);
  });
});

describe("logout", () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      therapist: THERAPIST,
      tokens: TOKENS,
      biometricEnabled: true,
      phone: "9999999999",
      isLocked: true,
    });
  });

  it("revokes server-side and clears local state", async () => {
    await useAuthStore.getState().logout();
    expect(authApi.logout).toHaveBeenCalled();
    expect(mocked.clearAllSecureData).toHaveBeenCalled();

    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.tokens).toBeNull();
    expect(s.therapist).toBeNull();
    expect(s.phone).toBeNull();
    expect(s.isLocked).toBe(false);
  });

  it("still clears local state when server revocation fails", async () => {
    // The backend logout is cookie-only today, so this is the normal path on RN, not an
    // edge case — a failure here must never strand the user in a signed-in shell.
    (authApi.logout as jest.Mock).mockRejectedValueOnce(new Error("network down"));

    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(mocked.clearAllSecureData).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});

describe("sessionExpired (refresh token rejected by the server)", () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: true,
      therapist: THERAPIST,
      tokens: TOKENS,
      biometricEnabled: true,
      phone: "9999999999",
      isLocked: false,
    });
  });

  it("clears the session locally without calling the server", async () => {
    await useAuthStore.getState().sessionExpired();

    // The credential that would authorize a server-side revoke is exactly what just died.
    expect(authApi.logout).not.toHaveBeenCalled();

    expect(mocked.clearAllSecureData).toHaveBeenCalled();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.tokens).toBeNull();
    expect(s.therapist).toBeNull();
  });

  it("tells the user why they were signed out", async () => {
    await useAuthStore.getState().sessionExpired();
    expect(toastShow).toHaveBeenCalledTimes(1);
    expect(toastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "error", text1: expect.stringMatching(/sign in again/i) }),
    );
  });

  it("is a no-op when already signed out — no toast on a login screen", async () => {
    useAuthStore.setState({ isAuthenticated: false, tokens: null, therapist: null });

    await useAuthStore.getState().sessionExpired();

    expect(mocked.clearAllSecureData).not.toHaveBeenCalled();
    expect(toastShow).not.toHaveBeenCalled();
  });
});
