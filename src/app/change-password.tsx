import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { Button, Input } from "@/components/ui";
import { therapistApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

/** Change the account password (PATCH /user/password). */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;
  const canSubmit =
    !loading && current.length > 0 && next.length >= 8 && confirm === next;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await therapistApi.changePassword(current, next);
      showToast("Password updated", "success");
      router.back();
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Couldn't update your password. Try again.",
        "error",
      );
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <View
        className="px-4 pb-3 flex-row items-center bg-white border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center"
        >
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg">Change password</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-3.5 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 14 }}
        >
          <View
            className="bg-white border border-border rounded-md p-3.5 flex-row items-center"
            style={{ gap: 12 }}
          >
            <View className="w-9 h-9 rounded-[10px] items-center justify-center bg-success/10">
              <ShieldCheck size={18} color={COLORS.success} />
            </View>
            <Text className="text-muted text-[12px] flex-1">
              Use at least 8 characters. You&apos;ll stay signed in on this device after changing it.
            </Text>
          </View>

          <Input
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            placeholder="Enter your current password"
            textContentType="password"
          />
          <Input
            label="New password"
            value={next}
            onChangeText={setNext}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            placeholder="At least 8 characters"
            textContentType="newPassword"
            invalid={tooShort}
            error={tooShort ? "Must be at least 8 characters" : undefined}
          />
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            placeholder="Re-enter the new password"
            textContentType="newPassword"
            invalid={mismatch}
            error={mismatch ? "Passwords don't match" : undefined}
          />

          <Pressable
            onPress={() => setReveal((r) => !r)}
            className="flex-row items-center self-start active:opacity-70"
            style={{ gap: 6 }}
            hitSlop={8}
          >
            {reveal ? (
              <EyeOff size={16} color={COLORS.muted} />
            ) : (
              <Eye size={16} color={COLORS.muted} />
            )}
            <Text className="text-muted text-[12px] font-bold">
              {reveal ? "Hide passwords" : "Show passwords"}
            </Text>
          </Pressable>

          <Button variant="primary" fullWidth onPress={handleSubmit} disabled={!canSubmit}>
            {loading ? <ActivityIndicator color="#fff" /> : "Update password"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
