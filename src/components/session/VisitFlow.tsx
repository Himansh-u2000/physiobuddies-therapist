import type { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Check, ChevronLeft, MapPinned, KeyRound, Stethoscope, ClipboardCheck } from "lucide-react-native";
import { COLORS } from "@/constants/config";

/**
 * The home-visit flow, as the therapist moves through it:
 *
 *   Navigate → Verify OTP → Treatment → Record
 *
 * One definition shared by every screen in `app/session/`, so the progress rail reads the same
 * on each of them and a step can never be called one thing here and another thing there. Each
 * screen passes the index of the step it *is*; everything before it renders as done. That is the
 * point of the rail — the old route screen printed a static "Step 1 of 3" badge with step 1
 * permanently highlighted, which never moved no matter what the therapist did.
 */
export const VISIT_STEPS = [
  { key: "navigate", label: "Navigate", icon: MapPinned },
  { key: "otp", label: "Verify OTP", icon: KeyRound },
  { key: "treatment", label: "Treatment", icon: Stethoscope },
  { key: "record", label: "Record", icon: ClipboardCheck },
] as const;

/** Index into `VISIT_STEPS`; `VISIT_STEPS.length` means every step is done. */
export type VisitStepIndex = 0 | 1 | 2 | 3 | 4;

/**
 * Horizontal progress rail. Drawn for the dark gradient header — every session screen uses that
 * header, so there is one colour scheme to keep right rather than two.
 */
export function VisitStepper({ current }: { current: VisitStepIndex }) {
  return (
    <View className="flex-row items-start" accessibilityRole="progressbar" accessibilityLabel={visitStepLabel(current)}>
      {VISIT_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = step.icon;
        return (
          <View key={step.key} className="flex-1 items-center">
            <View className="flex-row items-center w-full">
              {/* Connector halves either side of the dot, so the line runs dot-centre to
                  dot-centre regardless of how long each label is. */}
              <View
                className="flex-1 h-[2px]"
                style={{ backgroundColor: i === 0 ? "transparent" : i <= current ? COLORS.successLight : "rgba(255,255,255,0.18)" }}
              />
              <View
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{
                  backgroundColor: done ? COLORS.successLight : active ? "#fff" : "rgba(255,255,255,0.14)",
                  borderWidth: active ? 3 : 0,
                  borderColor: "rgba(255,255,255,0.35)",
                }}
              >
                {done ? <Check size={15} color="#fff" strokeWidth={3} /> : <Icon size={14} color={active ? COLORS.accent : "rgba(255,255,255,0.75)"} />}
              </View>
              <View
                className="flex-1 h-[2px]"
                style={{
                  backgroundColor:
                    i === VISIT_STEPS.length - 1 ? "transparent" : i < current ? COLORS.successLight : "rgba(255,255,255,0.18)",
                }}
              />
            </View>
            <Text
              className={`text-[10.5px] mt-1.5 ${active ? "text-white font-extrabold" : done ? "text-white/85 font-semibold" : "text-white/55 font-semibold"}`}
              numberOfLines={1}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export function visitStepLabel(current: VisitStepIndex): string {
  const step = VISIT_STEPS[current as number];
  if (!step) return "Visit complete";
  return `Step ${current + 1} of ${VISIT_STEPS.length} · ${step.label}`;
}

interface VisitHeaderProps {
  title: string;
  step: VisitStepIndex;
  /** Omit to hide the back button (the completion screen has nowhere sensible to go back to). */
  onBack?: () => void;
  /** Top-right slot — a status pill, a save button. */
  right?: ReactNode;
  /** Rendered under the rail, still on the gradient — the treatment form's phase rail lives here. */
  children?: ReactNode;
}

/**
 * The gradient header every visit screen opens with: back, title, step caption, progress rail.
 */
export function VisitHeader({ title, step, onBack, right, children }: VisitHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={["#003554", "#00506f"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="overflow-hidden"
      style={{ paddingTop: insets.top + 6 }}
    >
      {/* Soft decorative discs — depth without an image asset. */}
      <View className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/5" />
      <View className="absolute -left-16 bottom-0 w-32 h-32 rounded-full bg-white/[0.03]" />

      <View className="px-3.5 pt-1.5 flex-row items-center" style={{ gap: 10 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="w-10 h-10 rounded-[12px] bg-white/15 border border-white/20 items-center justify-center active:opacity-70"
          >
            <ChevronLeft size={20} color="#fff" />
          </Pressable>
        ) : (
          <View className="w-10" />
        )}
        <View className="flex-1">
          <Text className="text-white/65 text-[11px] font-bold uppercase" style={{ letterSpacing: 0.6 }}>
            {visitStepLabel(step)}
          </Text>
          <Text className="text-white text-[18px] font-extrabold" numberOfLines={1}>
            {title}
          </Text>
        </View>
        {right ?? <View className="w-10" />}
      </View>

      <View className="px-2 pt-4 pb-4">
        <VisitStepper current={step} />
      </View>
      {children}
    </LinearGradient>
  );
}

/**
 * Sticky bottom action bar. The next step always lives here, at thumb height, instead of being
 * one card among several in a scroll view — "what do I do now" should never need scrolling.
 */
export function VisitFooter({ children, hint }: { children: ReactNode; hint?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="px-3.5 pt-3 bg-white border-t border-border"
      style={{
        paddingBottom: insets.bottom + 12,
        gap: 8,
        shadowColor: COLORS.nav,
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
      }}
    >
      {hint ? <Text className="text-muted text-[11.5px] text-center">{hint}</Text> : null}
      <View className="flex-row" style={{ gap: 10 }}>
        {children}
      </View>
    </View>
  );
}

/** A white card on the page background, the unit every visit screen is built from. */
export function VisitCard({ children, className = "", padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <View
      className={`bg-white border border-border rounded-lg ${padded ? "p-4" : ""} ${className}`}
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}
    >
      {children}
    </View>
  );
}

/** Uppercase eyebrow label above a group of cards. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="text-[11.5px] font-extrabold text-muted uppercase px-1 mt-4 mb-2" style={{ letterSpacing: 0.8 }}>
      {children}
    </Text>
  );
}

/**
 * One row of a "before you go on" list whose tick reflects something the therapist actually did
 * (opened directions, called the patient) rather than a fixed highlight.
 */
export function ChecklistRow({
  done,
  title,
  sub,
  onPress,
  last,
}: {
  done: boolean;
  title: string;
  sub: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "checkbox" : undefined}
      accessibilityState={onPress ? { checked: done } : undefined}
      className={`flex-row items-center py-3 active:opacity-70 ${last ? "" : "border-b border-border"}`}
      style={{ gap: 12 }}
    >
      <View
        className="w-6 h-6 rounded-full items-center justify-center"
        style={{
          backgroundColor: done ? COLORS.success : "transparent",
          borderWidth: done ? 0 : 2,
          borderColor: COLORS.border,
        }}
      >
        {done && <Check size={13} color="#fff" strokeWidth={3} />}
      </View>
      <View className="flex-1">
        <Text className={`text-[13.5px] font-bold ${done ? "text-muted" : "text-fg"}`}>{title}</Text>
        <Text className="text-muted text-[11.5px] mt-0.5">{sub}</Text>
      </View>
    </Pressable>
  );
}
