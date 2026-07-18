import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, USE_MOCK_API } from "@/constants/config";
import { getTokens, saveTokens, clearTokens } from "@/lib/storage/secure";
import { jwtExpiryMs } from "@/lib/auth/jwt";
import { normalizeError } from "@/lib/api/errors";
import type { AuthTokens } from "@/types";

const USE_MOCK = USE_MOCK_API;

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const tokens = await getTokens();
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

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

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

    // Only attempt a single refresh, and never for the refresh call itself.
    const isRefreshCall = typeof originalRequest?.url === "string" && originalRequest.url.includes("/auth/refresh-token");

    if (status === 401 && originalRequest && !originalRequest._retry && !isRefreshCall) {
      originalRequest._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
        const newToken = await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        }
      } else if (refreshPromise) {
        // A refresh is already in flight — wait for it, then replay this request.
        const newToken = await refreshPromise;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        }
      }
    }
    return Promise.reject(normalizeError(error));
  },
);

export { client, USE_MOCK };
