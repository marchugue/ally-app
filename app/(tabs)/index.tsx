import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Plus, Home, Users } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { PostCard } from "@/components/PostCard";
import { CreatePostSheet } from "@/components/CreatePostSheet";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { listFeed, likePost, unlikePost } from "@/lib/api/feed";
import { listAllies } from "@/lib/api/interaction";
import type { FeedPost } from "@/types/feed";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [allyUserIds, setAllyUserIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<"all" | "allies">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    try {
      const feedPromise = listFeed(accessToken);
      const alliesPromise = user?.id
        ? listAllies(user.id, accessToken).catch(() => ({ items: [] }))
        : Promise.resolve({ items: [] });

      const [feed, alliesRes] = await Promise.all([feedPromise, alliesPromise]);
      setPosts(feed);
      if (alliesRes?.items) {
        setAllyUserIds(new Set(alliesRes.items.map((item) => item.id)));
      }
    } catch (err) {
      console.warn("Failed to load feed data", err);
    }
  }, [user?.id, accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadData();
      setLoading(false);
    }
    init();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const toggleLike = useCallback(
    async (post: FeedPost) => {
      if (!accessToken) return;
      const wasLiked = post.liked_by_me;

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                liked_by_me: !wasLiked,
                likes_count: p.likes_count + (wasLiked ? -1 : 1),
              }
            : p
        )
      );

      try {
        const result = wasLiked
          ? await unlikePost(post.id, accessToken)
          : await likePost(post.id, accessToken);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, liked_by_me: result.liked, likes_count: result.likesCount }
              : p
          )
        );
      } catch {
        // Revert on error
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, liked_by_me: wasLiked, likes_count: post.likes_count }
              : p
          )
        );
      }
    },
    [accessToken]
  );

  const navigateToPost = useCallback((post: FeedPost) => {
    router.push({
      pathname: "/pages/media-preview" as any,
      params: {
        mediaUrls: post.media && post.media.length > 0 ? JSON.stringify(post.media) : "",
        initialIndex: "0",
        postId: post.id,
        caption: post.content || "",
        authorName: post.author?.full_name || `@${post.author?.username}`,
        authorAvatar: post.author?.avatar_url || "",
        likesCount: String(post.likes_count || 0),
        commentsCount: String(post.comments_count || 0),
        isLiked: post.liked_by_me ? "true" : "false",
        openComments: "true",
      },
    });
  }, []);

  // Filter posts based on selected tab
  const displayedPosts = activeFilter === "all"
    ? posts
    : posts.filter(
        (p) => p.author?.id === user?.id || (p.author?.id && allyUserIds.has(p.author.id))
      );

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <ResponsiveContainer backgroundColor="#F9FAFB">
      {/* ── Feed Header Bar: Ally-jis Label on Left & Filters on Right ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: insets.top > 0 ? insets.top + 8 : 12,
          paddingBottom: 10,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        {/* Left: Ally-jis Brand Title */}
        <Text
          style={{
            fontFamily: "Fraunces_700Bold",
            fontSize: 22,
            color: "#1A6B3C",
            letterSpacing: -0.5,
          }}
        >
          Ally-jis
        </Text>

        {/* Right: Feed Filter Segment Pills */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => setActiveFilter("all")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: activeFilter === "all" ? "#1A6B3C" : "#F3F4F6",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: activeFilter === "all" ? "#FFFFFF" : "#4B5563",
              }}
            >
              All Feed
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveFilter("allies")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: activeFilter === "allies" ? "#1A6B3C" : "#F3F4F6",
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: activeFilter === "allies" ? "#FFFFFF" : "#4B5563",
              }}
            >
              Allies
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={displayedPosts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          displayedPosts.length === 0 ? { flex: 1 } : { paddingBottom: 16 }
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onToggleLike={toggleLike}
            onComment={navigateToPost}
          />
        )}
        ListEmptyComponent={
          activeFilter === "allies" ? (
            <EmptyState
              icon={<Users size={28} color="#1A6B3C" />}
              title="No posts from allies yet"
              description="Connect with classmates to see their posts in your Allies feed."
              actionLabel="Find Allies"
              onAction={() => router.push("/(tabs)/chat" as any)}
            />
          ) : (
            <EmptyState
              icon={<Home size={28} color="#1A6B3C" />}
              title="Your feed is empty"
              description="Follow classmates and their posts will show up here."
              actionLabel="Create a post"
              onAction={() => setShowCreate(true)}
            />
          )
        }
      />

      {/* Floating Action Button */}
      <Pressable
        onPress={() => setShowCreate(true)}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: "#1A6B3C",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#1A6B3C",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        }}
        android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      >
        <Plus size={26} color="#FFFFFF" />
      </Pressable>

      <CreatePostSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onPostCreated={loadData}
      />
    </ResponsiveContainer>
  );
}