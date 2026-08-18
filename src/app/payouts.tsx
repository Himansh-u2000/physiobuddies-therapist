import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronLeft,
  Wallet,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  XCircle,
  TriangleAlert,
} from "lucide-react-native";
import { Button, Input, Skeleton, EmptyState, ErrorState, BottomSheet } from "@/components/ui";
import { payoutApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import type { Payout } from "@/types";

/**
 * Wallet balance + payout history + a request form (GET /therapist/wallet, GET /therapist/payout,
 * POST /therapist/payout/request).
 *
 * The request call is deliberately NOT retried automatically anywhere in this screen: the backend
 * has no Idempotency-Key handling on it, so a silent retry after a dropped response could raise a
 * second request for the same money. The button is disabled while in flight and the sheet closes
 * only on a confirmed result.
 */
export default function PayoutsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: payoutApi.getWallet });
  const payouts = useQuery({ queryKey: ["payouts"], queryFn: payoutApi.list });

  const balance = wallet.data?.balance ?? 0;
  const parsedAmount = Number(amount);
  const amountError = useMemo(() => {
    if (!amount.trim()) return undefined;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return "Enter a valid amount";
    if (parsedAmount > balance) return `You can withdraw at most ${formatCurrency(balance)}`;
    return undefined;
  }, [amount, parsedAmount, balance]);

  const canSubmit =
    !submitting && !amountError && amount.trim().length > 0 && parsedAmount > 0 && balance > 0;

  const handleRequest = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await payoutApi.request(parsedAmount);
      showToast("Payout requested", "success");
      setSheetOpen(false);
      setAmount("");
      // Both the ledger and the history change server-side; refetch rather than patch locally.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["wallet"] }),
        queryClient.invalidateQueries({ queryKey: ["payouts"] }),
        queryClient.invalidateQueries({ queryKey: ["earnings"] }),
      ]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't request payout. Try again.", "error");
    } finally {
      setSubmitting(false);
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
        <Text className="text-[16px] font-extrabold text-fg">Payouts</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-3.5 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {wallet.isLoading ? (
          <Skeleton height={150} radius={18} />
        ) : wallet.isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load your wallet"
            badge="Error"
            description="We couldn't reach the server. Your balance is safe — this is usually temporary."
            action={{ label: "Try again", onPress: () => wallet.refetch() }}
          />
        ) : (
          <LinearGradient colors={["#00486b", "#006071"]} className="rounded-lg p-5 overflow-hidden relative">
            <View className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-white/5" />
            <Text className="text-white/80 text-[12px] font-semibold">Available balance</Text>
            <Text className="text-white text-[34px] font-black tracking-tight">
              {formatCurrency(balance)}
            </Text>
            <Text className="text-white/60 text-[11px] mt-1">
              Settled earnings you can withdraw to your registered account.
            </Text>
            <Pressable
              onPress={() => setSheetOpen(true)}
              disabled={balance <= 0}
              // Disabled is a different fill, not a dimmed copy: `opacity-50` on a white button
              // sitting on the navy card washed the whole control — label included — down to
              // something barely there. A translucent box with a white label keeps the text
              // legible while still reading as unavailable.
              className={`mt-4 h-11 rounded-[13px] flex-row items-center justify-center ${
                balance <= 0 ? "bg-white/15" : "bg-white active:opacity-80"
              }`}
              style={{ gap: 8 }}
            >
              <ArrowDownCircle size={18} color={balance <= 0 ? "rgba(255,255,255,0.75)" : COLORS.accent} />
              <Text
                className={`font-bold text-[14px] ${balance <= 0 ? "text-white/75" : "text-accent"}`}
              >
                Request payout
              </Text>
            </Pressable>
            {balance <= 0 && (
              <Text className="text-white/60 text-[11px] mt-2 text-center">
                Nothing to withdraw yet — complete a paid session first.
              </Text>
            )}
          </LinearGradient>
        )}

        <Text className="text-[15px] font-bold text-fg mt-4 mb-2">Payout history</Text>

        {payouts.isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={64} radius={12} />
            <Skeleton height={64} radius={12} />
          </View>
        ) : payouts.isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load payouts"
            badge="Error"
            description="We couldn't load your payout history right now. This is usually temporary."
            action={{ label: "Try again", onPress: () => payouts.refetch() }}
          />
        ) : (payouts.data ?? []).length === 0 ? (
          <EmptyState
            icon={Wallet}
            tone="success"
            title="No payouts yet"
            description="Once you request a withdrawal it will appear here with its settlement status and reference number."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {(payouts.data ?? []).map((p) => (
              <PayoutRow key={p.id} payout={p} />
            ))}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <View style={{ gap: 14 }}>
          <Text className="text-[16px] font-extrabold text-fg">Request payout</Text>
          <Text className="text-muted text-[12px]">
            Available to withdraw: <Text className="text-fg font-bold">{formatCurrency(balance)}</Text>
          </Text>
          <Input
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="0"
            invalid={!!amountError}
            error={amountError}
          />
          <View className="flex-row" style={{ gap: 8 }}>
            {[0.25, 0.5, 1].map((frac) => (
              <Pressable
                key={frac}
                onPress={() => setAmount(String(Math.floor(balance * frac)))}
                className="flex-1 h-9 rounded-[11px] border border-border bg-white items-center justify-center active:opacity-80"
              >
                <Text className="text-accent text-[12px] font-bold">
                  {frac === 1 ? "Max" : `${frac * 100}%`}
                </Text>
              </Pressable>
            ))}
          </View>
          <Button variant="primary" fullWidth onPress={handleRequest} disabled={!canSubmit}>
            {submitting ? <ActivityIndicator color="#fff" /> : "Request payout"}
          </Button>
          <Text className="text-muted/80 text-[11px] text-center">
            Payouts are reviewed and settled to your registered UPI or bank account.
          </Text>
        </View>
      </BottomSheet>
    </View>
  );
}

