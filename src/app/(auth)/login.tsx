import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Phone, Mail } from "lucide-react-native";
import { Button, PhoneInput } from "@/components/ui";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { useAppStore } from "@/lib/stores/app.store";
import { authApi } from "@/lib/api/services";
import { savePhone } from "@/lib/storage/secure";

export default function LoginScreen() {
  const router = useRouter();
  const showToast = useAppStore((s) => s.showToast);
  const [phone, setPhone] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setInvalid(true);
      showToast("Enter a valid 10 digit mobile number");
      return;
    }
    setInvalid(false);
    setLoading(true);
    try {
      await authApi.login(`+91${digits}`);
      await savePhone(`+91 ${phone}`);
      router.push({ pathname: "/(auth)/otp", params: { phone: `+91 ${phone}` } });
    } catch {
      showToast("Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="h-[240px] relative overflow-hidden">
        <LinearGradient
          colors={["#003554", "#004060"]}
          className="absolute inset-0"
        />
        <View className="absolute bottom-5 left-5">
          <View className="w-10 h-10 rounded-[10px] bg-white items-center justify-center mb-2">
            <Text className="text-accent font-black text-lg">P</Text>
          </View>
          <Text className="text-white text-[20px] font-extrabold">Physiobuddies Therapist</Text>
          <Text className="text-white/70 text-[12px] mt-0.5">Therapist Partner App</Text>
        </View>
      </View>

      <View className="flex-1 px-5 pt-6 pb-8" style={{ gap: 16 }}>
        <View>
          <Text className="text-[20px] font-bold text-fg">Enter your mobile number</Text>
          <Text className="text-muted text-[12px] mt-1">
            We&apos;ll send a 6-digit OTP to verify your account
          </Text>
        </View>

        <PhoneInput
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          invalid={invalid}
          error="Enter a valid 10-digit Indian mobile number"
        />

        <Button onPress={handleSendOtp} disabled={loading}>
          <Phone size={18} color="#fff" />
          <Text className="text-white font-bold text-[14px]">{loading ? "Sending..." : "Send OTP"}</Text>
        </Button>

        <View className="h-px bg-border my-1" />

        <View className="items-center">
          <Text className="text-muted text-[12px]">
            Are you a patient?{" "}
            <Text className="text-accent font-bold">Switch to patient app</Text>
          </Text>
          <Text className="text-muted text-[11px] mt-2.5 text-center leading-5">
            By continuing, you agree to Physiobuddies{" "}
            <Text className="text-accent">Terms of Service</Text> and{" "}
            <Text className="text-accent">Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </View>
  );
}
