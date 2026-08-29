import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { Plus, Home } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { PostCard } from "@/components/PostCard";
import { CreatePostSheet } from "@/components/CreatePostSheet";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { listFeed, likePost, unlikePost } from "@/lib/api/feed";
import type { FeedPost } from "@/types/feed";

export default function HomeScreen() {
  const { accessToken } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const loadFeed = useCallback(async () => {
    if (!accessToken) return;
    try {
      const feed = await listFeed(accessToken);
      setPosts(feed);
    } catch (err) {
      console.warn("Failed to load feed", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadFeed();
      setLoading(false);
    }
    init();
  }, [loadFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

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
      pathname: "/pages/post-detail" as any,
      params: { postId: post.id },
    });
  }, []);

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Home" subtitle="Latest from your campus" />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          posts.length === 0 ? { flex: 1 } : { paddingBottom: 80 }
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onToggleLike={toggleLike}
            onComment={navigateToPost}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Home size={28} color="#1A6B3C" />}
            title="Your feed is empty"
            description="Follow classmates and their posts will show up here."
            actionLabel="Create a post"
            onAction={() => setShowCreate(true)}
          />
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
        onPostCreated={loadFeed}
      />
    </View>
  );
}