import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Share,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  TriangleAlert,
  Eye,
  Clock3,
  Heart,
  MessageCircle,
  Send,
  Share2,
} from "lucide-react-native";
import { Badge, Skeleton, ErrorState, MarkdownText, TextArea } from "@/components/ui";
import { blogApi } from "@/lib/api/services";
import { useAppStore } from "@/lib/stores/app.store";
import { COLORS } from "@/constants/config";
import { relativeCommentTime } from "@/lib/utils/format";
import type { BlogPost } from "@/types";
import { GlassSurface } from "@/components/ui/Glass";

const COMMENT_MAX = 500;

/**
 * Reader for a patient-education article (`GET /blog/:slug` — keyed by slug, not id).
 *
 * Note the backend increments `views` on every read, so re-opening a post inflates its count.
 * That's server behaviour, not something to work around here.
 *
 * Liking and commenting both address the post by **id**, while the article itself is fetched by
 * **slug** — the detail payload carries both, so `post.id` is what the writes use.
 */
export default function LearnPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const showToast = useAppStore((s) => s.showToast);
  const queryClient = useQueryClient();

  const [liking, setLiking] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  /**
   * Whether *this* therapist has liked the post.
   *
   * Deliberately session-only. `GET /blog/:slug` returns a like COUNT and nothing about the
   * caller's own like, so on a fresh open there is no way to know — the heart therefore starts
   * unfilled even for a post already liked, and only reflects likes made since this screen was
   * opened. Filed as a backend gap; the alternative (guessing) would show a wrong state.
   */
  const [liked, setLiked] = useState(false);

  const { data: post, isLoading, isError, refetch } = useQuery({
    queryKey: ["blog-post", slug],
    queryFn: () => blogApi.getBySlug(slug),
    enabled: !!slug,
  });

  /** Merge a server result into the cached post so it survives re-render without a refetch. */
  const patchPost = (patch: Partial<BlogPost>) => {
    queryClient.setQueryData<BlogPost>(["blog-post", slug], (prev) =>
      prev ? { ...prev, ...patch } : prev,
    );
  };

  const toggleLike = async () => {
    if (!post || liking) return;
    setLiking(true);
    // Optimistic, because a like should feel instant — reconciled against the server's own
    // count below, which is authoritative (the endpoint toggles and returns the result).
    const previous = { liked, likes: post.likes ?? 0 };
    setLiked(!previous.liked);
    patchPost({ likes: Math.max(0, previous.likes + (previous.liked ? -1 : 1)) });
    try {
      const result = await blogApi.toggleLike(post.id);
      setLiked(result.liked);
      patchPost({ likes: result.likes });
    } catch (e) {
      setLiked(previous.liked);
      patchPost({ likes: previous.likes });
      showToast(e instanceof Error ? e.message : "Couldn't register that like", "error");
    } finally {
      setLiking(false);
    }
  };

  const submitComment = async () => {
    const text = comment.trim();
    if (!post || posting) return;
    if (!text) {
      showToast("Write something first", "error");
      return;
    }
    setPosting(true);
    try {
      const created = await blogApi.addComment(post.id, text);
      // Newest first, matching the order the detail endpoint returns comments in.
      patchPost({ reviews: [created, ...(post.reviews ?? [])] });
      setComment("");
      showToast("Comment posted", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't post your comment", "error");
    } finally {
      setPosting(false);
    }
  };

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
      <GlassSurface
        fallbackClassName="bg-white"
        className="px-4 pb-3 flex-row items-center border-b border-border"
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
      </GlassSurface>

      {/* The comment composer sits at the bottom of a long scroll, so the keyboard has to lift
          it rather than cover it. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
                <View className="flex-row items-center" style={{ gap: 4 }}>
                  <MessageCircle size={12} color={COLORS.muted} />
                  <Text className="text-muted text-[11.5px]">
                    {post.reviews?.length ?? 0} comments
                  </Text>
                </View>
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

              <View className="h-px bg-border mt-2" />

              {/* Like — a real toggle against POST /blog/:id/like. Both the fill and the count
                  carry the state, so it survives greyscale and doesn't rely on colour alone. */}
              <Pressable
                onPress={toggleLike}
                disabled={liking}
                accessibilityRole="button"
                accessibilityState={{ selected: liked }}
                accessibilityLabel={liked ? "Remove like" : "Like this article"}
                className={`h-11 flex-row items-center justify-center rounded-[13px] border active:opacity-80 ${
                  liked ? "bg-danger/10 border-danger/30" : "bg-white border-border"
                }`}
                style={{ gap: 8 }}
              >
                <Heart
                  size={17}
                  color={liked ? COLORS.danger : COLORS.muted}
                  fill={liked ? COLORS.danger : "transparent"}
                />
                <Text
                  className={`text-[13.5px] font-bold ${liked ? "text-danger" : "text-fg"}`}
                >
                  {liked ? "Liked" : "Like"}
                  {post.likes ? ` · ${post.likes}` : ""}
                </Text>
              </Pressable>

              <Text className="text-[14px] font-bold text-fg mt-1">
                Comments{post.reviews?.length ? ` (${post.reviews.length})` : ""}
              </Text>

              <GlassSurface
                fallbackClassName="bg-white"
                glassRadius={12}
                className="border border-border rounded-md p-3" style={{ gap: 10 }}>
                <TextArea
                  value={comment}
                  onChangeText={(t) => setComment(t.slice(0, COMMENT_MAX))}
                  placeholder="Share a note for other therapists…"
                />
                <View className="flex-row items-center justify-between">
                  <Text className="text-muted text-[11px]">
                    {comment.trim().length}/{COMMENT_MAX}
                  </Text>
                  <Pressable
                    onPress={submitComment}
                    disabled={posting || !comment.trim()}
                    accessibilityRole="button"
                    className={`h-9 px-4 rounded-[11px] flex-row items-center justify-center active:opacity-80 ${
                      comment.trim() ? "bg-accent" : "bg-border"
                    }`}
                    style={{ gap: 6 }}
                  >
                    {posting ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Send size={14} color={comment.trim() ? "#fff" : COLORS.muted} />
                    )}
                    <Text
                      className={`text-[13px] font-bold ${comment.trim() ? "text-white" : "text-muted"}`}
                    >
                      Post
                    </Text>
                  </Pressable>
                </View>
              </GlassSurface>

              {post.reviews && post.reviews.length > 0 ? (
                post.reviews.map((review) => (
                  <GlassSurface
                    fallbackClassName="bg-white"
                    glassRadius={12}
                    key={review.id}
                    className="border border-border rounded-md p-3"
                    style={{ gap: 4 }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[12.5px] font-bold text-fg">{review.userName}</Text>
                      {review.createdAt ? (
                        <Text className="text-muted text-[10.5px]">
                          {relativeCommentTime(review.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="text-muted text-[12.5px] leading-5">{review.comment}</Text>
                  </GlassSurface>
                ))
              ) : (
                <Text className="text-muted text-[12.5px] italic">
                  No comments yet — be the first to add one.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
