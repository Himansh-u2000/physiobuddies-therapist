import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, USE_MOCK_API } from "@/constants/config";
import { getTokens, saveTokens, clearTokens, isExpired } from "@/lib/storage/secure";
import { jwtExpiryMs } from "@/lib/auth/jwt";
import { isRetryable, normalizeError } from "@/lib/api/errors";
import { logRequest, logResponse, logFailure } from "@/lib/api/netlog";
import type { AuthTokens } from "@/types";

/**
 * The netlog id for an in-flight request, stashed on the config so the response/error
 * interceptor can close the same entry. Axios has no per-request context otherwise.
 */
interface LoggedRequestConfig extends InternalAxiosRequestConfig {
  _netLogId?: string | null;
  _retry?: boolean;
}

/** Absolute URL as actually requested — `baseURL` being wrong is itself a common bug. */
function absoluteUrl(config: { baseURL?: string; url?: string }): string {
  const base = (config.baseURL ?? "").replace(/\/$/, "");
  const path = config.url ?? "";
  return /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

const USE_MOCK = USE_MOCK_API;

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

/** The refresh endpoint must never itself be gated on a refresh. */
function isRefreshUrl(url?: string): boolean {
  return typeof url === "string" && url.includes("/auth/refresh");
}

client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    let tokens = await getTokens();

    // Refresh *before* sending rather than waiting for the inevitable 401. Without this,
    // the first request after the access token ages out (15m — so, most resumes from
    // background) is guaranteed to fail once and be replayed.
    if (tokens && !isRefreshUrl(config.url) && isExpired(tokens)) {
      // A failed refresh has already cleared storage — send no credential rather than a
      // known-dead one, so the 401 is unambiguous and the session ends cleanly.
      tokens = (await runRefresh()) ? await getTokens() : null;
    }

    if (tokens?.accessToken) {
      config.headers.Authorization = `Bearer ${tokens.accessToken}`;
    }

    // Logged last, so the entry records the Authorization header that was actually sent
    // (post-refresh) rather than the one we started with — "which token went out" is the
    // question this log most often has to answer.
    (config as LoggedRequestConfig)._netLogId = logRequest({
      method: config.method,
      url: config.url,
      fullUrl: absoluteUrl(config),
      headers: config.headers as unknown as Record<string, unknown>,
      body: config.data,
    });
    return config;
  },
  (error) => Promise.reject(error),
);

/** Build an AuthTokens record from the backend's `{ accessToken, refreshToken }` payload. */
export function toAuthTokens(data: { accessToken: string; refreshToken: string }): AuthTokens {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: jwtExpiryMs(data.accessToken),
  };
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Single-flight refresh. Concurrent callers — the request interceptor pre-empting expiry
 * and any number of in-flight requests hitting 401 — share one network call. Critical
 * because the backend ROTATES the refresh token (`generateTokens` overwrites the
 * `authSession` row), so parallel refreshes would invalidate each other's token.
 */
function runRefresh(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

type SessionDeadHandler = () => void;
let sessionDeadHandler: SessionDeadHandler | null = null;

/**
 * Registered once by the root layout so a rejected refresh can end the session in the UI.
 * Without it the client clears secure storage while `auth.store.isAuthenticated` stays
 * `true` — the therapist sits in a signed-in-looking app where every request 401s until the
 * next cold start. `api_contract.md` §1.2 already specifies "auto-refresh once, else force
 * logout"; this is the second half. A callback rather than a direct import because
 * `auth.store` → `services` → `client`, so importing the store here would close a cycle.
 */
export function setSessionDeadHandler(fn: SessionDeadHandler | null): void {
  sessionDeadHandler = fn;
}

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return null;
  // Logged by hand because this call deliberately bypasses the interceptors — and it is the
  // request most worth seeing: a silently failing refresh makes every *other* request 401,
  // which reads as "the whole app is broken" rather than "the session died".
  const logId = logRequest({
    method: "POST",
    url: "/auth/refresh",
    fullUrl: `${API_BASE_URL}/auth/refresh`,
    body: { refresh: tokens.refreshToken },
  });
  try {
    // Called with a bare axios instance so it skips the auth interceptor and the refresh
    // loop. Backend accepts the refresh token in the body (`req.body.refresh`) since RN has
    // no cookie jar. Response envelope: { success, message, data: { accessToken, refreshToken } }.
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refresh: tokens.refreshToken,
    });
    logResponse(logId, res.status, res.data);
    const data = res.data?.data ?? res.data;
    if (!data?.accessToken) throw new Error("Malformed refresh response");
    const newTokens = toAuthTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? tokens.refreshToken,
    });
    await saveTokens(newTokens);
    return newTokens.accessToken;
  } catch (e) {
    const err = normalizeError(e);
    logFailure(logId, err.status || undefined, err.message, err.details);
    // Only a server *rejection* proves the refresh token is dead. A network/timeout/5xx
    // failure means we couldn't ask — and clearing tokens there would sign a therapist out
    // for walking into a basement, taking any queued offline session down with the session.
    // Leave them in place; the next attempt (or reconnect) retries.
    if (isRetryable(err)) return null;
    await clearTokens();
    sessionDeadHandler?.();
    return null;
  }
}

/**
 * The backend wraps *every* response in `{ success, message, data }` (`api_contract.md` §1.2).
 * Unwrapping here — once, in the interceptor — rather than at each of the ~20 call sites is
 * deliberate: a service added later can't forget to do it, and there is exactly one peel in
 * the app, so a payload that itself carries a `data` field can never be unwrapped twice.
 * Both envelope keys are required before unwrapping, so a bare payload passes through
 * untouched (useful against any endpoint that doesn't follow the convention yet).
 */
function unwrapEnvelope(body: unknown): unknown {
  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "success" in body &&
    "data" in body
  ) {
    return (body as { data: unknown }).data;
  }
  return body;
}

client.interceptors.response.use(
  (response) => {
    response.data = unwrapEnvelope(response.data);
    // Logged post-unwrap deliberately: the log should show the payload the services and
    // mappers actually receive, not the envelope, so a "why is this field undefined?"
    // question can be answered from the log alone.
    // Optional-chained: logging must never be able to throw here. An exception raised inside
    // the success interceptor turns an otherwise-fine 200 into a rejected promise, which would
    // make the diagnostic tool a cause of the failures it exists to diagnose.
    logResponse(
      (response.config as LoggedRequestConfig | undefined)?._netLogId ?? null,
      response.status,
      response.data,
    );
    return response;
  },
  async (error) => {
    const originalRequest = error.config as LoggedRequestConfig | undefined;
    const status = error.response?.status;
    const normalized = normalizeError(error);

    logFailure(
      originalRequest?._netLogId ?? null,
      status,
      normalized.message,
      error.response?.data,
    );

    // Retry once, and never for the refresh call itself.
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshUrl(originalRequest.url)
    ) {
      originalRequest._retry = true;
      // The replay is a second request and gets its own log entry — a 401-then-200 pair is
      // the signature of a working refresh, and collapsing them would hide that.
      delete originalRequest._netLogId;
      const newToken = await runRefresh();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      }
    }
    return Promise.reject(normalized);
  },
);

export { client, USE_MOCK };
