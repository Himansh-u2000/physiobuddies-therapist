import { View, Text } from "react-native";
import { TopBar } from "@/components/shared/TopBar";
import { useAuthStore } from "@/lib/stores/auth.store";

export default function DocumentsScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Documents" subtitle="Verification & uploads" showNotification={false} />
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-muted text-[14px] text-center">Document verification module coming soon.</Text>
      </View>
    </View>
  );
}
