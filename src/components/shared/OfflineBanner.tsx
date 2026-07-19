import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";
import { useAppStore } from "@/lib/stores/app.store";

/**
 * Global, persistent connectivity banner (prototype's offline `.status-card`, adapted to an
 * ambient top bar since it must sit above every screen, not just one). Renders above the
 * safe area itself — `TopBar` skips its own top inset while this is visible so the two
 * don't double-pad the status bar gap.
 */
export function OfflineBanner() {
  const isOnline = useAppStore((s) => s.isOnline);
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View className="bg-danger" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-center px-3 py-2" style={{ gap: 6 }}>
        <WifiOff size={13} color="#fff" />
        <Text className="text-white text-[11px] font-bold">You&apos;re offline — showing saved data</Text>
      </View>
    </View>
  );
}
