/**
 * The axios client's two interceptors — the layer every non-auth service now depends on.
 *
 * `client.ts` builds its instance and registers both interceptors at import time, so the
 * mock below captures the handlers as they're registered and the tests then invoke them
 * directly. That's the only way to exercise this file without a network: the handlers are
 * plain functions, and calling them is exactly what axios itself would do.
 */

import * as secure from "@/lib/storage/secure";
import { setSessionDeadHandler } from "@/lib/api/client";

// `jest.mock` calls are hoisted above the imports above by babel-plugin-jest-hoist, so those
// modules resolve to these stubs despite appearing below (same arrangement as auth.store's tests).
jest.mock("axios", () => {
  // Declared inside the factory, not above it: importing `client.ts` requires "axios" during
  // the import phase, so anything declared in module scope out here would still be in its
  // temporal dead zone when this runs.
  const responseHandlers: { ok: (v: any) => any; err: (e: any) => any }[] = [];
  const instance = {
    interceptors: {
      request: { use: () => {} },
      response: { use: (ok: any, err: any) => responseHandlers.push({ ok, err }) },
    },
  };
  const mock = {
    create: jest.fn(() => instance),
    post: jest.fn(),
    isAxiosError: (e: any) => !!e?.isAxiosError,
    __responseHandlers: responseHandlers,
  };
  return { __esModule: true, default: mock, ...mock };
});

jest.mock("@/lib/storage/secure", () => ({
  getTokens: jest.fn(async () => null),
  saveTokens: jest.fn(async () => {}),
  clearTokens: jest.fn(async () => {}),
  isExpired: jest.fn(() => false),
}));

const mocked = secure as jest.Mocked<typeof secure>;
const axiosMock = jest.requireMock("axios") as any;

/** The client's success/error response interceptor pair, as axios itself would invoke it. */
const response = () => axiosMock.__responseHandlers[0];
/** The bare (non-intercepted) axios used for the refresh call, so it skips the auth loop. */
const bareAxiosPost = axiosMock.post as jest.Mock;

/** An axios rejection shaped the way `normalizeError` reads it. */
function axiosError(status?: number, code?: string) {
  return {
    isAxiosError: true,
    code,
    response: status === undefined ? undefined : { status, data: { message: "nope" } },
    config: { url: "/auth/refresh" },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  setSessionDeadHandler(null);
  mocked.getTokens.mockResolvedValue({
    accessToken: "access",
    refreshToken: "refresh",
    expiresAt: Date.now() + 900_000,
  });
});

describe("response envelope", () => {
  it("peels { success, message, data } down to the payload", () => {
    const res = response().ok({ data: { success: true, message: "ok", data: { id: "apt_1" } } });
    expect(res.data).toEqual({ id: "apt_1" });
  });

  it("passes a bare payload through untouched", () => {
    // Not every endpoint is guaranteed to follow the convention; an unenveloped body must
    // survive rather than be mangled into undefined.
    const res = response().ok({ data: { id: "apt_1" } });
    expect(res.data).toEqual({ id: "apt_1" });
  });

  it("does not peel a payload that merely happens to carry a `data` field", () => {
    // The guard requires BOTH envelope keys. Without that, any payload with its own `data`
    // property would be silently unwrapped twice.
    const res = response().ok({ data: { id: "cfg", data: [1, 2] } });
    expect(res.data).toEqual({ id: "cfg", data: [1, 2] });
  });

  it("passes arrays and null through untouched", () => {
    expect(response().ok({ data: [1, 2, 3] }).data).toEqual([1, 2, 3]);
    expect(response().ok({ data: null }).data).toBeNull();
  });

  it("yields null for an envelope with an empty payload", () => {
    const res = response().ok({ data: { success: true, message: "ok", data: null } });
    expect(res.data).toBeNull();
  });
});

describe("refresh failure handling", () => {
  /** Drives a refresh by 401-ing a normal request, which is what the interceptor reacts to. */
  async function triggerRefreshVia401() {
    await response()
      .err({ config: { url: "/appointments" }, response: { status: 401 }, isAxiosError: true })
      .catch(() => {});
  }

  it("ends the session when the server rejects the refresh token", async () => {
    const onDead = jest.fn();
    setSessionDeadHandler(onDead);
    bareAxiosPost.mockRejectedValueOnce(axiosError(401));

    await triggerRefreshVia401();

    expect(mocked.clearTokens).toHaveBeenCalled();
    expect(onDead).toHaveBeenCalled();
  });

  it("keeps the tokens when the refresh merely could not be delivered", async () => {
    // Offline-first: clearing tokens on a network blip would sign a therapist out — and
    // strand any queued, unsynced session — for walking into a basement.
    const onDead = jest.fn();
    setSessionDeadHandler(onDead);
    bareAxiosPost.mockRejectedValueOnce(axiosError(undefined));

    await triggerRefreshVia401();

    expect(mocked.clearTokens).not.toHaveBeenCalled();
    expect(onDead).not.toHaveBeenCalled();
  });

  it("keeps the tokens when the refresh endpoint 500s", async () => {
    setSessionDeadHandler(jest.fn());
    bareAxiosPost.mockRejectedValueOnce(axiosError(503));

    await triggerRefreshVia401();

    expect(mocked.clearTokens).not.toHaveBeenCalled();
  });

  it("persists the rotated pair on a successful refresh", async () => {
    bareAxiosPost.mockResolvedValueOnce({
      data: { success: true, message: "ok", data: { accessToken: "a2", refreshToken: "r2" } },
    });

    await triggerRefreshVia401();

    expect(mocked.saveTokens).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "a2", refreshToken: "r2" }),
    );
  });
});
