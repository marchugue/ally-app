import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Dimensions,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  Keyboard,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import {
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Heart,
  MessageCircle,
  Bookmark,
  Send,
  X,
  Flag,
  Share2,
  Trash2,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
import { useKeyboard } from "@/hooks/useKeyboard";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { resolveImageUri, UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  likePost,
  unlikePost,
  listComments,
  createComment,
  likeComment,
  unlikeComment,
  deletePost,
} from "@/lib/api/feed";
import { reportUser } from "@/lib/api/moderation";
import type { Comment } from "@/types/feed";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function MediaPreviewScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const {
    mediaUrls,
    mediaUrl,
    initialIndex,
    postId,
    caption,
    authorName,
    authorUsername,
    authorAvatar,
    createdAt,
    likesCount: rawLikes,
    commentsCount: rawComments,
    isLiked: rawLiked,
    openComments,
    commentId,
  } = useLocalSearchParams<{
    mediaUrls?: string;
    mediaUrl?: string;
    initialIndex?: string;
    postId?: string;
    caption?: string;
    authorName?: string;
    authorUsername?: string;
    authorAvatar?: string;
    createdAt?: string;
    likesCount?: string;
    commentsCount?: string;
    isLiked?: string;
    openComments?: string;
    /** commentId: when set from a comment_reply notification, auto-sets reply mode on this comment */
    commentId?: string;
  }>();

  const parsedUrls: string[] = useMemo(() => {
    const raw = mediaUrls || mediaUrl;
    if (!raw) return [];
    let list: any[] = [];
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      list = [raw];
    }
    return list
      .map((item) => resolveImageUri(item))
      .filter((uri): uri is string => Boolean(uri));
  }, [mediaUrls, mediaUrl]);

  const hasMedia = parsedUrls.length > 0;

  const displayTime = useMemo(() => {
    if (!createdAt) return "";
    const now = Date.now();
    const then = new Date(createdAt).getTime();
    if (isNaN(then)) return createdAt;
    const diffSec = Math.floor((now - then) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    const diffWeek = Math.floor(diffDay / 7);
    return `${diffWeek}w ago`;
  }, [createdAt]);

  const startIndex = useMemo(() => {
    const parsed = parseInt(initialIndex || "0", 10) || 0;
    return Math.max(0, Math.min(parsedUrls.length > 0 ? parsedUrls.length - 1 : 0, parsed));
  }, [initialIndex, parsedUrls.length]);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  useEffect(() => {
    setActiveIndex(startIndex);
  }, [startIndex]);

  // Like & Save state
  const [liked, setLiked] = useState(rawLiked === "true");
  const [likesCount, setLikesCount] = useState(parseInt(rawLikes || "0", 10) || 0);
  const [saved, setSaved] = useState(false);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<Comment | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const { isKeyboardVisible } = useKeyboard();

  const fetchComments = useCallback(async (): Promise<Comment[]> => {
    if (!postId || !accessToken) return [];
    try {
      setCommentsLoading(true);
      const data: any = await listComments(postId, accessToken);
      const flattened: Comment[] = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          flattened.push(item);
          if (item.replies && Array.isArray(item.replies)) {
            for (const reply of item.replies) {
              flattened.push(reply);
            }
          }
        }
      }
      setComments(flattened);
      return flattened;
    } catch (err) {
      console.warn("Failed to load comments", err);
      return [];
    } finally {
      setCommentsLoading(false);
    }
  }, [postId, accessToken]);

  useEffect(() => {
    if (openComments === "true") {
      setShowCommentModal(true);
      fetchComments().then((loadedComments) => {
        // Auto-set reply mode if commentId param is present
        if (commentId && loadedComments) {
          const target = loadedComments.find((c: any) => c.id === commentId);
          if (target) {
            setReplyingToComment(target);
          }
        }
      });
    }
  }, [openComments, fetchComments, commentId]);

  const handleOpenCommentModal = () => {
    setShowCommentModal(true);
    fetchComments();
  };

  const handleToggleCommentLike = async (commentItem: Comment) => {
    if (!accessToken) return;
    const wasLiked = commentItem.liked_by_me;
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentItem.id
          ? {
              ...c,
              liked_by_me: !wasLiked,
              likes_count: c.likes_count + (wasLiked ? -1 : 1),
            }
          : c
      )
    );

    try {
      if (wasLiked) {
        await unlikeComment(commentItem.id, accessToken);
      } else {
        await likeComment(commentItem.id, accessToken);
      }
    } catch {
      setComments((prev) =>
        prev.map((c) => (c.id === commentItem.id ? commentItem : c))
      );
    }
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || !postId || !accessToken || submittingComment) return;
    const text = commentInput.trim();
    setSubmittingComment(true);
    try {
      await createComment(
        postId,
        {
          content: text,
          parentCommentId: replyingToComment ? replyingToComment.id : undefined,
        },
        accessToken
      );
      setCommentInput("");
      setReplyingToComment(null);
      await fetchComments();
    } catch (err) {
      console.warn("Failed to send comment", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const flatListRef = useRef<FlatList>(null);
  const thumbnailListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (activeIndex < parsedUrls.length - 1) {
      const next = activeIndex + 1;
      setActiveIndex(next);
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      try {
        thumbnailListRef.current?.scrollToIndex({ index: next, animated: true, viewPosition: 0.5 });
      } catch {}
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      const prev = activeIndex - 1;
      setActiveIndex(prev);
      flatListRef.current?.scrollToIndex({ index: prev, animated: true });
      try {
        thumbnailListRef.current?.scrollToIndex({ index: prev, animated: true, viewPosition: 0.5 });
      } catch {}
    }
  };

  const handleSelectThumbnail = (index: number) => {
    setActiveIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
    try {
      thumbnailListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } catch {}
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    if (index >= 0 && index < parsedUrls.length && index !== activeIndex) {
      setActiveIndex(index);
      try {
        thumbnailListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } catch {}
    }
  };

  const handleToggleLike = async () => {
    if (!postId || !accessToken) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((prev) => prev + (wasLiked ? -1 : 1));

    try {
      if (wasLiked) {
        await unlikePost(postId, accessToken);
      } else {
        await likePost(postId, accessToken);
      }
    } catch {
      setLiked(wasLiked);
      setLikesCount((prev) => prev + (wasLiked ? 1 : -1));
    }
  };

  const handleToggleSave = () => {
    setSaved(!saved);
    Alert.alert(saved ? "Unsaved" : "Saved", saved ? "Post removed from saves." : "Post saved to your collection.");
  };

  return (
    <View style={styles.container}>
      {/* ── Background Media Viewer / Text Content Slide ────────────────────── */}
      {parsedUrls.length > 0 ? (
        <FlatList
          ref={flatListRef}
          data={parsedUrls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex >= parsedUrls.length ? 0 : startIndex}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
            }, 100);
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyExtractor={(url, index) => `${url}-${index}`}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <Image source={{ uri: item }} style={styles.fullImage} resizeMode="contain" />
            </View>
          )}
        />
      ) : (
        <View style={styles.textOnlySlide}>
          {caption ? (
            <Text style={styles.textOnlyContent}>{caption}</Text>
          ) : null}
        </View>
      )}

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 16) }]}>
        {/* Upper Left: Back Button */}
        <Pressable onPress={() => router.back()} style={styles.iconCircle} hitSlop={10}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>

        {/* Slide Counter in Center */}
        {parsedUrls.length > 1 && (
          <View style={styles.counterBadge}>
            <Text style={styles.counterText}>
              {activeIndex + 1} / {parsedUrls.length}
            </Text>
          </View>
        )}

        {/* Upper Right: Three Dot Post Settings */}
        {postId ? (
          <Pressable
            onPress={() => setShowSettingsModal(true)}
            style={styles.iconCircle}
            hitSlop={10}
          >
            <MoreVertical size={20} color="#FFFFFF" />
          </Pressable>
        ) : (
          <View style={{ width: 38 }} />
        )}
      </View>

      {/* ── Center Right Floating Action Bar ─────────────────────────────── */}
      {postId && (
        <View style={styles.centerRightActions}>
          {/* Like */}
          <Pressable onPress={handleToggleLike} style={styles.actionBtn} hitSlop={8}>
            <View style={styles.actionIconWrapper}>
              <Heart
                size={28}
                color={liked ? "#EF4444" : "#FFFFFF"}
                fill={liked ? "#EF4444" : "#FFFFFF"}
              />
            </View>
            <Text style={styles.actionLabel}>{likesCount > 0 ? likesCount : "Like"}</Text>
          </Pressable>

          {/* Comment */}
          <Pressable onPress={handleOpenCommentModal} style={styles.actionBtn} hitSlop={8}>
            <View style={styles.actionIconWrapper}>
              <MessageCircle
                size={28}
                color="#FFFFFF"
                fill="#FFFFFF"
              />
            </View>
            <Text style={styles.actionLabel}>
              {comments.length > 0 ? comments.length : rawComments || "Comment"}
            </Text>
          </Pressable>

          {/* Save */}
          <Pressable onPress={handleToggleSave} style={styles.actionBtn} hitSlop={8}>
            <View style={styles.actionIconWrapper}>
              <Bookmark
                size={28}
                color={saved ? "#16A34A" : "#FFFFFF"}
                fill={saved ? "#16A34A" : "#FFFFFF"}
              />
            </View>
            <Text style={styles.actionLabel}>{saved ? "Saved" : "Save"}</Text>
          </Pressable>
        </View>
      )}

      {/* ── Left / Right Navigation Buttons (UI Arrow Symbols) ─────── */}
      {parsedUrls.length > 1 && (
        <>
          <Pressable
            disabled={activeIndex === 0}
            onPress={handlePrev}
            style={[
              styles.navArrowBtn,
              styles.navArrowLeft,
              activeIndex === 0 && { opacity: 0.35 },
            ]}
            hitSlop={12}
          >
            <ChevronLeft size={28} color="#FFFFFF" />
          </Pressable>

          <Pressable
            disabled={activeIndex === parsedUrls.length - 1}
            onPress={handleNext}
            style={[
              styles.navArrowBtn,
              styles.navArrowRight,
              activeIndex === parsedUrls.length - 1 && { opacity: 0.35 },
            ]}
            hitSlop={12}
          >
            <ChevronRight size={28} color="#FFFFFF" />
          </Pressable>
        </>
      )}

      {/* ── Bottom Details Overlay (Thumbnail Carousel, Avatar, Caption) ── */}
      <View
        style={[
          styles.bottomOverlay,
          !postId && { right: 16 },
          { paddingBottom: Math.max(insets.bottom + 16, 24) },
        ]}
      >
        {/* Bottom Thumbnail Carousel Strip */}
        {parsedUrls.length > 1 && (
          <View style={styles.thumbnailCarouselContainer}>
            <FlatList
              ref={thumbnailListRef}
              data={parsedUrls}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, idx) => `thumb-${idx}`}
              contentContainerStyle={styles.thumbnailListContent}
              onScrollToIndexFailed={(info) => {
                setTimeout(() => {
                  thumbnailListRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.5 });
                }, 100);
              }}
              renderItem={({ item, index }) => {
                const isSelected = index === activeIndex;
                return (
                  <Pressable
                    onPress={() => handleSelectThumbnail(index)}
                    style={[
                      styles.thumbnailWrapper,
                      isSelected && styles.thumbnailWrapperActive,
                    ]}
                  >
                    <Image
                      source={{ uri: item }}
                      style={styles.thumbnailImage}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        <View style={styles.bottomAuthorRow}>
          <UserAvatar avatar={authorAvatar} size="sm" />
          <Text style={styles.bottomUsernameText} numberOfLines={1}>
            {authorUsername ? `@${authorUsername}` : authorName || "user"}
          </Text>
          {displayTime ? (
            <Text style={styles.bottomTimeText}>· {displayTime}</Text>
          ) : null}
        </View>

        {caption ? (
          <View style={styles.captionContainer}>
            <ScrollView
              nestedScrollEnabled
              scrollEnabled={isCaptionExpanded}
              style={[
                styles.captionScrollView,
                isCaptionExpanded && styles.captionScrollViewExpanded,
              ]}
              showsVerticalScrollIndicator={false}
            >
              <Pressable onPress={() => setIsCaptionExpanded(!isCaptionExpanded)}>
                <Text
                  style={styles.bottomCaptionText}
                  numberOfLines={isCaptionExpanded ? undefined : 2}
                >
                  {caption}
                </Text>
              </Pressable>
            </ScrollView>
            {caption.length > 70 && (
              <Pressable
                onPress={() => setIsCaptionExpanded(!isCaptionExpanded)}
                hitSlop={8}
                style={styles.moreBtn}
              >
                <Text style={styles.moreBtnText}>
                  {isCaptionExpanded ? "less" : "...more"}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>

      {/* ── 1. Post Settings Modal (Bottom Sheet UI) ────────────────────────── */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSettingsModal(false)}
        >
          <Pressable style={styles.bottomSheetContainer} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pillHandle} />
            <Text style={styles.sheetTitle}>Post Settings</Text>

            <Pressable
              onPress={handleToggleSave}
              style={styles.sheetRow}
            >
              <View style={styles.sheetRowLeft}>
                <Bookmark size={20} color={saved ? "#1A6B3C" : "#374151"} />
                <Text style={styles.sheetRowText}>
                  {saved ? "Remove from Saved" : "Save Post"}
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                setShowSettingsModal(false);
                Alert.alert("Report", "Thank you. We will review this post.");
              }}
              style={styles.sheetRow}
            >
              <View style={styles.sheetRowLeft}>
                <Flag size={20} color="#EF4444" />
                <Text style={[styles.sheetRowText, { color: "#EF4444" }]}>
                  Report Post
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setShowSettingsModal(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 2. Comment Modal (Same UI as Post Settings, with Height) ────────── */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
        statusBarTranslucent
      >
        <KeyboardHugView style={{ flex: 1 }}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowCommentModal(false)}
          >
            <Pressable
              style={[
                styles.bottomSheetContainer,
                styles.commentModalContainer,
                {
                  paddingBottom: isKeyboardVisible
                    ? (Platform.OS === "ios" ? 12 : 10)
                    : Math.max(insets.bottom + 8, 16),
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Drag Pill Handle */}
              <View style={styles.pillHandle} />

              {/* Comment Sheet Header */}
              <View style={styles.commentHeader}>
                <Text style={styles.sheetTitle}>
                  Comments ({comments.length})
                </Text>
                <Pressable
                  onPress={() => setShowCommentModal(false)}
                  hitSlop={10}
                  style={styles.commentCloseBtn}
                >
                  <X size={18} color="#6B7280" />
                </Pressable>
              </View>

              {/* Comments List */}
              {commentsLoading ? (
                <View style={styles.commentsLoader}>
                  <ActivityIndicator color="#1A6B3C" size="small" />
                </View>
              ) : (
                <KeyboardGestureArea style={{ flex: 1 }} interpolator="ios">
                  <FlatList
                    data={comments}
                    keyExtractor={(item, idx) => `${item.id}-${idx}`}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerStyle={styles.commentsListContent}
                    renderItem={({ item }) => {
                      const isReply = Boolean(item.parent_comment_id);
                      return (
                        <View
                          style={[
                            styles.commentItem,
                            isReply && styles.commentItemReply,
                          ]}
                        >
                          <UserAvatar avatar={item.author?.avatar_url} size="sm" />
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={styles.commentAuthor}>
                                @{item.author?.username || "User"}
                              </Text>
                              {isReply && (
                                <Text style={styles.replyBadgeText}>· reply</Text>
                              )}
                            </View>
                            <Text style={styles.commentBody}>{item.content}</Text>

                            {/* Comment Actions: Like & Reply */}
                            <View style={styles.commentActionRow}>
                              <Pressable
                                onPress={() => handleToggleCommentLike(item)}
                                style={styles.commentActionBtn}
                                hitSlop={6}
                              >
                                <Heart
                                  size={13}
                                  color={item.liked_by_me ? "#EF4444" : "#9CA3AF"}
                                  fill={item.liked_by_me ? "#EF4444" : "none"}
                                />
                                <Text
                                  style={[
                                    styles.commentActionText,
                                    item.liked_by_me && { color: "#EF4444", fontWeight: "700" },
                                  ]}
                                >
                                  {item.likes_count > 0 ? item.likes_count : "Like"}
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => setReplyingToComment(item)}
                                style={styles.commentActionBtn}
                                hitSlop={6}
                              >
                                <Text style={styles.commentActionText}>Reply</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    }}
                    ListEmptyComponent={
                      <Text style={styles.emptyCommentsText}>
                        No comments yet. Be the first to comment!
                      </Text>
                    }
                  />
                </KeyboardGestureArea>
              )}

              {/* Replying Banner */}
              {replyingToComment && (
                <View style={styles.replyBanner}>
                  <Text style={styles.replyBannerText} numberOfLines={1}>
                    Replying to{" "}
                    <Text style={{ fontWeight: "700", color: "#1A6B3C" }}>
                      @{replyingToComment.author?.username}
                    </Text>
                  </Text>
                  <Pressable
                    onPress={() => setReplyingToComment(null)}
                    hitSlop={8}
                  >
                    <X size={14} color="#6B7280" />
                  </Pressable>
                </View>
              )}

              {/* Comment Input Box */}
              <View style={styles.commentInputRow}>
                <TextInput
                  value={commentInput}
                  onChangeText={setCommentInput}
                  placeholder={
                    replyingToComment
                      ? `Reply to @${replyingToComment.author?.username}...`
                      : "Add a comment..."
                  }
                  placeholderTextColor="#9CA3AF"
                  style={styles.commentTextInput}
                  multiline
                />
                <Pressable
                  onPress={handleSendComment}
                  disabled={!commentInput.trim() || submittingComment}
                  style={[
                    styles.sendBtn,
                    (!commentInput.trim() || submittingComment) && styles.sendBtnDisabled,
                  ]}
                >
                  {submittingComment ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Send size={16} color="#FFFFFF" />
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardHugView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  textOnlySlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  textOnlyContent: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 28,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 15,
    textAlign: "center",
    marginTop: 100,
  },

  /* ── Top Bar ──────────────────────────────────────────────────────────── */
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  counterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  counterText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* ── Bottom Overlay Details ────────────────────────────────────────── */
  bottomOverlay: {
    position: "absolute",
    left: 16,
    right: 80,
    bottom: 0,
    zIndex: 40,
    gap: 6,
  },
  bottomAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bottomUsernameText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomTimeText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.75)",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomCaptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255, 255, 255, 0.95)",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionContainer: {
    gap: 2,
  },
  captionScrollView: {
    maxHeight: 44,
  },
  captionScrollViewExpanded: {
    maxHeight: 220,
  },
  moreBtn: {
    alignSelf: "flex-start",
    marginTop: 2,
  },
  moreBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F3F4F6",
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* ── Center Right Actions ────────────────────────────────────────────── */
  centerRightActions: {
    position: "absolute",
    right: 16,
    top: "38%",
    transform: [{ translateY: 250 }],
    zIndex: 40,
    alignItems: "center",
    gap: 18,
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
  },
  actionIconWrapper: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ── Bottom Sheet Modals (Settings & Comments) ───────────────────────── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  pillHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
  },
  sheetRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  sheetRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },

  /* ── Comment Modal Height & Subviews ─────────────────────────────────── */
  commentModalContainer: {
    height: SCREEN_HEIGHT * 0.65,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 12,
  },
  commentCloseBtn: {
    position: "absolute",
    right: 0,
    padding: 4,
  },
  commentsLoader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  commentsListContent: {
    paddingVertical: 8,
    gap: 14,
  },
  commentItem: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  commentItemReply: {
    marginLeft: 32,
    borderLeftWidth: 2,
    borderLeftColor: "#E5E7EB",
    paddingLeft: 8,
  },
  replyBadgeText: {
    fontSize: 11,
    color: "#1A6B3C",
    fontWeight: "600",
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  commentBody: {
    fontSize: 13.5,
    color: "#374151",
    marginTop: 2,
    lineHeight: 18,
  },
  commentActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 6,
  },
  commentActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentActionText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  replyBannerText: {
    fontSize: 12,
    color: "#374151",
    flex: 1,
  },
  emptyCommentsText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
    marginVertical: 30,
  },
  commentInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    marginTop: "auto",
  },
  commentTextInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: "#111827",
    maxHeight: 80,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A6B3C",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#9CA3AF",
  },
  navArrowBtn: {
    position: "absolute",
    top: "50%",
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
  },
  navArrowLeft: {
    left: 14,
  },
  navArrowRight: {
    right: 14,
  },
  thumbnailCarouselContainer: {
    marginBottom: 12,
    width: "100%",
  },
  thumbnailListContent: {
    gap: 10,
    paddingHorizontal: 2,
    alignItems: "center",
  },
  thumbnailWrapper: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.35)",
    opacity: 0.6,
  },
  thumbnailWrapperActive: {
    borderColor: "#1A6B3C",
    borderWidth: 2.5,
    opacity: 1,
    transform: [{ scale: 1.08 }],
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
});
