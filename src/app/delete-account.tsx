import { useState } from "react";
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { AlertTriangle, ChevronLeft, Check } from "lucide-react-native";
import { Button, TextArea } from "@/components/ui";
import { useAppStore } from "@/lib/stores/app.store";
import { useAuthStore } from "@/lib/stores/auth.store";
import { authApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";

/**
 * In-app account deletion (mandated by both app stores; DPDP Act deletion path).
 * STUB: the backend has no DELETE /account endpoint yet, so the call 404s until it lands
 * (see authApi.deleteAccount). Real deletion should soft-delete + revoke tokens.
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const logout = useAuthStore((s) => s.logout);
  const therapist = useAuthStore((s) => s.therapist);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirmed || loading) return;
    setLoading(true);
    try {
      await authApi.deleteAccount(reason.trim() || undefined);
      showToast("Your account has been deleted", "success");
      await logout();
      router.replace("/(auth)/login");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't delete account. Try again.", "error");
      setLoading(false);
    }
  };

  const consequences = [
    "Your therapist profile and login are permanently removed",
    "Session history and treatment records are anonymized",
    "Pending payouts must be settled before deletion completes",
    "This cannot be undone — you'll need to register again",
  ];

  return (
    <View className="flex-1 bg-bg">
      <View className="pt-14 px-4 pb-3 flex-row items-center gap-2 bg-white border-b border-border">
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg">Delete account</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pt-4 pb-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-4">
            <View className="w-16 h-16 rounded-full bg-danger/10 items-center justify-center">
              <AlertTriangle size={30} color={COLORS.danger} />
            </View>
          </View>

          <Text className="text-[18px] font-extrabold text-fg text-center">
            Delete {therapist?.name?.split(" ")[0] ?? "your"} account?
          </Text>
          <Text className="text-muted text-[13px] text-center mt-1.5 leading-5">
            This permanently removes your Physiobuddies therapist account.
          </Text>

          <View className="bg-white border border-border rounded-md p-3.5 mt-4" style={{ gap: 10 }}>
            {consequences.map((c) => (
              <View key={c} className="flex-row items-start gap-2.5">
                <View className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5" />
                <Text className="text-fg text-[13px] flex-1 leading-5">{c}</Text>
              </View>
            ))}
          </View>

          <View className="mt-4">
            <TextArea
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Help us improve — why are you leaving?"
            />
          </View>

          <Pressable
            onPress={() => setConfirmed((v) => !v)}
            className="flex-row items-center gap-2.5 mt-4"
            hitSlop={6}
          >
            <View
              className={`w-6 h-6 rounded-[7px] border-[1.5px] items-center justify-center ${
                confirmed ? "bg-danger border-danger" : "bg-white border-border"
              }`}
            >
              {confirmed && <Check size={16} color="#fff" />}
            </View>
            <Text className="text-fg text-[13px] flex-1">
              I understand this is permanent and cannot be undone.
            </Text>
          </Pressable>

          <View className="mt-6" style={{ gap: 10 }}>
            <Button variant="danger" onPress={handleDelete} disabled={!confirmed || loading}>
              <Text className="text-danger font-bold text-[14px]">
                {loading ? "Deleting..." : "Delete my account"}
              </Text>
            </Button>
            <Button variant="secondary" onPress={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
