/**
 * Distance between two points, computed on the device.
 *
 * Deliberately local arithmetic rather than a Distance Matrix / Directions call. Those are the
 * *billed* Google Maps SKUs, and the therapist does not need road distance here — the number on
 * this screen answers "is this across town or around the corner?" before they hand off to their
 * navigation app, which does the real routing for free. Calling a paid API to render one label
 * would be the expensive way to answer a question the phone can answer for nothing.
 *
 * The trade is that this is straight-line ("as the crow flies") distance, always shorter than the
 * drive. Every caller must therefore present it as approximate — see `formatDistance`, which
 * builds the `~` in rather than leaving it to each call site to remember.
 */

/** Mean Earth radius in kilometres (IUGG). */
const EARTH_RADIUS_KM = 6371;

export interface LatLng {
  latitude: number;
  longitude: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in kilometres, via the haversine formula.
 *
 * Haversine rather than the simpler equirectangular approximation because the latter degrades
 * badly at the extremes, and this costs nothing by comparison — we run it once per screen, not
 * per frame.
 */
export function haversineKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Render a distance for display, at a precision the underlying number can actually support.
 *
 * Straight-line distance is an estimate, so "1.27 km" would be false precision — it reads as a
 * measurement when it is a lower bound on the drive. Metres below a kilometre (rounded to 50 m,
 * because GPS on a phone is not better than that), one decimal below 10 km, whole kilometres
 * above.
 *
 * The leading `~` is not decoration: without it a therapist reasonably reads this as travel
 * distance and budgets their time against a number that is always optimistic.
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return "";
  if (km < 1) {
    const metres = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `~${metres} m away`;
  }
  if (km < 10) return `~${km.toFixed(1)} km away`;
  return `~${Math.round(km)} km away`;
}

/**
 * A map region that frames both points with breathing room.
 *
 * `MapView.fitToCoordinates` exists and is better once the map is laid out, but a region is
 * needed for `initialRegion` — without one the map opens on a default view and visibly jumps,
 * which on a slow device looks like a bug. The 2.2x padding keeps both pins clear of the edges
 * and of the callout bubbles that sit above them; the floor stops a very short trip from opening
 * zoomed so far in that neither pin has context around it.
 */
export function regionFor(points: LatLng[], minDelta = 0.01) {
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(minDelta, (maxLat - minLat) * 2.2),
    longitudeDelta: Math.max(minDelta, (maxLng - minLng) * 2.2),
  };
}
