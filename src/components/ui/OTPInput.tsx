import { TextInput, View, type TextInputProps } from "react-native";
import { useOtp } from "@/lib/hooks/useOtp";

interface OTPInputProps {
  length: number;
  onComplete?: (code: string) => void;
  textContentType?: TextInputProps["textContentType"];
}

export function OTPInput({ length, onComplete, textContentType }: OTPInputProps) {
  const { values, refs, setValue, handleBackspace, handlePaste, isComplete } = useOtp({
    length,
    onComplete,
  });

  return (
    <View className="flex-row" style={{ gap: 8 }}>
      {values.map((val, i) => (
        <TextInput
          key={i}
          ref={(ref) => {
            refs.current[i] = ref;
          }}
          value={val}
          onChangeText={(text) => {
            if (text.length > 1) handlePaste(text);
            else setValue(i, text);
          }}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === "Backspace") handleBackspace(i);
          }}
          className={`flex-1 h-[52px] text-center rounded-[13px] border-[1.5px] bg-white text-[20px] font-extrabold text-fg ${
            val ? "border-success bg-success/5" : "border-border"
          }`}
          keyboardType="number-pad"
          maxLength={1}
          autoComplete="one-time-code"
          textContentType={textContentType}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}
