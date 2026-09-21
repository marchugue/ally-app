import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  UserPlus,
  MessageCircle,
  UserCheck,
  X,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
} from "lucide-react-native";
import { UserAvatar, resolveImageUri } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { usePresence } from "@/context/PresenceContext";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { PostCard } from "@/components/PostCard";
import { RelationshipListModal } from "@/components/RelationshipListModal";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getProfileById,
  getProfileRelationship,
  listProfiles,
  followUser,
  unfollowUser,
  type ProfileRelationshipSummary,
} from "@/lib/api/profiles";
import { getOrCreateConversationWithUser } from "@/lib/api/conversation";
import { listFeedByUser, likePost, unlikePost } from "@/lib/api/feed";
import type { Profile, ProfileSummary } from "@/types/profile";
import type { FeedPost } from "@/types/feed";

const COLORS = {
  forest: "#1A6B3C",
  forestSoft: "#1A6B3C14",
  gold: "#E8A838",
  teal: "#3B8C7E",
  bg: "#FFFFFF",
};



export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { user, accessToken } = useAuth();
  const { isOnline } = usePresence();

  const viewedUserId = userId || user?.id || null;
  const isOwnProfile = !userId || userId === user?.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [relationship, setRelationship] =
    useState<ProfileRelationshipSummary | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);

  const [activeTab, setActiveTab] = useState<"feed" | "media" | "about">("feed");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationModalKind, setRelationModalKind] = useState<"followers" | "following" | "allies">("allies");

  // Load Profile & Relationship Details
  const loadData = useCallback(async () => {
    if (!viewedUserId || !accessToken) return;
    try {
      setLoading(true);

      const [profileData, relData, userPosts] = await Promise.all([
        getProfileById(viewedUserId, accessToken),
        !isOwnProfile
          ? getProfileRelationship(viewedUserId, accessToken).catch(() => null)
          : Promise.resolve(null),
        listFeedByUser(viewedUserId, accessToken).catch(() => []),
      ]);

      setProfile(profileData);
      setRelationship(relData);
      setPosts(userPosts);
    } catch (err) {
      console.warn("Failed to load user profile", err);
    } finally {
      setLoading(false);
    }
  }, [viewedUserId, accessToken, isOwnProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Handle Follow / Unfollow Profile
  const handleToggleFollow = async () => {
    if (!viewedUserId || !accessToken || !relationship || actionLoading) return;
    const currentlyFollowing = relationship.isFollowing;
    try {
      setActionLoading(true);
      if (currentlyFollowing) {
        await unfollowUser(viewedUserId, accessToken);
      } else {
        await followUser(viewedUserId, accessToken);
      }
      setRelationship((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: !currentlyFollowing,
              followersCount:
                prev.followersCount + (currentlyFollowing ? -1 : 1),
            }
          : null
      );
    } catch (err) {
      console.warn("Failed to update follow state", err);
    } finally {
      setActionLoading(false);
    }
  };


  const isConfirmedAlly =
    isOwnProfile ||
    relationship?.allyStatus === "accepted" ||
    (relationship?.allyStatus as any) === "allies";

  // Handle Open Direct Chat
  const handleOpenChat = async () => {
    if (!viewedUserId || !accessToken || actionLoading) return;
    try {
      setActionLoading(true);
      const conversation = await getOrCreateConversationWithUser(
        viewedUserId,
        accessToken
      );
      router.push({
        pathname: "/pages/chat",
        params: {
          id: (conversation as any).id || (conversation as any).conversationId,
          name: isConfirmedAlly ? (profile?.full_name || `@${profile?.username}`) : "Anonymous Peer",
          avatar: isConfirmedAlly ? (profile?.avatar_url || "") : "",
          type: "direct",
        },
      } as any);
    } catch (err) {
      console.warn("Failed to start conversation", err);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Like on User Post
  const handleToggleLike = useCallback(
    async (post: FeedPost) => {
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
          ? await unlikePost(post.id, accessToken!)
          : await likePost(post.id, accessToken!);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, liked_by_me: result.liked, likes_count: result.likesCount }
              : p
          )
        );
      } catch (err) {
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

  const mediaPosts = useMemo(() => {
    return posts.filter(
      (p) => p.media && p.media.length > 0 && resolveImageUri(p.media[0]) !== null
    );
  }, [posts]);

  if (loading || !profile) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: COLORS.bg }}
        className="items-center justify-center"
      >
        <ActivityIndicator size="large" color={COLORS.forest} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      edges={["top"]}
    >
      <ResponsiveContainer maxContentWidth={540} backgroundColor={COLORS.bg}>
        <FlatList
          key={`user-profile-list-${activeTab}`}
          data={isConfirmedAlly ? (activeTab === "feed" ? posts : activeTab === "media" ? mediaPosts : []) : []}
          numColumns={isConfirmedAlly && activeTab === "media" ? 3 : 1}
          columnWrapperStyle={isConfirmedAlly && activeTab === "media" ? { gap: 2, paddingHorizontal: 2 } : undefined}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.forest}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {/* ── Top Header with Back Button ── */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
                <Pressable
                  onPress={() => router.back()}
                  hitSlop={10}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "#F3F4F6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronLeft size={22} color="#111827" />
                </Pressable>
              </View>

              {/* ── Avatar + Stats Header ── */}
              <View style={{ paddingHorizontal: 16, paddingTop: 6, marginBottom: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      borderWidth: 3,
                      borderColor: "#FFFFFF",
                      borderRadius: 48,
                      backgroundColor: "#FFFFFF",
                      elevation: 3,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                    }}
                  >
                    {isConfirmedAlly ? (
                      <UserAvatar avatar={profile.avatar_url} size="xl" online={isOwnProfile ? true : isOnline(profile?.id)} />
                    ) : (
                      <AnonymousAvatar avatarKey={(profile as any).avatarKey || "fox"} size={80} />
                    )}
                  </View>

                  {/* Followers, Following, Allies NEXT to avatar — shifted 25px left */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      marginLeft: -25,
                      flex: 1,
                      justifyContent: "center",
                    }}
                  >
                    {isConfirmedAlly ? (
                      <>
                        <Pressable
                          onPress={() => {
                            setRelationModalKind("followers");
                            setRelationModalOpen(true);
                          }}
                          style={{ alignItems: "center", minWidth: 54 }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                            {relationship?.followersCount ?? 0}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Followers</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => {
                            setRelationModalKind("following");
                            setRelationModalOpen(true);
                          }}
                          style={{ alignItems: "center", minWidth: 54 }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                            {relationship?.followingCount ?? 0}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Following</Text>
                        </Pressable>

                        <Pressable
                          onPress={() => {
                            setRelationModalKind("allies");
                            setRelationModalOpen(true);
                          }}
                          style={{ alignItems: "center", minWidth: 54 }}
                        >
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                            {relationship?.alliesCount ?? 0}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>Allies</Text>
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <View style={{ alignItems: "center", minWidth: 54 }}>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#9CA3AF" }}>—</Text>
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Followers</Text>
                        </View>
                        <View style={{ alignItems: "center", minWidth: 54 }}>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#9CA3AF" }}>—</Text>
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Following</Text>
                        </View>
                        <View style={{ alignItems: "center", minWidth: 54 }}>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: "#9CA3AF" }}>—</Text>
                          <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>Allies</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              </View>

              {/* ── User Information Header ── */}
              <View style={{ paddingHorizontal: 20 }}>
                {/* Full Name & Verification */}
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
                      fontSize: 22,
                      fontWeight: "700",
                      color: "#111827",
                    }}
                  >
                    {isConfirmedAlly ? (profile.full_name || `@${profile.username}`) : "Anonymous Peer"}
                  </Text>

                  {isConfirmedAlly && profile.username && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "rgba(26, 107, 60, 0.08)",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 12,
                      }}
                    >
                      <Shield size={11} color={COLORS.forest} />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: COLORS.forest,
                          letterSpacing: 0.3,
                        }}
                      >
                        CHMSU VERIFIED
                      </Text>
                    </View>
                  )}
                </View>

                {/* Username & Academic Tag */}
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                  {isConfirmedAlly
                    ? `@${profile.username} · ${profile.course || "CHMSU Student"} · ${profile.year_level || "1st Year"}`
                    : `@anonymous · Protected Student`}
                </Text>

                {/* User Bio */}
                <Text
                  style={{
                    fontSize: 14,
                    color: isConfirmedAlly ? "#374151" : "#6B7280",
                    lineHeight: 20,
                    marginTop: 8,
                    fontStyle: isConfirmedAlly && !profile.bio ? "italic" : isConfirmedAlly ? "normal" : "italic",
                  }}
                >
                  {isConfirmedAlly
                    ? (profile.bio || "No bio provided yet.")
                    : "This student's profile is protected. Complete the matching roadmap to become campus allies and reveal full identity."}
                </Text>

                {/* ── Relationship Action Bar ── */}
                {!isOwnProfile && relationship && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    {/* Confirmed Ally Badge */}
                    {isConfirmedAlly && (relationship.allyStatus === "accepted" || (relationship.allyStatus as any) === "allies") && (
                      <View
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: COLORS.forestSoft,
                          borderWidth: 1,
                          borderColor: "rgba(26, 107, 60, 0.3)",
                        }}
                      >
                        <UserCheck size={15} color={COLORS.forest} />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: COLORS.forest,
                          }}
                        >
                          Ally Connected
                        </Text>
                      </View>
                    )}

                    {/* Follow / Unfollow Button (Only for confirmed allies) */}
                    {isConfirmedAlly && (
                      <Pressable
                        onPress={handleToggleFollow}
                        disabled={actionLoading}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          height: 40,
                          borderRadius: 12,
                          backgroundColor: relationship.isFollowing
                            ? "#F3F4F6"
                            : "#FFFFFF",
                          borderWidth: 1,
                          borderColor: relationship.isFollowing
                            ? "#D1D5DB"
                            : COLORS.forest,
                        }}
                      >
                        <UserCheck
                          size={15}
                          color={
                            relationship.isFollowing ? "#374151" : COLORS.forest
                          }
                        />
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color:
                              relationship.isFollowing ? "#374151" : COLORS.forest,
                          }}
                        >
                          {relationship.isFollowing ? "Following" : "Follow"}
                        </Text>
                      </Pressable>
                    )}

                    {/* Message Button */}
                    <Pressable
                      onPress={handleOpenChat}
                      disabled={actionLoading}
                      style={{
                        width: isConfirmedAlly ? 40 : "100%",
                        height: 40,
                        borderRadius: 12,
                        backgroundColor: isConfirmedAlly ? "#FFFFFF" : COLORS.forest,
                        borderWidth: 1,
                        borderColor: isConfirmedAlly ? "#E5E7EB" : COLORS.forest,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      <MessageCircle size={18} color={isConfirmedAlly ? "#374151" : "#FFFFFF"} />
                      {!isConfirmedAlly && (
                        <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
                          Message Anonymously
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )}

                {/* Mutual Allies Info */}
                {!isOwnProfile &&
                isConfirmedAlly &&
                relationship &&
                (relationship.mutualAlliesCount > 0 ||
                  relationship.mutualFollowersCount > 0) ? (
                  <Text
                    style={{
                      fontSize: 11,
                      color: "#6B7280",
                      marginTop: 6,
                    }}
                  >
                    {relationship.mutualAlliesCount > 0
                      ? `${relationship.mutualAlliesCount} Mutual Allies`
                      : ""}
                    {relationship.mutualAlliesCount > 0 &&
                    relationship.mutualFollowersCount > 0
                      ? " · "
                      : ""}
                    {relationship.mutualFollowersCount > 0
                      ? `${relationship.mutualFollowersCount} Mutual Followers`
                      : ""}
                  </Text>
                ) : null}
              </View>

              {/* ── Feed & About Tab Switcher (Only if confirmed ally) ── */}
              {isConfirmedAlly ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: 3,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E8E6E1",
                  }}
                >
                  <Pressable
                    onPress={() => setActiveTab("feed")}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 12,
                      borderBottomWidth: activeTab === "feed" ? 2.5 : 0,
                      borderBottomColor: COLORS.forest,
                      marginBottom: -1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: activeTab === "feed" ? "700" : "500",
                        color: activeTab === "feed" ? COLORS.forest : "#6B7280",
                      }}
                    >
                      Feed
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setActiveTab("media")}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 12,
                      borderBottomWidth: activeTab === "media" ? 2.5 : 0,
                      borderBottomColor: COLORS.forest,
                      marginBottom: -1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: activeTab === "media" ? "700" : "500",
                        color: activeTab === "media" ? COLORS.forest : "#6B7280",
                      }}
                    >
                      Media
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setActiveTab("about")}
                    style={{
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 12,
                      borderBottomWidth: activeTab === "about" ? 2.5 : 0,
                      borderBottomColor: COLORS.forest,
                      marginBottom: -1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: activeTab === "about" ? "700" : "500",
                        color: activeTab === "about" ? COLORS.forest : "#6B7280",
                      }}
                    >
                      About
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Tab View Contents */}
              {isConfirmedAlly && activeTab === "about" ? (
                <AboutTabSection profile={profile} />
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
                        mediaUrls: item.media && item.media.length > 0 ? JSON.stringify(item.media) : "",
                        initialIndex: "0",
                        caption: item.content || "",
                        authorName: profile.full_name || `@${profile.username}`,
                        authorUsername: profile.username || "",
                        authorAvatar: profile.avatar_url || "",
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
                    backgroundColor: "#E5E7EB",
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
              />
            );
          }}
          ListEmptyComponent={
            !isConfirmedAlly ? (
              <View style={{ alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
                <View
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 30,
                    backgroundColor: "rgba(26, 107, 60, 0.1)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <Shield size={30} color={COLORS.forest} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827", textAlign: "center" }}>
                  Profile is Protected
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    textAlign: "center",
                    marginTop: 8,
                    lineHeight: 19,
                    maxWidth: 300,
                  }}
                >
                  Posts, media, and academic details are hidden until both students complete the matching roadmap and become campus allies.
                </Text>
              </View>
            ) : activeTab === "feed" ? (
              <View className="items-center px-6 py-10">
                <Text className="font-semibold text-gray-500">
                  No posts to display
                </Text>
                <Text className="text-xs text-gray-400 mt-1">
                  This user has not published any posts yet.
                </Text>
              </View>
            ) : activeTab === "media" ? (
              <View className="items-center px-6 py-10">
                <Text className="font-semibold text-gray-500">
                  No media to display
                </Text>
                <Text className="text-xs text-gray-400 mt-1">
                  This user has not published any media yet.
                </Text>
              </View>
            ) : null
          }
        />
      </ResponsiveContainer>

      {profile && (
        <RelationshipListModal
          visible={relationModalOpen}
          onClose={() => setRelationModalOpen(false)}
          userId={profile.id}
          initialKind={relationModalKind}
          userName={profile.username || undefined}
        />
      )}
    </SafeAreaView>
  );
}

