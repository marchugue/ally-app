import { getAnonymousDisplayName } from "@/lib/anonymousHandle";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Building2,
  Flag,
  GraduationCap,
  Image as ImageIcon,
  Layers,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Shield,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react-native";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { ErrorAlertModal } from "@/components/ErrorAlertModal";
import { PostCard } from "@/components/PostCard";
import { ReportModal } from "@/components/ReportModal";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { isUrl, resolveImageUri, UserAvatar } from "@/components/UserAvatar";
import { getDeterministicAnonymousAvatar } from "@/constants/matchOptions";
import { usePresence } from "@/context/PresenceContext";
import { useTheme } from "@/context/ThemeContext";
import { createConversation } from "@/lib/api/conversation";
import { listFeedByUser, likePost, unlikePost } from "@/lib/api/feed";
import { removeAlly } from "@/lib/api/interaction";
import { reportUser } from "@/lib/api/moderation";
import {
  followUser,
  getProfileById,
  getProfileRelationship,
  unfollowUser,
  type ProfileRelationshipSummary,
} from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/AuthContext";
import { newsfeedCache } from "@/lib/newsfeedCache";
import type { FeedPost } from "@/types/feed";
import type { Profile } from "@/types/profile";

type ProfileTab = "feed" | "media" | "about";

