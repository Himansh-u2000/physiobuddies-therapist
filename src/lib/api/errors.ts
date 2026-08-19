import axios from "axios";

/**
 * Normalized API error handling.
 *
 * The backend returns a uniform envelope `{ success, message, data }` and, on failure,
 * `{ success: false, message }` with an HTTP status — there is NO machine-readable error
 * `code`. So we branch on HTTP status and surface the server `message`. (Note: the backend
 * currently returns 500 for some not-found cases, e.g. login with an unknown email, so we
 * keep messages user-safe and never assume a clean status taxonomy.)
 */

export type ApiErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "server"
  | "network"
  | "timeout"
  | "unknown";

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly details?: unknown;

  constructor(message: string, status: number, kind: ApiErrorKind, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.details = details;
  }
}

function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
    case 422:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

/** User-facing fallback when the server sends no message. */
function fallbackMessage(status: number): string {
  switch (status) {
    case 400:
    case 422:
      return "Please check the details and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have access to this. Contact support if this seems wrong.";
    case 404:
      return "We couldn't find what you were looking for.";
    case 429:
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return status >= 500
        ? "Something went wrong on our end. Please try again shortly."
        : "Something went wrong. Please try again.";
  }
}

interface ErrorBody {
  message?: string;
  error?: { message?: string };
}

/** Convert any thrown value (axios error, ApiError, Error) into a typed ApiError. */
export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (axios.isAxiosError(err)) {
    if (err.response) {
      const status = err.response.status;
      const body = err.response.data as ErrorBody | undefined;
      const message = body?.message || body?.error?.message || fallbackMessage(status);
      return new ApiError(message, status, kindFromStatus(status), body);
    }
    if (err.code === "ECONNABORTED") {
      return new ApiError("The request timed out. Check your connection and try again.", 0, "timeout");
    }
    return new ApiError("Can't reach the server. Check your internet connection.", 0, "network");
  }

  const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
  return new ApiError(message, 0, "unknown");
}

/**
 * A 500 the server raises against *itself*: the handler produced a body its own declared
 * response schema rejects. It arrives as `{ code: "RESPONSE_CONTRACT_ERROR" }` and, unlike
 * every other 5xx, is perfectly deterministic — the stored data is the problem, so retrying
 * it forever is the wrong response. Callers that can repair the data check for it explicitly.
 */
export function isResponseContractError(err: unknown): boolean {
  const e = normalizeError(err);
  return (
    e.status >= 500 &&
    (e.details as { code?: string } | undefined)?.code === "RESPONSE_CONTRACT_ERROR"
  );
}

/** Transient failures worth retrying (network / timeout / 5xx / rate-limit). */
export function isRetryable(err: ApiError): boolean {
  return (
    err.kind === "network" ||
    err.kind === "timeout" ||
    err.kind === "server" ||
    err.kind === "rate_limited"
  );
}

interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
}

/**
 * Run `fn` with exponential backoff + jitter on transient errors. Non-retryable errors
 * (validation, auth, not-found) throw immediately. Always throws a normalized ApiError.
 * Use for idempotent operations (auth requests are safe to retry).
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let attempt = 0;

  for (;;) {
    try {
      return await fn();
    } catch (e) {
      const err = normalizeError(e);
      if (attempt >= retries || !isRetryable(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
