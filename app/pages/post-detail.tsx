import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Send, Heart } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getPost,
  likePost,
  unlikePost,
  listComments,
  createComment,
  likeComment,
  unlikeComment,
} from "@/lib/api/feed";
import { PostCard } from "@/components/PostCard";
import { UserAvatar } from "@/components/UserAvatar";
import type { FeedPost, Comment } from "@/types/feed";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
}

export default function PostDetailScreen() {
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { accessToken } = useAuth();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!postId || !accessToken) return;
    try {
      const [p, c] = await Promise.all([
        getPost(postId, accessToken),
        listComments(postId, accessToken),
      ]);
      setPost(p);
      setComments(c);
    } catch (err) {
      console.warn("Failed to load post", err);
    }
  }, [postId, accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadData();
      setLoading(false);
    }
    init();
  }, [loadData]);

  const toggleLike = useCallback(
    async (p: FeedPost) => {
      if (!accessToken) return;
      const wasLiked = p.liked_by_me;
      setPost((prev) =>
        prev
          ? {
              ...prev,
              liked_by_me: !wasLiked,
              likes_count: prev.likes_count + (wasLiked ? -1 : 1),
            }
          : prev
      );
      try {
        const result = wasLiked
          ? await unlikePost(p.id, accessToken)
          : await likePost(p.id, accessToken);
        setPost((prev) =>
          prev
            ? { ...prev, liked_by_me: result.liked, likes_count: result.likesCount }
            : prev
        );
      } catch {
        setPost((prev) =>
          prev
            ? { ...prev, liked_by_me: wasLiked, likes_count: p.likes_count }
            : prev
        );
      }
    },
    [accessToken]
  );

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !postId || !accessToken || submitting) return;
    setSubmitting(true);
    try {
      const newComment = await createComment(
        postId,
        { content: commentText.trim() },
        accessToken
      );
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      setPost((prev) =>
        prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev
      );
    } catch (err) {
      console.warn("Failed to create comment", err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCommentLike = useCallback(
    async (comment: Comment) => {
      if (!accessToken) return;
      const wasLiked = comment.liked_by_me;
      setComments((prev) =>
        prev.map((c) =>
          c.id === comment.id
            ? {
                ...c,
                liked_by_me: !wasLiked,
                likes_count: c.likes_count + (wasLiked ? -1 : 1),
              }
            : c
        )
      );
      try {
        const result = wasLiked
          ? await unlikeComment(comment.id, accessToken)
          : await likeComment(comment.id, accessToken);
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? { ...c, liked_by_me: result.liked, likes_count: result.likesCount }
              : c
          )
        );
      } catch {
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? { ...c, liked_by_me: wasLiked, likes_count: comment.likes_count }
              : c
          )
        );
      }
    },
    [accessToken]
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  if (!post) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <Text style={{ color: "#6B7280" }}>Post not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F7F4EF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E2DED7",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
          Post
        </Text>
      </View>

      {/* Post + Comments */}
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListHeaderComponent={
          <View>
            <PostCard post={post} onToggleLike={toggleLike} />
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Comments ({comments.length})
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              gap: 10,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: "#F0EDE8",
            }}
          >
            <UserAvatar avatar={item.author.avatar_url} size="sm" />
            <View style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text
                  style={{ fontSize: 13, fontWeight: "600", color: "#111827" }}
                >
                  @{item.author.username}
                </Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {timeAgo(item.created_at)}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 14,
                  color: "#374151",
                  lineHeight: 20,
                  marginTop: 2,
                }}
              >
                {item.content}
              </Text>
              <Pressable
                onPress={() => toggleCommentLike(item)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                }}
                hitSlop={6}
              >
                <Heart
                  size={14}
                  color={item.liked_by_me ? "#1A6B3C" : "#9CA3AF"}
                  fill={item.liked_by_me ? "#1A6B3C" : "none"}
                />
                {item.likes_count > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: item.liked_by_me ? "#1A6B3C" : "#9CA3AF",
                    }}
                  >
                    {item.likes_count}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
              No comments yet. Be the first!
            </Text>
          </View>
        }
      />

      {/* Comment input */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: "#E2DED7",
          backgroundColor: "#FFFFFF",
          paddingBottom: insets.bottom + 8,
          gap: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#F7F4EF",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#E2DED7",
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment…"
            placeholderTextColor="#9CA3AF"
            multiline
            style={{
              fontSize: 14,
              color: "#111827",
              maxHeight: 80,
              lineHeight: 20,
            }}
          />
        </View>
        <Pressable
          onPress={handleSubmitComment}
          disabled={!commentText.trim() || submitting}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor:
              commentText.trim() && !submitting ? "#1A6B3C" : "#E2DED7",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send
              size={16}
              color={commentText.trim() ? "#FFFFFF" : "#9CA3AF"}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
