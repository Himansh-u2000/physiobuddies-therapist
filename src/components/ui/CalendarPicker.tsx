import { useMemo } from "react";
import { Platform } from "react-native";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { COLORS } from "@/constants/config";
import { fromPickerValue, pickerBound, toPickerValue } from "@/lib/utils/pickerDate";

interface CalendarPickerProps {
  /** Selected day, ISO `YYYY-MM-DD`. */
  value: string;
  /** Earliest selectable day, ISO. */
  minDate?: string;
  /** Latest selectable day, ISO. */
  maxDate?: string;
  /** Called only when the day genuinely changes — never for the native side's own echo. */
  onChange: (iso: string) => void;
}

/**
 * An inline month calendar, speaking ISO date strings.
 *
 * Every screen should use this rather than `DateTimePicker` directly, because using it directly
 * got two things wrong that are easy to reintroduce:
 *
 *   1. **An infinite loop on Android.** The raw picker round-trips a day through different
 *      timezone conventions on each platform, so a local-midnight value came back as the previous
 *      day, forever — see `lib/utils/pickerDate.ts`. This component converts per platform, and
 *      additionally drops any report that matches the current value, so the native side's
 *      on-mount echo can never trigger a render.
 *   2. **A compact button instead of a calendar on iOS.** The iOS implementation ignores
 *      `presentation` and chooses its style from `display`, which callers never set, so iOS fell
 *      back to `automatic` (compact). Both props are set here.
 *
 * All `Date` props are memoised on their ISO strings. The native Android view rebuilds its whole
 * calendar state whenever a bound changes, so a `new Date()` created during render — as
 * `DatePickerSheet` used to do for "today", with the current milliseconds — rebuilt it on every
 * render, which is its own loop.
 */
export function CalendarPicker({ value, minDate, maxDate, onChange }: CalendarPickerProps) {
  const platform = Platform.OS;
  const pickerValue = useMemo(() => toPickerValue(value, platform), [value, platform]);
  const minimumDate = useMemo(() => pickerBound(minDate), [minDate]);
  const maximumDate = useMemo(() => pickerBound(maxDate), [maxDate]);

  return (
    <DateTimePicker
      value={pickerValue}
      mode="date"
      presentation="inline"
      display="inline"
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      accentColor={COLORS.accent}
      onValueChange={(_, date) => {
        const iso = fromPickerValue(date, platform);
        // The echo of the value we just sent. (A report landing between a state update and its
        // re-render can still repeat the new day once — harmless, since setting identical string
        // state is a no-op React skips.)
        if (!iso || iso === value) return;
        onChange(iso);
      }}
    />
  );
}