export default function UserProfileScreen() {
  const {
    userId,
    avatarKey: paramAvatarKey,
    avatarUrl: paramAvatarUrl,
    authorName: paramAuthorName,
  } = useLocalSearchParams<{
    userId?: string;
    avatarKey?: string;
    avatarUrl?: string;
    authorName?: string;
  }>();
  const { user, accessToken } = useAuth();
  const { isOnline } = usePresence();
  const { colors, isDark } = useTheme();

  const viewedUserId = userId || user?.id || null;
  const isOwnProfile = !userId || userId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [relationship, setRelationship] =
    useState<ProfileRelationshipSummary | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>("feed");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [allyBusy, setAllyBusy] = useState(false);

  const [optionsVisible, setOptionsVisible] = useState(false);
  const [removeAllyConfirmVisible, setRemoveAllyConfirmVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [alertState, setAlertState] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const openRelationships = useCallback(
    (initialTab: "allies" | "following" | "followers") => {
      if (!viewedUserId) return;
      router.push({
        pathname: "/pages/relationships" as any,
        params: { userId: viewedUserId, initialTab },
      });
    },
    [viewedUserId]
  );

  const handleReportUser = async (violationId: string, details?: string) => {
    if (!viewedUserId || !accessToken) return;
    await reportUser(viewedUserId, violationId, accessToken, {
      notes: details,
    });
  };

  const loadData = useCallback(
    async (silent = false) => {
      if (!viewedUserId || !accessToken) {
        setLoading(false);
        return;
      }
      try {
        if (!silent) {
          setLoading(true);
          setLoadError(null);
        }

        const [profileData, relData, userPosts] = await Promise.all([
          getProfileById(viewedUserId, accessToken),
          getProfileRelationship(viewedUserId, accessToken).catch(() => null),
          listFeedByUser(viewedUserId, accessToken).catch(() => []),
        ]);

        setProfile(profileData);
        setRelationship(relData);
        setPosts(userPosts);
      } catch (err: any) {
        if (!silent) {
          setLoadError(err?.message || "Failed to load user profile.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [viewedUserId, accessToken]
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const handleToggleFollow = async () => {
    if (!viewedUserId || !accessToken || !relationship || followBusy) return;
    const prevFollowing = relationship.isFollowing;
    const prevFollowersCount = relationship.followersCount;
    const nextFollowing = !prevFollowing;

    setRelationship((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: nextFollowing,
            followersCount:
              prev.followersCount !== null
                ? Math.max(0, prev.followersCount + (nextFollowing ? 1 : -1))
                : null,
          }
        : null
    );

    try {
      setFollowBusy(true);
      if (nextFollowing) {
        await followUser(viewedUserId, accessToken);
      } else {
        await unfollowUser(viewedUserId, accessToken);
      }
    } catch (err: any) {
      setRelationship((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: prevFollowing,
              followersCount: prevFollowersCount,
            }
          : null
      );
      setAlertState({
        title: nextFollowing ? "Follow Failed" : "Unfollow Failed",
        message: err?.message || "Could not update follow status.",
      });
    } finally {
      setFollowBusy(false);
    }
  };

  const handleRemoveAlly = async () => {
    if (!viewedUserId || !accessToken || allyBusy) return;
    try {
      setAllyBusy(true);
      await removeAlly(viewedUserId, accessToken);
      setRemoveAllyConfirmVisible(false);
      setRelationship((prev) =>
        prev
          ? {
              ...prev,
              allyStatus: "none",
              alliesCount:
                prev.alliesCount !== null ? Math.max(0, prev.alliesCount - 1) : null,
            }
          : null
      );
      await loadData(true);
    } catch (err: any) {
      setRemoveAllyConfirmVisible(false);
      setAlertState({
        title: "Action Failed",
        message: err?.message || "Could not remove ally connection.",
      });
    } finally {
      setAllyBusy(false);
    }
  };

  const isUnrevealedMatch = Boolean(
    (profile as any)?.is_unrevealed_match ||
      (profile as any)?.isUnrevealedMatch
  );

  const isConfirmedAlly =
    isOwnProfile ||
    relationship?.allyStatus === "accepted" ||
    (relationship?.allyStatus as any) === "allies" ||
    Boolean((profile as any)?.is_ally);

  const isIdentityRevealed = isConfirmedAlly && !isUnrevealedMatch;

  const resolvedAvatarKey =
    (profile as any)?.avatarKey ||
    (profile as any)?.avatar_preset_id ||
    paramAvatarKey ||
    getDeterministicAnonymousAvatar(viewedUserId);

  const resolvedAvatarUrl = profile?.avatar_url || paramAvatarUrl || null;
  const normalizedAvatarUrl = resolveImageUri(resolvedAvatarUrl);
  const showPhotoFrame =
    isIdentityRevealed &&
    Boolean(normalizedAvatarUrl) &&
    isUrl(normalizedAvatarUrl);
  const showUserAvatar = isIdentityRevealed && Boolean(resolvedAvatarUrl);
  const maskedDisplayName = getAnonymousDisplayName(
    profile,
    paramAuthorName,
    viewedUserId
  );

  const displayName = isIdentityRevealed
    ? profile?.full_name ||
      (profile?.username ? `@${profile.username}` : "Student")
    : maskedDisplayName;

  const subtitleText = useMemo(() => {
    if (!profile) return "";
    const handle = isIdentityRevealed
      ? profile.username
        ? `@${profile.username}`
        : null
      : isUnrevealedMatch
        ? "@campus-ally"
        : "@anonymous";
    return [handle, profile.course, profile.year_level]
      .filter((part): part is string => Boolean(part && String(part).trim()))
      .join(" · ");
  }, [profile, isIdentityRevealed, isUnrevealedMatch]);

  // Public accounts show posts to everyone (identity stays anonymous unless allied);
  // private accounts only show posts to confirmed allies.
  const canViewPosts = isConfirmedAlly || !relationship?.isPrivate;

  const visibleStats = useMemo(() => {
    if (!relationship) return [];
    return [
      {
        key: "followers" as const,
        label: "Followers",
        count: relationship.followersCount,
        visible:
          relationship.visibility?.followers ??
          relationship.followersCount !== null,
      },
      {
        key: "following" as const,
        label: "Following",
        count: relationship.followingCount,
        visible:
          relationship.visibility?.following ??
          relationship.followingCount !== null,
      },
      {
        key: "allies" as const,
        label: "Allies",
        count: relationship.alliesCount,
        visible:
          relationship.visibility?.allies ?? relationship.alliesCount !== null,
      },
    ].filter((stat) => stat.visible && stat.count !== null);
  }, [relationship]);

  const showMutualAllies =
    Boolean(relationship?.visibility?.allies ?? true) &&
    (relationship?.mutualAlliesCount ?? 0) > 0;
  const showMutualFollowers =
    Boolean(relationship?.visibility?.followers ?? true) &&
    (relationship?.mutualFollowersCount ?? 0) > 0;

  const handleOpenChat = async () => {
    if (!viewedUserId || !accessToken || chatBusy) return;
    try {
      setChatBusy(true);
      const conversation = await createConversation(viewedUserId, accessToken);
      router.push({
        pathname: "/pages/conversation",
        params: {
          id: (conversation as any).id || (conversation as any).conversationId,
          conversationId:
            (conversation as any).conversationId || (conversation as any).id,
          prefillName: displayName,
          prefillAvatar: isIdentityRevealed
            ? resolvedAvatarUrl || ""
            : resolvedAvatarKey,
          prefillUserId: isIdentityRevealed ? viewedUserId : "",
          isAnonymous: isIdentityRevealed ? "false" : "true",
          name: displayName,
          avatar: isIdentityRevealed ? resolvedAvatarUrl || "" : "",
          avatarKey: resolvedAvatarKey,
          type: "direct",
        },
      } as any);
    } catch (err: any) {
      setAlertState({
        title: "Chat Unavailable",
        message: err?.message || "Could not start conversation.",
      });
    } finally {
      setChatBusy(false);
    }
  };

  const handleToggleLike = useCallback(
    async (post: FeedPost) => {
      if (!accessToken) return;
      const wasLiked = post.liked_by_me;
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
              ? {
                  ...p,
                  liked_by_me: result.liked,
                  likes_count: result.likesCount,
                }
              : p
          )
        );
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? {
                  ...p,
                  liked_by_me: wasLiked,
                  likes_count: post.likes_count,
                }
              : p
          )
        );
      }
    },
    [accessToken]
  );

  const handleUpdatePost = useCallback(
    (updatedPost: FeedPost) => {
      setPosts((prev) =>
        prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
      );
      void newsfeedCache.updatePostEverywhere(updatedPost, user?.id);
    },
    [user?.id]
  );

  const handleDeletePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const mediaPosts = useMemo(
    () =>
      posts.filter(
        (p) => p.media && p.media.length > 0 && resolveImageUri(p.media[0]) !== null
      ),
    [posts]
  );

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (loadError || !profile) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.surface }}
        edges={["top"]}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
          }}
        >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              fontFamily: "PlusJakartaSans-Bold",
              color: colors.textPrimary,
            }}
          >
            Profile
          </Text>
          <View style={{ width: 38 }} />
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 28,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.textPrimary,
              textAlign: "center",
            }}
          >
            Profile Unavailable
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: 6,
            }}
          >
            {loadError || "This student's profile could not be loaded."}
          </Text>
          <Pressable
            onPress={() => void loadData(false)}
            style={{
              marginTop: 18,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.primary,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
              Try Again
            </Text>
          </Pressable>
        </View>
        </View>
      </SafeAreaView>
    );
  }

  const followLabel = relationship?.isFollowing
    ? "Following"
    : relationship?.isFollowedBy
      ? "Follow Back"
      : "Follow";

  const listData =
    activeTab === "about" || !canViewPosts
      ? []
      : activeTab === "feed"
        ? posts
        : mediaPosts;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.surface }}
      edges={["top"]}
    >
      <ResponsiveContainer
        maxContentWidth={540}
        backgroundColor={colors.background}
      >
        {/* ── Top Header Bar (matches profile.tsx & web mobile visitor bar) ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityLabel="Go back"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Pressable>

          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: "center",
              marginHorizontal: 12,
              fontSize: 16,
              fontWeight: "700",
              fontFamily: "PlusJakartaSans-Bold",
              color: colors.textPrimary,
            }}
          >
            {displayName}
          </Text>

          {!isOwnProfile ? (
            <Pressable
              onPress={() => setOptionsVisible(true)}
              hitSlop={10}
              accessibilityLabel="Visitor profile options"
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: colors.surfaceMuted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MoreHorizontal size={20} color={colors.textPrimary} />
            </Pressable>
          ) : (
            <View style={{ width: 38 }} />
          )}
        </View>

        <FlatList
          key={`user-profile-list-${activeTab}-${canViewPosts ? "open" : "locked"}`}
          data={listData}
          numColumns={canViewPosts && activeTab === "media" ? 3 : 1}
          columnWrapperStyle={
            canViewPosts && activeTab === "media"
              ? { gap: 2, paddingHorizontal: 2 }
              : undefined
          }
          keyExtractor={(item, index) => `${item.id}-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {/* ── Profile Header Card ── */}
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 14,
                }}
              >
                {/* Avatar + Relationship Counts Row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <View
                    style={{
                      borderWidth: showPhotoFrame ? 3 : 0,
                      borderColor: showPhotoFrame ? colors.surface : "transparent",
                      borderRadius: 48,
                      backgroundColor: showPhotoFrame
                        ? colors.surface
                        : "transparent",
                      elevation: showPhotoFrame ? 3 : 0,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: showPhotoFrame
                        ? isDark
                          ? 0.3
                          : 0.1
                        : 0,
                      shadowRadius: 4,
                    }}
                  >
                    {showUserAvatar ? (
                      <UserAvatar
                        avatar={resolvedAvatarUrl}
                        size="xl"
                        online={isOwnProfile ? true : isOnline(profile.id)}
                      />
                    ) : (
                      <AnonymousAvatar avatarKey={resolvedAvatarKey} size={80} />
                    )}
                  </View>

                  {visibleStats.length > 0 && (
                    <View
                      style={{
                        flex: 1,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-around",
                      }}
                    >
                      {visibleStats.map((stat) => (
                        <Pressable
                          key={stat.key}
                          onPress={() => openRelationships(stat.key)}
                          style={{ alignItems: "center", minWidth: 54 }}
                        >
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "700",
                              color: colors.textPrimary,
                            }}
                          >
                            {stat.count}
                          </Text>
                          <Text
                            style={{
                              fontSize: 11,
                              color: colors.textSecondary,
                              marginTop: 2,
                            }}
                          >
                            {stat.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>

                {/* Identity & Badges */}
                <View style={{ marginTop: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: "700",
                        fontFamily: "PlusJakartaSans-Bold",
                        color: colors.textPrimary,
                      }}
                    >
                      {displayName}
                    </Text>

                    {isIdentityRevealed && profile.username && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 3,
                          backgroundColor: colors.primarySoft,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 10,
                        }}
                      >
                        <Shield size={11} color={colors.primary} />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: colors.primary,
                            letterSpacing: 0.3,
                          }}
                        >
                          CHMSU VERIFIED
                        </Text>
                      </View>
                    )}

                    {!isOwnProfile && isConfirmedAlly && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: colors.primarySoft,
                          borderWidth: 1,
                          borderColor: isDark
                            ? "rgba(56, 193, 133, 0.35)"
                            : "rgba(26, 107, 60, 0.2)",
                          paddingHorizontal: 8,
                          paddingVertical: 2.5,
                          borderRadius: 10,
                        }}
                      >
                        <UserCheck size={11} color={colors.primary} />
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: "700",
                            color: colors.primary,
                          }}
                        >
                          Ally
                        </Text>
                      </View>
                    )}
                  </View>

                  {Boolean(subtitleText) && (
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginTop: 3,
                      }}
                    >
                      {subtitleText}
                    </Text>
                  )}

                  {isIdentityRevealed && profile.bio ? (
                    <Text
                      style={{
                        fontSize: 13.5,
                        color: colors.textSecondary,
                        lineHeight: 19,
                        marginTop: 8,
                      }}
                    >
                      {profile.bio}
                    </Text>
                  ) : null}

                  {/* Visitor Action Buttons */}
                  {!isOwnProfile && relationship && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 14,
                      }}
                    >
                      <TouchableOpacity
                        onPress={handleOpenChat}
                        disabled={chatBusy}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: colors.primary,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          opacity: chatBusy ? 0.65 : 1,
                        }}
                      >
                        {chatBusy ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MessageCircle size={16} color="#FFFFFF" />
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 13.5,
                                fontWeight: "700",
                                color: "#FFFFFF",
                              }}
                            >
                              Message
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleToggleFollow}
                        disabled={followBusy}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: relationship.isFollowing
                            ? colors.surfaceMuted
                            : colors.surface,
                          borderWidth: 1,
                          borderColor: relationship.isFollowing
                            ? colors.border
                            : colors.primary,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          opacity: followBusy ? 0.65 : 1,
                        }}
                      >
                        {relationship.isFollowing ? (
                          <UserCheck size={15} color={colors.textPrimary} />
                        ) : (
                          <UserPlus size={15} color={colors.primary} />
                        )}
                        <Text
                          numberOfLines={1}
                          style={{
                            fontSize: 13.5,
                            fontWeight: "600",
                            color: relationship.isFollowing
                              ? colors.textPrimary
                              : colors.primary,
                          }}
                        >
                          {followLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Mutual Allies / Followers (respects privacy visibility) */}
                  {!isOwnProfile && (showMutualAllies || showMutualFollowers) ? (
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 8,
                      }}
                    >
                      {showMutualAllies
                        ? `${relationship!.mutualAlliesCount} Mutual Allies`
                        : ""}
                      {showMutualAllies && showMutualFollowers ? " · " : ""}
                      {showMutualFollowers
                        ? `${relationship!.mutualFollowersCount} Mutual Followers`
                        : ""}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* ── 3-Tab Switcher: Feed | Media | About ── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                {(
                  [
                    { id: "feed" as const, label: "Feed" },
                    { id: "media" as const, label: "Media" },
                    { id: "about" as const, label: "About" },
                  ] as const
                ).map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => setActiveTab(tab.id)}
                      style={{
                        flex: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingVertical: 12,
                        borderBottomWidth: isActive ? 2.5 : 0,
                        borderBottomColor: colors.primary,
                        marginBottom: -1,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14.5,
                          fontWeight: isActive ? "700" : "500",
                          color: isActive
                            ? colors.primary
                            : colors.textSecondary,
                        }}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {activeTab === "about" ? (
                <AboutTabSection
                  profile={profile}
                  isIdentityRevealed={isIdentityRevealed}
                  isOwnProfile={isOwnProfile}
                />
              ) : null}
            </View>
          }
          renderItem={({ item }) => {
            if (activeTab === "media") {
              const hasMultiple = item.media && item.media.length > 1;
              const coverImageUri = resolveImageUri(item.media?.[0]);
              return (
                <Pressable
                  onPress={() => {
                    router.push({
                      pathname: "/pages/media-preview" as any,
                      params: {
                        postId: item.id,
                        mediaUrls:
                          item.media && item.media.length > 0
                            ? JSON.stringify(item.media)
                            : "",
                        initialIndex: "0",
                        caption: item.content || "",
                        authorId: profile.id,
                        authorName: displayName,
                        authorUsername: isIdentityRevealed
                          ? profile.username || ""
                          : "anonymous",
                        authorAvatar: isIdentityRevealed
                          ? profile.avatar_url || ""
                          : "",
                        avatarKey: resolvedAvatarKey,
                        isAlly: isIdentityRevealed ? "true" : "false",
                        createdAt: item.created_at || "",
                        likesCount: String(item.likes_count || 0),
                        commentsCount: String(item.comments_count || 0),
                        isLiked: item.liked_by_me ? "true" : "false",
                      },
                    });
                  }}
                  style={{
                    flex: 1 / 3,
                    aspectRatio: 1,
                    marginBottom: 2,
                    backgroundColor: colors.surfaceMuted,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {coverImageUri ? (
                    <Image
                      source={{ uri: coverImageUri }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : null}
                  {hasMultiple && (
                    <View
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        backgroundColor: "rgba(0, 0, 0, 0.55)",
                        borderRadius: 4,
                        padding: 3,
                      }}
                    >
                      <Layers size={13} color="#FFFFFF" />
                    </View>
                  )}
                </Pressable>
              );
            }
            return (
              <PostCard
                post={item}
                onToggleLike={() => handleToggleLike(item)}
                onUpdatePost={handleUpdatePost}
                onDeletePost={handleDeletePost}
              />
            );
          }}
          ListEmptyComponent={
            activeTab === "about" ? null : !canViewPosts ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 48,
                  paddingHorizontal: 24,
                }}
              >
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 14,
                  }}
                >
                  <Shield size={28} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "700",
                    color: colors.textPrimary,
                    textAlign: "center",
                  }}
                >
                  This Account is Private
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.textSecondary,
                    textAlign: "center",
                    marginTop: 6,
                    lineHeight: 19,
                    maxWidth: 290,
                  }}
                >
                  Posts and media on this account are only visible to confirmed
                  campus allies.
                </Text>
              </View>
            ) : activeTab === "feed" ? (
              <View
                style={{
                  alignItems: "center",
                  paddingHorizontal: 24,
                  paddingVertical: 44,
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.textSecondary,
                  }}
                >
                  No posts yet
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: colors.textMuted,
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  This student has not published any posts yet.
                </Text>
              </View>
            ) : (
              <View
                style={{
                  alignItems: "center",
                  paddingHorizontal: 24,
                  paddingVertical: 44,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 10,
                  }}
                >
                  <ImageIcon size={22} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.textSecondary,
                  }}
                >
                  No media yet
                </Text>
                <Text
                  style={{
                    fontSize: 12.5,
                    color: colors.textMuted,
                    marginTop: 4,
                    textAlign: "center",
                  }}
                >
                  This student has not shared any photos yet.
                </Text>
              </View>
            )
          }
        />
      </ResponsiveContainer>

      {/* ── Visitor Options Action Sheet ── */}
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
            onPress={(e) => e.stopPropagation()}
            style={{
              marginTop: "auto",
              backgroundColor: colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 32,
              borderTopWidth: 1,
              borderColor: colors.border,
            }}
          >
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

            {isConfirmedAlly && (
              <Pressable
                onPress={() => {
                  setOptionsVisible(false);
                  setRemoveAllyConfirmVisible(true);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 14,
                }}
              >
                <UserMinus size={18} color="#F59E0B" />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: colors.textPrimary,
                  }}
                >
                  Remove Ally
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                setOptionsVisible(false);
                setReportModalVisible(true);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 14,
              }}
            >
              <Flag size={18} color="#EF4444" />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#EF4444",
                }}
              >
                Report Student
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Confirm Remove Ally Modal ── */}
      <Modal
        visible={removeAllyConfirmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => !allyBusy && setRemoveAllyConfirmVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => !allyBusy && setRemoveAllyConfirmVisible(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: colors.surface,
              borderRadius: 20,
              padding: 22,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.textPrimary,
                marginBottom: 8,
              }}
            >
              Remove {displayName} as an ally?
            </Text>
            <Text
              style={{
                fontSize: 13.5,
                color: colors.textSecondary,
                lineHeight: 19,
                marginBottom: 20,
              }}
            >
              You will need to send a new request to become allies again. Your
              conversation history stays intact.
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                disabled={allyBusy}
                onPress={() => setRemoveAllyConfirmVisible(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: colors.textPrimary,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                disabled={allyBusy}
                onPress={handleRemoveAlly}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: "#EF4444",
                  alignItems: "center",
                }}
              >
                {allyBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text
                    style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}
                  >
                    Remove
                  </Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {viewedUserId && !isOwnProfile && (
        <ReportModal
          visible={reportModalVisible}
          onClose={() => setReportModalVisible(false)}
          onSubmitReport={handleReportUser}
          targetType="user"
          targetName={displayName}
        />
      )}

      <ErrorAlertModal
        visible={Boolean(alertState)}
        title={alertState?.title}
        message={alertState?.message}
        onClose={() => setAlertState(null)}
      />
    </SafeAreaView>
  );
}

