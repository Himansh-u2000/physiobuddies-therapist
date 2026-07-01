import { View, Text, ScrollView, Pressable } from "react-native";
import { FileCheck2, FileText, Upload, AlertTriangle, CheckCircle2, Clock3 } from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Button, Chip } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

const requiredDocuments = [
  { title: "Registration certificate", subtitle: "State council registration", status: "verified" },
  { title: "Government ID", subtitle: "Aadhaar, PAN, or passport", status: "verified" },
  { title: "Clinic address proof", subtitle: "Utility bill or rent agreement", status: "review" },
  { title: "Degree certificate", subtitle: "BPT/MPT qualification proof", status: "missing" },
] as const;

const uploads = [
  { name: "registration-certificate.pdf", date: "Uploaded 18 Jun", status: "Verified" },
  { name: "aadhaar-front.jpg", date: "Uploaded 18 Jun", status: "Verified" },
  { name: "clinic-lease.pdf", date: "Uploaded 24 Jun", status: "In review" },
] as const;

export default function DocumentsScreen() {
  const therapist = useAuthStore((s) => s.therapist);
  const showToast = useAppStore((s) => s.showToast);

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Documents" subtitle="Verification & uploads" showNotification={false} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pb-8">
        <View className="bg-white border border-border rounded-md p-4" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[18px] font-extrabold text-fg">Verification status</Text>
              <Text className="text-muted text-[12px] mt-1">3 of 4 documents submitted</Text>
            </View>
            <View className="w-12 h-12 rounded-[14px] items-center justify-center bg-success/10">
              <FileCheck2 size={24} color={COLORS.success} />
            </View>
          </View>
          <View className="h-2 rounded-full bg-border mt-4 overflow-hidden">
            <View className="h-full rounded-full bg-success" style={{ width: "75%" }} />
          </View>
        </View>

        <View className="mt-3" style={{ gap: 10 }}>
          {requiredDocuments.map((doc) => (
            <DocumentRequirement key={doc.title} {...doc} onPress={() => showToast(`${doc.title} upload flow will open`)} />
          ))}
        </View>

        <View className="bg-white border border-border rounded-md p-3.5 mt-3" style={{ gap: 10 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-fg">Recent uploads</Text>
            <Chip variant="neutral">{uploads.length} files</Chip>
          </View>
          {uploads.map((file) => (
            <View key={file.name} className="flex-row items-center py-2.5 border-b border-border last:border-b-0" style={{ gap: 10 }}>
              <View className="w-10 h-10 rounded-[12px] bg-primary-soft items-center justify-center">
                <FileText size={18} color={COLORS.accent} />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-bold text-fg">{file.name}</Text>
                <Text className="text-muted text-[11px] mt-0.5">{file.date}</Text>
              </View>
              <Chip variant={file.status === "Verified" ? "active" : "pending"}>{file.status}</Chip>
            </View>
          ))}
        </View>

        <Button variant="secondary" onPress={() => showToast("Document picker will open")}>
          <Upload size={16} color={COLORS.accent} />
          <Text className="text-accent font-bold text-[14px]">Upload another document</Text>
        </Button>
      </ScrollView>
    </View>
  );
}

function DocumentRequirement({
  title,
  subtitle,
  status,
  onPress,
}: {
  title: string;
  subtitle: string;
  status: "verified" | "review" | "missing";
  onPress: () => void;
}) {
  const Icon = status === "verified" ? CheckCircle2 : status === "review" ? Clock3 : AlertTriangle;
  const color = status === "verified" ? COLORS.success : status === "review" ? COLORS.warning : COLORS.danger;
  const chip = status === "verified" ? "Verified" : status === "review" ? "In review" : "Required";

  return (
    <Pressable onPress={onPress} className="bg-white border border-border rounded-md p-3.5 flex-row items-center active:opacity-80" style={{ gap: 12 }}>
      <View className="w-10 h-10 rounded-[12px] items-center justify-center" style={{ backgroundColor: `${color}18` }}>
        <Icon size={19} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-[13px] font-bold text-fg">{title}</Text>
        <Text className="text-muted text-[11px] mt-0.5">{subtitle}</Text>
      </View>
      <Chip variant={status === "verified" ? "active" : status === "review" ? "pending" : "cancelled"}>{chip}</Chip>
    </Pressable>
  );
}
