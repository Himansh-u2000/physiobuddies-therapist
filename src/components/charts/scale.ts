/**
 * Scale helpers shared by the earnings charts. Pure, so the parts that decide whether a chart tells
 * the truth — where zero is, what the top of the axis means — are pinned by tests rather than eyed.
 */

/**
 * The chart series colour.
 *
 * `COLORS.info` (#0086a8), chosen by running the dataviz palette validator rather than by taste.
 * The brand navy (`COLORS.accent`, #004060) FAILS as a data colour on a white card — outside the
 * lightness band and below the chroma floor, so on a chart it reads as near-black text ink rather
 * than as data. The previous charts used it, plus `COLORS.success` green, which is a status colour
 * and made an ordinary bar read as "good day".
 *
 * There is deliberately no second, darker "selected" step: the obvious candidate (#00637d) fails
 * the chroma floor too and reads grey. Selection is carried by a label and a marker instead, which
 * also keeps it from depending on colour at all.
 */
export const SERIES_COLOR = "#0086a8";

/** Recessive, solid hairline — gridlines are one shade off the surface, never dashed. */
export const GRID_COLOR = "rgba(207,217,223,0.7)";

/**
 * Round an axis maximum up to 1, 2, 2.5 or 5 × 10ⁿ, so ticks land on numbers people read at a
 * glance (Rs 2,500 rather than Rs 2,317).
 *
 * Returns 0 for an all-zero series; callers treat that as "nothing to chart" and show an empty state
 * instead of an axis from 0 to 0.
 */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const exponent = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exponent;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return step * exponent;
}

/**
 * Compact rupee label for axis ticks: "Rs 0", "Rs 500", "Rs 1.5k", "Rs 12k".
 *
 * Only for ticks. Every value a therapist reads as *their money* — the headline, the selected-day
 * label — uses the full `formatCurrency`, because "Rs 1.5k" is not how anyone checks a payout.
 */
export function compactRupees(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 1000) return `Rs ${Math.round(value)}`;
  const k = value / 1000;
  const text = Number.isInteger(k) ? String(k) : k.toFixed(k < 10 ? 1 : 0).replace(/\.0$/, "");
  return `Rs ${text}k`;
}

/** Height fraction of `value` on a 0-based axis topped at `max`. Zero stays zero. */
export function barFraction(value: number, max: number): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(1, value / max);
}
