import { getAnonymousDisplayName, isAnonymousHandle } from "@/lib/anonymousHandle";
import React, { useState, useEffect } from "react";
import { View, Text, Pressable, TouchableOpacity, Image, Modal, Alert } from "react-native";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Link2,
  EyeOff,
  Flag,
  ChevronRight,
  ShieldAlert,
  Pencil,
} from "lucide-react-native";
import { resolveImageUri } from "./UserAvatar";
import { ClickableAvatar } from "./ClickableAvatar";
import { ReportModal } from "./ReportModal";
import { EditPostSheet } from "./EditPostSheet";
import { AnimatedHeart } from "./AnimatedHeart";
import { getPostAudienceMeta, normalizePostAudience } from "./PostAudienceCard";
import type { FeedPost } from "@/types/feed";
import { router } from "expo-router";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { followUser, unfollowUser } from "@/lib/api/follow";
import { deletePost } from "@/lib/api/feed";
import { reportUser } from "@/lib/api/moderation";

interface PostCardProps {
  post: FeedPost;
  onToggleLike: (post: FeedPost) => void;
  onComment?: (post: FeedPost) => void;
  onMore?: (post: FeedPost) => void;
  onDeletePost?: (postId: string) => void;
  onUpdatePost?: (updatedPost: FeedPost) => void;
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
  onUpdatePost,
  onPressAuthor,
  onToggleFollow,
}: PostCardProps) {
  const { user, accessToken } = useAuth();
  const { colors } = useTheme();
  const [currentPost, setCurrentPost] = useState<FeedPost>(post);
  const [isFollowing, setIsFollowing] = useState<boolean>(
    Boolean(post.author?.is_following)
  );
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    setCurrentPost(post);
  }, [post]);

  useEffect(() => {
    setIsFollowing(Boolean(currentPost.author?.is_following));
  }, [currentPost.author?.is_following]);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isContentExpanded, setIsContentExpanded] = useState(false);

  const handleReportSubmit = async (violationId: string, details?: string) => {
    if (!accessToken || !currentPost.author_id) return;
    await reportUser(currentPost.author_id, violationId, accessToken, {
      postId: currentPost.id,
      notes: details,
    });
  };

  const hasMedia = currentPost.media && currentPost.media.length > 0;
  const isOwnPost = user?.id === currentPost.author?.id;
  const isAlly = Boolean((currentPost.author?.is_ally && !currentPost.author?.is_unrevealed_match && currentPost.author?.username !== "anonymous") || isOwnPost);
  const isFlagged = Boolean(
    currentPost.is_flagged ||
    currentPost.is_restricted ||
    currentPost.content?.includes("<!--flagged") ||
    currentPost.content?.includes("<!--visibility:admin_and_user_only")
  );
  const isEdited = Boolean(currentPost.is_edited || currentPost.edited_at);

  const handleAuthorPress = () => {
    if (onPressAuthor && currentPost.author?.id) {
      onPressAuthor(currentPost.author.id);
    } else if (currentPost.author?.id) {
      router.push({
        pathname: "/pages/user-profile",
        params: {
          userId: currentPost.author.id,
          avatarKey: currentPost.author?.avatarKey || "",
          avatarUrl: currentPost.author?.avatar_url || "",
          authorName: isAlly ? (currentPost.author?.full_name || `@${currentPost.author?.username}`) : getAnonymousDisplayName(currentPost.author),
        },
      } as any);
    }
  };

  const handleToggleFollow = async () => {
    if (!accessToken || !currentPost.author?.id || followLoading) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    if (onToggleFollow) {
      onToggleFollow(currentPost.author.id, nextState);
    }
    try {
      setFollowLoading(true);
      if (nextState) {
        await followUser(currentPost.author.id, accessToken);
      } else {
        await unfollowUser(currentPost.author.id, accessToken);
      }
    } catch (err) {
      console.warn("Failed to update follow state", err);
      setIsFollowing(!nextState);
      if (onToggleFollow) {
        onToggleFollow(currentPost.author.id, !nextState);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || deleting) return;
    try {
      setDeleting(true);
      await deletePost(currentPost.id, accessToken);
      setOptionsVisible(false);
      onDeletePost?.(currentPost.id);
    } catch (err) {
      console.warn("Failed to delete post", err);
      Alert.alert("Error", "Could not delete post. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenSettings = () => {
    if (onMore) {
      onMore(currentPost);
    } else {
      setOptionsVisible(true);
    }
  };

  const handleMediaPress = (index: number = 0, openComments: boolean = false) => {
    router.push({
      pathname: "/pages/media-preview" as any,
      params: {
        mediaUrls: currentPost.media && currentPost.media.length > 0 ? JSON.stringify(currentPost.media) : "",
        initialIndex: String(index),
        postId: currentPost.id,
        caption: currentPost.content || "",
        authorName: isAlly ? (currentPost.author.full_name || `@${currentPost.author.username}`) : getAnonymousDisplayName(currentPost.author),
        authorUsername: isAlly ? (currentPost.author.username || "") : "anonymous",
        authorAvatar: isAlly ? (currentPost.author.avatar_url || "") : "",
        avatarKey: currentPost.author?.avatarKey || "",
        authorId: currentPost.author.id,
        isAlly: isAlly ? "true" : "false",
        createdAt: currentPost.created_at || "",
        isEdited: isEdited ? "true" : "false",
        likesCount: String(currentPost.likes_count || 0),
        commentsCount: String(currentPost.comments_count || 0),
        isLiked: currentPost.liked_by_me ? "true" : "false",
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
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      {/* Moderation Warning / Restricted Visibility Banner */}
      {isFlagged && (
        <View
          style={{
            marginHorizontal: 16,
            marginTop: 12,
            marginBottom: 2,
            padding: 12,
            borderRadius: 12,
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(245, 158, 11, 0.3)",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <ShieldAlert size={16} color="#D97706" style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#D97706" }}>
              Flagged Content (Restricted Visibility)
            </Text>
            <Text style={{ fontSize: 11, color: "#92400E", marginTop: 2, lineHeight: 15 }}>
              This post received an administrative warning. Its visibility is restricted to you and administrators.
            </Text>
          </View>
        </View>
      )}

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
          <ClickableAvatar
            userId={currentPost.author?.id}
            avatarUrl={currentPost.author?.avatar_url}
            avatarKey={currentPost.author?.avatarKey}
            revealed={isAlly}
            size={40}
            onPress={onPressAuthor}
          />

          <View style={{ flex: 1 }}>
            <Text
              style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}
              numberOfLines={1}
            >
              {isAlly
                ? (currentPost.author?.full_name || `@${currentPost.author?.username}`)
                : getAnonymousDisplayName(currentPost.author)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {isAlly && currentPost.author?.username ? `@${currentPost.author.username} · ` : ""}
                {timeAgo(currentPost.created_at)}
                {isEdited ? " · edited" : ""}
                {" ·"}
              </Text>
              {(() => {
                const AudIcon = getPostAudienceMeta(normalizePostAudience(currentPost.audience)).Icon;
                return <AudIcon size={11} color={colors.textMuted} />;
              })()}
            </View>
          </View>
        </Pressable>

        {/* Follow / Following Button next to author name on right side */}
        {!isOwnPost && isAlly && currentPost.author?.id ? (
          <TouchableOpacity
            onPress={handleToggleFollow}
            disabled={followLoading}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 4.5,
              borderRadius: 14,
              backgroundColor: isFollowing
                ? colors.surfaceMuted
                : colors.primarySoft,
              borderWidth: 1,
              borderColor: isFollowing
                ? colors.border
                : colors.primaryBorder,
              marginRight: 2,
              opacity: followLoading ? 0.6 : 1,
            }}
            hitSlop={6}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: isFollowing ? "600" : "700",
                color: isFollowing ? colors.textSecondary : colors.primary,
              }}
            >
              {isFollowing ? "Following" : "+ Follow"}
            </Text>
          </TouchableOpacity>
        ) : null}

        {/* Three dots Settings button (Always on right side) */}
        <Pressable onPress={handleOpenSettings} hitSlop={10} style={{ padding: 4 }}>
          <MoreHorizontal size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {/* Content */}
      {currentPost.content ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: hasMedia ? 10 : 8 }}>
          <Pressable onPress={handlePostDetailPress}>
            <Text
              style={{
                fontSize: currentPost.content === "This message was removed" ? 14 : 15,
                color: currentPost.content === "This message was removed" ? colors.textMuted : colors.textPrimary,
                fontStyle: currentPost.content === "This message was removed" ? "italic" : "normal",
                lineHeight: 22,
              }}
              numberOfLines={isContentExpanded ? undefined : 1}
            >
              {currentPost.content}
            </Text>
          </Pressable>

          {currentPost.content.length > 40 && currentPost.content !== "This message was removed" && (
            <Pressable
              onPress={() => setIsContentExpanded(!isContentExpanded)}
              hitSlop={6}
              style={{ marginTop: 4, alignSelf: "flex-start" }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: colors.primary,
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
          {currentPost.media.length === 1 ? (
            (() => {
              const item = currentPost.media[0];
              if (item === "[removed]") {
                return (
                  <View
                    style={{
                      width: "100%",
                      padding: 24,
                      borderRadius: 14,
                      backgroundColor: colors.surfaceMuted,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textMuted,
                        fontWeight: "500",
                        textAlign: "center",
                        lineHeight: 18,
                      }}
                    >
                      This photo was removed for violating community standards.
                    </Text>
                  </View>
                );
              }
              const uri = resolveImageUri(item);
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
              {currentPost.media.slice(0, 4).map((url, idx) => {
                if (url === "[removed]") {
                  return (
                    <View
                      key={idx}
                      style={{
                        width: "48%",
                        height: 140,
                        borderRadius: 10,
                        backgroundColor: colors.surfaceMuted,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 12,
                        flexGrow: 1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          color: colors.textMuted,
                          fontWeight: "500",
                          textAlign: "center",
                          lineHeight: 15,
                        }}
                      >
                        This photo was removed for violating community standards.
                      </Text>
                    </View>
                  );
                }
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
          onPress={() => onToggleLike(currentPost)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
          hitSlop={6}
        >
          <AnimatedHeart
            isLiked={Boolean(currentPost.liked_by_me)}
            size={18}
            activeColor={colors.primary}
            inactiveColor={colors.textSecondary}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "500",
              color: currentPost.liked_by_me ? colors.primary : colors.textSecondary,
            }}
          >
            {currentPost.likes_count > 0 ? currentPost.likes_count : ""}
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
          <MessageCircle size={18} color={colors.textSecondary} />
          <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textSecondary }}>
            {currentPost.comments_count > 0 ? currentPost.comments_count : ""}
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
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setOptionsVisible(false)}
        >
          <Pressable
            style={{
              marginTop: "auto",
              backgroundColor: colors.surface,
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
                backgroundColor: colors.border,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.textPrimary,
                marginBottom: 12,
                textAlign: "center",
              }}
            >
              Post Settings
            </Text>

            {isOwnPost ? (
              <>
                <Pressable
                  onPress={() => {
                    setOptionsVisible(false);
                    setEditVisible(true);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Pencil size={18} color={colors.textPrimary} />
                    <Text style={{ fontSize: 15, fontWeight: "500", color: colors.textPrimary }}>
                      Edit post
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>

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
        previewText={currentPost.content || (hasMedia ? "[Image post]" : "")}
      />

      {/* Edit Post Sheet */}
      <EditPostSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        post={currentPost}
        onPostUpdated={(updated) => {
          setCurrentPost(updated);
          onUpdatePost?.(updated);
        }}
      />
    </View>
  );
}
