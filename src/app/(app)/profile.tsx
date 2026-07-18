import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Star, Shield, FileText, Bell, Lock, HelpCircle, LogOut, ChevronRight, Fingerprint, Trash2 } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Avatar } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

export default function ProfileScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useAppStore((s) => s.showToast);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/splash");
  };

  const settings = [
    { icon: FileText, label: "Documents & verification", sub: "Manage your credentials", color: COLORS.accent },
    { icon: Bell, label: "Notifications", sub: "Push notification preferences", color: COLORS.info },
    { icon: Fingerprint, label: "Biometric login", sub: biometricEnabled ? "Enabled" : "Disabled", color: COLORS.success },
    { icon: Lock, label: "Security", sub: "Password, 2FA, sessions", color: COLORS.warning },
    { icon: HelpCircle, label: "Help & support", sub: "FAQs, contact us", color: COLORS.danger },
  ];

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Profile" subtitle="Account & settings" showNotification={false} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pt-3 pb-24">
        <View className="bg-white border border-border rounded-md p-4 items-center" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
          <Avatar name={therapist?.name} url={therapist?.avatarUrl} size={80} radius={18} />
          <Text className="text-[18px] font-extrabold text-fg mt-3">{therapist?.name}</Text>
          <Text className="text-muted text-[12px]">{therapist?.specialization}</Text>
          <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Star size={14} color={COLORS.warning} fill={COLORS.warning} />
              <Text className="text-fg text-[13px] font-bold">{therapist?.rating}</Text>
            </View>
            {therapist?.isVerified && (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Shield size={14} color={COLORS.success} />
                <Text className="text-success text-[12px] font-bold">Verified</Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-3" style={{ gap: 10 }}>
          {settings.map((s) => {
            const Icon = s.icon;
            return (
              <Pressable
                key={s.label}
                className="bg-white border border-border rounded-md p-3.5 flex-row items-center active:opacity-80"
                style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
              >
                <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: COLORS.primarySoft }}>
                  <Icon size={18} color={s.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-[14px] font-bold text-fg">{s.label}</Text>
                  <Text className="text-muted text-[12px]">{s.sub}</Text>
                </View>
                <ChevronRight size={18} color={COLORS.muted} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleLogout}
          className="mt-3 bg-white border border-danger/30 rounded-md p-3.5 flex-row items-center justify-center active:opacity-80"
          style={{ gap: 8 }}
        >
          <LogOut size={18} color={COLORS.danger} />
          <Text className="text-danger font-bold text-[14px]">Log out</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/delete-account")}
          className="mt-2.5 p-2 flex-row items-center justify-center active:opacity-70"
          style={{ gap: 6 }}
        >
          <Trash2 size={15} color={COLORS.muted} />
          <Text className="text-muted font-bold text-[12px]">Delete account</Text>
        </Pressable>

        <Text className="text-muted/60 text-[11px] text-center mt-4">Physiobuddies Therapist v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
