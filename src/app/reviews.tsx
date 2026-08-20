import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Star, MessageSquareQuote, TriangleAlert } from "lucide-react-native";
import { Avatar, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { therapistApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";
import type { TherapistReview } from "@/types";
import { GlassSurface } from "@/components/ui/Glass";

/** Patient reviews for the signed-in therapist (GET /therapist/:id/reviews). */
export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reviews"],
    queryFn: therapistApi.getReviews,
  });

  const reviews = data ?? [];
  const average =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

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
        <Text className="text-[16px] font-extrabold text-fg">Reviews</Text>
      </GlassSurface>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="px-3.5 pt-3"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, gap: 10 }}
      >
        {isLoading ? (
          <>
            <Skeleton height={92} radius={18} />
            <Skeleton height={96} radius={12} />
            <Skeleton height={96} radius={12} />
          </>
        ) : isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load reviews"
            badge="Error"
            description="We couldn't reach the server right now. This is usually temporary."
            action={{ label: "Try again", onPress: () => refetch() }}
          />
        ) : reviews.length === 0 ? (
          <EmptyState
            icon={MessageSquareQuote}
            title="No reviews yet"
            description="Patients can leave a review after a completed session. They'll appear here as they come in."
          />
        ) : (
          <>
            <GlassSurface
              fallbackClassName="bg-white"
              glassRadius={12}
              className="border border-border rounded-md p-4 flex-row items-center"
              style={{
              gap: 14,
              shadowColor: COLORS.nav,
              shadowOpacity: 0.07,
              shadowRadius: 8,
              elevation: 2,
              }}
            >
              <View className="items-center">
                <Text className="text-[30px] font-black text-fg leading-tight">
                  {average.toFixed(1)}
                </Text>
                <View className="flex-row" style={{ gap: 1 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      size={12}
                      color={COLORS.warning}
                      fill={i <= Math.round(average) ? COLORS.warning : "transparent"}
                    />
                  ))}
                </View>
              </View>
              <View className="flex-1">
                <Text className="text-[14px] font-bold text-fg">
                  {reviews.length} review{reviews.length > 1 ? "s" : ""}
                </Text>
                <Text className="text-muted text-[12px] mt-0.5">
                  Based on completed sessions with your patients.
                </Text>
              </View>
            </GlassSurface>

            {reviews.map((r, i) => (
              <ReviewCard key={`${r.reviewerName}-${r.createdAt}-${i}`} review={r} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function ReviewCard({ review }: { review: TherapistReview }) {
  return (
    <GlassSurface
      fallbackClassName="bg-white"
      glassRadius={12}
      className="border border-border rounded-md p-3.5"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 }}
    >
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <Avatar name={review.reviewerName} url={review.reviewerImage ?? undefined} size={36} radius={12} />
        <View className="flex-1">
          <Text className="text-[13px] font-bold text-fg">{review.reviewerName}</Text>
          <Text className="text-muted text-[11px]">{review.dateLabel}</Text>
        </View>
        <View className="flex-row items-center" style={{ gap: 3 }}>
          <Star size={13} color={COLORS.warning} fill={COLORS.warning} />
          <Text className="text-fg text-[13px] font-bold">{review.rating}</Text>
        </View>
      </View>
      {review.comment ? (
        <Text className="text-fg text-[13px] mt-2.5 leading-5">{review.comment}</Text>
      ) : null}
    </GlassSurface>
  );
}
