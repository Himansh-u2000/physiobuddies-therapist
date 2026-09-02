import { API_BASE_URL } from "@/constants/config";

/**
 * Resolving a server file path to something `<Image>` can actually fetch.
 *
 * Its own module rather than living in `services.ts` because the *mappers* need it too — a
 * `GET /user` response carries `image`, and if the backend stored a relative path there, every
 * screen renders a blank avatar. `services.ts` already imports `mappers.ts`, so putting these
 * here is what keeps `mappers.ts → services.ts` from closing an import cycle.
 */

/**
 * The upload endpoint returns a SERVER-RELATIVE path (`/uploads/1786…-name.jpg`) — multer
 * writes to local disk and the controller hands back `/uploads/${filename}` verbatim. That is
 * unusable as-is in two places: `<Image source={{uri}}>` can't fetch it, and
 * `PATCH /user/avatar` validates its body with `z.string().url()`, so a relative path is
 * rejected outright. Absolutise it against the API origin (base URL minus the `/api/v1`
 * suffix, since `/uploads` is served from the root) so callers always get something fetchable.
 */
export function absoluteFileUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const origin = API_BASE_URL.replace(/\/api\/v\d+\/?$/, "");
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

/**
 * Resolve a PRIVATE document url (`/file/<id>`) returned by `add-docs`.
 *
 * Deliberately NOT `absoluteFileUrl`, and the difference is the whole point: `/uploads/...` is
 * served from the site root, so that helper *strips* the `/api/v1` suffix. `/file/:id` is a
 * versioned API route, so this one *keeps* it. Passing a private url through `absoluteFileUrl`
 * yields a 404 at a public path — which would look like a missing file rather than a wrong URL.
 *
 * The result still needs an `Authorization` header to fetch; see `lib/utils/privateFile.ts`.
 */
export function privateFileUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url)) return url;
  const base = API_BASE_URL.replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
