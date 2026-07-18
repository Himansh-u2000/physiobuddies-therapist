import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, USE_MOCK_API } from "@/constants/config";
import { getTokens, saveTokens, clearTokens, isExpired } from "@/lib/storage/secure";
import { jwtExpiryMs } from "@/lib/auth/jwt";
import { normalizeError } from "@/lib/api/errors";
import type { AuthTokens } from "@/types";

const USE_MOCK = USE_MOCK_API;

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

/** The refresh endpoint must never itself be gated on a refresh. */
function isRefreshUrl(url?: string): boolean {
  return typeof url === "string" && url.includes("/auth/refresh-token");
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

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return null;
  try {
    // Called with a bare axios instance so it skips the auth interceptor and the refresh
    // loop. Backend accepts the refresh token in the body (`req.body.refresh`) since RN has
    // no cookie jar. Response envelope: { success, message, data: { accessToken, refreshToken } }.
    const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, {
      refresh: tokens.refreshToken,
    });
    const data = res.data?.data ?? res.data;
    if (!data?.accessToken) throw new Error("Malformed refresh response");
    const newTokens = toAuthTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? tokens.refreshToken,
    });
    await saveTokens(newTokens);
    return newTokens.accessToken;
  } catch {
    // Refresh failed → the refresh token is dead. Clear so the app falls back to sign-in.
    await clearTokens();
    return null;
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    // Retry once, and never for the refresh call itself.
    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshUrl(originalRequest.url)
    ) {
      originalRequest._retry = true;
      const newToken = await runRefresh();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      }
    }
    return Promise.reject(normalizeError(error));
  },
);

export { client, USE_MOCK };
