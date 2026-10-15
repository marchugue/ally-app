import { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
  Modal,
  Animated,
  AppState,
  type AppStateStatus,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Plus, Home, Users, UserCheck, SlidersHorizontal, Check, ArrowUp } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResponsiveContainer } from "@/components/ResponsiveContainer";
import { PostCard } from "@/components/PostCard";
import { CreatePostSheet } from "@/components/CreatePostSheet";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { listFeed, likePost, unlikePost } from "@/lib/api/feed";
import { newsfeedCache } from "@/lib/newsfeedCache";
import type { FeedPost } from "@/types/feed";

const PAGE_SIZE = 30;

type FeedFilter = "all" | "following" | "allies";

const FILTER_OPTIONS: { value: FeedFilter; label: string; description: string }[] = [
  { value: "all", label: "All Feed", description: "All campus community posts" },
  { value: "following", label: "Following", description: "Posts from people you follow" },
  { value: "allies", label: "Allies", description: "Posts from your accepted allies" },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("all");
  const initialMemCache = newsfeedCache.getMemory(activeFilter, user?.id);
  const [posts, setPosts] = useState<FeedPost[]>(() => initialMemCache?.posts ?? []);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [loading, setLoading] = useState(() => !initialMemCache?.posts?.length);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newPostsCount, setNewPostsCount] = useState(0);

  const cursorRef = useRef<string | undefined>(undefined);
  const postsRef = useRef<FeedPost[]>(posts);
  postsRef.current = posts;
  const flatListRef = useRef<FlatList>(null);
  const isCheckingRef = useRef<boolean>(false);

  // Dynamic animations for Filter Icon
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation when an active non-default filter is selected
  useEffect(() => {
    if (activeFilter !== "all") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeFilter, pulseAnim]);

  const toggleDropdown = () => {
    if (showFilterDropdown) {
      closeDropdown();
    } else {
      openDropdown();
    }
  };

  const openDropdown = () => {
    setShowFilterDropdown(true);
    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.88,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const closeDropdown = () => {
    setShowFilterDropdown(false);
    Animated.parallel([
      Animated.spring(rotateAnim, {
        toValue: 0,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadData = useCallback(
    async (filterToUse = activeFilter, isBackground = false) => {
      if (!accessToken) return;
      try {
        const feed = await listFeed(accessToken, {
          limit: PAGE_SIZE,
          filter: filterToUse,
        });
        setPosts(feed);
        setHasMore(feed.length === PAGE_SIZE);
        cursorRef.current = feed.length > 0 ? feed[feed.length - 1].created_at : undefined;
        // Cache up to 20 posts
        await newsfeedCache.set(filterToUse, feed, user?.id);
        setNewPostsCount(0);
      } catch (err) {
        console.warn("Failed to load feed data", err);
      }
    },
    [accessToken, activeFilter, user?.id]
  );

  const handleSelectFilter = async (newFilter: FeedFilter) => {
    if (newFilter === activeFilter) {
      closeDropdown();
      return;
    }
    closeDropdown();
    setActiveFilter(newFilter);

    // Instant display from cache if available
    const cached = await newsfeedCache.get(newFilter, user?.id);
    if (cached && cached.posts.length > 0) {
      setPosts(cached.posts);
      setLoading(false);
    } else {
      setLoading(true);
      setPosts([]);
    }
    cursorRef.current = undefined;
    loadData(newFilter).finally(() => setLoading(false));
  };

  const loadMore = useCallback(async () => {
    if (!accessToken || isLoadingMore || !hasMore || !cursorRef.current) return;
    setIsLoadingMore(true);
    try {
      const nextPage = await listFeed(accessToken, {
        limit: PAGE_SIZE,
        filter: activeFilter,
        before: cursorRef.current,
      });
      if (nextPage.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newUniquePosts = nextPage.filter((p) => !existingIds.has(p.id));
          return [...prev, ...newUniquePosts];
        });
        setHasMore(nextPage.length === PAGE_SIZE);
        cursorRef.current = nextPage[nextPage.length - 1].created_at;
      }
    } catch (err) {
      console.warn("Failed to load more posts", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [accessToken, isLoadingMore, hasMore, activeFilter]);

  // Initial load: check cache first, then fetch fresh
  useEffect(() => {
    let isMounted = true;
    async function init() {
      const cached = await newsfeedCache.get(activeFilter, user?.id);
      if (cached && cached.posts.length > 0 && isMounted) {
        setPosts(cached.posts);
        setLoading(false);
      } else {
        setLoading(true);
      }
      await loadData(activeFilter);
      if (isMounted) setLoading(false);
    }
    init();
    return () => {
      isMounted = false;
    };
  }, [loadData, activeFilter, user?.id]);

  // Tab Reopen & App Foreground Watcher
  const checkTabReopen = useCallback(async () => {
    if (!accessToken || isCheckingRef.current) return;
    isCheckingRef.current = true;
    try {
      const peek = await listFeed(accessToken, { limit: 1, filter: activeFilter });
      if (peek.length === 0) return;

      const currentTopId = postsRef.current[0]?.id;
      const latestBackendPost = peek[0];

      if (currentTopId && latestBackendPost.id !== currentTopId) {
        // Backend has new post(s)! Reload feed and update cache
        await loadData(activeFilter);
      } else {
        // No new posts: keep cache intact
      }
    } catch (err) {
      console.warn("[HomeScreen] Peek on reopen failed:", err);
    } finally {
      isCheckingRef.current = false;
    }
  }, [accessToken, activeFilter, loadData]);

  // Check when tab focuses (e.g. switching back from other tabs)
  useFocusEffect(
    useCallback(() => {
      void checkTabReopen();
    }, [checkTabReopen])
  );

  // Check when app returns from background to active foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void checkTabReopen();
      }
    });
    return () => sub.remove();
  }, [checkTabReopen]);

  // In-app background polling: only refresh if >20 new posts, otherwise update pill count
  useEffect(() => {
    if (!accessToken) return;
    const interval = setInterval(async () => {
      if (AppState.currentState !== "active" || isCheckingRef.current) return;
      const currentTop = postsRef.current[0];
      if (!currentTop) return;

      isCheckingRef.current = true;
      try {
        const peek = await listFeed(accessToken, { limit: 25, filter: activeFilter });
        const topIdx = peek.findIndex((p) => p.id === currentTop.id);

        let count = 0;
        if (topIdx > -1) {
          count = topIdx;
        } else if (peek.length > 0) {
          count = 25;
        }

        if (count > 20) {
          // Rule: More than 20 new posts while in app -> auto-refresh
          await loadData(activeFilter, true);
        } else {
          setNewPostsCount(count);
        }
      } catch {
      } finally {
        isCheckingRef.current = false;
      }
    }, 40000);

    return () => clearInterval(interval);
  }, [accessToken, activeFilter, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(activeFilter);
    setRefreshing(false);
  }, [loadData, activeFilter]);

  const toggleLike = useCallback(
    async (post: FeedPost) => {
      if (!accessToken) return;
      const wasLiked = post.liked_by_me;
      const optimisticPost: FeedPost = {
        ...post,
        liked_by_me: !wasLiked,
        likes_count: post.likes_count + (wasLiked ? -1 : 1),
      };

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? optimisticPost : p))
      );
      void newsfeedCache.updatePost(activeFilter, optimisticPost, user?.id);

      try {
        const result = wasLiked
          ? await unlikePost(post.id, accessToken)
          : await likePost(post.id, accessToken);
        const resolved: FeedPost = {
          ...post,
          liked_by_me: result.liked,
          likes_count: result.likesCount,
        };
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? resolved : p))
        );
        void newsfeedCache.updatePost(activeFilter, resolved, user?.id);
      } catch {
        // Revert on error
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? post : p))
        );
        void newsfeedCache.updatePost(activeFilter, post, user?.id);
      }
    },
    [accessToken, activeFilter, user?.id]
  );

  const navigateToPost = useCallback((post: FeedPost) => {
    router.push({
      pathname: "/pages/media-preview" as any,
      params: {
        mediaUrls: post.media && post.media.length > 0 ? JSON.stringify(post.media) : "",
        initialIndex: "0",
        postId: post.id,
        caption: post.content || "",
        authorName: post.author?.full_name || `@${post.author?.username}`,
        authorAvatar: post.author?.avatar_url || "",
        likesCount: String(post.likes_count || 0),
        commentsCount: String(post.comments_count || 0),
        isLiked: post.liked_by_me ? "true" : "false",
        openComments: "true",
      },
    });
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const isFilterActive = activeFilter !== "all";

  return (
    <ResponsiveContainer backgroundColor="#F9FAFB">
      {/* ── Feed Header Bar: Ally-jis Brand & Animated Filter Dropdown ── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: insets.top > 0 ? insets.top + 8 : 12,
          paddingBottom: 10,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          zIndex: 10,
        }}
      >
        {/* Left: Ally-jis Brand Title */}
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
          <Text
            style={{
              fontFamily: "Fraunces_700Bold",
              fontSize: 22,
              color: "#1A6B3C",
              letterSpacing: -0.5,
            }}
          >
            Ally-jis
          </Text>
          {isFilterActive && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: "#16A34A",
                textTransform: "capitalize",
              }}
            >
              • {activeFilter}
            </Text>
          )}
        </View>

        {/* Right: Dynamic Animated Filter Icon Button */}
        <TouchableOpacity
          onPress={toggleDropdown}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor:
              isFilterActive || showFilterDropdown ? "rgba(26,107,60,0.1)" : "#F3F4F6",
            borderWidth: 1,
            borderColor:
              isFilterActive || showFilterDropdown ? "rgba(26,107,60,0.3)" : "#E5E7EB",
          }}
        >
          <Animated.View
            style={{
              transform: [{ rotate }, { scale: scaleAnim }],
            }}
          >
            <SlidersHorizontal
              size={16}
              color={isFilterActive || showFilterDropdown ? "#1A6B3C" : "#4B5563"}
              strokeWidth={2.2}
            />
          </Animated.View>

          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: isFilterActive || showFilterDropdown ? "#1A6B3C" : "#4B5563",
              textTransform: "capitalize",
            }}
          >
            {activeFilter === "all" ? "Filter" : activeFilter}
          </Text>

        </TouchableOpacity>
      </View>

      {/* ── Dropdown Modal with Clean Labels (NO Pressable Button Pills) ── */}
      <Modal
        visible={showFilterDropdown}
        transparent
        animationType="fade"
        onRequestClose={closeDropdown}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.18)",
            justifyContent: "flex-start",
            alignItems: "flex-end",
            paddingTop: insets.top > 0 ? insets.top + 52 : 56,
            paddingHorizontal: 16,
          }}
          onPress={closeDropdown}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              paddingVertical: 6,
              paddingHorizontal: 6,
              minWidth: 175,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {FILTER_OPTIONS.map((option, idx) => {
              const isSelected = activeFilter === option.value;
              return (
                <View key={option.value}>
                  {idx > 0 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: "#F3F4F6",
                        marginHorizontal: 10,
                        marginVertical: 2,
                      }}
                    />
                  )}
                  {/* Clean text label row — NOT a button pill */}
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => handleSelectFilter(option.value)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: isSelected ? "rgba(26,107,60,0.06)" : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isSelected ? "700" : "500",
                        color: isSelected ? "#1A6B3C" : "#374151",
                      }}
                    >
                      {option.label}
                    </Text>
                    {isSelected && (
                      <Check size={16} color="#1A6B3C" strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Floating New Posts Indicator (Tap or pull down) ── */}
      {newPostsCount > 0 && (
        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            top: insets.top > 0 ? insets.top + 60 : 64,
            left: 0,
            right: 0,
            alignItems: "center",
            zIndex: 30,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              onRefresh();
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#1A6B3C",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
              elevation: 6,
            }}
          >
            <ArrowUp size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>
              {newPostsCount} new {newPostsCount === 1 ? "post" : "posts"} • Tap to refresh
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Feed Content List */}
      {loading ? (
        <View className="flex-1 bg-background items-center justify-center">
          <ActivityIndicator color="#1A6B3C" size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1A6B3C"
            />
          }
          contentContainerStyle={
            posts.length === 0 ? { flex: 1 } : { paddingBottom: 16 }
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={toggleLike}
              onComment={navigateToPost}
            />
          )}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <ActivityIndicator size="small" color="#1A6B3C" />
              </View>
            ) : !hasMore && posts.length > 0 ? (
              <View style={{ paddingVertical: 20, alignItems: "center" }}>
                <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                  You've seen all posts
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            activeFilter === "following" ? (
              <EmptyState
                icon={<UserCheck size={28} color="#1A6B3C" />}
                title="No posts from following yet"
                description="Follow classmates on campus to see their thoughts and updates here."
                actionLabel="Discover classmates"
                onAction={() => router.push("/(tabs)/discover" as any)}
              />
            ) : activeFilter === "allies" ? (
              <EmptyState
                icon={<Users size={28} color="#1A6B3C" />}
                title="No posts from allies yet"
                description="Connect with classmates to see their posts in your Allies feed."
                actionLabel="Find Allies"
                onAction={() => router.push("/(tabs)/discover" as any)}
              />
            ) : (
              <EmptyState
                icon={<Home size={28} color="#1A6B3C" />}
                title="Your feed is empty"
                description="Share your thoughts with your campus community or follow classmates."
                actionLabel="Create a post"
                onAction={() => setShowCreate(true)}
              />
            )
          }
        />
      )}

      {/* Floating Action Button */}
      <Pressable
        onPress={() => setShowCreate(true)}
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: "#1A6B3C",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#1A6B3C",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        }}
        android_ripple={{ color: "rgba(255,255,255,0.15)" }}
      >
        <Plus size={26} color="#FFFFFF" />
      </Pressable>

      <CreatePostSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onPostCreated={() => loadData(activeFilter)}
      />
    </ResponsiveContainer>
  );
}