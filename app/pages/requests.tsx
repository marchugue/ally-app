import { getAnonymousDisplayName, getAnonymousAvatarKey } from "@/lib/anonymousHandle";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  UserPlus,
  Check,
  X,
  Filter,
  Sparkles,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getFriendRequestNotifications,
  markNotificationRead,
  markTargetNotificationsRead,
} from "@/lib/api/notification";
import { dismissPresentedNotificationsByCategory } from "@/lib/pushNotifications";
import {
  acceptConnection,
  rejectConnection,
} from "@/lib/api/interaction";
import type { NotificationItem } from "@/types/notification";

type RequestFilter = "all" | "unread" | "recent";

const ANIMAL_KEYS = [
  "fox", "wolf", "whale", "owl", "panda", "otter", "falcon", "koala", "lynx", "dolphin", "raven", "badger"
];

function getAnonAvatarKey(id?: string | null): string {
  const seed = id || "default";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return ANIMAL_KEYS[hash % ANIMAL_KEYS.length];
}

function formatTimestamp(dateStr?: string): string {
  if (!dateStr) return "Just now";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return dateStr;
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return `${Math.floor(diffDay / 7)}w ago`;
}

function isRecent(dateStr?: string): boolean {
  if (!dateStr) return true;
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return true;
  return Date.now() - then < 24 * 60 * 60 * 1000;
}

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const { colors, isDark } = useTheme();
  const [requests, setRequests] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [handledStatus, setHandledStatus] = useState<Record<string, "accepted" | "declined">>({});
  const [activeFilter, setActiveFilter] = useState<RequestFilter>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!accessToken) return;
    try {
      const items = await getFriendRequestNotifications(accessToken);
      setRequests(items || []);
      dismissPresentedNotificationsByCategory("connections").catch(() => null);
      markTargetNotificationsRead("connections", accessToken).catch(() => null);
    } catch (err) {
      console.warn("Failed to load requests", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadRequests();
      setLoading(false);
    }
    init();
  }, [loadRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, [loadRequests]);

  const handleAccept = useCallback(
    async (item: NotificationItem) => {
      const requesterId = item.from_user_id || item.fromUserId;
      if (!accessToken || !requesterId) return;
      setProcessing((prev) => new Set(prev).add(item.id));
      try {
        await acceptConnection(requesterId, accessToken);
        await markNotificationRead(item.id, accessToken).catch(() => { });
        setHandledStatus((prev) => ({ ...prev, [item.id]: "accepted" }));
        setTimeout(() => {
          setRequests((prev) => prev.filter((r) => r.id !== item.id));
        }, 800);
      } catch (err) {
        console.warn("Failed to accept", err);
      } finally {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [accessToken]
  );

  const handleReject = useCallback(
    async (item: NotificationItem) => {
      const requesterId = item.from_user_id || item.fromUserId;
      if (!accessToken || !requesterId) return;
      setProcessing((prev) => new Set(prev).add(item.id));
      try {
        await rejectConnection(requesterId, accessToken);
        await markNotificationRead(item.id, accessToken).catch(() => { });
        setHandledStatus((prev) => ({ ...prev, [item.id]: "declined" }));
        setTimeout(() => {
          setRequests((prev) => prev.filter((r) => r.id !== item.id));
        }, 800);
      } catch (err) {
        console.warn("Failed to reject", err);
      } finally {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [accessToken]
  );

  const counts = useMemo(() => {
    return {
      all: requests.length,
      unread: requests.filter((r) => !(r.is_read ?? r.isRead ?? r.read ?? false)).length,
      recent: requests.filter((r) => isRecent(r.created_at || r.timestamp)).length,
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const isUnread = !(r.is_read ?? r.isRead ?? r.read ?? false);
      if (activeFilter === "unread") return isUnread;
      if (activeFilter === "recent") return isRecent(r.created_at || r.timestamp);
      return true;
    });
  }, [requests, activeFilter]);

  if (loading && requests.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* ═══ Top Sticky Header with Seamless Transparent Blend ═══ */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        }}
        pointerEvents="box-none"
      >
        <View
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 8,
            minHeight: insets.top + 48,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Left: Fully Rounded Pill Back Button */}
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={10}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Back to Notifications"
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={19} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Center: Match Requests Title + Filter Trigger (matching Notification screen) */}
          <TouchableOpacity
            onPress={() => setShowFilterDropdown((prev) => !prev)}
            hitSlop={10}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel="Filter match requests"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingVertical: 4,
              paddingHorizontal: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                fontFamily: "Fraunces_700Bold",
                fontSize: 22,
                color: isDark ? "rgba(255,255,255,0.85)" : colors.primary,
                letterSpacing: -0.5,
              }}
            >
              Match Requests
            </Text>

            <View style={{ position: "relative", alignItems: "center", justifyContent: "center" }}>
              <Filter size={17} color={colors.primary} strokeWidth={2.3} />
              {activeFilter !== "all" && (
                <View
                  style={{
                    position: "absolute",
                    top: -3,
                    right: -3,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.primary,
                    borderWidth: 1.5,
                    borderColor: colors.surface,
                  }}
                />
              )}
            </View>
          </TouchableOpacity>

          {/* Right: Balanced Pending Count Pill */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            {counts.all > 0 && (
              <View
                style={{
                  backgroundColor: colors.primarySoft,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isDark ? "rgba(16,185,129,0.22)" : "rgba(26,107,60,0.16)",
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "PlusJakartaSans-Bold",
                    color: colors.primary,
                  }}
                >
                  {counts.all}
                </Text>
              </View>
            )}
          </View>
        </View>

        <LinearGradient
          colors={
            isDark
              ? ["#181818", "rgba(24, 24, 24, 0.9)", "rgba(24, 24, 24, 0.4)", "rgba(24, 24, 24, 0)"]
              : ["#FFFFFF", "rgba(255, 255, 255, 0.9)", "rgba(255, 255, 255, 0.4)", "rgba(255, 255, 255, 0)"]
          }
          style={{ height: 28, width: "100%" }}
          pointerEvents="none"
        />
      </View>

      {/* ═══ Requests List ═══ */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={insets.top + 48}
          />
        }
        contentContainerStyle={
          filteredRequests.length === 0
            ? { flexGrow: 1, paddingTop: insets.top + 68, paddingHorizontal: 20 }
            : {
                paddingTop: insets.top + 54,
                paddingBottom: Math.max(insets.bottom + 24, 36),
              }
        }
        renderItem={({ item }) => {
          const isProcessing = processing.has(item.id);
          const isUnread = !(item.is_read ?? item.isRead ?? item.read ?? false);
          const message = item.message || item.description || "Sent you a match request";
          const requesterId = item.from_user_id || item.fromUserId;
          const status = handledStatus[item.id];
          const anonAvatarKey = getAnonymousAvatarKey(item, undefined, requesterId);
          const anonName = getAnonymousDisplayName(
            {
              ...item,
              id: requesterId,
              anonymous_handle: item.anonymous_handle || item.anonymousHandle || item.from_user_alias || item.fromUserAlias,
              full_name: item.from_user_name || item.fromUserName || item.author_name,
              name: item.username,
            },
            undefined,
            requesterId
          );

          return (
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: isUnread ? colors.primarySoft : colors.surface,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                opacity: isProcessing ? 0.65 : 1,
              }}
            >
              {/* Avatar with corner Sparkles badge matching notification rows */}
              <View style={{ position: "relative", flexShrink: 0 }}>
                <AnonymousAvatar avatarKey={anonAvatarKey} size={44} />
                <View
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: "#D97706",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 2,
                    borderColor: colors.surface,
                  }}
                >
                  <Sparkles size={10} color="#FFFFFF" />
                </View>
              </View>

              {/* Middle Content */}
              <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
                <Text
                  style={{
                    fontSize: 13.5,
                    lineHeight: 18,
                  }}
                  numberOfLines={2}
                >
                  <Text style={{ fontFamily: "PlusJakartaSans-Bold", color: colors.textPrimary }}>
                    {anonName}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontWeight: isUnread ? "600" : "400",
                      color: isUnread ? colors.textPrimary : colors.textSecondary,
                    }}
                  >
                    {" sent you a match request"}
                  </Text>
                </Text>

                {Boolean(message) && message.toLowerCase() !== "sent you a match request" && (
                  <Text
                    numberOfLines={2}
                    style={{
                      fontSize: 12.5,
                      lineHeight: 17,
                      color: colors.textSecondary,
                      fontFamily: "PlusJakartaSans",
                      marginTop: 3,
                    }}
                  >
                    {`"${message}"`}
                  </Text>
                )}

                {/* Full-width 1-row iconless Confirm / Decline pill CTAs */}
                {status === "accepted" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                    <Check size={13} color={colors.primary} strokeWidth={2.5} />
                    <Text style={{ fontSize: 12, fontFamily: "PlusJakartaSans-Bold", color: colors.primary }}>
                      Match Request Accepted
                    </Text>
                  </View>
                ) : status === "declined" ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 }}>
                    <X size={13} color={colors.textMuted} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textMuted }}>
                      Match Request Declined
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10, width: "100%" }}>
                    <TouchableOpacity
                      onPress={() => handleAccept(item)}
                      disabled={isProcessing}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        backgroundColor: colors.primary,
                        paddingVertical: 8.5,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontFamily: "PlusJakartaSans-Bold", color: "#FFFFFF" }}>
                        {isProcessing ? "Confirming..." : "Confirm"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleReject(item)}
                      disabled={isProcessing}
                      activeOpacity={0.7}
                      style={{
                        flex: 1,
                        backgroundColor: colors.surfaceMuted,
                        paddingVertical: 8.5,
                        paddingHorizontal: 12,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: "600", color: colors.textSecondary }}>
                        {isProcessing ? "Declining..." : "Decline"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Right Timestamp + Unread Dot */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingTop: 1,
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "500",
                    color: colors.textMuted,
                    fontFamily: "PlusJakartaSans",
                  }}
                >
                  {formatTimestamp(item.created_at || item.timestamp)}
                </Text>

                {isUnread && (
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 4,
                      backgroundColor: colors.primary,
                    }}
                  />
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<UserPlus size={28} color={colors.primary} />}
            title={activeFilter === "all" ? "No pending requests" : `No ${activeFilter} requests`}
            description={
              activeFilter === "all"
                ? "Connection requests from other students will appear here."
                : `You don't have any ${activeFilter} match requests right now.`
            }
          />
        }
      />

      {/* ═══ Centered Filter Dropdown Modal (matching Notifications) ═══ */}
      <Modal
        visible={showFilterDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterDropdown(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: isDark ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0.22)",
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: insets.top + 54,
          }}
          onPress={() => setShowFilterDropdown(false)}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              paddingVertical: 8,
              paddingHorizontal: 6,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.45 : 0.12,
              shadowRadius: 14,
              elevation: 8,
              width: 230,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontFamily: "PlusJakartaSans-Bold",
                color: colors.textMuted,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              Filter requests
            </Text>
            {[
              { id: "all", label: "All Requests", count: counts.all },
              { id: "unread", label: "Unread", count: counts.unread },
              { id: "recent", label: "Recent (Last 24h)", count: counts.recent },
            ].map((option) => {
              const isSelected = activeFilter === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setActiveFilter(option.id as RequestFilter);
                    setShowFilterDropdown(false);
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    backgroundColor: isSelected ? colors.primarySoft : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {isSelected ? (
                      <Check size={14} color={colors.primary} strokeWidth={2.5} />
                    ) : (
                      <View style={{ width: 14 }} />
                    )}
                    <Text
                      style={{
                        fontSize: 13,
                        fontFamily: isSelected ? "PlusJakartaSans-Bold" : "PlusJakartaSans",
                        color: isSelected ? colors.primary : colors.textPrimary,
                      }}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 999,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "PlusJakartaSans-Bold",
                        color: isSelected ? "#FFFFFF" : colors.textMuted,
                      }}
                    >
                      {option.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