const STATUS_META: Record<
  Payout["status"],
  { label: string; color: string; tint: string; Icon: typeof Clock }
> = {
  requested: { label: "Requested", color: COLORS.warning, tint: "rgba(209,154,18,0.1)", Icon: Clock },
  processing: { label: "Processing", color: COLORS.info, tint: "rgba(0,134,168,0.1)", Icon: Clock },
  processed: { label: "Paid", color: COLORS.success, tint: "rgba(35,145,73,0.1)", Icon: CheckCircle2 },
  failed: { label: "Failed", color: COLORS.danger, tint: "rgba(207,66,56,0.1)", Icon: XCircle },
  rejected: { label: "Rejected", color: COLORS.danger, tint: "rgba(207,66,56,0.1)", Icon: XCircle },
};

function PayoutRow({ payout }: { payout: Payout }) {
  const meta = STATUS_META[payout.status];
  const Icon = meta.Icon;
  return (
    <View
      className="bg-white border border-border rounded-md p-3 flex-row items-center"
      style={{ gap: 10, shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
      <View
        className="w-10 h-10 rounded-[12px] items-center justify-center"
        style={{ backgroundColor: meta.tint }}
      >
        <Icon size={18} color={meta.color} />
      </View>
      <View className="flex-1">
        <Text className="text-[14px] font-extrabold text-fg">{formatCurrency(payout.amount)}</Text>
        <Text className="text-muted text-[11px]">
          {payout.dateLabel}
          {payout.account?.bankName ? ` · ${payout.account.bankName}` : ""}
        </Text>
        {payout.transactionRef ? (
          <Text className="text-muted/70 text-[10px] mt-0.5">Ref {payout.transactionRef}</Text>
        ) : null}
      </View>
      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: meta.tint }}>
        <Text className="text-[11px] font-bold" style={{ color: meta.color }}>
          {meta.label}
        </Text>
      </View>
    </View>
  );
}
