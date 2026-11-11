import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Settings,
  Bookmark,
  LogOut,
  ChevronRight,
  Pencil,
  Shield,
  ShieldAlert,
  X,
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  Plus,
  Layers,
} from "lucide-react-native";
import { UserAvatar, resolveImageUri } from "@/components/UserAvatar";
import { PostCard } from "@/components/PostCard";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { CreatePostSheet } from "@/components/CreatePostSheet";
import { usePresence } from "@/context/PresenceContext";
import { newsfeedCache } from "@/lib/newsfeedCache";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getMyProfile,
  listProfiles,
  getProfileRelationship,
  followUser,
  unfollowUser,
  type ProfileRelationshipSummary,
} from "@/lib/api/profiles";
import { listFeedByUser, likePost, unlikePost } from "@/lib/api/feed";
import type { Profile, ProfileSummary } from "@/types/profile";
import type { FeedPost } from "@/types/feed";

const PAGE_SIZE = 10;

export default function ProfileScreen() {
  const { user, accessToken, signOut } = useAuth();
  const { colors, isDark } = useTheme();
  const { isOnline } = usePresence();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [relationship, setRelationship] = useState<ProfileRelationshipSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"feed" | "media" | "about">("feed");
  const [showCreatePost, setShowCreatePost] = useState(false);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);


  const [menuOpen, setMenuOpen] = useState(false);

  const openRelationships = useCallback(
    (initialTab: "allies" | "following" | "followers") => {
      if (!profile?.id) return;
      router.push({
        pathname: "/pages/relationships" as any,
        params: { userId: profile.id, initialTab },
      });
    },
    [profile?.id]
  );

  const loadProfileData = useCallback(async () => {
    if (!accessToken || !user) return;
    try {
      const [current, relationshipData] = await Promise.all([
        getMyProfile(accessToken),
        getProfileRelationship(user.id, accessToken).catch(() => null),
      ]);
      setProfile(current);
      setRelationship(relationshipData);
    } catch (err) {
      console.warn("Failed to load profile", err);
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id, accessToken]);

  const loadPosts = useCallback(async () => {
    if (!user?.id || !accessToken) return;
    setPostsLoading(true);
    try {
      const page = await listFeedByUser(user.id, accessToken!);
      setPosts(page);
      setHasMore(page.length === PAGE_SIZE);
      cursorRef.current = page.length > 0 ? page[page.length - 1].created_at : undefined;
    } catch (err) {
      console.warn("Failed to load posts", err);
    } finally {
      setPostsLoading(false);
    }
  }, [user?.id, accessToken]);

  useEffect(() => {
    loadProfileData();
    loadPosts();
  }, [loadProfileData, loadPosts]);

  useFocusEffect(
    useCallback(() => {
      void loadProfileData();
      void loadPosts();
    }, [loadProfileData, loadPosts])
  );

  const loadMore = useCallback(async () => {
    if (!user?.id || !accessToken || isLoadingMore || !hasMore || activeTab !== "feed") return;
    setIsLoadingMore(true);
    try {
      const next = await listFeedByUser(user.id, accessToken!);
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = next.filter((p) => !existingIds.has(p.id));
        return [...prev, ...newItems];
      });
      setHasMore(next.length === PAGE_SIZE);
      if (next.length > 0) cursorRef.current = next[next.length - 1].created_at;
    } catch (err) {
      console.warn("Failed to load more posts", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user?.id, accessToken, isLoadingMore, hasMore, activeTab]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = undefined;
    await Promise.all([loadProfileData(), loadPosts()]);
    setRefreshing(false);
  }, [loadProfileData, loadPosts]);

  const toggleLike = useCallback(
    async (post: FeedPost) => {
      const wasLiked = post.liked_by_me;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, liked_by_me: !wasLiked, likes_count: p.likes_count + (wasLiked ? -1 : 1) }
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
            p.id === post.id ? { ...p, liked_by_me: wasLiked, likes_count: post.likes_count } : p
          )
        );
      }
    },
    [accessToken]
  );

  const handleUpdatePost = useCallback((updatedPost: FeedPost) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
    void newsfeedCache.updatePostEverywhere(updatedPost, user?.id);
  }, [user?.id]);

  const handleDeletePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const mediaPosts = useMemo(() => {
    return posts.filter(
      (p) => p.media && p.media.length > 0 && resolveImageUri(p.media[0]) !== null
    );
  }, [posts]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
  };

  if (profileLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={["top"]}>
      <ResponsiveContainer maxContentWidth={540} backgroundColor={colors.background}>
        {/* ── Top Header Bar with Settings Icon ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              fontFamily: "PlusJakartaSans-Bold",
              color: colors.textPrimary,
            }}
          >
            {profile.username ? `@${profile.username}` : "Profile"}
          </Text>

          <TouchableOpacity
            onPress={() => router.push("/pages/settings" as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.surfaceMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Settings size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          key={`profile-list-${activeTab}`}
          data={activeTab === "feed" ? posts : activeTab === "media" ? mediaPosts : []}
          numColumns={activeTab === "media" ? 3 : 1}
          columnWrapperStyle={activeTab === "media" ? { gap: 2, paddingHorizontal: 2 } : undefined}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
          ListHeaderComponent={
            <View>
              {/* ── Avatar + Stats Header ── */}
              <View style={{ paddingHorizontal: 16, paddingTop: 10, marginBottom: 12 }}>
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
                      borderColor: colors.surface,
                      borderRadius: 48,
                      backgroundColor: colors.surface,
                      elevation: 3,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: isDark ? 0.3 : 0.1,
                      shadowRadius: 4,
                    }}
                  >
                    <UserAvatar avatar={profile.avatar_url} size="xl" />
                  </View>

                  {/* Followers, Following, Allies NEXT to avatar — shifted 25px left */}
                  {relationship && (
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
                      {(
                        [
                          { key: "followers" as const, label: "Followers", count: relationship.followersCount, visible: relationship.visibility?.followers ?? relationship.followersCount !== null },
                          { key: "following" as const, label: "Following", count: relationship.followingCount, visible: relationship.visibility?.following ?? relationship.followingCount !== null },
                          { key: "allies" as const, label: "Allies", count: relationship.alliesCount, visible: relationship.visibility?.allies ?? relationship.alliesCount !== null },
                        ]
                      )
                        .filter((stat) => stat.visible && stat.count !== null)
                        .map((stat) => (
                          <Pressable
                            key={stat.key}
                            onPress={() => openRelationships(stat.key)}
                            style={{ alignItems: "center", minWidth: 54 }}
                          >
                            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
                              {stat.count}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                              {stat.label}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  )}
                </View>
              </View>

              {/* ── Identity & Name Header ── */}
              <View style={{ paddingHorizontal: 20 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>
                        {profile.full_name || `@${profile.username}`}
                      </Text>
                      {profile.username && (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                            backgroundColor: colors.primarySoft,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 12,
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
                    </View>

                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                      @{profile.username} · {profile.course} · {profile.year_level}
                    </Text>
                  </View>
                </View>

                {profile.bio ? (
                  <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginTop: 8 }}>
                    {profile.bio}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => router.push("/pages/edit-profile" as any)}
                    style={{ marginTop: 8, paddingVertical: 2 }}
                    hitSlop={6}
                  >
                    <Text style={{ fontSize: 13, color: colors.textMuted, fontStyle: "italic" }}>
                      + Add bio to introduce yourself to campus allies...
                    </Text>
                  </Pressable>
                )}

                {/* Own Profile Action Buttons */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable
                    onPress={() => router.push("/pages/edit-profile" as any)}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      height: 40,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isDark ? "rgba(56, 193, 133, 0.4)" : "rgba(26, 107, 60, 0.3)",
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Pencil size={15} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                      Edit profile
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* ── Feed & About Tab Switcher ── */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 3,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
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
                    borderBottomColor: colors.primary,
                    marginBottom: -1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: activeTab === "feed" ? "700" : "500",
                      color: activeTab === "feed" ? colors.primary : colors.textSecondary,
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
                    borderBottomColor: colors.primary,
                    marginBottom: -1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: activeTab === "media" ? "700" : "500",
                      color: activeTab === "media" ? colors.primary : colors.textSecondary,
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
                    borderBottomColor: colors.primary,
                    marginBottom: -1,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: activeTab === "about" ? "700" : "500",
                      color: activeTab === "about" ? colors.primary : colors.textSecondary,
                    }}
                  >
                    About
                  </Text>
                </Pressable>
              </View>

              {/* Tab View Contents */}
              {activeTab === "about" ? (
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
                onToggleLike={toggleLike}
                onUpdatePost={handleUpdatePost}
                onDeletePost={handleDeletePost}
              />
            );
          }}
          ListEmptyComponent={
            activeTab === "feed" && !postsLoading ? (
              <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 36 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>
                  No posts yet
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
                  Share something with your campus community.
                </Text>

                <Pressable
                  onPress={() => setShowCreatePost(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: colors.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginTop: 16,
                    elevation: 2,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.2 : 0.1,
                    shadowRadius: 3,
                  }}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>
                    Create post
                  </Text>
                </Pressable>
              </View>
            ) : activeTab === "media" && !postsLoading ? (
              <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 36 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary }}>
                  No media yet
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: "center" }}>
                  Share photos with your campus community.
                </Text>

                <Pressable
                  onPress={() => setShowCreatePost(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: colors.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginTop: 16,
                    elevation: 2,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: isDark ? 0.2 : 0.1,
                    shadowRadius: 3,
                  }}
                >
                  <Plus size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>
                    Create post
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          ListFooterComponent={
            activeTab === "feed" && isLoadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
        />
      </ResponsiveContainer>

      <CreatePostSheet
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onPostCreated={() => {
          loadPosts();
        }}
      />

      <AccountSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSignOut={handleSignOut}
        onEdit={() => {
          setMenuOpen(false);
          router.push("/pages/edit-profile" as any);
        }}
        onSettings={() => {
          setMenuOpen(false);
          router.push("/pages/settings" as any);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * About Tab Details Component
 */
function AboutTabSection({ profile }: { profile: Profile }) {
  const { colors } = useTheme();
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
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
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
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
              {department}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Carlos Hilado Memorial State University
            </Text>
          </View>
        </View>
      </View>

      {/* Academic Details */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
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
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GraduationCap size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
                {profile.course || "BS Information Technology"}
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
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
                backgroundColor: colors.primarySoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BookOpen size={18} color={colors.primary} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>
                Campus Ally Status
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                Verified Student Ally
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Organizations */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
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
                  backgroundColor: colors.surfaceMuted,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={15} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textPrimary }}>
                {org}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Interests */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
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
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textSecondary }}>
                {interest}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}


function AccountSheet({
  visible,
  onClose,
  onSignOut,
  onEdit,
  onSettings,
}: {
  visible: boolean;
  onClose: () => void;
  onSignOut: () => void;
  onEdit: () => void;
  onSettings: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <Pressable
          style={{
            marginTop: "auto",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          <MenuRow icon={Pencil} label="Edit profile" onPress={onEdit} colors={colors} />
          <MenuRow icon={Settings} label="Settings" onPress={onSettings} colors={colors} />
          <MenuRow
            icon={ShieldAlert}
            label="Report center"
            onPress={() => {
              onClose();
              router.push("/pages/reports" as any);
            }}
            colors={colors}
          />
          <MenuRow icon={Bookmark} label="Saved posts" onPress={onClose} colors={colors} />

          <View style={{ height: 12 }} />

          <MenuRow icon={LogOut} label="Log out" onPress={onSignOut} destructive colors={colors} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon: Icon,
  label,
  onPress,
  destructive,
  colors,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon size={18} color={destructive ? "#EF4444" : colors.textPrimary} />
        <Text
          style={{
            fontSize: 15,
            fontWeight: "500",
            color: destructive ? "#EF4444" : colors.textPrimary,
          }}
        >
          {label}
        </Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
}