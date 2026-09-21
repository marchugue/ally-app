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
import {
  ArrowLeft,
  UserPlus,
  Check,
  X,
  Filter,
  ChevronDown,
  Sparkles,
  Clock,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { getFriendRequestNotifications, markNotificationRead } from "@/lib/api/notification";
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
        await markNotificationRead(item.id, accessToken).catch(() => {});
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
        await markNotificationRead(item.id, accessToken).catch(() => {});
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
      <View style={{ flex: 1, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#1A6B3C" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* ═══ Header ═══ */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>
              Match Requests
            </Text>
            {counts.all > 0 && (
              <View
                style={{
                  backgroundColor: "#1A6B3C",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>
                  {counts.all}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Filter Toggle Button */}
        <TouchableOpacity
          onPress={() => setShowFilterDropdown((prev) => !prev)}
          hitSlop={8}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#F3F4F6",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Filter size={15} color="#1A6B3C" />
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827" }}>
            {activeFilter === "all" ? "All" : activeFilter === "unread" ? "Unread" : "Recent"}
          </Text>
          <ChevronDown size={13} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* ═══ Filter Chips Bar ═══ */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
        }}
      >
        {[
          { id: "all", label: "All", count: counts.all },
          { id: "unread", label: "Unread", count: counts.unread },
          { id: "recent", label: "Recent", count: counts.recent },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveFilter(tab.id as RequestFilter)}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: isActive ? "#1A6B3C" : "#F3F4F6",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: isActive ? "800" : "600",
                  color: isActive ? "#FFFFFF" : "#4B5563",
                }}
              >
                {tab.label}
              </Text>
              <View
                style={{
                  backgroundColor: isActive ? "rgba(255,255,255,0.25)" : "#E5E7EB",
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: isActive ? "#FFFFFF" : "#6B7280",
                  }}
                >
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ═══ Requests List ═══ */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          filteredRequests.length === 0
            ? { flex: 1, padding: 20 }
            : { paddingVertical: 12, paddingHorizontal: 16, gap: 12 }
        }
        renderItem={({ item }) => {
          const isProcessing = processing.has(item.id);
          const message = item.message || item.description || "Sent you a match request";
          const requesterId = item.from_user_id || item.fromUserId;
          const status = handledStatus[item.id];
          const anonAvatarKey = getAnonAvatarKey(requesterId);
          const anonName = `Anonymous ${anonAvatarKey.charAt(0).toUpperCase() + anonAvatarKey.slice(1)}`;

          return (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
                opacity: isProcessing ? 0.6 : 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <AnonymousAvatar avatarKey={anonAvatarKey} size={46} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                      {anonName}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "#FEF3C7",
                        paddingHorizontal: 7,
                        paddingVertical: 2,
                        borderRadius: 10,
                      }}
                    >
                      <Sparkles size={10} color="#D97706" />
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#92400E" }}>
                        MATCH REQUEST
                      </Text>
                    </View>
                  </View>

                  {/* Message Quote Box */}
                  <View
                    style={{
                      backgroundColor: "#F9FAFB",
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: "#F3F4F6",
                    }}
                  >
                    <Text style={{ fontSize: 12.5, color: "#4B5563", fontStyle: "italic", lineHeight: 18 }}>
                      "{message}"
                    </Text>
                  </View>

                  {/* Sent time */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                    <Clock size={11} color="#9CA3AF" />
                    <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                      Sent {formatTimestamp(item.created_at || item.timestamp)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Two-Column One-Row Buttons */}
              {status === "accepted" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 12,
                    paddingVertical: 8,
                    backgroundColor: "rgba(26,107,60,0.08)",
                    borderRadius: 12,
                  }}
                >
                  <Check size={15} color="#1A6B3C" />
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#1A6B3C" }}>
                    Match Request Accepted
                  </Text>
                </View>
              ) : status === "declined" ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 12,
                    paddingVertical: 8,
                    backgroundColor: "#F3F4F6",
                    borderRadius: 12,
                  }}
                >
                  <X size={15} color="#6B7280" />
                  <Text style={{ fontSize: 12.5, fontWeight: "600", color: "#6B7280" }}>
                    Match Request Declined
                  </Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    onPress={() => handleAccept(item)}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      backgroundColor: "#1A6B3C",
                      paddingVertical: 9,
                      borderRadius: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Check size={15} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
                      {isProcessing ? "Accepting..." : "Accept Request"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleReject(item)}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                    style={{
                      flex: 1,
                      backgroundColor: "#F3F4F6",
                      paddingVertical: 9,
                      borderRadius: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                    }}
                  >
                    <X size={15} color="#4B5563" />
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#4B5563" }}>
                      {isProcessing ? "Declining..." : "Decline Request"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<UserPlus size={28} color="#1A6B3C" />}
            title={activeFilter === "all" ? "No pending requests" : `No ${activeFilter} requests`}
            description={
              activeFilter === "all"
                ? "Connection requests from other students will appear here."
                : `You don't have any ${activeFilter} match requests right now.`
            }
          />
        }
      />

      {/* ═══ Dropdown Filter Modal ═══ */}
      <Modal
        visible={showFilterDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFilterDropdown(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "flex-start",
            paddingTop: insets.top + 55,
            paddingHorizontal: 16,
          }}
          onPress={() => setShowFilterDropdown(false)}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 5,
              alignSelf: "flex-end",
              width: 220,
            }}
          >
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
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: isSelected ? "rgba(26,107,60,0.08)" : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {isSelected ? (
                      <Check size={14} color="#1A6B3C" />
                    ) : (
                      <View style={{ width: 14 }} />
                    )}
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? "700" : "500",
                        color: isSelected ? "#1A6B3C" : "#374151",
                      }}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: isSelected ? "#1A6B3C" : "#F3F4F6",
                      paddingHorizontal: 6,
                      paddingVertical: 1,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: isSelected ? "#FFFFFF" : "#6B7280",
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

