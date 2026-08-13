import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Plus, Check } from "lucide-react-native";
import { Chip } from "@/components/ui";
import { COLORS } from "@/constants/config";
import type { Option } from "@/constants/clinical";

/**
 * The building blocks of the treatment form.
 *
 * Extracted so every clinical field looks and behaves the same. The form previously built each
 * input inline, which is how it ended up with three different visual treatments for
 * "pick one of N" on the same screen.
 */

/** Section wrapper — a titled white card with optional helper text. */
export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row items-center" style={{ gap: 5 }}>
        <Text className="text-[12.5px] font-bold text-fg">{label}</Text>
        {required && <Text className="text-danger text-[12px] font-bold">*</Text>}
      </View>
      {hint ? <Text className="text-muted text-[11.5px] -mt-1">{hint}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Pick exactly one, from a small fixed set. Wraps rather than scrolling horizontally: a
 * hidden-off-screen option in a *clinical* choice is a correctness problem, not just a
 * discoverability one.
 */
export function SegmentedField<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 7 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className="rounded-[11px] border px-3 py-2 active:opacity-80"
            style={{
              backgroundColor: active ? COLORS.accent : "#fff",
              borderColor: active ? COLORS.accent : COLORS.border,
            }}
          >
            <Text
              className="text-[12.5px] font-bold"
              style={{ color: active ? "#fff" : COLORS.fg }}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text
                className="text-[10px] font-semibold mt-0.5"
                style={{ color: active ? "rgba(255,255,255,0.75)" : COLORS.muted }}
              >
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Pick any number, plus add your own.
 *
 * These map to `String[]` columns with no server-side enum, so the suggestions are a shortcut,
 * not a constraint — a therapist who needs to record something the list doesn't cover must be
 * able to, otherwise they'd bury it in the notes field where nothing can read it.
 */
export function MultiSelectField({
  options,
  values,
  onChange,
  addPlaceholder = "Add your own…",
}: {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  addPlaceholder?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const toggle = (option: string) => {
    onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option]);
  };

  const commitCustom = () => {
    const trimmed = draft.trim();
    // Case-insensitive dedupe so "night pain" doesn't sit next to "Night pain" as two entries.
    if (trimmed && !values.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...values, trimmed]);
    }
    setDraft("");
    setAdding(false);
  };

  // Anything the therapist typed that isn't in the suggestion list still needs a chip.
  const extras = values.filter((v) => !options.includes(v));

  return (
    <View style={{ gap: 8 }}>
      <View className="flex-row flex-wrap" style={{ gap: 7 }}>
        {[...options, ...extras].map((option) => (
          <Chip
            key={option}
            selectable
            selected={values.includes(option)}
            onPress={() => toggle(option)}
          >
            {option}
          </Chip>
        ))}
        {!adding && (
          <Pressable
            onPress={() => setAdding(true)}
            className="flex-row items-center justify-center min-h-[30px] px-3 rounded-full border border-dashed active:opacity-70"
            style={{ gap: 4, borderColor: "rgba(0,64,96,0.3)" }}
          >
            <Plus size={12} color={COLORS.accent} />
            <Text className="text-accent text-[11.5px] font-bold">Add</Text>
          </Pressable>
        )}
      </View>

      {adding && (
        <View className="flex-row items-center" style={{ gap: 8 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={addPlaceholder}
            placeholderTextColor={COLORS.muted}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={commitCustom}
            onBlur={commitCustom}
            className="flex-1 h-[38px] rounded-[11px] border border-border bg-white px-3 text-[13px] text-fg"
          />
          <Pressable
            onPress={commitCustom}
            className="w-[38px] h-[38px] rounded-[11px] items-center justify-center active:opacity-80"
            style={{ backgroundColor: COLORS.accent }}
          >
            <Check size={16} color="#fff" strokeWidth={3} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/** Yes/No, as a two-up segmented control. */
export function BooleanField({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <View
      className="flex-row rounded-[13px] border border-border p-[3px]"
      style={{ backgroundColor: "rgba(0,64,96,0.02)" }}
    >
      {[true, false].map((option) => {
        const active = value === option;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className={`flex-1 h-[36px] rounded-[10px] items-center justify-center ${active ? "bg-white" : ""}`}
            style={
              active
                ? { shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }
                : undefined
            }
          >
            <Text className={`text-[13px] font-bold ${active ? "text-accent" : "text-muted"}`}>
              {option ? yesLabel : noLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A plain single-line text field, styled to match the rest of the form. */
export function TextField({
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.muted}
      keyboardType={keyboardType}
      className="h-[42px] rounded-[11px] border border-border bg-white px-3 text-[13.5px] text-fg"
    />
  );
}
