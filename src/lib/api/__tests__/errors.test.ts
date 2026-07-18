import { ApiError, normalizeError, isRetryable, withRetry } from "@/lib/api/errors";

/**
 * The backend has no machine-readable error `code` — only `{ success, message }` plus an
 * HTTP status — so every user-facing auth message depends on this status→kind mapping
 * being right. These are the cases a device test would take a build to discover.
 */

/** Minimal axios-error shape: axios.isAxiosError only checks the `isAxiosError` flag. */
function axiosError(opts: { status?: number; data?: unknown; code?: string }) {
  return {
    isAxiosError: true,
    code: opts.code,
    message: "request failed",
    response: opts.status === undefined ? undefined : { status: opts.status, data: opts.data },
  };
}

describe("normalizeError", () => {
  it("passes an existing ApiError through untouched", () => {
    const original = new ApiError("already normalized", 418, "validation");
    expect(normalizeError(original)).toBe(original);
  });

  it("prefers the server-supplied message over the generic fallback", () => {
    const err = normalizeError(axiosError({ status: 400, data: { message: "Invalid credentials" } }));
    expect(err.message).toBe("Invalid credentials");
    expect(err.status).toBe(400);
    expect(err.kind).toBe("validation");
  });

  it("falls back to a user-safe message when the body carries none", () => {
    const err = normalizeError(axiosError({ status: 401, data: {} }));
    expect(err.kind).toBe("unauthorized");
    expect(err.message).toBe("Your session has expired. Please sign in again.");
  });

  it.each([
    [400, "validation"],
    [422, "validation"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "server"],
    [503, "server"],
    [418, "unknown"],
  ])("maps HTTP %i to kind %s", (status, kind) => {
    expect(normalizeError(axiosError({ status, data: {} })).kind).toBe(kind);
  });

  it("classifies an aborted request as a timeout, not a network failure", () => {
    const err = normalizeError(axiosError({ code: "ECONNABORTED" }));
    expect(err.kind).toBe("timeout");
    expect(err.status).toBe(0);
  });

  it("classifies a response-less axios error as a network failure", () => {
    const err = normalizeError(axiosError({}));
    expect(err.kind).toBe("network");
    expect(err.status).toBe(0);
  });

  it("wraps a plain Error, keeping its message", () => {
    const err = normalizeError(new Error("something odd"));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.kind).toBe("unknown");
    expect(err.message).toBe("something odd");
  });

  it("wraps a non-Error throw without crashing", () => {
    expect(normalizeError("just a string")).toBeInstanceOf(ApiError);
  });

  it("keeps the raw body available for debugging", () => {
    const body = { message: "nope", trace: "abc" };
    expect(normalizeError(axiosError({ status: 400, data: body })).details).toEqual(body);
  });
});

describe("isRetryable", () => {
  it("retries transient failures", () => {
    for (const kind of ["network", "timeout", "server", "rate_limited"] as const) {
      expect(isRetryable(new ApiError("x", 0, kind))).toBe(true);
    }
  });

  it("does not retry failures the user must act on", () => {
    for (const kind of ["validation", "unauthorized", "forbidden", "not_found"] as const) {
      expect(isRetryable(new ApiError("x", 400, kind))).toBe(false);
    }
  });
});

describe("withRetry", () => {
  it("returns the value without retrying when the call succeeds", async () => {
    const fn = jest.fn().mockResolvedValue("ok");
    await expect(withRetry(fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure and returns the eventual success", async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(axiosError({ status: 503, data: {} }))
      .mockResolvedValue("recovered");
    await expect(withRetry(fn, { baseDelayMs: 1 })).resolves.toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured number of retries", async () => {
    const fn = jest.fn().mockRejectedValue(axiosError({ status: 500, data: {} }));
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 1 })).rejects.toBeInstanceOf(ApiError);
    // Initial attempt plus two retries.
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a validation failure", async () => {
    const fn = jest.fn().mockRejectedValue(axiosError({ status: 400, data: { message: "bad" } }));
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toMatchObject({ message: "bad" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 401, so a dead session fails fast to the sign-in screen", async () => {
    const fn = jest.fn().mockRejectedValue(axiosError({ status: 401, data: {} }));
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toMatchObject({ kind: "unauthorized" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("always rejects with a normalized ApiError, never the raw throw", async () => {
    const fn = jest.fn().mockRejectedValue("a bare string");
    await expect(withRetry(fn, { baseDelayMs: 1 })).rejects.toBeInstanceOf(ApiError);
  });

  it("backs off increasingly between attempts", async () => {
    const fn = jest.fn().mockRejectedValue(axiosError({ status: 500, data: {} }));
    const started = Date.now();
    await expect(withRetry(fn, { retries: 2, baseDelayMs: 20 })).rejects.toBeInstanceOf(ApiError);
    // 20ms then 40ms of backoff, ignoring jitter.
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
  });
});
