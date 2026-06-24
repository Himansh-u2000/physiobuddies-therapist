import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { CalendarDays, Users, IndianRupee, User, FileText, Upload } from "lucide-react-native";
import { COLORS } from "@/constants/config";

const actions = [
  { label: "Availability", sub: "Set slots", icon: CalendarDays, color: "#2563eb", bg: "#e8f4fd", route: "/(app)/appointments" },
  { label: "Patients", sub: "Records", icon: Users, color: "#16a34a", bg: "#edfaf1", route: "/(app)/patients" },
  { label: "Earnings", sub: "Payouts", icon: IndianRupee, color: "#d97706", bg: "#fef9ec", route: "/(app)/earnings" },
  { label: "Profile", sub: "Public page", icon: User, color: "#7c3aed", bg: "#f3eeff", route: "/(app)/profile" },
  { label: "Articles", sub: "Content", icon: FileText, color: "#e11d48", bg: "#fff0f5", route: "/(app)/articles" },
  { label: "Documents", sub: "Verify", icon: Upload, color: "#ea580c", bg: "#fff4e5", route: "/(app)/documents" },
] as const;

export function QuickActions() {
  const router = useRouter();

  return (
    <View className="flex-row flex-wrap" style={{ gap: 9 }}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Pressable
            key={action.label}
            onPress={() => router.push(action.route as never)}
            className="w-[31.5%] min-h-[92px] border border-border rounded-[14px] bg-white items-center justify-center active:opacity-80"
            style={{ gap: 7, paddingVertical: 12, shadowColor: COLORS.nav, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
          >
            <View className="w-10 h-10 rounded-[12px] items-center justify-center" style={{ backgroundColor: action.bg }}>
              <Icon size={20} color={action.color} />
            </View>
            <View className="items-center" style={{ gap: 2 }}>
              <Text className="text-[11px] font-bold text-fg text-center">{action.label}</Text>
              <Text className="text-muted text-[9px] font-semibold text-center">{action.sub}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
