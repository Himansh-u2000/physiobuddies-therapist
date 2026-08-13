import { View, Text, Pressable, ScrollView, Share } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, TriangleAlert, Eye, Clock3, Heart, Share2 } from "lucide-react-native";
import { Badge, Skeleton, ErrorState, MarkdownText } from "@/components/ui";
import { blogApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";

/**
 * Reader for a patient-education article (`GET /blog/:slug` — keyed by slug, not id).
 *
 * Note the backend increments `views` on every read, so re-opening a post inflates its count.
 * That's server behaviour, not something to work around here.
 */
export default function LearnPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const showToast = useAppStore((s) => s.showToast);

  const { data: post, isLoading, isError, refetch } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => blogApi.getBySlug(slug),
    enabled: !!slug,
  });

  const share = async () => {
    if (!post) return;
    try {
      // Shares the summary rather than the body: this is meant to be forwarded to a patient,
      // and the full article text in a WhatsApp message is unreadable.
      await Share.share({ message: `${post.title}\n\n${post.summary}` });
    } catch {
      showToast("Couldn't open the share sheet");
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <View
        className="px-4 pb-3 flex-row items-center bg-white border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1" numberOfLines={1}>
          {post?.title ?? "Article"}
        </Text>
        {post && (
          <Pressable onPress={share} hitSlop={8} className="w-8 h-8 items-center justify-center active:opacity-70">
            <Share2 size={18} color={COLORS.accent} />
          </Pressable>
        )}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        {isLoading ? (
          <View className="px-3.5 pt-3" style={{ gap: 12 }}>
            <Skeleton height={180} radius={16} />
            <Skeleton height={24} radius={8} />
            <Skeleton height={120} radius={8} />
          </View>
        ) : isError || !post ? (
          <View className="px-3.5 pt-3">
            <ErrorState
              icon={TriangleAlert}
              title="Couldn't load this article"
              badge="Error"
              description="We couldn't reach the server. This is usually temporary."
              action={{ label: "Try again", onPress: () => refetch() }}
            />
          </View>
        ) : (
          <>
            {post.thumbnail && (
              <Image
                source={{ uri: post.thumbnail }}
                style={{ width: "100%", height: 200, backgroundColor: COLORS.primarySoft }}
                contentFit="cover"
                transition={150}
              />
            )}

            <View className="px-3.5 pt-4" style={{ gap: 12 }}>
              <Text className="text-[21px] font-black text-fg leading-7">{post.title}</Text>

              <View className="flex-row items-center flex-wrap" style={{ gap: 12 }}>
                {post.readTime ? (
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Clock3 size={12} color={COLORS.muted} />
                    <Text className="text-muted text-[11.5px]">{post.readTime}</Text>
                  </View>
                ) : null}
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <Eye size={12} color={COLORS.muted} />
                  <Text className="text-muted text-[11.5px]">{post.views} views</Text>
                </View>
                {post.likes != null && (
                  <View className="flex-row items-center" style={{ gap: 4 }}>
                    <Heart size={12} color={COLORS.muted} />
                    <Text className="text-muted text-[11.5px]">{post.likes}</Text>
                  </View>
                )}
                {post.dateLabel ? (
                  <Text className="text-muted text-[11.5px]">{post.dateLabel}</Text>
                ) : null}
              </View>

              {post.tags.length > 0 && (
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                  {post.tags.map((tag) => (
                    <Badge key={tag} variant="info" size="sm" dot={false}>
                      {tag}
                    </Badge>
                  ))}
                </View>
              )}

              <View className="h-px bg-border" />

              {post.summary ? (
                <Text className="text-[14px] text-fg/80 leading-6 italic">{post.summary}</Text>
              ) : null}

              {post.content ? (
                <MarkdownText content={post.content} />
              ) : (
                <Text className="text-muted text-[13px] italic">
                  This article has no body text yet.
                </Text>
              )}

              {post.reviews && post.reviews.length > 0 && (
                <>
                  <View className="h-px bg-border mt-2" />
                  <Text className="text-[14px] font-bold text-fg">
                    What readers said ({post.reviews.length})
                  </Text>
                  {post.reviews.map((review) => (
                    <View
                      key={review.id}
                      className="bg-white border border-border rounded-md p-3"
                      style={{ gap: 4 }}
                    >
                      <Text className="text-[12.5px] font-bold text-fg">{review.userName}</Text>
                      <Text className="text-muted text-[12.5px] leading-5">{review.comment}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
