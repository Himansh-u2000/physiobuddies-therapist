import { useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, type Href } from "expo-router";
import {
  Star,
  Shield,
  FileText,
  Bell,
  BellRing,
  Lock,
  HelpCircle,
  LogOut,
  ChevronRight,
  Fingerprint,
  Trash2,
  Wallet,
  CalendarRange,
  MessageSquareQuote,
  Crown,
  Pencil,
  BookOpenText,
  MessagesSquare,
  Camera,
  Image as ImageIcon,
  Mail,
  GraduationCap,
  Receipt,
  MonitorSmartphone,
  Radio,
} from "lucide-react-native";
import { TopBar } from "@/components/shared/TopBar";
import { Avatar, BottomSheet, Button } from "@/components/ui";
import { useAuthStore } from "@/lib/stores/auth.store";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS, NETWORK_LOG_ENABLED, SUPPORT_EMAIL } from "@/constants/config";
import { therapistApi } from "@/lib/api/services";
import { useFileUpload, pickImageFromLibrary, captureImage } from "@/lib/hooks/useFilePicker";
import { openSupportEmail } from "@/lib/utils/support";
import { GlassSurface, GlassLayer, GLASS_ENABLED } from "@/components/ui/Glass";

export default function ProfileScreen() {
  const router = useRouter();
  const therapist = useAuthStore((s) => s.therapist);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setTherapist = useAuthStore((s) => s.setTherapist);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useAppStore((s) => s.showToast);
  const { busy: uploadingAvatar, upload } = useFileUpload("avatar");
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/splash");
  };

  /**
   * Profile photo. Two backend calls, in order: upload the file, then point the account at the
   * returned URL. `PATCH /user/avatar` validates its body as a URL, so the relative path multer
   * hands back has to be absolutised first — `uploadApi` already does that.
   */
  const handlePickAvatar = async (source: "library" | "camera") => {
    setAvatarSheetOpen(false);
    try {
      const picked = await upload(() =>
        source === "camera"
          ? captureImage({ allowsEditing: true, aspect: [1, 1] })
          : pickImageFromLibrary({ allowsEditing: true, aspect: [1, 1] }),
      );
      if (!picked) return; // cancelled — not a failure, say nothing
      const updated = await therapistApi.updateAvatar(picked.url);
      await setTherapist(updated);
      showToast("Profile photo updated", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't update your photo. Try again.", "error");
    }
  };

  const handleSupport = () => openSupportEmail(therapist);

  /**
   * Grouped rather than one flat list. It reached thirteen rows once login activity, payments and
   * the article library were added, and an undifferentiated stack that long is scanned by reading
   * every label. Three headings — what you do, what you earn, and your account — let the eye skip.
   */
  const sections: {
    title: string;
    items: { icon: typeof FileText; label: string; sub: string; color: string; href: Href }[];
  }[] = [
    {
      title: "Practice",
      items: [
        {
          icon: CalendarRange,
          label: "Availability",
          sub: "Working hours, block slots, leave",
          color: COLORS.info,
          href: "/availability",
        },
        {
          icon: FileText,
          label: "Documents & verification",
          sub: "Manage your credentials",
          color: COLORS.accent,
          href: "/(app)/documents",
        },
        {
          icon: MessageSquareQuote,
          label: "Reviews",
          sub: "What your patients say",
          color: COLORS.warning,
          href: "/reviews",
        },
        {
          icon: BookOpenText,
          label: "Articles",
          sub: "Write patient-education content",
          color: COLORS.info,
          href: "/(app)/articles",
        },
        {
          icon: MessagesSquare,
          label: "FAQs",
          sub: "Answer common patient questions",
          color: COLORS.accent,
          href: "/faqs",
        },
        {
          icon: GraduationCap,
          label: "Learn",
          sub: "Physiobuddies articles to read & share",
          color: COLORS.info,
          href: "/learn",
        },
      ],
    },
    {
      title: "Money",
      items: [
        {
          icon: Wallet,
          label: "Payouts & wallet",
          sub: "Balance, withdrawals, history",
          color: COLORS.success,
          href: "/payouts",
        },
        {
          icon: Crown,
          label: "Subscription",
          sub: "Your plan & membership",
          color: COLORS.accent,
          href: "/subscription",
        },
        {
          icon: Receipt,
          label: "Payments",
          sub: "What you've been charged",
          color: COLORS.warning,
          href: "/billing",
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          icon: Bell,
          label: "Notifications",
          sub: "Your alerts and updates",
          color: COLORS.info,
          href: "/(app)/notifications",
        },
        {
          icon: BellRing,
          label: "Notification settings",
          sub: "Push, email and reminder preferences",
          color: COLORS.accent,
          href: "/notification-settings",
        },
        {
          icon: Fingerprint,
          label: "Biometric login",
          sub: biometricEnabled ? "Enabled" : "Disabled",
          color: COLORS.success,
          // `from=settings` puts the screen in its manage-the-setting layout rather than the
          // first-run pitch — see the note at the top of biometric-setup.tsx.
          href: "/(auth)/biometric-setup?from=settings",
        },
        {
          icon: MonitorSmartphone,
          label: "Login activity",
          sub: "Devices signed in to your account",
          color: COLORS.accent,
          href: "/security",
        },
        {
          icon: Lock,
          label: "Change password",
          sub: "Update your account password",
          color: COLORS.warning,
          href: "/change-password",
        },
      ],
    },
  ];

  return (
    <View className="flex-1 bg-bg">
      <TopBar therapist={therapist} title="Profile" subtitle="Account & settings" showNotification={false} />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-3.5 pt-3 pb-24">
        <GlassSurface
          fallbackClassName="bg-white"
          glassRadius={12}
          className="border border-border rounded-md p-4 items-center relative" style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}>
          <Pressable
            onPress={() => router.push("/edit-profile")}
            hitSlop={6}
            className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-bg items-center justify-center active:opacity-70"
          >
            <Pencil size={15} color={COLORS.accent} />
          </Pressable>
          <Pressable
            onPress={() => setAvatarSheetOpen(true)}
            disabled={uploadingAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            className="active:opacity-80"
          >
            <Avatar name={therapist?.name} url={therapist?.avatarUrl} size={80} radius={18} />
            {/* The camera badge is what makes the avatar legible as a control — a bare image
                gives no affordance, and this is now a real upload rather than decoration. */}
            <View
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full items-center justify-center border-2 border-white"
              style={{ backgroundColor: COLORS.accent }}
            >
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Camera size={13} color="#fff" />
              )}
            </View>
          </Pressable>
          <Text className="text-[18px] font-extrabold text-fg mt-3">{therapist?.name}</Text>
          <Text className="text-muted text-[12px]">{therapist?.specialization}</Text>
          <View className="flex-row items-center mt-2" style={{ gap: 12 }}>
            <Pressable
              onPress={() => router.push("/reviews")}
              className="flex-row items-center active:opacity-70"
              style={{ gap: 4 }}
              hitSlop={6}
            >
              <Star size={14} color={COLORS.warning} fill={COLORS.warning} />
              <Text className="text-fg text-[13px] font-bold">{therapist?.rating}</Text>
            </Pressable>
            {therapist?.isVerified && (
              <View className="flex-row items-center" style={{ gap: 4 }}>
                <Shield size={14} color={COLORS.success} />
                <Text className="text-success text-[12px] font-bold">Verified</Text>
              </View>
            )}
          </View>
        </GlassSurface>

        {sections.map((section) => (
          <View key={section.title} className="mt-4" style={{ gap: 10 }}>
            <Text
              className="text-[11.5px] font-extrabold text-muted uppercase px-1"
              style={{ letterSpacing: 0.8 }}
            >
              {section.title}
            </Text>
            {section.items.map((s) => {
              const Icon = s.icon;
              return (
                <Pressable
                  key={s.label}
                  onPress={() => router.push(s.href)}
                  className={`border border-border rounded-md p-3.5 flex-row items-center active:opacity-80 ${GLASS_ENABLED ? "" : "bg-white"}`}
                  style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
                >
                  <GlassLayer radius={12} />
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
        ))}

        <View className="mt-4" style={{ gap: 10 }}>
          <Text
            className="text-[11.5px] font-extrabold text-muted uppercase px-1"
            style={{ letterSpacing: 0.8 }}
          >
            Support
          </Text>

          <Pressable
            onPress={handleSupport}
            className={`border border-border rounded-md p-3.5 flex-row items-center active:opacity-80 ${GLASS_ENABLED ? "" : "bg-white"}`}
            style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
          >
            <GlassLayer radius={12} />
            <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: COLORS.primarySoft }}>
              <HelpCircle size={18} color={COLORS.danger} />
            </View>
            <View className="flex-1">
              <Text className="text-[14px] font-bold text-fg">Help & support</Text>
              <Text className="text-muted text-[12px]">Email {SUPPORT_EMAIL}</Text>
            </View>
            <Mail size={18} color={COLORS.muted} />
          </Pressable>

          {/* Only in builds that captured anything. On a release review APK this is the only
              way to see a request payload — there's no Metro and no DevTools to attach. */}
          {NETWORK_LOG_ENABLED && (
            <Pressable
              onPress={() => router.push("/network-log")}
              className={`border border-border rounded-md p-3.5 flex-row items-center active:opacity-80 ${GLASS_ENABLED ? "" : "bg-white"}`}
              style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
            >
              <GlassLayer radius={12} />
              <View className="w-9 h-9 rounded-[10px] items-center justify-center" style={{ backgroundColor: COLORS.primarySoft }}>
                <Radio size={18} color={COLORS.info} />
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-fg">Network log</Text>
                <Text className="text-muted text-[12px]">Every API request, payload and response</Text>
              </View>
              <ChevronRight size={18} color={COLORS.muted} />
            </Pressable>
          )}
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

      <BottomSheet visible={avatarSheetOpen} onClose={() => setAvatarSheetOpen(false)}>
        <View style={{ gap: 12 }}>
          <Text className="text-[16px] font-extrabold text-fg">Profile photo</Text>
          <Text className="text-muted text-[12px]">
            Patients see this photo when they book you. A clear head-and-shoulders shot works best.
          </Text>
          <Button variant="primary" fullWidth onPress={() => handlePickAvatar("camera")}>
            <Camera size={16} color="#fff" />
            <Text className="text-white font-bold text-[14px]">Take a photo</Text>
          </Button>
          <Button variant="secondary" fullWidth onPress={() => handlePickAvatar("library")}>
            <ImageIcon size={16} color={COLORS.accent} />
            <Text className="text-accent font-bold text-[14px]">Choose from gallery</Text>
          </Button>
        </View>
      </BottomSheet>
    </View>
  );
}
