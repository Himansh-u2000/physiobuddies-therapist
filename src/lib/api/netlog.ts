/**
 * In-app network log — a Chrome-DevTools-Network-tab equivalent for a phone.
 *
 * Why this exists rather than "just read the console": the review loop for this app is a
 * locally-built **release** APK (`npm run apk`) installed on a physical Android. There is no
 * Metro attached, `console.log` goes nowhere a reviewer can see, and Chrome DevTools can't
 * attach to a production JS bundle. So when a screen says "couldn't load", the only thing
 * anyone can report is "it failed" — which is exactly the position we were in.
 *
 * Every request that goes through `client.ts` (plus the bare-axios refresh call, which
 * deliberately bypasses the interceptors) lands here: method, full URL, request body, status,
 * response body, duration. The `/network-log` screen renders it and can share a JSON dump.
 *
 * Ring buffer, capped — this holds patient data in memory, so it is bounded, never persisted
 * to SQLite or disk, and cleared on sign-out.
 */

import { NETWORK_LOG_ENABLED } from "@/constants/config";

export type NetLogPhase = "pending" | "success" | "error";

export interface NetLogEntry {
  id: string;
  method: string;
  /** Path only (`/auth/login`) — what you scan the list by. */
  url: string;
  /** Absolute URL actually requested, for when the base URL itself is the bug. */
  fullUrl: string;
  phase: NetLogPhase;
  status?: number;
  /** Set when the failure never reached the server (DNS, timeout, TLS). */
  errorMessage?: string;
  requestHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
  startedAt: number;
  durationMs?: number;
}

/** Enough to cover a full screen's worth of traffic plus the login that preceded it. */
const MAX_ENTRIES = 80;

/**
 * Bodies are stringified for display; a base64 image or a long article would otherwise make
 * the detail view unusable (and, on a low-end device, expensive to render).
 */
const MAX_BODY_CHARS = 4000;

let entries: NetLogEntry[] = [];
let seq = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to log changes (drives `useSyncExternalStore` in the screen). */
export function subscribeNetLog(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current snapshot, newest first. Stable identity between emits, as the store contract requires. */
export function getNetLog(): NetLogEntry[] {
  return entries;
}

export function clearNetLog(): void {
  entries = [];
  emit();
}

/**
 * Redact anything that would turn a shared log into a credential leak.
 *
 * The whole point of this log is that it gets screenshotted and pasted into chats, so this is
 * not optional politeness. Bearer tokens are truncated rather than removed entirely — "which
 * token was sent" is frequently the actual question, and the first characters are enough to
 * tell two tokens apart.
 */
const SECRET_KEYS = /^(password|newpassword|currentpassword|token|refresh|accesstoken|refreshtoken|otp)$/i;

function redactHeaders(headers: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value === undefined || value === null || typeof value === "object") continue;
    if (/^authorization$/i.test(key)) {
      const raw = String(value);
      const token = raw.replace(/^Bearer\s+/i, "");
      out[key] = `Bearer ${token.slice(0, 12)}…(${token.length} chars)`;
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

function redactBody(body: unknown, depth = 0): unknown {
  if (body === null || body === undefined) return body;
  if (depth > 4) return "[nested]";
  if (Array.isArray(body)) return body.map((item) => redactBody(item, depth + 1));
  if (typeof body === "object") {
    // FormData (file uploads) has no useful enumerable shape in RN — say so rather than
    // rendering `{}` and leaving the reader thinking the body was empty.
    if (typeof FormData !== "undefined" && body instanceof FormData) return "[FormData]";
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      out[key] = SECRET_KEYS.test(key) ? "[redacted]" : redactBody(value, depth + 1);
    }
    return out;
  }
  if (typeof body === "string") {
    // Axios hands back raw strings when the response isn't JSON — an HTML error page from a
    // proxy, most usefully. Keep it, truncated.
    try {
      return redactBody(JSON.parse(body), depth + 1);
    } catch {
      return body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}…[truncated]` : body;
    }
  }
  return body;
}

/** Render a body for display/sharing. Kept out of the hot path — called by the screen only. */
export function formatBody(body: unknown): string {
  if (body === undefined) return "";
  if (typeof body === "string") return body;
  try {
    const json = JSON.stringify(body, null, 2);
    return json.length > MAX_BODY_CHARS ? `${json.slice(0, MAX_BODY_CHARS)}…[truncated]` : json;
  } catch {
    return String(body);
  }
}

function push(entry: NetLogEntry): void {
  entries = [entry, ...entries].slice(0, MAX_ENTRIES);
  emit();
}

/**
 * Record a request as it leaves. Returns the entry id, or null when logging is off — callers
 * pass that straight back to `logResponse`/`logFailure`, so a disabled log costs one branch.
 */
export function logRequest(input: {
  method?: string;
  url?: string;
  fullUrl: string;
  headers?: Record<string, unknown>;
  body?: unknown;
}): string | null {
  if (!NETWORK_LOG_ENABLED) return null;
  const id = `net-${++seq}`;
  push({
    id,
    method: (input.method ?? "GET").toUpperCase(),
    url: input.url ?? input.fullUrl,
    fullUrl: input.fullUrl,
    phase: "pending",
    requestHeaders: input.headers ? redactHeaders(input.headers) : undefined,
    requestBody: redactBody(input.body),
    startedAt: Date.now(),
  });
  return id;
}

function complete(id: string | null, patch: Partial<NetLogEntry>): void {
  if (!NETWORK_LOG_ENABLED || !id) return;
  const index = entries.findIndex((e) => e.id === id);
  if (index === -1) return;
  const existing = entries[index];
  const updated: NetLogEntry = {
    ...existing,
    ...patch,
    durationMs: Date.now() - existing.startedAt,
  };
  entries = [...entries.slice(0, index), updated, ...entries.slice(index + 1)];
  emit();
}

export function logResponse(id: string | null, status: number, body: unknown): void {
  complete(id, { phase: "success", status, responseBody: redactBody(body) });
  if (__DEV__ && id) {
    const entry = entries.find((e) => e.id === id);
    if (entry) console.log(`[api] ${entry.method} ${entry.url} → ${status} (${entry.durationMs}ms)`);
  }
}

export function logFailure(
  id: string | null,
  status: number | undefined,
  message: string,
  body: unknown,
): void {
  complete(id, { phase: "error", status, errorMessage: message, responseBody: redactBody(body) });
  if (__DEV__ && id) {
    const entry = entries.find((e) => e.id === id);
    if (entry) {
      console.warn(`[api] ${entry.method} ${entry.url} → ${status ?? "ERR"} ${message}`);
    }
  }
}

/** One shareable text dump of the whole log — what a reviewer sends when a screen misbehaves. */
export function dumpNetLog(): string {
  return entries
    .map((e) => {
      const head = `${e.method} ${e.fullUrl}\n  ${e.phase.toUpperCase()} ${e.status ?? ""} ${
        e.durationMs != null ? `${e.durationMs}ms` : ""
      }`;
      const err = e.errorMessage ? `\n  error: ${e.errorMessage}` : "";
      const req = e.requestBody !== undefined ? `\n  request: ${formatBody(e.requestBody)}` : "";
      const res = e.responseBody !== undefined ? `\n  response: ${formatBody(e.responseBody)}` : "";
      return `${head}${err}${req}${res}`;
    })
    .join("\n\n");
}
