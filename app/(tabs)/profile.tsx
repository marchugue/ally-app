import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Image,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Settings,
  Bookmark,
  LogOut,
  ChevronRight,
  Pencil,
  Shield,
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
import { RelationshipListModal } from "@/components/RelationshipListModal";
import { usePresence } from "@/context/PresenceContext";
import { useAuth } from "@/lib/auth/AuthContext";
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

const COLORS = {
  forest: "#1A6B3C",
  forestSoft: "#1A6B3C14",
  gold: "#E8A838",
  teal: "#3B8C7E",
  bg: "#FFFFFF",
};


export default function ProfileScreen() {
  const { user, accessToken, signOut } = useAuth();
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
  const [relationModalOpen, setRelationModalOpen] = useState(false);
  const [relationModalKind, setRelationModalKind] = useState<"followers" | "following" | "allies">("allies");

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
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg }} edges={["top"]}>
      <ResponsiveContainer maxContentWidth={540} backgroundColor={COLORS.bg}>
        <FlatList
          key={`profile-list-${activeTab}`}
          data={activeTab === "feed" ? posts : activeTab === "media" ? mediaPosts : []}
          numColumns={activeTab === "media" ? 3 : 1}
          columnWrapperStyle={activeTab === "media" ? { gap: 2, paddingHorizontal: 2 } : undefined}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.forest} />
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
                    <UserAvatar avatar={profile.avatar_url} size="xl" />
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
                  </View>
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
                      <Text style={{ fontSize: 22, fontWeight: "700", color: "#111827" }}>
                        {profile.full_name || `@${profile.username}`}
                      </Text>
                      {profile.username && (
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

                    <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>
                      @{profile.username} · {profile.course} · {profile.year_level}
                    </Text>
                  </View>
                </View>

                {profile.bio ? (
                  <Text style={{ fontSize: 14, color: "#374151", lineHeight: 20, marginTop: 8 }}>
                    {profile.bio}
                  </Text>
                ) : (
                  <Pressable
                    onPress={() => router.push("/pages/edit-profile" as any)}
                    style={{ marginTop: 8, paddingVertical: 2 }}
                    hitSlop={6}
                  >
                    <Text style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic" }}>
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
                      borderColor: "rgba(26, 107, 60, 0.3)",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <Pencil size={15} color={COLORS.forest} />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.forest }}>
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
            return <PostCard post={item} onToggleLike={toggleLike} />;
          }}
          ListEmptyComponent={
            activeTab === "feed" && !postsLoading ? (
              <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 36 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#6B7280" }}>
                  No posts yet
                </Text>
                <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, textAlign: "center" }}>
                  Share something with your campus community.
                </Text>

                <Pressable
                  onPress={() => setShowCreatePost(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: COLORS.forest,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginTop: 16,
                    elevation: 2,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
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
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#6B7280" }}>
                  No media yet
                </Text>
                <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4, textAlign: "center" }}>
                  Share photos with your campus community.
                </Text>

                <Pressable
                  onPress={() => setShowCreatePost(true)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: COLORS.forest,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    marginTop: 16,
                    elevation: 2,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.1,
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
                <ActivityIndicator color={COLORS.forest} />
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/30" onPress={onClose}>
        <Pressable className="mt-auto bg-white rounded-t-3xl px-5 pt-5 pb-8" onPress={(e) => e.stopPropagation()}>
          <View className="w-10 h-1 rounded-full bg-gray-200 self-center mb-5" />

          <MenuRow icon={Pencil} label="Edit profile" onPress={onEdit} />
          <MenuRow icon={Settings} label="Settings" onPress={onSettings} />
          <MenuRow icon={Bookmark} label="Saved posts" onPress={onClose} />

          <View className="h-3" />

          <MenuRow icon={LogOut} label="Log out" onPress={onSignOut} destructive />
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
}: {
  icon: any;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center justify-between py-3.5">
      <View className="flex-row items-center gap-3">
        <Icon size={17} color={destructive ? "#DC2626" : "#374151"} />
        <Text className={destructive ? "text-red-600 font-medium" : "text-gray-800 font-medium"}>
          {label}
        </Text>
      </View>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}