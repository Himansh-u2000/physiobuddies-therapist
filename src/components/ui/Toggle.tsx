import { Pressable, View } from "react-native";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function Toggle({ value, onValueChange }: ToggleProps) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      className={`h-[30px] w-[56px] rounded-full border-[1.5px] p-[2px] flex-row items-center ${
        value ? "bg-success/60 border-success/40 justify-end" : "bg-muted/15 border-border justify-start"
      }`}
    >
      <View className="h-[24px] w-[24px] rounded-full bg-white shadow-sm" />
    </Pressable>
  );
}
