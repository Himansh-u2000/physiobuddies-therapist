import { View, Text } from "react-native";
import { TopBar } from "@/components/shared/TopBar";
import { useAuthStore } from "@/lib/stores/auth.store";

export default function ArticlesScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Articles" subtitle="Health content" showNotification={false} />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-muted text-[14px] text-center">Articles module coming soon.</Text>
      </View>
    </View>
  );
}
