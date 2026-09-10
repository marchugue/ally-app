import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  ScrollView,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  CheckCheck,
  UserPlus,
  MessageCircle,
  Heart,
  Rss,
  Drama,
  ChevronRight,
  Sparkles,
  Trash2,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { getSocket } from "@/lib/socket";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from "@/lib/api/notification";
import type { NotificationItem } from "@/types/notification";

type FilterCategory = "all" | "unread" | "requests" | "matches";

const POLL_INTERVAL_MS = 10000;

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

function isTodayDate(dateStr?: string): boolean {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

const EXCLUDED_NOTIFICATION_TYPES = ["message"];

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");

  const loadNotifications = useCallback(async (isInitial = false) => {
    if (!accessToken) {
      setNotifications([]);
      if (isInitial) setLoading(false);
      return;
    }
    if (isInitial) setLoading(true);
    try {
      const items = await listNotifications(accessToken);
      if (!items || items.length === 0) {
        setNotifications([]);
      } else {
        const filtered = items.filter(
          (n) => !EXCLUDED_NOTIFICATION_TYPES.includes(n.type)
        );
        setNotifications(filtered);
      }
    } catch (err) {
      console.warn("Failed to load notifications", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [accessToken]);

  // Screen Focus + Real-time socket events (relaxed 60s fallback matching web)
  useFocusEffect(
    useCallback(() => {
      void loadNotifications(false);
      const interval = setInterval(() => {
        void loadNotifications(false);
      }, 60000);

      return () => clearInterval(interval);
    }, [loadNotifications])
  );

  // Real-time socket events for notifications
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onRealtimeNotification = () => {
      void loadNotifications(false);
    };

    socket.on("notification:new", onRealtimeNotification);
    socket.on("notification", onRealtimeNotification);

    return () => {
      socket.off("notification:new", onRealtimeNotification);
      socket.off("notification", onRealtimeNotification);
    };
  }, [accessToken, loadNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (accessToken) {
      try {
        await markAllNotificationsRead(accessToken);
      } catch (err) {
        console.warn("Failed to mark all read API", err);
      }
    }
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true, read: true }))
    );
  }, [accessToken]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      "Clear Notifications",
      "Are you sure you want to clear all notifications?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            if (accessToken) {
              try {
                await clearAllNotifications(accessToken);
              } catch (err) {
                console.warn("Failed to clear notifications", err);
              }
            }
            setNotifications([]);
          },
        },
      ]
    );
  }, [accessToken]);

  const handleTapNotification = useCallback(
    async (item: NotificationItem) => {
      // Mark as read locally and remote
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, read: true } : n))
      );
      if (accessToken) {
        markNotificationRead(item.id, accessToken).catch(() => {});
      }

      // Navigate by type
      if (item.type === "friend_request" || item.type === "connection_request") {
        router.push("/pages/requests" as any);
      } else if (item.type === "message" || item.type === "accepted" || item.type === "anon_match") {
        router.push("/(tabs)/messages" as any);
      } else if (item.type === "match") {
        router.push("/(tabs)/discover" as any);
      } else if (item.type === "comment_reply") {
        // Deep-link with commentId so media-preview can auto-enter reply mode
        const targetPostId = item.post_id || item.target_id;
        if (targetPostId) {
          router.push({
            pathname: "/pages/media-preview" as any,
            params: {
              postId: targetPostId,
              openComments: "true",
              ...(item.comment_id ? { commentId: item.comment_id } : {}),
            },
          });
        } else {
          router.push("/(tabs)" as any);
        }
      } else if (
        item.type === "like" ||
        item.type === "post_like" ||
        item.type === "comment" ||
        item.type === "post_comment" ||
        item.type === "comment_like"
      ) {
        const targetPostId = item.post_id || item.target_id;
        if (targetPostId) {
          router.push({
            pathname: "/pages/media-preview" as any,
            params: {
              postId: targetPostId,
              openComments: "true",
            },
          });
        } else {
          router.push("/(tabs)" as any);
        }
      }
    },
    [accessToken]
  );

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead && !n.read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (EXCLUDED_NOTIFICATION_TYPES.includes(n.type)) return false;
      const isUnread = !n.isRead && !n.read;
      if (activeFilter === "unread") return isUnread;
      if (activeFilter === "requests") return n.type === "friend_request" || n.type === "accepted" || n.type === "connection_request";
      if (activeFilter === "matches") return n.type === "match" || n.type === "anon_match";
      return true;
    });
  }, [notifications, activeFilter]);

  const { todayList, earlierList } = useMemo(() => {
    const today: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];
    for (const item of filteredNotifications) {
      if (isTodayDate(item.timestamp || item.created_at)) {
        today.push(item);
      } else {
        earlier.push(item);
      }
    }
    return { todayList: today, earlierList: earlier };
  }, [filteredNotifications]);

  const renderNotificationAvatar = (item: NotificationItem) => {
    const avatarUri = item.avatar_url || item.from_user?.avatar_url || item.user_avatar;
    let badgeIcon: React.ReactNode = null;
    let badgeBg = "#1A6B3C";

    switch (item.type) {
      case "comment":
      case "post_comment":
      case "comment_reply":
        badgeIcon = <MessageCircle size={10} color="#FFFFFF" />;
        badgeBg = "#EC4899";
        break;
      case "like":
      case "post_like":
      case "comment_like":
        badgeIcon = <Heart size={10} color="#FFFFFF" />;
        badgeBg = "#EF4444";
        break;
      case "feed":
      case "post":
      case "post_created":
        badgeIcon = <Rss size={10} color="#FFFFFF" />;
        badgeBg = "#10B981";
        break;
      case "friend_request":
      case "connection_request":
        badgeIcon = <UserPlus size={10} color="#FFFFFF" />;
        badgeBg = "#2563EB";
        break;
      case "accepted":
      case "connection_accepted":
        badgeIcon = <Text style={{ fontSize: 8 }}>🤝</Text>;
        badgeBg = "#16A34A";
        break;
      case "match":
        badgeIcon = <Sparkles size={10} color="#FFFFFF" />;
        badgeBg = "#D97706";
        break;
      case "anon_match":
        badgeIcon = <Drama size={10} color="#FFFFFF" />;
        badgeBg = "#3B8C7E";
        break;
      default:
        badgeIcon = <Bell size={10} color="#FFFFFF" />;
        badgeBg = "#4B5563";
        break;
    }

    return (
      <View style={{ width: 44, height: 44, position: "relative" }}>
        <UserAvatar
          avatar={item.type === "anon_match" ? "🎭" : avatarUri}
          fallback={item.type === "anon_match" ? "🎭" : "👤"}
          size="md"
        />
        <View
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: badgeBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1.5,
            borderColor: "#FFFFFF",
          }}
        >
          {badgeIcon}
        </View>
      </View>
    );
  };

  const renderRow = (item: NotificationItem) => {
    const isUnread = !item.isRead && !item.read;
    const name = item.username || item.author_name || item.from_user?.username || item.from_user?.full_name || "Someone";

    // 1. Build Action Headline (e.g., "charlotte commented on your post")
    let actionText = "";
    if (item.type === "post_comment" || item.type === "comment") {
      actionText = "commented on your post";
    } else if (item.type === "post_like" || item.type === "like") {
      actionText = "liked your post";
    } else if (item.type === "comment_reply") {
      actionText = "replied to your comment";
    } else if (item.type === "comment_like") {
      actionText = "liked your comment";
    } else if (item.type === "friend_request" || item.type === "connection_request") {
      actionText = "sent you a connection request";
    } else if (item.type === "accepted" || item.type === "connection_accepted") {
      actionText = "accepted your connection request";
    } else if (item.type === "match") {
      actionText = "matched with you!";
    } else if (item.type === "anon_match") {
      actionText = "sent an anonymous match invitation";
    } else {
      actionText = item.title || "interacted with your post";
    }

    // 2. Extract Subtitle / Description content (e.g. comment text "asd")
    let subtext = "";
    const rawDesc = (item.description || item.message || "").trim();
    if (rawDesc) {
      if (rawDesc.includes('commented: "')) {
        subtext = rawDesc.replace(/^commented:\s*"/i, "").replace(/"$/, "");
      } else if (rawDesc.includes('replied: "')) {
        subtext = rawDesc.replace(/^replied:\s*"/i, "").replace(/"$/, "");
      } else if (
        rawDesc !== "liked your post." &&
        rawDesc !== "liked your comment." &&
        rawDesc !== "Someone commented on your post." &&
        rawDesc !== "Someone liked your post." &&
        rawDesc !== "Someone replied to your comment." &&
        !rawDesc.startsWith("Someone ") &&
        rawDesc !== item.title
      ) {
        subtext = rawDesc;
      }
    }

    return (
      <Pressable
        key={item.id}
        onPress={() => handleTapNotification(item)}
        android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: isUnread ? "rgba(26,107,60,0.03)" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
          gap: 12,
        }}
      >
        {renderNotificationAvatar(item)}

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <Text
              style={{
                fontSize: 13.5,
                color: "#111827",
                lineHeight: 18,
                flex: 1,
              }}
              numberOfLines={1}
            >
              <Text style={{ fontWeight: "700", color: "#111827" }}>
                {item.type === "anon_match" ? "Anonymous Ally" : name}
              </Text>
              <Text style={{ fontWeight: isUnread ? "600" : "400", color: isUnread ? "#111827" : "#374151" }}>
                {` ${actionText}`}
              </Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#9CA3AF", fontWeight: "500" }}>
              {formatTimestamp(item.timestamp || item.created_at)}
            </Text>
          </View>

          {Boolean(subtext) && (
            <Text
              style={{
                fontSize: 13.5,
                color: isUnread ? "#4B5563" : "#6B7280",
                marginTop: 3,
                lineHeight: 19,
                fontWeight: "400",
              }}
              numberOfLines={2}
            >
              {subtext}
            </Text>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {isUnread && (
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#1A6B3C",
              }}
            />
          )}
          <ChevronRight size={16} color="#D1D5DB" />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB", paddingTop: insets.top }}>
      {/* ═══ Header Bar ═══ */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text
            style={{
              fontFamily: "Fraunces_700Bold",
              fontSize: 24,
              color: "#1A6B3C",
              letterSpacing: -0.5,
            }}
          >
            Notifications
          </Text>
          {unreadCount > 0 && (
            <View
              style={{
                backgroundColor: "#1A6B3C",
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 10,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>
                {unreadCount}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: "rgba(26,107,60,0.08)",
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 12,
              }}
            >
              <CheckCheck size={14} color="#1A6B3C" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#1A6B3C" }}>
                Read All
              </Text>
            </Pressable>
          )}

          {notifications.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: "#F3F4F6",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={16} color="#6B7280" />
            </Pressable>
          )}
        </View>
      </View>

      {/* ═══ Category Segment Filter Tabs ═══ */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          paddingVertical: 10,
          paddingHorizontal: 16,
        }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "requests", label: "Requests" },
            { id: "matches", label: "Matches" },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveFilter(tab.id as FilterCategory)}
                style={{
                  backgroundColor: isActive ? "#1A6B3C" : "#F3F4F6",
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 14,
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
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ═══ Content List ═══ */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B3C" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Quick Requests Card */}
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
          <Pressable
            onPress={() => router.push("/pages/requests" as any)}
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: "rgba(26,107,60,0.15)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: "rgba(26,107,60,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserPlus size={20} color="#1A6B3C" />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827" }}>
                  Connection Requests
                </Text>
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                  Review pending campus allies & invites
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ChevronRight size={18} color="#9CA3AF" />
            </View>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ padding: 20, gap: 16 }}>
            {[1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={{
                  height: 64,
                  borderRadius: 16,
                  backgroundColor: "#E5E7EB",
                  opacity: 0.5,
                }}
              />
            ))}
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={{ padding: 40, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 24,
                backgroundColor: "rgba(26,107,60,0.1)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Bell size={28} color="#1A6B3C" />
            </View>
            <Text style={{ fontFamily: "Fraunces_700Bold", fontSize: 18, color: "#111827", marginBottom: 6 }}>
              You're all caught up! 🎉
            </Text>
            <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center" }}>
              New likes, comments, and connection requests will appear here.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            {/* Today Section */}
            {todayList.length > 0 && (
              <View>
                <View
                  style={{
                    backgroundColor: "#F3F4F6",
                    paddingHorizontal: 20,
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#6B7280",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    Today
                  </Text>
                </View>
                <View style={{ backgroundColor: "#FFFFFF" }}>
                  {todayList.map((item) => renderRow(item))}
                </View>
              </View>
            )}

            {/* Earlier Section */}
            {earlierList.length > 0 && (
              <View style={{ marginTop: todayList.length > 0 ? 12 : 0 }}>
                <View
                  style={{
                    backgroundColor: "#F3F4F6",
                    paddingHorizontal: 20,
                    paddingVertical: 6,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E5E7EB",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: "#6B7280",
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                    }}
                  >
                    Earlier
                  </Text>
                </View>
                <View style={{ backgroundColor: "#FFFFFF" }}>
                  {earlierList.map((item) => renderRow(item))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}