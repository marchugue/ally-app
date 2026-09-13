import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Image, Modal, Alert } from "react-native";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Bookmark,
  Link2,
  EyeOff,
  Flag,
  ChevronRight,
} from "lucide-react-native";
import { UserAvatar, resolveImageUri } from "./UserAvatar";
import { ReportModal } from "./ReportModal";
import type { FeedPost } from "@/types/feed";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth/AuthContext";
import { followUser, unfollowUser } from "@/lib/api/follow";
import { deletePost } from "@/lib/api/feed";
import { reportUser } from "@/lib/api/moderation";

interface PostCardProps {
  post: FeedPost;
  onToggleLike: (post: FeedPost) => void;
  onComment?: (post: FeedPost) => void;
  onMore?: (post: FeedPost) => void;
  onDeletePost?: (postId: string) => void;
  onPressAuthor?: (authorId: string) => void;
  onToggleFollow?: (authorId: string, isFollowing: boolean) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w`;
}

export function PostCard({
  post,
  onToggleLike,
  onComment,
  onMore,
  onDeletePost,
  onPressAuthor,
  onToggleFollow,
}: PostCardProps) {
  const { user, accessToken } = useAuth();
  const [isFollowing, setIsFollowing] = useState<boolean>(
    Boolean(post.author?.is_following)
  );
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    setIsFollowing(Boolean(post.author?.is_following));
  }, [post.author?.is_following]);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  const handleReportSubmit = async (reason: string, details?: string) => {
    if (!accessToken || !post.author_id) return;
    const fullReason = details ? `${reason} - ${details}` : reason;
    await reportUser(post.author_id, fullReason, accessToken);
  };

  const hasMedia = post.media && post.media.length > 0;
  const isOwnPost = user?.id === post.author?.id;

  const handleAuthorPress = () => {
    if (onPressAuthor) {
      onPressAuthor(post.author.id);
    } else if (post.author?.id) {
      router.push({
        pathname: "/pages/user-profile",
        params: { userId: post.author.id },
      } as any);
    }
  };

  const handleToggleFollow = async () => {
    if (!accessToken || !post.author?.id || followLoading) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    if (onToggleFollow) {
      onToggleFollow(post.author.id, nextState);
    }
    try {
      setFollowLoading(true);
      if (nextState) {
        await followUser(post.author.id, accessToken);
      } else {
        await unfollowUser(post.author.id, accessToken);
      }
    } catch (err) {
      console.warn("Failed to update follow state", err);
      setIsFollowing(!nextState);
      if (onToggleFollow) {
        onToggleFollow(post.author.id, !nextState);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || deleting) return;
    try {
      setDeleting(true);
      await deletePost(post.id, accessToken);
      setOptionsVisible(false);
      onDeletePost?.(post.id);
    } catch (err) {
      console.warn("Failed to delete post", err);
      Alert.alert("Error", "Could not delete post. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenSettings = () => {
    if (onMore) {
      onMore(post);
    } else {
      setOptionsVisible(true);
    }
  };

  const handleMediaPress = (index: number = 0, openComments: boolean = false) => {
    router.push({
      pathname: "/pages/media-preview" as any,
      params: {
        mediaUrls: post.media && post.media.length > 0 ? JSON.stringify(post.media) : "",
        initialIndex: String(index),
        postId: post.id,
        caption: post.content || "",
        authorName: post.author.full_name || `@${post.author.username}`,
        authorUsername: post.author.username || "",
        authorAvatar: post.author.avatar_url || "",
        createdAt: post.created_at || "",
        likesCount: String(post.likes_count || 0),
        commentsCount: String(post.comments_count || 0),
        isLiked: post.liked_by_me ? "true" : "false",
        openComments: openComments ? "true" : "false",
      },
    });
  };

  const handlePostDetailPress = () => {
    handleMediaPress(0, false);
  };

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E2DED7",
      }}
    >
      {/* Author header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 10,
          gap: 10,
        }}
      >
        <Pressable
          onPress={handleAuthorPress}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
        >
          <UserAvatar avatar={post.author.avatar_url} size="md" />

          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}
              numberOfLines={1}
            >
              {post.author.full_name || `@${post.author.username}`}
            </Text>
            <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
              @{post.author.username} · {timeAgo(post.created_at)}
            </Text>
          </View>
        </Pressable>

        {/* Follow / Following Button next to author name on right side */}
        {!isOwnPost && post.author?.id ? (
          <Pressable
            onPress={handleToggleFollow}
            disabled={followLoading}
            style={({ pressed }) => ({
              paddingHorizontal: 11,
              paddingVertical: 4.5,
              borderRadius: 14,
              backgroundColor: isFollowing
                ? "#F3F4F6"
                : "rgba(26, 107, 60, 0.08)",
              borderWidth: 1,
              borderColor: isFollowing
                ? "#E5E7EB"
                : "rgba(26, 107, 60, 0.25)",
              marginRight: 2,
              opacity: followLoading ? 0.6 : pressed ? 0.75 : 1,
            })}
            hitSlop={6}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: isFollowing ? "600" : "700",
                color: isFollowing ? "#6B7280" : "#1A6B3C",
              }}
            >
              {isFollowing ? "Following" : "+ Follow"}
            </Text>
          </Pressable>
        ) : null}

        {/* Three dots Settings button (Always on right side) */}
        <Pressable onPress={handleOpenSettings} hitSlop={10} style={{ padding: 4 }}>
          <MoreHorizontal size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Content */}
      {post.content ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: hasMedia ? 10 : 8 }}>
          <Pressable onPress={handlePostDetailPress}>
            <Text
              style={{
                fontSize: 15,
                color: "#111827",
                lineHeight: 22,
              }}
              numberOfLines={isContentExpanded ? undefined : 1}
            >
              {post.content}
            </Text>
          </Pressable>

          {post.content.length > 40 && (
            <Pressable
              onPress={() => setIsContentExpanded(!isContentExpanded)}
              hitSlop={6}
              style={{ marginTop: 4, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: "#1A6B3C",
                }}
              >
                {isContentExpanded ? "Show less" : "...more"}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {/* Media grid */}
      {hasMedia && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {post.media.length === 1 ? (
            (() => {
              const uri = resolveImageUri(post.media[0]);
              return uri ? (
                <Pressable onPress={() => handleMediaPress(0)}>
                  <Image
                    source={{ uri }}
                    style={{
                      width: "100%",
                      height: 220,
                      borderRadius: 14,
                    }}
                    resizeMode="cover"
                  />
                </Pressable>
              ) : null;
            })()
          ) : (
            <View style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}>
              {post.media.slice(0, 4).map((url, idx) => {
                const uri = resolveImageUri(url);
                if (!uri) return null;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleMediaPress(idx)}
                    style={{
                      width: "48%",
                      height: 140,
                      borderRadius: 10,
                      flexGrow: 1,
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      source={{ uri }}
                      style={{
                        width: "100%",
                        height: "100%",
                      }}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Action row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 10,
          gap: 20,
        }}
      >
        <Pressable
          onPress={() => onToggleLike(post)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
          hitSlop={6}
        >
          <Heart
            size={18}
            color={post.liked_by_me ? "#1A6B3C" : "#9CA3AF"}
            fill={post.liked_by_me ? "#1A6B3C" : "none"}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: post.liked_by_me ? "#1A6B3C" : "#6B7280",
            }}
          >
            {post.likes_count > 0 ? post.likes_count : ""}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => handleMediaPress(0, true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
          hitSlop={6}
        >
          <MessageCircle size={18} color="#9CA3AF" />
          <Text style={{ fontSize: 13, fontWeight: "500", color: "#6B7280" }}>
            {post.comments_count > 0 ? post.comments_count : ""}
          </Text>
        </Pressable>
      </View>

      {/* Post Settings Modal */}
      <Modal
        visible={optionsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={() => setOptionsVisible(false)}
        >
          <Pressable
            style={{
              marginTop: "auto",
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 32,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Pill Indicator */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#E5E7EB",
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: "#111827",
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Post Settings
            </Text>

            {isOwnPost ? (
              <>
                <Pressable
                  onPress={handleDelete}
                  disabled={deleting}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Trash2 size={18} color="#DC2626" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#DC2626" }}>
                      {deleting ? "Deleting..." : "Delete post"}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>

                <Pressable
                  onPress={() => setOptionsVisible(false)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Bookmark size={18} color="#374151" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                      Save post
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>

                <Pressable
                  onPress={() => setOptionsVisible(false)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Link2 size={18} color="#374151" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                      Copy link
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => setOptionsVisible(false)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Bookmark size={18} color="#374151" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                      Save post
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>

                <Pressable
                  onPress={() => setOptionsVisible(false)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Link2 size={18} color="#374151" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                      Copy post link
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>

                <Pressable
                  onPress={() => setOptionsVisible(false)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <EyeOff size={18} color="#374151" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#374151" }}>
                      Hide post
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>

                <Pressable
                  onPress={() => {
                    setOptionsVisible(false);
                    setReportVisible(true);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Flag size={18} color="#DC2626" />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: "#DC2626" }}>
                      Report post
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Post Modal using Community Standards Taxonomy */}
      <ReportModal
        visible={reportVisible}
        onClose={() => setReportVisible(false)}
        onSubmitReport={handleReportSubmit}
        targetType="post"
      />
    </View>
  );
}
