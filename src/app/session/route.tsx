import { View, Text, Pressable, ScrollView, Linking } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Phone, MessageSquare, Lock, ChevronLeft } from "lucide-react-native";
import { Avatar, Chip, Button } from "@/components/ui";
import { appointmentApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { useLocation } from "@/lib/hooks/useLocation";
import { COLORS } from "@/constants/config";

export default function RouteScreen() {
  const router = useRouter();
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const { getCurrentLocation, openInMaps } = useLocation();
  const { data: appointment } = useQuery({
    queryKey: ["appointment", appointmentId],
    queryFn: () => appointmentApi.getById(appointmentId),
    enabled: !!appointmentId,
  });

  const handleOpenMaps = async () => {
    if (!appointment?.latitude || !appointment.longitude) {
      showToast("Patient coordinates unavailable");
      return;
    }
    try {
      await getCurrentLocation();
      await openInMaps(appointment.latitude, appointment.longitude, appointment.patientName);
    } catch {
      showToast("Unable to open maps");
    }
  };

  const handleCallPatient = async () => {
    if (!appointment?.patientPhone) {
      showToast("Patient phone unavailable");
      return;
    }
    await Linking.openURL(`tel:${appointment.patientPhone}`);
  };

  const checklist = [
    { num: 1, title: "Navigate to patient location", sub: "Use the map link above to get turn-by-turn directions. Allow location access if prompted.", current: true },
    { num: 2, title: "Call patient if delayed", sub: "Confirm building entry and update the patient if you're running late." },
    { num: 3, title: "Enter patient OTP to start session", sub: "Only enter the OTP after meeting the patient in person." },
  ];

  return (
    <View className="flex-1 bg-bg">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
        <View className="h-[240px] relative overflow-hidden" style={{ backgroundColor: "#e8f0f8" }}>
          <View className="absolute inset-0" style={{ backgroundColor: "rgba(0,64,96,0.04)" }} />
          <View className="absolute inset-0" style={{ backgroundColor: "rgba(233,246,254,0.5)" }} />
          <Pressable onPress={() => router.back()} className="absolute top-3 left-3.5 w-10 h-10 rounded-md bg-white/90 items-center justify-center z-10">
            <ChevronLeft size={18} color={COLORS.accent} />
          </Pressable>
          <View className="absolute" style={{ bottom: 55, left: "38%" }}>
            <View className="w-3.5 h-3.5 rounded-full border-[2.5px] border-white" style={{ backgroundColor: COLORS.accent }} />
            <View className="bg-white rounded-lg px-2 py-1 mt-1">
              <Text className="text-[10px] font-bold">📍 You</Text>
            </View>
          </View>
          <View className="absolute" style={{ top: 45, right: "28%" }}>
            <View className="w-3.5 h-3.5 rounded-full border-[2.5px] border-white" style={{ backgroundColor: COLORS.danger }} />
            <View className="bg-white rounded-lg px-2 py-1 mt-1">
              <Text className="text-[10px] font-bold">🏠 {appointment?.patientName ?? "Patient"}&apos;s home</Text>
            </View>
          </View>
        </View>

        {appointment && (
          <>
            <View className="mx-4 -mt-8 bg-surface-strong rounded-lg border-[1.5px] border-border p-4 relative z-10" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.12, shadowRadius: 28, elevation: 6 }}>
              <View className="flex-row items-start" style={{ gap: 12 }}>
                <View className="w-11 h-11 rounded-[14px] items-center justify-center" style={{ backgroundColor: "rgba(207,66,56,0.08)" }}>
                  <Text className="text-[20px]">🏠</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-extrabold text-fg">{appointment.address?.split(",")[0] ?? "Location"}</Text>
                  <Text className="text-muted text-[12px] mt-0.5">{appointment.address}</Text>
                </View>
              </View>
              <View className="flex-row mt-3.5 rounded-md overflow-hidden border-[1.5px] border-border" style={{ backgroundColor: COLORS.bg }}>
                <RouteStat value={`${appointment.etaMin ?? 18}`} label="min ETA" />
                <RouteStat value={`${appointment.distanceKm ?? 5.2}`} label="km" />
                <RouteStat value="10:12" label="arrival" />
                <RouteStat value="Home" label="visit type" />
              </View>
            </View>

            <View className="flex-row px-4 mt-3.5" style={{ gap: 10 }}>
              <Button variant="secondary" onPress={handleOpenMaps}>
                <Text className="text-accent font-bold text-[14px]">🗺 Open Maps</Text>
              </Button>
              <Button onPress={() => router.push(`/session/otp?appointmentId=${appointment.id}`)}>
                <Lock size={16} color="#fff" />
                <Text className="text-white font-bold text-[14px]">Enter OTP</Text>
              </Button>
            </View>

            <View className="mx-4 mt-3.5 bg-surface-strong rounded-md border-[1.5px] border-border p-3.5 flex-row items-center" style={{ gap: 12 }}>
              <Avatar name={appointment.patientName} size={44} radius={22} />
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-fg">{appointment.patientName}</Text>
                <Text className="text-muted text-[11px]">{appointment.patientPhone} · Home visit</Text>
              </View>
              <View className="flex-row" style={{ gap: 8 }}>
                <Pressable onPress={handleCallPatient} className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(35,145,73,0.1)" }}>
                  <Phone size={16} color={COLORS.success} />
                </Pressable>
                <Pressable onPress={() => showToast("Opening WhatsApp")} className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.primarySoft }}>
                  <MessageSquare size={16} color={COLORS.accent} />
                </Pressable>
              </View>
            </View>

            <View className="mx-4 mt-3.5 bg-surface-strong rounded-md border-[1.5px] border-border overflow-hidden">
              <View className="px-4 py-3.5 border-b border-border flex-row items-center justify-between">
                <Text className="text-[14px] font-extrabold text-fg">Before you enter OTP</Text>
                <Chip variant="pending">Step 1 of 3</Chip>
              </View>
              {checklist.map((step) => (
                <View key={step.num} className="flex-row px-4 py-3.5 border-b border-border last:border-b-0" style={{ gap: 14 }}>
                  <View className={`w-7 h-7 rounded-full items-center justify-center ${step.current ? "bg-accent" : "bg-muted/10"}`}>
                    <Text className={`text-[12px] font-extrabold ${step.current ? "text-white" : "text-muted"}`}>{step.num}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[13px] font-bold text-fg">{step.title}</Text>
                    <Text className="text-muted text-[12px] mt-0.5">{step.sub}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View className="mx-4 mt-3.5 rounded-md p-3.5" style={{ backgroundColor: "rgba(0,64,96,0.03)", borderWidth: 1, borderColor: "rgba(0,64,96,0.1)" }}>
              <Text className="text-[12px] font-bold text-accent uppercase tracking-wide mb-1.5">Visit instructions</Text>
              <Text className="text-muted text-[12px] leading-6">
                Security gate requires appointment ID <Text className="font-bold text-fg">PB-2406</Text>. {appointment.patientName?.split(" ")[0]} prefers WhatsApp if you are delayed. Please carry resistance band and lumbar support assessment sheet. Lift access available on the left side of the lobby.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function RouteStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center py-2.5 border-r border-border last:border-r-0">
      <Text className="text-[16px] font-black text-fg">{value}</Text>
      <Text className="text-muted text-[10px] uppercase tracking-wide">{label}</Text>
    </View>
  );
}
