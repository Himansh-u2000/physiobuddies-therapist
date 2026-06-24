import { TextInput, Text, View, type TextInputProps } from "react-native";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  invalid?: boolean;
}

export function Input({ label, error, invalid, className, ...props }: InputProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-[12px] font-bold text-fg">{label}</Text>}
      <TextInput
        className={`h-[46px] w-full rounded-[13px] border-[1.5px] bg-white px-3.5 text-[14px] text-fg ${
          invalid ? "border-danger" : "border-border"
        } ${className ?? ""}`}
        placeholderTextColor="#5e6b77"
        {...props}
      />
      {invalid && error && <Text className="text-[11px] text-danger">{error}</Text>}
    </View>
  );
}

interface TextAreaProps extends TextInputProps {
  label?: string;
}

export function TextArea({ label, className, ...props }: TextAreaProps) {
  return (
    <View className="gap-1.5">
      {label && <Text className="text-[12px] font-bold text-fg">{label}</Text>}
      <TextInput
        multiline
        className={`min-h-[88px] w-full rounded-[13px] border-[1.5px] border-border bg-white px-3.5 py-2.5 text-[14px] text-fg ${className ?? ""}`}
        placeholderTextColor="#5e6b77"
        textAlignVertical="top"
        {...props}
      />
    </View>
  );
}

interface PhoneInputProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  invalid?: boolean;
  error?: string;
}

export function PhoneInput({ label, value, onChangeText, invalid, error, ...props }: PhoneInputProps) {
  const formatPhone = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 5) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
    return digits;
  };

  return (
    <View className="gap-1.5">
      {label && <Text className="text-[12px] font-bold text-fg">{label}</Text>}
      <View
        className={`flex-row h-[46px] rounded-[13px] border-[1.5px] bg-white overflow-hidden ${
          invalid ? "border-danger" : "border-border"
        }`}
      >
        <View className="flex-row items-center gap-1.5 px-3 border-r border-border bg-bg/50">
          <Text className="text-[13px] font-bold text-fg">🇮🇳 +91</Text>
        </View>
        <TextInput
          className="flex-1 px-3.5 text-[14px] text-fg"
          value={value}
          onChangeText={(t) => onChangeText(formatPhone(t))}
          placeholder="98765 43210"
          placeholderTextColor="#5e6b77"
          keyboardType="number-pad"
          autoComplete="tel"
          {...props}
        />
      </View>
      {invalid && error && <Text className="text-[11px] text-danger">{error}</Text>}
    </View>
  );
}
