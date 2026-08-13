import { useCallback, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Minus, Plus } from "lucide-react-native";
import { COLORS } from "@/constants/config";

/**
 * A draggable numeric slider.
 *
 * Every numeric field in the treatment form was a bare `TextInput` with `keyboard-type:
 * number-pad` — which means: tap, wait for the keyboard, type, dismiss the keyboard, for a value
 * that is almost always a small integer the therapist is estimating anyway. That's a lot of
 * interaction cost mid-session, often one-handed, sometimes with gloves. A slider makes the
 * common case one gesture, and the ± buttons keep exact values reachable (and give the control
 * a keyboard-and-screen-reader-accessible path, which a drag target alone would not).
 *
 * Built on gesture-handler + reanimated (both already dependencies) rather than pulling in a
 * community slider: the thumb tracks the finger on the UI thread, and JS is only notified when
 * the *stepped* value actually changes — so a full drag across a 0–10 scale fires ~10 updates,
 * not one per frame.
 */

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  /** Rendered after the value, e.g. "/10", " reps", " bpm". */
  unit?: string;
  /** Small captions under the two ends of the track, e.g. "No pain" … "Worst". */
  minLabel?: string;
  maxLabel?: string;
  /** Colour of the filled portion and thumb. Defaults to the app accent. */
  color?: string;
  /** Called with the value for a live colour, e.g. green→red across a pain scale. */
  colorForValue?: (value: number) => string;
  disabled?: boolean;
}

const TRACK_HEIGHT = 8;
const THUMB_SIZE = 26;

export function Slider({
  value,
  onChange,
  min = 0,
  max = 10,
  step = 1,
  label,
  unit,
  minLabel,
  maxLabel,
  color,
  colorForValue,
  disabled,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const accent = colorForValue ? colorForValue(value) : (color ?? COLORS.accent);
  const range = Math.max(max - min, 1);

  const commit = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next));
      // Snap to the step grid and kill float drift (0.30000000000000004 → 0.3).
      const snapped = Math.round((clamped - min) / step) * step + min;
      const rounded = Number(snapped.toFixed(6));
      if (rounded !== value) onChange(rounded);
    },
    [max, min, step, value, onChange],
  );

  const setFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / trackWidth));
      commit(min + ratio * range);
    },
    [trackWidth, commit, min, range],
  );

  // `runOnJS(true)` keeps the gesture callbacks on the JS thread so they can call `setFromX`
  // directly. Correct trade-off here: the only thing being animated is a stepped integer, so
  // there are ~10 updates across a full drag, not one per frame — the cost a UI-thread worklet
  // would be avoiding doesn't exist, and this keeps the component free of worklet plumbing.
  const pan = Gesture.Pan()
    .enabled(!disabled)
    .runOnJS(true)
    // Claim horizontal movement early and give up on vertical: without this the enclosing
    // ScrollView wins the first pixels of a drag and the thumb jumps when the slider takes over.
    .activeOffsetX([-4, 4])
    .failOffsetY([-14, 14])
    .onBegin((e) => setFromX(e.x))
    .onUpdate((e) => setFromX(e.x));

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .runOnJS(true)
    .onEnd((e) => setFromX(e.x));

  const gesture = Gesture.Race(pan, tap);

  // Derived from the value prop, so the thumb always agrees with the number shown — including
  // when the value changes via the ± buttons or is reset from outside.
  const fillRatio = (Math.min(max, Math.max(min, value)) - min) / range;

  return (
    <View style={{ gap: 8, opacity: disabled ? 0.5 : 1 }}>
      {(label || unit !== undefined) && (
        <View className="flex-row items-center justify-between">
          {label ? <Text className="text-[12.5px] font-bold text-fg">{label}</Text> : <View />}
          <View className="flex-row items-baseline" style={{ gap: 1 }}>
            <Text className="text-[17px] font-black" style={{ color: accent }}>
              {value}
            </Text>
            {unit ? (
              <Text className="text-[11.5px] font-bold" style={{ color: accent }}>
                {unit}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      <View className="flex-row items-center" style={{ gap: 10 }}>
        <StepButton
          icon={Minus}
          onPress={() => commit(value - step)}
          disabled={disabled || value <= min}
          accessibilityLabel={`Decrease ${label ?? "value"}`}
        />

        <GestureDetector gesture={gesture}>
          <View
            className="flex-1 justify-center"
            // A 44pt tall hit area around an 8pt track — the visual track is thin, but the
            // touch target has to clear the platform minimum or it's fiddly to grab.
            style={{ height: 44 }}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min, max, now: value }}
          >
            <View
              className="rounded-full w-full overflow-hidden"
              style={{ height: TRACK_HEIGHT, backgroundColor: "rgba(0,64,96,0.1)" }}
            >
              <View
                className="h-full rounded-full"
                style={{ width: `${fillRatio * 100}%`, backgroundColor: accent }}
              />
            </View>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                borderRadius: THUMB_SIZE / 2,
                backgroundColor: "#fff",
                borderWidth: 3,
                borderColor: accent,
                shadowColor: COLORS.nav,
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 3,
                // Offset by half the thumb so it centres on the value rather than sitting to
                // its right, and clamped so it can't overhang either end of the track.
                left: Math.max(
                  0,
                  Math.min(trackWidth - THUMB_SIZE, fillRatio * trackWidth - THUMB_SIZE / 2),
                ),
              }}
            />
          </View>
        </GestureDetector>

        <StepButton
          icon={Plus}
          onPress={() => commit(value + step)}
          disabled={disabled || value >= max}
          accessibilityLabel={`Increase ${label ?? "value"}`}
        />
      </View>

      {(minLabel || maxLabel) && (
        <View className="flex-row justify-between px-11">
          <Text className="text-muted text-[10.5px] font-semibold">{minLabel}</Text>
          <Text className="text-muted text-[10.5px] font-semibold">{maxLabel}</Text>
        </View>
      )}
    </View>
  );
}

function StepButton({
  icon: Icon,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  icon: typeof Minus;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="w-8 h-8 rounded-[10px] border border-border bg-white items-center justify-center active:opacity-70"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Icon size={15} color={COLORS.accent} strokeWidth={3} />
    </Pressable>
  );
}

/**
 * The 0–10 pain VAS, with the colour ramp clinicians expect (green → amber → red) and the
 * standard anchor wording. Kept here rather than at each call site so every pain score in the
 * app looks and reads identically.
 */
export function painSeverityColor(n: number): string {
  if (n <= 3) return COLORS.success;
  if (n <= 6) return COLORS.warning;
  return COLORS.danger;
}

export function PainSlider({
  value,
  onChange,
  label = "Pain score",
}: {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}) {
  return (
    <Slider
      value={value}
      onChange={onChange}
      min={0}
      max={10}
      step={1}
      label={label}
      unit="/10"
      minLabel="No pain"
      maxLabel="Worst imaginable"
      colorForValue={painSeverityColor}
    />
  );
}
