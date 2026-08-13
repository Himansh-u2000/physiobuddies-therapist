import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, BookOpen, TriangleAlert, Eye, Clock3 } from "lucide-react-native";
import { Badge, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { blogApi } from "@/lib/api/services";
import { COLORS } from "@/constants/config";
import type { BlogPost } from "@/types";

/**
 * Patient-education library — platform-authored articles from `GET /blog`.
 *
 * Distinct from `articles.tsx`, which is the therapist's *own* writing (`/therapist/articles`).
 * This is material written centrally that a therapist can read and point patients at, so it's
 * read-only here.
 */
export default function LearnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["blog-posts"],
    queryFn: blogApi.list,
  });

  const posts = data ?? [];

  return (
    <View className="flex-1 bg-bg">
      <View
        className="px-4 pb-3 flex-row items-center bg-white border-b border-border"
        style={{ paddingTop: insets.top + 10, gap: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} className="w-8 h-8 items-center justify-center">
          <ChevronLeft size={22} color={COLORS.fg} />
        </Pressable>
        <Text className="text-[16px] font-extrabold text-fg flex-1">Learn</Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: insets.bottom + 24, gap: 12 }}
      >
        <Text className="text-muted text-[12px]">
          Patient-education articles from Physiobuddies — useful to read, and to share with patients.
        </Text>

        {isLoading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={190} radius={16} />
            <Skeleton height={190} radius={16} />
          </View>
        ) : isError ? (
          <ErrorState
            icon={TriangleAlert}
            title="Couldn't load articles"
            badge="Error"
            description="We couldn't reach the server. This is usually temporary."
            action={{ label: "Try again", onPress: () => refetch() }}
          />
        ) : posts.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nothing published yet"
            description="Physiobuddies hasn't published any patient-education articles yet."
          />
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              // The object form, not a template literal: expo-router's typed routes only know
              // the static `[slug]` pattern, so an interpolated path fails typecheck.
              onPress={() => router.push({ pathname: "/learn/[slug]", params: { slug: post.slug } })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function PostCard({ post, onPress }: { post: BlogPost; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-[16px] overflow-hidden active:opacity-95"
      style={{ shadowColor: COLORS.nav, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 }}
    >
      {post.thumbnail && (
        <Image
          source={{ uri: post.thumbnail }}
          style={{ width: "100%", height: 130, backgroundColor: COLORS.primarySoft }}
          contentFit="cover"
          transition={150}
        />
      )}
      <View className="p-3.5" style={{ gap: 7 }}>
        <Text className="text-[15px] font-extrabold text-fg" numberOfLines={2}>
          {post.title}
        </Text>
        <Text className="text-muted text-[12px] leading-4" numberOfLines={2}>
          {post.summary}
        </Text>
        <View className="flex-row items-center flex-wrap" style={{ gap: 6 }}>
          {post.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="info" size="sm" dot={false}>
              {tag}
            </Badge>
          ))}
        </View>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {post.readTime ? (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <Clock3 size={11} color={COLORS.muted} />
              <Text className="text-muted text-[11px]">{post.readTime}</Text>
            </View>
          ) : null}
          <View className="flex-row items-center" style={{ gap: 4 }}>
            <Eye size={11} color={COLORS.muted} />
            <Text className="text-muted text-[11px]">{post.views}</Text>
          </View>
          {post.dateLabel ? <Text className="text-muted text-[11px]">{post.dateLabel}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}
