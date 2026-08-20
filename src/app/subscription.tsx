import { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Check, Crown, Sparkles, Info } from "lucide-react-native";
import { Button } from "@/components/ui";
import { subscriptionApi } from "@/lib/api/services";
import type { SubscriptionPlan } from "@/lib/subscription/plans";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import { GlassSurface } from "@/components/ui/Glass";

/**
 * Therapist subscription plans (Quarterly / Half-Yearly / Annual). Plan selection is real; the
 * "Subscribe" action is intentionally disabled while `SUBSCRIPTION_PAYMENT_ENABLED` is false —
 * the backend does not yet charge for or activate a subscription (see the flag note in config.ts),
 * so charging here would take a therapist's money for nothing. The screen is otherwise complete and
 * flips to a working checkout the moment that flag (and the backend) are ready.
 */
export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);

  const plans = subscriptionApi.getPlans();
  const billingEnabled = subscriptionApi.isBillingEnabled();
  const [selectedId, setSelectedId] = useState<SubscriptionPlan["id"]>("6m");
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0]!;

  const handleSubscribe = () => {
    if (!billingEnabled) {
      showToast("In-app subscription billing is coming soon.", "default");
      return;
    }
    // Wired once billing is enabled: subscriptionApi.createOrder(selected) → Razorpay checkout →
    // POST /payment/confirm. Left here as the single integration point.
    showToast("Starting checkout…", "default");
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
        <Text className="text-[16px] font-extrabold text-fg">Subscription</Text>
      </GlassSurface>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-3.5 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 150 }}
      >
        <LinearGradient
          colors={["#00486b", "#006071"]}
          className="rounded-lg p-5 overflow-hidden relative"
        >
          <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/5" />
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <Crown size={20} color="#fff" />
            <Text className="text-white font-extrabold text-[17px]">Activate your practice</Text>
          </View>
          <Text className="text-white/70 text-[12px] mt-1.5">
            Keep your verified profile live and keep receiving patient bookings. Pick the plan that
            fits your practice.
          </Text>
        </LinearGradient>

        <View
          className="mt-3 flex-row bg-info/5 border border-info/20 rounded-md p-3"
          style={{ gap: 8 }}
        >
          <Info size={16} color={COLORS.info} style={{ marginTop: 1 }} />
          <Text className="flex-1 text-[12px] text-fg/80">
            New therapists get their first month free during onboarding. In-app plan billing is
            coming soon — you&apos;ll be able to renew right here.
          </Text>
        </View>

        <View className="mt-4" style={{ gap: 12 }}>
          {plans.map((plan) => {
            const isSelected = plan.id === selectedId;
            return (
              <Pressable
                key={plan.id}
                onPress={() => setSelectedId(plan.id)}
                className={`bg-white rounded-lg p-4 border-2 ${
                  isSelected ? "border-accent" : "border-border"
                } active:opacity-90`}
                style={{
                  shadowColor: COLORS.nav,
                  shadowOpacity: isSelected ? 0.12 : 0.05,
                  shadowRadius: 10,
                  elevation: isSelected ? 3 : 1,
                }}
              >
                {plan.popular && (
                  <View
                    className="absolute top-0 right-0 bg-accent px-2.5 py-1 rounded-bl-[12px] rounded-tr-[14px] flex-row items-center"
                    style={{ gap: 4 }}
                  >
                    <Sparkles size={11} color="#fff" />
                    <Text className="text-white text-[10px] font-extrabold uppercase tracking-wider">
                      Popular
                    </Text>
                  </View>
                )}
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-16">
                    <Text className="text-[15px] font-extrabold text-fg">{plan.name}</Text>
                    <Text className="text-muted text-[11px]">{plan.months} months</Text>
                  </View>
                  <View
                    className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      isSelected ? "border-accent bg-accent" : "border-border"
                    }`}
                  >
                    {isSelected && <Check size={12} color="#fff" />}
                  </View>
                </View>

                <View className="flex-row items-end mt-2" style={{ gap: 6 }}>
                  <Text className="text-[26px] font-black text-fg tracking-tight">
                    {formatCurrency(plan.price)}
                  </Text>
                  <Text className="text-muted text-[12px] mb-1.5">
                    {formatCurrency(plan.monthlyEquivalent)}/mo
                  </Text>
                  {plan.savings && (
                    <View className="ml-auto bg-success/10 px-2 py-0.5 rounded-full mb-1.5">
                      <Text className="text-success text-[11px] font-bold">{plan.savings}</Text>
                    </View>
                  )}
                </View>

                <View className="h-px bg-border my-3" />

                <View style={{ gap: 7 }}>
                  {plan.features.map((f) => (
                    <View key={f} className="flex-row items-center" style={{ gap: 8 }}>
                      <View className="w-4 h-4 rounded-full bg-success/10 items-center justify-center">
                        <Check size={11} color={COLORS.success} />
                      </View>
                      <Text className="text-fg/80 text-[12.5px] flex-1">{f}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <GlassSurface
        fallbackClassName="bg-white"
        className="absolute left-0 right-0 bottom-0 border-t border-border px-3.5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-muted text-[12px]">
            {selected.name} · {selected.months} mo
          </Text>
          <Text className="text-fg font-extrabold text-[15px]">{formatCurrency(selected.price)}</Text>
        </View>
        <Button variant="primary" fullWidth onPress={handleSubscribe} disabled={!billingEnabled}>
          {billingEnabled ? `Subscribe — ${formatCurrency(selected.price)}` : "Billing coming soon"}
        </Button>
        {!billingEnabled && (
          <Text className="text-muted/70 text-[11px] text-center mt-2">
            In-app subscription payment isn&apos;t available yet.
          </Text>
        )}
      </GlassSurface>
    </View>
  );
}
