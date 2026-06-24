import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";
import { Avatar } from "@/components/ui/Avatar";
import { COLORS } from "@/constants/config";
import type { Therapist } from "@/types";

interface TopBarProps {
  therapist?: Therapist | null;
  title?: string;
  subtitle?: string;
  showNotification?: boolean;
}

export function TopBar({ therapist, title = "Physiobuddies", subtitle = "Therapist Partner", showNotification = true }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      className="bg-white/92 border-b border-border px-3.5 flex-row items-center justify-between"
      style={{ zIndex: 10, paddingTop: insets.top, minHeight: 56 + insets.top }}
    >
      <Pressable className="flex-row items-center gap-2.5" onPress={() => router.push("/(app)")}>
        <View className="w-6 h-6 rounded-[10px] items-center justify-center" style={{ backgroundColor: COLORS.accent }}>
          <Text className="text-white font-black text-base">P</Text>
        </View>
        <View>
          <Text className="text-[13px] font-extrabold text-accent">{title}</Text>
          <Text className="text-[10px] text-muted">{subtitle}</Text>
        </View>
      </Pressable>
      <View className="flex-row items-center gap-2">
        {showNotification && (
          <Pressable
            className="w-10 h-10 rounded-md border border-border bg-white items-center justify-center"
            onPress={() => router.push("/(app)/notifications")}
            hitSlop={8}
          >
            <Bell size={18} color={COLORS.accent} />
            <View className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger border-[1.5px] border-white" />
          </Pressable>
        )}
        <Pressable onPress={() => router.push("/(app)/profile")}>
          <Avatar name={therapist?.name} url={therapist?.avatarUrl} size={36} radius={18} />
        </Pressable>
      </View>
    </View>
  );
}
