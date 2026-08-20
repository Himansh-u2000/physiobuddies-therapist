import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, Info } from "lucide-react-native";
import { Input, PhoneInput, Button, Avatar } from "@/components/ui";
import { therapistApi } from "@/lib/api/services";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import { GlassSurface } from "@/components/ui/Glass";

/** Format 10 raw digits the way `PhoneInput` displays them ("98765 43210"). */
function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 10);
  return d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d;
}

/**
 * Edit the therapist's identity fields — the two the backend accepts on PATCH /user
 * (`{ name, mobile }`). Specialization / experience / clinic live on the therapist profile
 * (set during onboarding), and the avatar needs a gallery picker the app doesn't bundle, so
 * both are surfaced as notes rather than faked here.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const therapist = useAuthStore((s) => s.therapist);
  const setTherapist = useAuthStore((s) => s.setTherapist);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState(therapist?.name ?? "");
  const [phone, setPhone] = useState(formatPhone(therapist?.phone ?? ""));
  const [saving, setSaving] = useState(false);

  const phoneDigits = phone.replace(/\D/g, "");
  const nameError =
    name.trim().length > 0 && name.trim().length < 3 ? "Name must be at least 3 characters" : undefined;
  const phoneError =
    phoneDigits.length > 0 && phoneDigits.length !== 10 ? "Enter a 10-digit number" : undefined;
  const canSave = !saving && name.trim().length >= 3 && !phoneError;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const updated = await therapistApi.updateProfile({
        name: name.trim(),
        phone: phoneDigits,
      });
      await setTherapist(updated);
      showToast("Profile updated", "success");
      router.back();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't update your profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-3 flex-row items-center border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="w-8 h-8 items-center justify-center"
        >
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg">Edit profile</Text>
      </GlassSurface>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 60}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="px-3.5 pt-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 40, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-center">
            <Avatar name={therapist?.name} url={therapist?.avatarUrl} size={84} radius={20} />
            <Text className="text-muted text-[11px] mt-2">Profile photo is managed in verification</Text>
          </View>

          <Input
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Dr. Your Name"
            invalid={!!nameError}
            error={nameError}
          />
          <PhoneInput
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            invalid={!!phoneError}
            error={phoneError}
          />

          <View className="flex-row bg-info/5 border border-info/20 rounded-md p-3" style={{ gap: 8 }}>
            <Info size={16} color={COLORS.info} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[12px] text-fg/80">
              Specialization, experience and clinic details are set during onboarding and
              verification.
            </Text>
          </View>

          <Button variant="primary" fullWidth onPress={handleSave} disabled={!canSave}>
            {saving ? <ActivityIndicator color="#fff" /> : "Save changes"}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
