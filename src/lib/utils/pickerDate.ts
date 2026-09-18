/**
 * Converting a calendar day to and from the native date picker (`@expo/ui` DateTimePicker).
 *
 * ## Why this exists: the Time off picker looped forever on Android
 *
 * The two native implementations disagree about what the `Date` they exchange means:
 *
 *   - **Android** (Material3, `DatePickerView.kt`) treats the incoming value as a *UTC* instant and
 *     reports the selection as **UTC midnight** of the chosen day (`selectedDateMillis`).
 *   - **iOS** (SwiftUI) treats both directions as ordinary local instants.
 *
 * The app sent local midnight (`new Date("2026-09-17T00:00:00")`). In India that instant is
 * 2026-09-16 18:30 UTC, so Material3 selected the **16th** and reported it straight back — its
 * `LaunchedEffect(state.selectedDateMillis)` fires on every state creation, not only on a tap. The
 * app stored the 16th, re-rendered with a new value, the native side rebuilt its state (it is keyed
 * on the incoming date), selected the 15th, and so on: the calendar walked backwards month after
 * month and no tap could land, because the state was recreated underneath it. Any zone other than
 * UTC does this; east of UTC it walks back, west of it the local reading of UTC midnight is the
 * previous evening, which walks back too.
 *
 * The fix is to speak each platform's dialect, so a day survives the round trip unchanged. A value
 * that comes back identical is a string React state already holds, so the render — and the loop —
 * stops there.
 *
 * `minimumDate`/`maximumDate` are different again: Android's `toUtcDayMillis` reads them with LOCAL
 * calendar fields, so they are passed as local midnight on both platforms. See `pickerBound`.
 */

export type PickerPlatform = "android" | "ios" | string;

function parseIso(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO `YYYY-MM-DD` → the `value` to hand the native picker on `platform`. */
export function toPickerValue(iso: string, platform: PickerPlatform): Date {
  const parts = parseIso(iso);
  if (!parts) return new Date(Number.NaN);
  const [y, m, d] = parts;
  return platform === "android" ? new Date(Date.UTC(y, m, d)) : new Date(y, m, d);
}

/** A date the native picker reported → ISO `YYYY-MM-DD`, read the way `platform` meant it. */
export function fromPickerValue(date: Date, platform: PickerPlatform): string {
  if (Number.isNaN(date.getTime())) return "";
  return platform === "android"
    ? `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * ISO → a `minimumDate`/`maximumDate`. Local midnight on every platform — Android's bound handling
 * reads local calendar fields, unlike its selection handling.
 */
export function pickerBound(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const parts = parseIso(iso);
  return parts ? new Date(parts[0], parts[1], parts[2]) : undefined;
}
