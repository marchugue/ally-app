import { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  StatusBar,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  Ban,
  Search,
  X,
  ShieldCheck,
  Calendar,
  AlertCircle,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { listBlockedUsers, unblockUser } from "@/lib/api/moderation";
import { getProfilesBatch } from "@/lib/api/profiles";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { BlockedUserEntry } from "@/types/moderation";
import type { Profile } from "@/types/profile";

interface BlockedEntry extends BlockedUserEntry {
  profile?: Profile;
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unblockTarget, setUnblockTarget] = useState<BlockedEntry | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlocked = useCallback(async () => {
    if (!accessToken) return;
    try {
      const blocked = await listBlockedUsers(accessToken);
      if (blocked.length > 0) {
        const ids = blocked.map((b) => b.blockedUserId);
        try {
          const profiles = await getProfilesBatch(ids, accessToken);
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          setEntries(
            blocked.map((b) => ({
              ...b,
              profile: profileMap.get(b.blockedUserId),
            }))
          );
        } catch {
          setEntries(blocked);
        }
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.warn("Failed to load blocked users", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadBlocked();
      setLoading(false);
    }
    init();
  }, [loadBlocked]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBlocked();
    setRefreshing(false);
  }, [loadBlocked]);

  const handleUnblock = useCallback(async () => {
    if (!unblockTarget || !accessToken) return;
    const targetId = unblockTarget.blockedUserId;
    setUnblockingId(targetId);
    try {
      await unblockUser(targetId, accessToken);
      setEntries((prev) => prev.filter((e) => e.blockedUserId !== targetId));
      setUnblockTarget(null);
    } catch (err) {
      console.warn("Failed to unblock user", err);
    } finally {
      setUnblockingId(null);
    }
  }, [unblockTarget, accessToken]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const name = (e.profile?.full_name || "").toLowerCase();
      const username = (e.profile?.username || "").toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [entries, searchQuery]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.centerContainer,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading blocked accounts…
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Modern Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.surface,
            borderBottomColor: colors.borderSubtle,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={[
              styles.backButton,
              {
                backgroundColor: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "#F3F4F6",
              },
            ]}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Pressable>
          <View>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              Blocked Accounts
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Manage restricted interactions
            </Text>
          </View>
        </View>

        {entries.length > 0 && (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isDark
                  ? "rgba(239, 68, 68, 0.16)"
                  : "#FEE2E2",
                borderColor: isDark ? "rgba(239, 68, 68, 0.3)" : "#FECACA",
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                { color: isDark ? "#F87171" : "#DC2626" },
              ]}
            >
              {entries.length} {entries.length === 1 ? "user" : "users"}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.blockedUserId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          filteredEntries.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Informational Guidance Banner */}
            <View
              style={[
                styles.noticeBanner,
                {
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.08)"
                    : "#FEF2F2",
                  borderColor: isDark
                    ? "rgba(239, 68, 68, 0.2)"
                    : "#FEE2E2",
                },
              ]}
            >
              <View
                style={[
                  styles.noticeIconBubble,
                  {
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.2)"
                      : "#FEE2E2",
                  },
                ]}
              >
                <Ban size={18} color={isDark ? "#F87171" : "#EF4444"} />
              </View>
              <View style={styles.noticeTextContainer}>
                <Text
                  style={[
                    styles.noticeTitle,
                    { color: isDark ? "#FCA5A5" : "#991B1B" },
                  ]}
                >
                  What happens when you block someone?
                </Text>
                <Text
                  style={[
                    styles.noticeDescription,
                    { color: isDark ? "#F87171" : "#7F1D1D" },
                  ]}
                >
                  Blocked accounts cannot view your profile, see your posts, or message you. Ally-jis never notifies users when they are blocked.
                </Text>
              </View>
            </View>

            {/* Search Input (visible if entries exist) */}
            {entries.length > 0 && (
              <View
                style={[
                  styles.searchContainer,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                <Search size={17} color={colors.textSecondary} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search blocked accounts…"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery("")}
                    hitSlop={8}
                    style={styles.clearSearchBtn}
                  >
                    <X size={15} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isItemUnblocking = unblockingId === item.blockedUserId;
          const fullName = item.profile?.full_name || "Blocked User";
          const username = item.profile?.username;
          const blockedDate = formatDate(item.blockedAt);

          return (
            <View
              style={[
                styles.userCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              {/* Left Avatar with block indicator */}
              <View style={styles.avatarWrapper}>
                <UserAvatar avatar={item.profile?.avatar_url} size="md" />
                <View
                  style={[
                    styles.avatarBadge,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.surface,
                    },
                  ]}
                >
                  <View style={styles.avatarBadgeInner}>
                    <Ban size={9} color="#FFFFFF" strokeWidth={3} />
                  </View>
                </View>
              </View>

              {/* User Identity Info */}
              <View style={styles.userInfo}>
                <Text
                  style={[styles.userName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {fullName}
                </Text>

                {username ? (
                  <Text
                    style={[styles.userHandle, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    @{username}
                  </Text>
                ) : null}

                {blockedDate ? (
                  <View style={styles.dateRow}>
                    <Calendar size={11} color={colors.textMuted} />
                    <Text
                      style={[styles.dateText, { color: colors.textMuted }]}
                    >
                      Blocked {blockedDate}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Action Button */}
              <Pressable
                onPress={() => setUnblockTarget(item)}
                disabled={isItemUnblocking}
                style={({ pressed }) => [
                  styles.unblockButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(239, 68, 68, 0.12)"
                      : "#FEF2F2",
                    borderColor: isDark
                      ? "rgba(239, 68, 68, 0.28)"
                      : "#FECACA",
                    opacity: pressed || isItemUnblocking ? 0.7 : 1,
                  },
                ]}
              >
                {isItemUnblocking ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#F87171" : "#EF4444"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.unblockButtonText,
                      { color: isDark ? "#F87171" : "#EF4444" },
                    ]}
                  >
                    Unblock
                  </Text>
                )}
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: colors.primarySoft },
                ]}
              >
                <ShieldCheck size={36} color={colors.primary} />
              </View>
              <Text
                style={[styles.emptyTitle, { color: colors.textPrimary }]}
              >
                No Blocked Accounts
              </Text>
              <Text
                style={[
                  styles.emptyDescription,
                  { color: colors.textSecondary },
                ]}
              >
                When you choose to block someone on Ally-jis, they will appear here. You can unblock them at any time.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <Search size={32} color={colors.textSecondary} />
              </View>
              <Text
                style={[styles.emptyTitle, { color: colors.textPrimary }]}
              >
                No Matching Users
              </Text>
              <Text
                style={[
                  styles.emptyDescription,
                  { color: colors.textSecondary },
                ]}
              >
                No blocked accounts match "{searchQuery}".
              </Text>
            </View>
          )
        }
      />

      <ConfirmModal
        visible={!!unblockTarget}
        title={`Unblock ${
          unblockTarget?.profile?.full_name ||
          (unblockTarget?.profile?.username
            ? `@${unblockTarget.profile.username}`
            : "this user")
        }?`}
        description="They will be able to message you, view your posts, and interact with your profile again."
        confirmLabel="Unblock"
        cancelLabel="Keep Blocked"
        onConfirm={handleUnblock}
        onCancel={() => setUnblockTarget(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listContent: {
    paddingBottom: 40,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  headerComponent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    gap: 12,
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  noticeIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  noticeDescription: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  userCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBadgeInner: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  userHandle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 1,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  dateText: {
    fontSize: 11,
    fontWeight: "500",
  },
  unblockButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 78,
  },
  unblockButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  emptyDescription: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
