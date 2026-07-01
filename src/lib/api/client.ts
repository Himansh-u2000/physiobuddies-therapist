import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, USE_MOCK_API } from "@/constants/config";
import { getTokens, saveTokens, clearTokens } from "@/lib/storage/secure";

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

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
      refreshToken: tokens.refreshToken,
    });
    const newTokens = res.data;
    await saveTokens(newTokens);
    return newTokens.accessToken;
  } catch {
    await clearTokens();
    return null;
  }
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
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
        const newToken = await refreshPromise;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        }
      }
    }
    return Promise.reject(error);
  },
);

export { client, USE_MOCK };
