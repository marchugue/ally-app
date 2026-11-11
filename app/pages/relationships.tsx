import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Search, Users, X } from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { getAnonymousDisplayName } from "@/lib/anonymousHandle";
import { getDeterministicAnonymousAvatar } from "@/constants/matchOptions";
import { listFollowers, listFollowing } from "@/lib/api/follow";
import { listAllies } from "@/lib/api/interaction";
import {
  getProfileRelationship,
  type ProfileRelationshipSummary,
} from "@/lib/api/profiles";
import {
  EditRelationshipPrivacyModal,
  type MobileRelationshipPrivacyState,
} from "@/components/EditRelationshipPrivacyModal";
import type { FollowListItem } from "@/types/follow";
import type { AllyListItem } from "@/types/interaction";

type RelationshipFilterKind = "allies" | "following" | "followers";
type ListItem = (FollowListItem | AllyListItem) & {
  department?: string | null;
  year_level?: string | null;
  yearLevel?: string | null;
};

const FILTER_LABELS: Record<RelationshipFilterKind, string> = {
  allies: "Allies",
  following: "Following",
  followers: "Followers",
};

const KIND_ORDER: RelationshipFilterKind[] = ["allies", "following", "followers"];

export default function RelationshipsScreen() {
  const { user, accessToken } = useAuth();
  const { colors, isDark } = useTheme();
  const { userId, initialTab } = useLocalSearchParams<{
    userId?: string;
    initialTab?: string;
  }>();

  const targetUserId = userId || user?.id || "";
  const isOwnProfile = Boolean(user?.id && targetUserId === user.id);

  const parsedInitial: RelationshipFilterKind =
    initialTab === "following" || initialTab === "followers" ? initialTab : "allies";

  const [relationship, setRelationship] = useState<ProfileRelationshipSummary | null>(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [activeKind, setActiveKind] = useState<RelationshipFilterKind>(parsedInitial);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [items, setItems] = useState<ListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const searchTimerRef = useRef<any>(null);

  useEffect(() => {
    setActiveKind(parsedInitial);
  }, [parsedInitial]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  const loadSummary = useCallback(async () => {
    if (!targetUserId || !accessToken) return;
    try {
      const data = await getProfileRelationship(targetUserId, accessToken);
      setRelationship(data);
    } catch (err) {
      console.warn("[RelationshipsScreen] summary failed", err);
    } finally {
      setSummaryLoaded(true);
    }
  }, [targetUserId, accessToken]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary])
  );

  const visibleKinds: RelationshipFilterKind[] = useMemo(() => {
    if (!relationship) return isOwnProfile ? KIND_ORDER : [];
    const vis = relationship.visibility;
    return KIND_ORDER.filter((kind) => {
      if (vis) return vis[kind];
      if (kind === "allies") return relationship.alliesCount !== null;
      if (kind === "following") return relationship.followingCount !== null;
      return relationship.followersCount !== null;
    });
  }, [relationship, isOwnProfile]);

  const effectiveKind: RelationshipFilterKind | null = useMemo(() => {
    if (visibleKinds.length === 0) return null;
    return visibleKinds.includes(activeKind) ? activeKind : visibleKinds[0];
  }, [visibleKinds, activeKind]);

  const fetchListPage = useCallback(
    async (
      kind: RelationshipFilterKind,
      nextCursor: string | null,
      query: string
    ) => {
      if (!accessToken || !targetUserId) {
        return { items: [] as ListItem[], nextCursor: null as string | null, totalCount: 0 };
      }
      const params = {
        cursor: nextCursor,
        search: query.trim() || undefined,
        sortBy: "recent" as const,
      };
      if (kind === "allies") return listAllies(targetUserId, accessToken, params);
      if (kind === "followers") return listFollowers(targetUserId, accessToken, params);
      return listFollowing(targetUserId, accessToken, params);
    },
    [accessToken, targetUserId]
  );

  const loadList = useCallback(
    async (reset = true, nextCursor: string | null = null) => {
      if (!effectiveKind || !accessToken || !targetUserId) {
        setItems([]);
        setCursor(null);
        setTotalCount(null);
        setLoading(false);
        return;
      }
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await fetchListPage(effectiveKind, nextCursor, debouncedQuery);
        if (reset) {
          setItems((res.items as ListItem[]) || []);
        } else {
          setItems((prev) => [...prev, ...((res.items as ListItem[]) || [])]);
        }
        setCursor(res.nextCursor ?? null);
        setTotalCount(
          typeof res.totalCount === "number" ? res.totalCount : ((res.items || []).length)
        );
      } catch (err) {
        console.warn("[RelationshipsScreen] list failed", err);
        if (reset) {
          setItems([]);
          setCursor(null);
          setTotalCount(null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [effectiveKind, accessToken, targetUserId, debouncedQuery, fetchListPage]
  );

  useEffect(() => {
    if (!summaryLoaded) return;
    void loadList(true, null);
  }, [summaryLoaded, loadList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSummary();
    await loadList(true, null);
    setRefreshing(false);
  }, [loadSummary, loadList]);

  const handleLoadMore = () => {
    if (!cursor || loading || loadingMore) return;
    void loadList(false, cursor);
  };

  const activeCount = useMemo(() => {
    if (!effectiveKind) return 0;
    if (debouncedQuery.trim()) return totalCount ?? items.length;
    if (relationship) {
      if (effectiveKind === "allies" && relationship.alliesCount !== null) {
        return relationship.alliesCount;
      }
      if (effectiveKind === "following" && relationship.followingCount !== null) {
        return relationship.followingCount;
      }
      if (effectiveKind === "followers" && relationship.followersCount !== null) {
        return relationship.followersCount;
      }
    }
    return totalCount ?? items.length;
  }, [effectiveKind, debouncedQuery, totalCount, items.length, relationship]);

  const openMemberProfile = (memberId: string) => {
    if (memberId === user?.id) {
      router.push("/(tabs)/profile" as any);
      return;
    }
    router.push({
      pathname: "/pages/user-profile",
      params: { userId: memberId },
    } as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      {/* Top Bar: bare back arrow only (no label, no background pill) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Back"
          style={{ padding: 4 }}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        {isOwnProfile && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <TouchableOpacity
              onPress={() => router.push("/pages/requests" as any)}
              hitSlop={6}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                Connection Requests
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPrivacyModalOpen(true)} hitSlop={6}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                Privacy
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Filter Chips under the back button in a row (omit hidden ones) */}
      {visibleKinds.length > 0 && effectiveKind && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ flexDirection: "row", gap: 8 }}
          >
            {visibleKinds.map((kind) => {
              const selected = effectiveKind === kind;
              return (
                <TouchableOpacity
                  key={kind}
                  onPress={() => setActiveKind(kind)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: selected
                      ? colors.primary
                      : isDark
                      ? "rgba(255,255,255,0.08)"
                      : "#F3F4F6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: selected ? "#FFFFFF" : colors.textSecondary,
                    }}
                  >
                    {FILTER_LABELS[kind]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Under that: Search Bar Full Width */}
      {visibleKinds.length > 0 && effectiveKind && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <View
            style={{
              width: "100%",
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6",
              borderRadius: 999,
              paddingHorizontal: 14,
              height: 42,
              gap: 8,
            }}
          >
            <Search size={16} color={colors.textMuted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={`Search ${FILTER_LABELS[effectiveKind].toLowerCase()}...`}
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                fontSize: 14,
                color: colors.textPrimary,
                padding: 0,
              }}
            />
            {Boolean(searchQuery) && (
              <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={6}>
                <X size={15} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Under that: <number> <Filter Name> bold */}
      {visibleKinds.length > 0 && effectiveKind && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
            {activeCount} {FILTER_LABELS[effectiveKind]}
          </Text>
        </View>
      )}

      {/* Under that: Chatlist-style List (omitted completely if none visible) */}
      {visibleKinds.length === 0 ? (
        summaryLoaded ? (
          <View style={{ flex: 1 }} />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )
      ) : loading && items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => {
            const isMasked =
              item.username === "anonymous" ||
              item.isAlly === false ||
              (item as any).is_ally === false;
            const isAlly = !isMasked && Boolean(item.isAlly ?? true);
            const displayName = isAlly
              ? item.fullName || (item.username ? `@${item.username}` : "Student")
              : getAnonymousDisplayName(item);
            const subline = isAlly
              ? [item.username ? `@${item.username}` : null, item.course]
                  .filter(Boolean)
                  .join(" · ") || "Campus Ally"
              : [item.course, "Protected · Campus Student"].filter(Boolean).join(" · ");

            return (
              <Pressable
                onPress={() => openMemberProfile(item.id)}
                android_ripple={{ color: "rgba(0,0,0,0.04)" }}
                style={({ pressed }) => ({
                  backgroundColor: pressed
                    ? isDark
                      ? "#1F1F1F"
                      : "#F9FAFB"
                    : colors.surface,
                })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 20,
                    paddingVertical: 14,
                  }}
                >
                  {isAlly ? (
                    <UserAvatar avatar={item.avatarUrl} size="lg" />
                  ) : (
                    <AnonymousAvatar
                      avatarKey={item.avatarKey || getDeterministicAnonymousAvatar(item.id)}
                      size={56}
                    />
                  )}

                  <View style={{ flex: 1, minWidth: 0, marginLeft: 16 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "700",
                        color: colors.textPrimary,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {displayName}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textSecondary,
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {subline}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 52, alignItems: "center", paddingHorizontal: 32 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Users size={22} color={colors.primary} />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "700",
                  color: colors.textPrimary,
                  textAlign: "center",
                }}
              >
                {debouncedQuery
                  ? "No matches found"
                  : effectiveKind
                  ? `No ${FILTER_LABELS[effectiveKind].toLowerCase()} yet`
                  : "Nothing to show"}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : null
          }
        />
      )}

      {isOwnProfile && (
        <EditRelationshipPrivacyModal
          visible={privacyModalOpen}
          onClose={() => setPrivacyModalOpen(false)}
          accessToken={accessToken}
          initialPrivacy={relationship?.privacy ?? null}
          onSaved={(updated: MobileRelationshipPrivacyState) => {
            setRelationship((prev) => (prev ? { ...prev, privacy: updated } : prev));
          }}
        />
      )}
    </SafeAreaView>
  );
}