/**
 * About Tab Details Component (respects theme & hides identity/bio until revealed)
 */
function AboutTabSection({
  profile,
  isIdentityRevealed,
  isOwnProfile,
}: {
  profile: Profile;
  isIdentityRevealed: boolean;
  isOwnProfile: boolean;
}) {
  const { colors } = useTheme();
  const orgs = profile.organizations ?? [];
  const interests = profile.interests ?? [];

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  } as const;

  const sectionTitleStyle = {
    fontSize: 11,
    fontWeight: "700" as const,
    color: colors.primary,
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
  };

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 12 }}>
      {/* Bio / Identity Status */}
      <View style={cardStyle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <MessageSquare size={13} color={colors.primary} />
          <Text style={sectionTitleStyle}>About</Text>
        </View>
        {isIdentityRevealed ? (
          profile.bio ? (
            <Text
              style={{
                fontSize: 13.5,
                color: colors.textSecondary,
                lineHeight: 20,
              }}
            >
              {profile.bio}
            </Text>
          ) : (
            <Text
              style={{
                fontSize: 13,
                color: colors.textMuted,
                fontStyle: "italic",
              }}
            >
              {isOwnProfile ? "No bio added yet." : "No bio provided."}
            </Text>
          )
        ) : (
          <Text
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              fontStyle: "italic",
              lineHeight: 19,
            }}
          >
            Identity and bio will be revealed once you become Campus Allies.
          </Text>
        )}
      </View>

      {/* Academic Journey */}
      <View style={cardStyle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
          }}
        >
          <GraduationCap size={14} color={colors.primary} />
          <Text style={sectionTitleStyle}>Academic Journey</Text>
        </View>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GraduationCap size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}
              >
                {profile.course || "Not specified"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                {profile.year_level || "Student"}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: colors.textPrimary,
                }}
              >
                {profile.department || "CHMSU College"}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginTop: 2,
                }}
              >
                Carlos Hilado Memorial State University
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Interests */}
      <View style={cardStyle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Sparkles size={13} color={colors.primary} />
            <Text style={sectionTitleStyle}>Campus Interests</Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: colors.textSecondary,
              }}
            >
              {interests.length}
            </Text>
          </View>
        </View>

        {interests.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {interests.map((interest, index) => (
              <View
                key={`${interest}-${index}`}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "500",
                    color: colors.textSecondary,
                  }}
                >
                  {interest}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text
            style={{
              fontSize: 12.5,
              color: colors.textMuted,
              fontStyle: "italic",
            }}
          >
            No interests selected yet.
          </Text>
        )}
      </View>

      {/* Organizations */}
      <View style={cardStyle}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Users size={13} color={colors.primary} />
            <Text style={sectionTitleStyle}>Campus Organizations</Text>
          </View>
          <View
            style={{
              backgroundColor: colors.surfaceMuted,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: colors.textSecondary,
              }}
            >
              {orgs.length}
            </Text>
          </View>
        </View>

        {orgs.length > 0 ? (
          <View style={{ gap: 10 }}>
            {orgs.map((org, index) => (
              <View
                key={`${org}-${index}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: colors.primarySoft,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users size={15} color={colors.primary} />
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "500",
                    color: colors.textPrimary,
                    flex: 1,
                  }}
                >
                  {org}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text
            style={{
              fontSize: 12.5,
              color: colors.textMuted,
              fontStyle: "italic",
            }}
          >
            No organizations listed.
          </Text>
        )}
      </View>
    </View>
  );
}