/**
 * About Tab Details Component
 */
function AboutTabSection({ profile }: { profile: Profile }) {
  const department = profile.department
    ? profile.department
    : "College of Computer Studies";
  const orgs =
    profile.organizations && profile.organizations.length > 0
      ? profile.organizations
      : ["CHMSU Supreme Student Council", "Computer Society (CS)"];
  const interests =
    profile.interests && profile.interests.length > 0
      ? profile.interests
      : ["Mobile Development", "UI/UX Design", "Software Engineering", "Campus Events"];

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 16 }}>
      {/* College & Department */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#E8E6E1",
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "#9CA3AF",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          College & Department
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "rgba(26, 107, 60, 0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={18} color={COLORS.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
              {department}
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              Carlos Hilado Memorial State University
            </Text>
          </View>
        </View>
      </View>

      {/* Academic Details */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#E8E6E1",
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "#9CA3AF",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Academic Details
        </Text>
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(26, 107, 60, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GraduationCap size={18} color={COLORS.forest} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                {profile.course || "BS Information Technology"}
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {profile.year_level || "3rd Year"} Student
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "rgba(26, 107, 60, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BookOpen size={18} color={COLORS.forest} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
                Campus Ally Status
              </Text>
              <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                Verified Student Ally
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Organizations */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#E8E6E1",
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "#9CA3AF",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Organizations
        </Text>
        <View style={{ gap: 10 }}>
          {orgs.map((org, index) => (
            <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={15} color={COLORS.forest} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: "500", color: "#374151" }}>
                {org}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Interests */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#E8E6E1",
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "#9CA3AF",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Interests & Skills
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {interests.map((interest, index) => (
            <View
              key={index}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: "#F9FAFB",
                borderWidth: 1,
                borderColor: "#E5E7EB",
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "500", color: "#374151" }}>
                {interest}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}


