import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
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
  Building2,
  Users,
  Heart,
  MessageCircle,
  UserPlus,
} from "lucide-react-native";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/lib/auth/AuthContext";
import { getMyProfile, listProfiles, } from "@/lib/api/profiles";
import {
  listInteractions,
  requestConnection,
} from "@/lib/api/interaction";
import {
  listFeedByUser,
  likePost,
  unlikePost,
} from "@/lib/api/feed";
import type { Profile, ProfileSummary } from "@/types/profile";
import type { FeedPost } from "@/types/feed";

const PAGE_SIZE = 10;

// Design system palette — forest / gold / teal (matches web)
const COLORS = {
  forest: "#1A6B3C",
  forestSoft: "#1A6B3C14",
  gold: "#E8A838",
  teal: "#3B8C7E",
  bg: "#F7F4EF",
};

type ConnectionStatus = "none" | "pending" | "accepted";

export default function ProfileScreen() {
  const { user, accessToken, signOut } = useAuth();

  // ── profile ──────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // ── own posts ────────────────────────────────────────────────────────────
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cursorRef = useRef<string | undefined>(undefined);

  // ── suggested people ────────────────────────────────────────────────────
  const [suggested, setSuggested] = useState<ProfileSummary[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});

  // ── account sheet ────────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);

  // ── load profile + connections/suggested ────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!accessToken || !user) return;
    try {
      const [current, others, interactions] = await Promise.all([
        getMyProfile(accessToken),
        listProfiles(accessToken, user.id),
        listInteractions(accessToken),
      ]);
      setProfile(current);
      const connMap: Record<string, ConnectionStatus> = {};
      (interactions ?? []).forEach((r: any) => {
        connMap[r.target_user_id] = r.status;
      });
      setConnections(connMap);
      setSuggested(others.filter((s: ProfileSummary) => connMap[s.id] !== "accepted").slice(0, 4));
    } catch (err) {
      console.warn("Failed to load profile", err);
    } finally {
      setProfileLoading(false);
    }
  }, [user?.id]);

  // ── load own posts (first page) ─────────────────────────────────────────
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
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [loadProfile, loadPosts]);

  const loadMore = useCallback(async () => {
    if (!user?.id || !accessToken || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const next = await listFeedByUser(user.id, accessToken!);
      setPosts((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
      if (next.length > 0) cursorRef.current = next[next.length - 1].created_at;
    } catch (err) {
      console.warn("Failed to load more posts", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user?.id, accessToken, isLoadingMore, hasMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = undefined;
    await Promise.all([loadProfile(), loadPosts()]);
    setRefreshing(false);
  }, [loadProfile, loadPosts]);

  const toggleLike = useCallback(async (post: FeedPost) => {
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
  }, []);

  const toggleConnect = useCallback(
    async (targetId: string) => {
      if (
        !user?.id ||
        !accessToken ||
        connections[targetId] === "pending" ||
        connections[targetId] === "accepted"
      ) {
        return;
      }

      setConnections((prev) => ({ ...prev, [targetId]: "pending" }));

      try {
        await requestConnection(targetId, accessToken);
      } catch (err) {
        setConnections((prev) => ({ ...prev, [targetId]: "none" }));
      }
    },
    [user?.id, accessToken, connections]
  );

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
  };

  if (profileLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: COLORS.bg }}>
        <ActivityIndicator color={COLORS.forest} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.bg }} edges={["top"]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.forest} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <ProfileHeader
            profile={profile}
            suggested={suggested}
            connections={connections}
            onConnect={toggleConnect}
            onEdit={() => router.push("/pages/edit-profile" as any)}
            onOpenMenu={() => setMenuOpen(true)}
          />
        }
        renderItem={({ item }) => <PostRow post={item} onToggleLike={toggleLike} />}
        ListEmptyComponent={
          !postsLoading ? (
            <View className="items-center px-6 py-10">
              <Text className="font-semibold text-gray-500">No posts yet</Text>
              <Text className="text-xs text-gray-400 mt-1">
                Share something with your campus community.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View className="py-4 items-center">
              <ActivityIndicator color={COLORS.forest} />
            </View>
          ) : null
        }
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

