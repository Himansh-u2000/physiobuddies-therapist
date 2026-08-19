import { useEffect, useState } from "react";
import { getTokens } from "@/lib/storage/secure";

/**
 * Fetching clinical documents, which live behind auth.
 *
 * `POST /treatment-session/:id/add-docs` stores a file in the server's `private-uploads`
 * directory and hands back `/file/<id>`. That path resolves ONLY through
 * `GET /api/v1/file/:id`, which 401s without a bearer token and answers 404 — indistinguishable
 * from a missing id — to anyone who isn't the patient concerned, the assigned therapist, or an
 * admin. That is the point: a patient's X-ray must not sit on a URL anyone can curl.
 *
 * The consequence is that `<Image source={{ uri }} />` stops working on its own. RN's image
 * loader issues a plain GET with no app headers, so a private url renders as a blank box with no
 * error — the failure mode is silence, which is why this helper exists rather than each call
 * site remembering. `expo-image` accepts `source.headers`, so the fix is to attach the same
 * bearer token the API client uses.
 */

/** A private `/file/:id` url — as opposed to a public `/uploads/...` one or a local `file://`. */
export function isPrivateFileUrl(url: string | null | undefined): boolean {
  return !!url && /\/api\/v\d+\/file\//i.test(url);
}

/**
 * Build an `expo-image` source for a url that may or may not need auth.
 *
 * Public urls and on-device `file://` uris pass through untouched — attaching a bearer token to
 * a third-party or local url would leak it, so the private-path check is deliberately narrow.
 */
export function privateImageSource(
  url: string | null | undefined,
  token: string | null,
): { uri: string; headers?: Record<string, string> } | null {
  if (!url) return null;
  if (!isPrivateFileUrl(url) || !token) return { uri: url };
  return { uri: url, headers: { Authorization: `Bearer ${token}` } };
}

/**
 * The current access token, for image headers.
 *
 * Read from secure storage rather than the auth store because the store holds the therapist
 * profile, not the token. Refreshes are handled by the API client's interceptor and rotate the
 * stored value, so this re-reads on mount rather than caching module-level: an image rendered
 * after a refresh would otherwise carry a token the server has already replaced.
 *
 * Returns `null` until the read resolves, which callers should treat as "not ready yet" — render
 * the local file or a placeholder rather than firing an unauthenticated request that will 401
 * and then be cached as a failure by the image loader.
 */
export function useFileAuthToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getTokens()
      .then((tokens) => {
        if (!cancelled) setToken(tokens?.accessToken ?? null);
      })
      .catch(() => {
        // A failed read is not worth surfacing: it degrades to "no header", which shows the
        // local copy or a placeholder. Throwing here would take down the treatment form.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}
