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
  ShieldAlert,
  Search,
  X,
  ShieldCheck,
  Calendar,
  EyeOff,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { listRestrictedUsers, unrestrictUser } from "@/lib/api/moderation";
import { getProfilesBatch } from "@/lib/api/profiles";
import { UserAvatar } from "@/components/UserAvatar";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { RestrictedUserEntry } from "@/types/moderation";
import type { Profile } from "@/types/profile";

interface RestrictedEntry extends RestrictedUserEntry {
  profile?: Profile;
}

export default function RestrictedUsersScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { colors, isDark } = useTheme();

  const [entries, setEntries] = useState<RestrictedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unrestrictTarget, setUnrestrictTarget] = useState<RestrictedEntry | null>(null);
  const [unrestrictingId, setUnrestrictingId] = useState<string | null>(null);

  const loadRestricted = useCallback(async () => {
    if (!accessToken) return;
    try {
      const restricted = await listRestrictedUsers(accessToken);
      if (restricted.length > 0) {
        const ids = restricted.map((b) => b.restrictedUserId);
        try {
          const profiles = await getProfilesBatch(ids, accessToken);
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          setEntries(
            restricted.map((b) => ({
              ...b,
              profile: profileMap.get(b.restrictedUserId),
            }))
          );
        } catch {
          setEntries(restricted);
        }
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.warn("Failed to load restricted users", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadRestricted();
      setLoading(false);
    }
    init();
  }, [loadRestricted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRestricted();
    setRefreshing(false);
  }, [loadRestricted]);

  const handleUnrestrict = useCallback(async () => {
    if (!unrestrictTarget || !accessToken) return;
    const targetId = unrestrictTarget.restrictedUserId;
    setUnrestrictingId(targetId);
    try {
      await unrestrictUser(targetId, accessToken);
      setEntries((prev) => prev.filter((e) => e.restrictedUserId !== targetId));
      setUnrestrictTarget(null);
    } catch (err) {
      console.warn("Failed to unrestrict user", err);
    } finally {
      setUnrestrictingId(null);
    }
  }, [unrestrictTarget, accessToken]);

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
        <ActivityIndicator size="large" color={colors.accent || "#D97706"} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading restricted accounts…
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
              Restricted Accounts
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Quiet boundaries & interaction limits
            </Text>
          </View>
        </View>

        {entries.length > 0 && (
          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: isDark
                  ? "rgba(245, 158, 11, 0.16)"
                  : "#FEF3C7",
                borderColor: isDark
                  ? "rgba(245, 158, 11, 0.3)"
                  : "#FDE68A",
              },
            ]}
          >
            <Text
              style={[
                styles.countBadgeText,
                { color: isDark ? "#FBBF24" : "#B45309" },
              ]}
            >
              {entries.length} {entries.length === 1 ? "user" : "users"}
            </Text>
          </View>
        )}
      </View>

      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.restrictedUserId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent || "#D97706"}
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
                    ? "rgba(245, 158, 11, 0.08)"
                    : "#FFFBEB",
                  borderColor: isDark
                    ? "rgba(245, 158, 11, 0.2)"
                    : "#FEF3C7",
                },
              ]}
            >
              <View
                style={[
                  styles.noticeIconBubble,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.2)"
                      : "#FEF3C7",
                  },
                ]}
              >
                <EyeOff size={18} color={isDark ? "#FBBF24" : "#D97706"} />
              </View>
              <View style={styles.noticeTextContainer}>
                <Text
                  style={[
                    styles.noticeTitle,
                    { color: isDark ? "#FDE68A" : "#92400E" },
                  ]}
                >
                  How does restriction work?
                </Text>
                <Text
                  style={[
                    styles.noticeDescription,
                    { color: isDark ? "#FCD34D" : "#78350F" },
                  ]}
                >
                  Restricting is a quiet boundary. They cannot see your online presence or read receipts. Their comments on your posts will only be visible to them.
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
                  placeholder="Search restricted accounts…"
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
          const isItemUnrestricting = unrestrictingId === item.restrictedUserId;
          const fullName = item.profile?.full_name || "Restricted User";
          const username = item.profile?.username;
          const restrictedDate = formatDate(item.restrictedAt);

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
              {/* Left Avatar with restrict indicator */}
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
                    <EyeOff size={9} color="#FFFFFF" strokeWidth={2.8} />
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

                {restrictedDate ? (
                  <View style={styles.dateRow}>
                    <Calendar size={11} color={colors.textMuted} />
                    <Text
                      style={[styles.dateText, { color: colors.textMuted }]}
                    >
                      Restricted {restrictedDate}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Action Button */}
              <Pressable
                onPress={() => setUnrestrictTarget(item)}
                disabled={isItemUnrestricting}
                style={({ pressed }) => [
                  styles.unrestrictButton,
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.12)"
                      : "#FFFBEB",
                    borderColor: isDark
                      ? "rgba(245, 158, 11, 0.3)"
                      : "#FDE68A",
                    opacity: pressed || isItemUnrestricting ? 0.7 : 1,
                  },
                ]}
              >
                {isItemUnrestricting ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#FBBF24" : "#D97706"}
                  />
                ) : (
                  <Text
                    style={[
                      styles.unrestrictButtonText,
                      { color: isDark ? "#FBBF24" : "#D97706" },
                    ]}
                  >
                    Unrestrict
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
                  {
                    backgroundColor: isDark
                      ? "rgba(245, 158, 11, 0.15)"
                      : "#FEF3C7",
                  },
                ]}
              >
                <ShieldCheck
                  size={36}
                  color={isDark ? "#FBBF24" : "#D97706"}
                />
              </View>
              <Text
                style={[styles.emptyTitle, { color: colors.textPrimary }]}
              >
                No Restricted Accounts
              </Text>
              <Text
                style={[
                  styles.emptyDescription,
                  { color: colors.textSecondary },
                ]}
              >
                You haven't restricted anyone. Restricting allows you to discreetly protect your peace without blocking.
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
                No restricted accounts match "{searchQuery}".
              </Text>
            </View>
          )
        }
      />

      <ConfirmModal
        visible={!!unrestrictTarget}
        title={`Unrestrict ${
          unrestrictTarget?.profile?.full_name ||
          (unrestrictTarget?.profile?.username
            ? `@${unrestrictTarget.profile.username}`
            : "this user")
        }?`}
        description="They will be able to see your online status and active presence again."
        confirmLabel="Unrestrict"
        cancelLabel="Keep Restricted"
        onConfirm={handleUnrestrict}
        onCancel={() => setUnrestrictTarget(null)}
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
    backgroundColor: "#D97706",
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
  unrestrictButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 86,
  },
  unrestrictButtonText: {
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