// ─────────────────────────────────────────────────────────────────────────
// Header block. Each visual group gets real vertical whitespace instead of
// borders doing the separating — identity stays tight, everything after it
// reads as its own zone (law of proximity).
// ─────────────────────────────────────────────────────────────────────────
function ProfileHeader({
  profile,
  suggested,
  connections,
  onConnect,
  onEdit,
  onOpenMenu,
}: {
  profile: Profile;
  suggested: ProfileSummary[];
  connections: Record<string, ConnectionStatus>;
  onConnect: (id: string) => void;
  onEdit: () => void;
  onOpenMenu: () => void;
}) {
  return (
    <View className="px-5 pt-4">
      {/* Identity cluster — avatar, name, badge, handle: tight */}
      <View className="flex-row items-center gap-3 mb-1">
        <UserAvatar avatar={profile.avatar_url} size="lg" />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>
              {profile.username ? `@${profile.username}` : profile.full_name}
            </Text>
            <Shield size={14} color={COLORS.forest} />
          </View>
          <Text className="text-xs text-gray-400 mt-0.5">
            {profile.course} · {profile.year_level}
          </Text>
        </View>
        <Pressable onPress={onOpenMenu} hitSlop={10} className="p-2 -mr-2">
          <Settings size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      {/* Bio sits right under identity — still the same cluster */}
      {profile.bio ? <Text className="text-sm text-gray-600 leading-5 mt-2">{profile.bio}</Text> : null}

      {/* Edit action closes out the identity cluster */}
      <View className="flex-row gap-2 mt-3">
        <Pressable
          onPress={onEdit}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border"
          style={{ borderColor: COLORS.forest + "33" }}
        >
          <Pencil size={13} color={COLORS.forest} />
          <Text className="text-sm font-semibold" style={{ color: COLORS.forest }}>
            Edit profile
          </Text>
        </Pressable>
      </View>

      {/* ── real gap before the next group ── */}
      <View className="h-6" />

      <View className="flex-row items-center gap-2 mb-4">
        <Building2 size={13} color={COLORS.forest} />
        <Text className="text-xs text-gray-500">
          {(profile.department || "").replace("College of ", "")}
        </Text>
      </View>

      {/* Interests — own group */}
      {profile.interests?.length ? (
        <View className="mb-4">
          <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Interests
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {profile.interests.map((i) => (
              <View key={i} className="px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
                <Text className="text-xs font-medium text-gray-600">{i}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Organizations — own group */}
      {profile.organizations?.length ? (
        <View className="mb-6">
          <Text className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Organizations
          </Text>
          <View className="gap-2">
            {profile.organizations.map((org) => (
              <View key={org} className="flex-row items-center gap-2">
                <Users size={12} color={COLORS.forest} />
                <Text className="text-xs text-gray-700">{org}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View className="h-2" />
      )}

      {/* People you may know — distinct card, clearly separated */}
      {suggested.length > 0 && (
        <View className="rounded-2xl p-4 mb-6 bg-white">
          <Text className="text-sm font-bold text-gray-900 mb-3">People you may know</Text>
          <View className="gap-4">
            {suggested.map((person) => {
              const status = connections[person.id] || "none";
              return (
                <View key={person.id} className="flex-row items-center gap-3">
                  <UserAvatar avatar={null} size="md" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                      {person.username ? `@${person.username}` : person.full_name}
                    </Text>
                    <Text className="text-xs text-gray-400" numberOfLines={1}>
                      @{person.username}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onConnect(person.id)}
                    disabled={status === "accepted"}
                    className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg border"
                    style={{
                      borderColor: status === "accepted" ? COLORS.forest + "33" : "#E5E7EB",
                      backgroundColor: status === "pending" ? COLORS.gold + "1A" : "transparent",
                    }}
                  >
                    <UserPlus size={11} color={status === "accepted" ? COLORS.forest : "#6B7280"} />
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: status === "accepted" ? COLORS.forest : "#6B7280" }}
                    >
                      {status === "none" ? "Connect" : status === "pending" ? "Requested" : "Connected"}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Posts label — its own zone, divider above signals the shift */}
      <View className="border-t border-gray-200 pt-4 pb-2">
        <Text className="text-sm font-bold text-gray-900">Posts</Text>
      </View>
    </View>
  );
}

function PostRow({ post, onToggleLike }: { post: FeedPost; onToggleLike: (p: FeedPost) => void }) {
  return (
    <View className="px-5 py-4 border-b border-gray-100">
      <Text className="text-sm text-gray-800 leading-5">{post.content}</Text>
      <View className="flex-row items-center gap-4 mt-3">
        <Pressable onPress={() => onToggleLike(post)} className="flex-row items-center gap-1.5">
          <Heart
            size={15}
            color={post.liked_by_me ? COLORS.forest : "#9CA3AF"}
            fill={post.liked_by_me ? COLORS.forest : "none"}
          />
          <Text className="text-xs text-gray-500">{post.likes_count}</Text>
        </Pressable>
        <View className="flex-row items-center gap-1.5">
          <MessageCircle size={15} color="#9CA3AF" />
          <Text className="text-xs text-gray-500">{post.comments_count}</Text>
        </View>
      </View>
    </View>
  );
}

// Bottom sheet groups profile actions vs. destructive action separately
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

          {/* Profile actions — grouped */}
          <MenuRow icon={Pencil} label="Edit profile" onPress={onEdit} />
          <MenuRow icon={Settings} label="Settings" onPress={onSettings} />
          <MenuRow icon={Bookmark} label="Saved posts" onPress={onClose} />

          <View className="h-3" />

          {/* Destructive action — separated group */}
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