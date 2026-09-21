import { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Keyboard,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Send, Heart, Reply } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
import { useKeyboard } from "@/hooks/useKeyboard";
import { KeyboardHugView } from "@/components/KeyboardHugView";
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
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
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
  const { user, accessToken } = useAuth();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { isKeyboardVisible } = useKeyboard();
  const flatListRef = useRef<FlatList>(null);

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
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
    <View style={{ flex: 1, backgroundColor: "#F7F4EF" }}>
      {/* Header (pinned to top) */}
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

      <KeyboardHugView
        style={{
          flex: 1,
          backgroundColor: "#F7F4EF",
        }}
        keyboardVerticalOffset={0}
      >
        {/* Post + Comments */}
        <KeyboardGestureArea style={{ flex: 1 }} interpolator="ios">
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
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
        renderItem={({ item }) => {
          const isOwn = item.author?.id === user?.id;
          const isCommentAlly = Boolean(item.author?.is_ally || isOwn);
          const authorHandle = isCommentAlly ? item.author?.username || "user" : "anonymous";
          const authorDisplayName = isCommentAlly ? (item.author?.full_name || `@${item.author?.username}`) : "Anonymous Peer";

          // Format content: convert '#' to '@' and highlight mentions
          const contentParts = item.content.split(/([@#][a-zA-Z0-9_-]+)/g);

          return (
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#F0EDE8",
              }}
            >
              <TouchableOpacity
                disabled={!isCommentAlly}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.author?.id && isCommentAlly) {
                    router.push({
                      pathname: "/pages/user-profile",
                      params: { userId: item.author.id },
                    } as any);
                  }
                }}
              >
                {isCommentAlly ? (
                  <UserAvatar avatar={item.author?.avatar_url} size="sm" />
                ) : (
                  <AnonymousAvatar avatarKey={item.author?.avatarKey || "fox"} size={32} />
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <TouchableOpacity
                    disabled={!isCommentAlly}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (item.author?.id && isCommentAlly) {
                        router.push({
                          pathname: "/pages/user-profile",
                          params: { userId: item.author.id },
                        } as any);
                      }
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                  >
                    <Text
                      style={{ fontSize: 13, fontWeight: "700", color: "#111827" }}
                    >
                      {isCommentAlly ? `@${authorHandle}` : authorDisplayName}
                    </Text>
                    {!isCommentAlly && (
                      <Text style={{ fontSize: 11, color: "#6B7280" }}>
                        @anonymous
                      </Text>
                    )}
                  </TouchableOpacity>

                  {isOwn && (
                    <View style={{ backgroundColor: "rgba(26, 107, 60, 0.1)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "800", color: "#1A6B3C" }}>You</Text>
                    </View>
                  )}
                  {!isOwn && isCommentAlly && (
                    <View style={{ backgroundColor: "#DCFCE7", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#15803D" }}>Ally</Text>
                    </View>
                  )}

                  <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                    {timeAgo(item.created_at)}
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: 14,
                    color: "#374151",
                    lineHeight: 20,
                    marginTop: 3,
                  }}
                >
                  {contentParts.map((part: string, pIdx: number) => {
                    if (part.startsWith("@") || part.startsWith("#")) {
                      const rawHandle = part.slice(1);
                      const isMentionKnownAlly = Boolean(
                        rawHandle.toLowerCase() === "anonymous" ||
                        comments.some((c) => c.author?.is_ally && c.author?.username?.toLowerCase() === rawHandle.toLowerCase()) ||
                        (user as any)?.username?.toLowerCase() === rawHandle.toLowerCase()
                      );
                      const displayMention = isMentionKnownAlly ? `@${rawHandle}` : "@anonymous";
                      return (
                        <Text key={pIdx} style={{ color: "#1A6B3C", fontWeight: "700" }}>
                          {displayMention}
                        </Text>
                      );
                    }
                    return <Text key={pIdx}>{part}</Text>;
                  })}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => toggleCommentLike(item)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                    hitSlop={6}
                    activeOpacity={0.7}
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
                          fontWeight: "600",
                        }}
                      >
                        {item.likes_count}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      const targetHandle = isCommentAlly ? authorHandle : "anonymous";
                      const tag = `@${targetHandle} `;
                      setCommentText((prev) => (prev.startsWith(tag) ? prev : `${tag}${prev}`));
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                    hitSlop={6}
                    activeOpacity={0.7}
                  >
                    <Reply size={13} color="#6B7280" />
                    <Text style={{ fontSize: 11, color: "#6B7280", fontWeight: "600" }}>
                      Reply
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 13, color: "#9CA3AF" }}>
              No comments yet. Be the first!
            </Text>
          </View>
        }
      />
      </KeyboardGestureArea>

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
          paddingBottom: isKeyboardVisible
            ? 8
            : Math.max(insets.bottom + 4, 12),
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
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submitting}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#1A6B3C",
              alignItems: "center",
              justifyContent: "center",
              opacity: !commentText.trim() || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={16} color="#FFFFFF" />
            )}
          </TouchableOpacity>
      </View>
      </KeyboardHugView>
    </View>
  );
}
