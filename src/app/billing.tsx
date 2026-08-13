import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Receipt, TriangleAlert, Info } from "lucide-react-native";
import { Badge, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { billingApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";
import { formatCurrency } from "@/lib/utils/format";
import type { PaymentRecord } from "@/types";

/**
 * Payment history — money *in* (subscription charges), as opposed to `payouts.tsx`, which is money
 * out. Reads `GET /payment/`, an endpoint that has always existed but had no app surface.
 *
 * Deliberately read-only. The subscription flow doesn't charge anyone yet
 * (`SUBSCRIPTION_PAYMENT_ENABLED=false` — a subscription-purpose payment activates nothing
 * server-side), so this is a record of what the account has been billed, not a place to pay.
 */

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "completed":
    case "captured":
    case "paid":
      return "success";
    case "pending":
    case "processing":
      return "warning";
    case "failed":
    case "refunded":
      return "danger";
    default:
      return "neutral";
  }
}

function purposeLabel(purpose: string): string {
  switch (purpose) {
    case "subscription":
      return "Subscription";
    case "session":
      return "Session";
    default:
      return purpose.charAt(0).toUpperCase() + purpose.slice(1);
  }
}

export default function BillingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments"],
    queryFn: billingApi.listPayments,
  });

  const payments = data ?? [];
  const totalPaid = payments
    .filter((p) => p.status === "completed" && !p.refundedAt)
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <View className="flex-1 bg-bg">
      <View
        className="px-4 pb-3 flex-row items-center bg-white border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">Payments</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 12 }}
      >
        {payments.length > 0 && (
          <View
            className="bg-white border border-border rounded-md p-4"
            style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
          >
            <Text className="text-muted text-[11px] font-bold uppercase" style={{ letterSpacing: 0.6 }}>
              Total paid
            </Text>
            <Text className="text-[26px] font-black text-fg mt-1">{formatCurrency(totalPaid)}</Text>
            <Text className="text-muted text-[12px] mt-0.5">
              Across {payments.length} payment{payments.length === 1 ? "" : "s"}
            </Text>
          </View>
        )}

        {isLoading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={70} radius={12} />
            <Skeleton height={70} radius={12} />
          </View>
        ) : isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load payments"
            badge="Error"
            description="We couldn't reach the server. This is usually temporary."
            action={{ label: "Try again", onPress: () => refetch() }}
          />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments yet"
            description="Charges to your account — such as your Physiobuddies subscription — will appear here."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {payments.map((payment) => (
              <PaymentRow key={payment.id} payment={payment} />
            ))}
          </View>
        )}

        {/* Stated rather than hidden: the invoice endpoint exists but can't be reached from a
            payment record, because the payload only carries the display number and
            GET /invoice/:id wants an ObjectId. See BACKEND_TODO §1.3. */}
        {payments.length > 0 && (
          <View className="flex-row bg-info/5 border border-info/20 rounded-md p-3" style={{ gap: 8 }}>
            <Info size={15} color={COLORS.info} style={{ marginTop: 1 }} />
            <Text className="flex-1 text-[11.5px] text-fg/80">
              Downloadable invoices aren&apos;t available in the app yet. Contact
              support@physiobuddies.in if you need one for your records.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PaymentRow({ payment }: { payment: PaymentRecord }) {
  const refunded = !!payment.refundedAt;
  return (
    <View
      className="bg-white border border-border rounded-md p-3.5 flex-row items-center"
      style={{ gap: 12, shadowColor: COLORS.nav, shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}
    >
      <View className="w-10 h-10 rounded-[12px] bg-primary-soft items-center justify-center">
        <Receipt size={19} color={COLORS.accent} />
      </View>
      <View className="flex-1">
        <Text className="text-[13.5px] font-bold text-fg">{purposeLabel(payment.purpose)}</Text>
        <Text className="text-muted text-[11.5px] mt-0.5">
          {[payment.dateLabel, payment.invoiceNumber].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View className="items-end" style={{ gap: 4 }}>
        <Text
          className="text-[14px] font-black"
          style={{
            color: refunded ? COLORS.muted : COLORS.fg,
            textDecorationLine: refunded ? "line-through" : "none",
          }}
        >
          {formatCurrency(payment.amount)}
        </Text>
        <Badge variant={refunded ? "danger" : statusVariant(payment.status)} size="sm">
          {refunded ? "Refunded" : payment.status}
        </Badge>
      </View>
    </View>
  );
}
