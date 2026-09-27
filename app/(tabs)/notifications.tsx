import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
  Modal,
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
  Flame,
  Reply,
  Check,
  X,
  Filter,
  ChevronDown,
  ShieldAlert,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { acceptConnection, rejectConnection } from "@/lib/api/interaction";
import { getSocket } from "@/lib/socket";
import * as Notifications from "expo-notifications";
import {
  setAppBadgeCount,
  dismissPresentedNotificationByConversationId,
  dismissPresentedNotificationsByCategory,
} from "@/lib/pushNotifications";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  clearAllNotifications,
} from "@/lib/api/notification";
import type { NotificationItem, NotificationCategory } from "@/types/notification";

type FilterCategory = NotificationCategory;

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
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.floor(diffMo / 12)}y ago`;
}

type DateGroupKey = "today" | "earlier" | "last_month" | "last_year";

function getDateGroup(dateStr?: string): DateGroupKey {
  if (!dateStr) return "earlier";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "earlier";
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const dYear = d.getFullYear();
  const dMonth = d.getMonth();

  if (
    d.getDate() === now.getDate() &&
    dMonth === currentMonth &&
    dYear === currentYear
  ) {
    return "today";
  }

  // Last Month (previous calendar month)
  const isLastMonth =
    (currentMonth > 0 && dYear === currentYear && dMonth === currentMonth - 1) ||
    (currentMonth === 0 && dYear === currentYear - 1 && dMonth === 11);

  if (isLastMonth) {
    return "last_month";
  }

  // Last Year (previous calendar year or older)
  if (dYear < currentYear) {
    return "last_year";
  }

  // Earlier (earlier this month or earlier this year)
  return "earlier";
}

const EXCLUDED_NOTIFICATION_TYPES: string[] = [];

function deriveCategory(type?: string): NotificationCategory {
  if (!type) return "activity";
  const t = type.toLowerCase();
  if (t === "message") return "messages";
  if (
    t.includes("friend") ||
    t.includes("connection") ||
    t.includes("request") ||
    t.includes("accepted")
  ) {
    return "connections";
  }
  if (t.includes("match") || t.includes("ally")) return "ally";
  if (
    t.includes("safety") ||
    t.includes("emergency") ||
    t.includes("alert") ||
    t.includes("warning")
  ) {
    return "safety";
  }
  return "activity";
}

const ANIMAL_KEYS = [
  "fox", "wolf", "whale", "owl", "panda", "otter", "falcon", "koala", "lynx", "dolphin", "raven", "badger"
];

export function getAnonymousInfo(item: NotificationItem) {
  const isExplicitAnonType =
    item.type === "anon_match" ||
    item.type === "match" ||
    item.type === "friend_request" ||
    item.type === "connection_request";

  const nameContainsAnon = Boolean(
    (item.username && /anonymous/i.test(item.username)) ||
    (item.author_name && /anonymous/i.test(item.author_name))
  );
  const titleContainsAnon = Boolean(
    item.title && (/anonymous/i.test(item.title) || /messaged you/i.test(item.title))
  );
  const descContainsAnon = Boolean(
    item.description && /anonymous/i.test(item.description)
  );

  const rawAvatar = (item as any).avatarKey || (item as any).avatar_key || (item as any).avatar || (item as any).from_user_avatar;
  const avatarIsAnimal = Boolean(
    rawAvatar &&
    ANIMAL_KEYS.includes(String(rawAvatar).toLowerCase().trim())
  );

  const isAnon =
    isExplicitAnonType ||
    nameContainsAnon ||
    titleContainsAnon ||
    descContainsAnon ||
    avatarIsAnimal ||
    Boolean((item as any).is_anonymous || (item as any).isAnonymous);

  if (!isAnon) {
    return { isAnon: false, avatarKey: null, anonName: null };
  }

  // Determine animal avatar key
  let avatarKey: string | null = null;
  if (avatarIsAnimal && rawAvatar) {
    avatarKey = String(rawAvatar).toLowerCase().trim();
  } else if (item.author_name) {
    const match = item.author_name.match(/anonymous\s+(\w+)/i);
    if (match && ANIMAL_KEYS.includes(match[1].toLowerCase())) {
      avatarKey = match[1].toLowerCase();
    }
  } else if (item.username) {
    const match = item.username.match(/anonymous\s+(\w+)/i);
    if (match && ANIMAL_KEYS.includes(match[1].toLowerCase())) {
      avatarKey = match[1].toLowerCase();
    }
  }
  if (!avatarKey && item.title) {
    const match = item.title.match(/anonymous\s+(\w+)/i);
    if (match && ANIMAL_KEYS.includes(match[1].toLowerCase())) {
      avatarKey = match[1].toLowerCase();
    }
  }

  // Derive deterministically from from_user_id or id
  if (!avatarKey) {
    const seed = item.from_user_id || item.id || "default";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    avatarKey = ANIMAL_KEYS[hash % ANIMAL_KEYS.length];
  }

  // Determine anonymous name
  let anonName = "Anonymous Ally";
  if (nameContainsAnon && (item.author_name || item.username)) {
    anonName = item.author_name || item.username || "Anonymous Ally";
  } else if (titleContainsAnon && item.title && item.title.includes("messaged you")) {
    anonName = item.title.replace(/\s*messaged you.*$/i, "").trim();
  } else if (titleContainsAnon && item.title && item.title.includes("sent an anonymous")) {
    anonName = item.title.replace(/\s*sent an anonymous.*$/i, "").trim();
  } else if (avatarKey) {
    const capitalized = avatarKey.charAt(0).toUpperCase() + avatarKey.slice(1);
    anonName = `Anonymous ${capitalized}`;
  }

  return {
    isAnon: true,
    avatarKey,
    anonName,
  };
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [handledRequests, setHandledRequests] = useState<Record<string, "accepted" | "declined">>({});
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const loadNotifications = useCallback(
    async (showSkeleton = false) => {
      if (!accessToken) {
        setNotifications([]);
        setLoading(false);
        return;
      }
      if (showSkeleton) setLoading(true);
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
        setLoading(false);
      }
    },
    [accessToken]
  );

  // Initial load when accessToken becomes available
  useEffect(() => {
    if (accessToken) {
      void loadNotifications(true);
    }
  }, [accessToken, loadNotifications]);

  // Screen Focus + Real-time socket events (relaxed 60s fallback matching web)
  useFocusEffect(
    useCallback(() => {
      void loadNotifications(notifications.length === 0);
      const interval = setInterval(() => {
        void loadNotifications(false);
      }, 60000);

      return () => clearInterval(interval);
    }, [loadNotifications, notifications.length])
  );

  // Real-time socket events for notifications
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onRealtimeNotification = () => {
      void loadNotifications(false);
    };

    const onNotificationUpdated = (payload: any) => {
      if (!payload) return;
      setNotifications((prev) => {
        const idx = prev.findIndex(
          (n) => n.id === payload.id || (payload.group_key && n.group_key === payload.group_key)
        );
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...payload, isRead: false, read: false, is_read: false };
          return next;
        }
        return [payload, ...prev];
      });
    };

    const onNotificationRead = (payload: any) => {
      if (!payload) return;
      setNotifications((prev) =>
        prev.map((n) => {
          if (
            (payload.id && n.id === payload.id) ||
            (payload.targetId && (n.target_id === payload.targetId || n.group_key?.includes(payload.targetId)))
          ) {
            return { ...n, isRead: true, read: true, is_read: true, unread_count: 0 };
          }
          return n;
        })
      );
    };

    const onNotificationCleared = (payload: any) => {
      if (!payload) return;
      if (payload.conversationId) {
        dismissPresentedNotificationByConversationId(payload.conversationId).catch(() => null);
      }
      if (payload.category) {
        dismissPresentedNotificationsByCategory(payload.category, payload.targetId).catch(() => null);
      }
      setNotifications((prev) =>
        prev.map((n) => {
          if (
            (payload.conversationId && (n.target_id === payload.conversationId || n.group_key?.includes(payload.conversationId))) ||
            (payload.targetId && (n.target_id === payload.targetId || n.group_key?.includes(payload.targetId))) ||
            (payload.groupKey && n.group_key === payload.groupKey)
          ) {
            return { ...n, isRead: true, read: true, is_read: true, unread_count: 0 };
          }
          return n;
        })
      );
    };

    socket.on("notification:new", onRealtimeNotification);
    socket.on("notification:updated", onNotificationUpdated);
    socket.on("notification:read", onNotificationRead);
    socket.on("notification:cleared", onNotificationCleared);
    socket.on("notification", onRealtimeNotification);

    return () => {
      socket.off("notification:new", onRealtimeNotification);
      socket.off("notification:updated", onNotificationUpdated);
      socket.off("notification:read", onNotificationRead);
      socket.off("notification:cleared", onNotificationCleared);
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
    setAppBadgeCount(0);
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
            setAppBadgeCount(0);
          },
        },
      ]
    );
  }, [accessToken]);

  const handleAcceptInline = useCallback(
    async (item: NotificationItem) => {
      const requesterId = item.from_user_id || item.fromUserId;
      if (!accessToken || !requesterId || busyIds[item.id]) return;

      setBusyIds((prev) => ({ ...prev, [item.id]: true }));
      try {
        const res = await acceptConnection(requesterId, accessToken);
        await markNotificationRead(item.id, accessToken).catch(() => {});
        setHandledRequests((prev) => ({ ...prev, [item.id]: "accepted" }));
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === item.id
              ? {
                  ...n,
                  isRead: true,
                  read: true,
                  target_id: res?.conversationId || n.target_id,
                }
              : n
          )
        );
      } catch (err) {
        console.warn("Failed to accept request inline:", err);
      } finally {
        setBusyIds((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [accessToken, busyIds]
  );

  const handleDeclineInline = useCallback(
    async (item: NotificationItem) => {
      const requesterId = item.from_user_id || item.fromUserId;
      if (!accessToken || !requesterId || busyIds[item.id]) return;

      setBusyIds((prev) => ({ ...prev, [item.id]: true }));
      try {
        await rejectConnection(requesterId, accessToken);
        await markNotificationRead(item.id, accessToken).catch(() => {});
        setHandledRequests((prev) => ({ ...prev, [item.id]: "declined" }));
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true, read: true } : n))
        );
      } catch (err) {
        console.warn("Failed to decline request inline:", err);
      } finally {
        setBusyIds((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [accessToken, busyIds]
  );

  const handleTapNotification = useCallback(
    async (item: NotificationItem) => {
      // Mark as read locally and remote
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true, read: true } : n))
      );
      if (accessToken) {
        markNotificationRead(item.id, accessToken).catch(() => {});
      }
      if (Notifications && typeof Notifications.getBadgeCountAsync === "function") {
        Notifications.getBadgeCountAsync().then((count) => {
          setAppBadgeCount(Math.max(0, count - 1));
        }).catch(() => null);
      }

      // Automatically clear corresponding notification from device tray
      if (item.type === "message" || item.type === "anon_match" || item.type === "streak_reminder" || item.type === "accepted") {
        const targetConvId = item.target_id || item.post_id;
        if (targetConvId) {
          dismissPresentedNotificationByConversationId(targetConvId).catch(() => null);
        }
      } else if (item.type === "friend_request" || item.type === "connection_request") {
        dismissPresentedNotificationsByCategory("connections").catch(() => null);
      } else if (item.category) {
        dismissPresentedNotificationsByCategory(item.category).catch(() => null);
      }

      // 1. Direct Redirection from Backend (if provided)
      if (item.redirection?.route) {
        router.push({
          pathname: item.redirection.route as any,
          params: item.redirection.params || {},
        });
        return;
      }

      // 2. Fallback navigate by type
      if (item.type === "friend_request" || item.type === "connection_request") {
        if (handledRequests[item.id] === "accepted") {
          const targetConvId = item.target_id || item.post_id;
          if (targetConvId) {
            router.push({
              pathname: "/pages/conversation" as any,
              params: { conversationId: targetConvId },
            });
          } else {
            router.push("/(tabs)/messages" as any);
          }
        } else {
          router.push("/pages/requests" as any);
        }
      } else if (item.type === "streak_reminder") {
        const targetConvId = item.target_id || item.post_id;
        if (targetConvId) {
          router.push({
            pathname: "/pages/conversation" as any,
            params: { conversationId: targetConvId },
          });
        } else {
          router.push("/(tabs)/messages" as any);
        }
      } else if (item.type === "message" || item.type === "accepted" || item.type === "anon_match") {
        const targetConvId = item.target_id || item.post_id;
        if (targetConvId) {
          router.push({
            pathname: "/pages/conversation" as any,
            params: { conversationId: targetConvId },
          });
        } else {
          router.push("/(tabs)/messages" as any);
        }
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
        item.type === "comment_like" ||
        item.type === "comment_mention"
      ) {
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
      }
    },
    [accessToken]
  );

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !(n.is_read ?? n.isRead ?? n.read ?? false)).length;
  }, [notifications]);

  const categoryCounts = useMemo(() => {
    const counts = {
      all: notifications.length,
      unread: 0,
      messages: 0,
      connections: 0,
      ally: 0,
      safety: 0,
      activity: 0,
    };
    for (const n of notifications) {
      const isUnread = !(n.is_read ?? n.isRead ?? n.read ?? false);
      if (isUnread) counts.unread++;
      const cat = n.category || deriveCategory(n.type);
      if (cat in counts && cat !== "all" && cat !== "unread") {
        counts[cat as keyof typeof counts]++;
      }
    }
    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (EXCLUDED_NOTIFICATION_TYPES.includes(n.type)) return false;
      const isUnread = !(n.is_read ?? n.isRead ?? n.read ?? false);
      if (activeFilter === "unread") return isUnread;
      if (activeFilter === "all") return true;
      const cat = n.category || deriveCategory(n.type);
      return cat === activeFilter;
    });
  }, [notifications, activeFilter]);

  const { todayList, earlierList, lastMonthList, lastYearList } = useMemo(() => {
    const today: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];
    const lastMonth: NotificationItem[] = [];
    const lastYear: NotificationItem[] = [];
    for (const item of filteredNotifications) {
      const grp = getDateGroup(item.created_at || item.timestamp);
      if (grp === "today") {
        today.push(item);
      } else if (grp === "last_month") {
        lastMonth.push(item);
      } else if (grp === "last_year") {
        lastYear.push(item);
      } else {
        earlier.push(item);
      }
    }
    return { todayList: today, earlierList: earlier, lastMonthList: lastMonth, lastYearList: lastYear };
  }, [filteredNotifications]);

  const renderNotificationAvatar = (item: NotificationItem) => {
    const fromUser = Array.isArray(item.from_user) ? item.from_user[0] : item.from_user;
    const avatarUri = item.avatar_url || fromUser?.avatar_url || item.user_avatar;
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
        badgeIcon = <Sparkles size={10} color="#FFFFFF" />;
        badgeBg = "#1A6B3C";
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
      case "streak_reminder":
        badgeIcon = <Flame size={10} color="#FFFFFF" />;
        badgeBg = "#EB5600";
        break;
      case "message":
        badgeIcon = <MessageCircle size={10} color="#FFFFFF" />;
        badgeBg = "#1A6B3C";
        break;
      case "safety":
      case "safety_alert":
        badgeIcon = <ShieldAlert size={10} color="#FFFFFF" />;
        badgeBg = "#DC2626";
        break;
      default:
        badgeIcon = <Bell size={10} color="#FFFFFF" />;
        badgeBg = "#4B5563";
        break;
    }

    if (item.type === "streak_reminder") {
      return (
        <View style={{ width: 44, height: 44, position: "relative" }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "rgba(235, 86, 0, 0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Flame size={22} color="#EB5600" />
          </View>
          <View
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: "#EB5600",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: "#FFFFFF",
            }}
          >
            <Flame size={10} color="#FFFFFF" />
          </View>
        </View>
      );
    }

    const anonInfo = getAnonymousInfo(item);

    return (
      <View style={{ width: 44, height: 44, position: "relative" }}>
        {anonInfo.isAnon ? (
          <AnonymousAvatar
            avatarKey={anonInfo.avatarKey || "fox"}
            size={40}
          />
        ) : (
          <UserAvatar
            avatar={avatarUri}
            fallback="👤"
            size="md"
          />
        )}
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

  const renderRow = (item: NotificationItem, key?: string) => {
    const isUnread = !(item.is_read ?? item.isRead ?? item.read ?? false);
    const fromUser = Array.isArray(item.from_user) ? item.from_user[0] : item.from_user;
    const anonInfo = getAnonymousInfo(item);

    let name = anonInfo.isAnon
      ? anonInfo.anonName!
      : item.type === "streak_reminder"
      ? "Streak Reminder"
      : item.username || item.author_name || fromUser?.username || fromUser?.full_name || "Someone";

    const unreadCountForNotif = item.unread_count ?? (item as any).unreadCount ?? 1;

    // Facebook / Messenger style: Alex (3 new messages)
    if (item.type === "message" && unreadCountForNotif > 1) {
      name = `${name} (${unreadCountForNotif} new messages)`;
    }

    // 1. Build Action Headline (e.g., "charlotte commented on your post")
    let actionText = "";
    if (item.type === "message") {
      actionText = unreadCountForNotif > 1 ? "" : "sent you a message";
    } else if (item.type === "post_comment" || item.type === "comment") {
      actionText = "commented on your post";
    } else if (item.type === "post_like" || item.type === "like") {
      actionText = "liked your post";
    } else if (item.type === "comment_reply") {
      actionText = "replied to your comment";
    } else if (item.type === "comment_like") {
      actionText = "liked your comment";
    } else if (item.type === "friend_request" || item.type === "connection_request") {
      actionText = "sent you a match request";
    } else if (item.type === "accepted" || item.type === "connection_accepted") {
      actionText = "accepted your connection request";
    } else if (item.type === "match") {
      actionText = "matched with you!";
    } else if (item.type === "anon_match") {
      actionText = "messaged you";
    } else if (item.type === "streak_reminder") {
      actionText = "🔥";
    } else if (item.type === "safety" || item.type === "safety_alert") {
      actionText = "Safety Alert";
    } else {
      actionText = item.title || "interacted with your post";
    }

    const isMatchReq = item.type === "friend_request" || item.type === "connection_request";
    const reqStatus = handledRequests[item.id];
    const isBusy = busyIds[item.id];

    // 2. Extract Subtitle / Description content
    let subtext = "";
    if (item.type === "streak_reminder") {
      subtext = (item.description || item.message || "Your streak is not yet activated! Send a message to activate.").trim();
    } else if (item.type === "message") {
      subtext = (item.description || item.message || "").trim();
    } else if (!isMatchReq) {
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
    }

    return (
      <TouchableOpacity
        key={key || item.id}
        onPress={() => handleTapNotification(item)}
        activeOpacity={0.8}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
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
          <Text
            style={{
              fontSize: 13.5,
              color: "#111827",
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            <Text style={{ fontWeight: "700", color: "#111827" }}>
              {name}
            </Text>
            <Text style={{ fontWeight: isUnread ? "600" : "400", color: isUnread ? "#111827" : "#374151" }}>
              {` ${actionText}`}
            </Text>
          </Text>

          {/* Inline match request accept/decline action buttons */}
          {isMatchReq ? (
            reqStatus === "accepted" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <Check size={13} color="#1A6B3C" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A6B3C" }}>
                  Match Request Accepted
                </Text>
              </View>
            ) : reqStatus === "declined" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <X size={13} color="#6B7280" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>
                  Match Request Declined
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => handleAcceptInline(item)}
                  disabled={isBusy}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: "#1A6B3C",
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <Check size={13} color="#FFFFFF" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                    {isBusy ? "Accepting..." : "Accept Request"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDeclineInline(item)}
                  disabled={isBusy}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: "#F3F4F6",
                    paddingVertical: 7,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <X size={13} color="#4B5563" />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#4B5563" }}>
                    {isBusy ? "Declining..." : "Decline Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            Boolean(subtext) && (
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
            )
          )}
        </View>

        {/* Right side: Top-right justified time & status badges, no arrow icon */}
        <View
          style={{
            alignItems: "flex-end",
            alignSelf: "flex-start",
            paddingTop: 2,
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "500",
              color: "#9CA3AF",
            }}
          >
            {formatTimestamp(item.created_at || item.timestamp)}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {(item.type === "comment" ||
              item.type === "post_comment" ||
              item.type === "comment_reply" ||
              item.type === "comment_mention") && (
              <TouchableOpacity
                onPress={() => handleTapNotification(item)}
                hitSlop={8}
                activeOpacity={0.7}
                style={{
                  backgroundColor: "rgba(26, 107, 60, 0.08)",
                  paddingHorizontal: 8,
                  paddingVertical: 3.5,
                  borderRadius: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Reply size={11} color="#1A6B3C" />
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#1A6B3C" }}>
                  Reply
                </Text>
              </TouchableOpacity>
            )}

            {isUnread && (
              <View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: "#1A6B3C",
                }}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
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
            <TouchableOpacity
              onPress={handleMarkAllRead}
              hitSlop={8}
              activeOpacity={0.7}
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
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity
              onPress={handleClearAll}
              hitSlop={8}
              activeOpacity={0.7}
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
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ═══ Category Segment Filter Tabs & view all match request ═══ */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {/* Filter Dropdown Button */}
        <TouchableOpacity
          onPress={() => setShowFilterDropdown(true)}
          hitSlop={6}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#F3F4F6",
            paddingHorizontal: 11,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
        >
          <Filter size={13} color="#1A6B3C" />
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#111827", textTransform: "capitalize" }}>
            {activeFilter}
          </Text>
          <View
            style={{
              backgroundColor: "rgba(26,107,60,0.1)",
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#1A6B3C" }}>
              {categoryCounts[activeFilter] ?? 0}
            </Text>
          </View>
          <ChevronDown size={13} color="#6B7280" />
        </TouchableOpacity>

        {/* "view all match request" Link */}
        <TouchableOpacity
          onPress={() => router.push("/pages/requests" as any)}
          hitSlop={6}
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: "#1A6B3C",
            }}
          >
            view all match request
          </Text>
          <ChevronRight size={13} color="#1A6B3C" />
        </TouchableOpacity>
      </View>

      {/* ═══ Content List ═══ */}
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B3C" />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >

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
            {[
              { key: "today", label: "Today", items: todayList },
              { key: "earlier", label: "Earlier", items: earlierList },
              { key: "last_month", label: "Last Month", items: lastMonthList },
              { key: "last_year", label: "Last Year", items: lastYearList },
            ]
              .filter((sec) => sec.items.length > 0)
              .map((sec, secIdx) => (
                <View key={sec.key} style={{ marginTop: secIdx > 0 ? 12 : 0 }}>
                  <View
                    style={{
                      backgroundColor: "#F3F4F6",
                      paddingHorizontal: 20,
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E7EB",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
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
                      {sec.label}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#9CA3AF" }}>
                      {sec.items.length}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: "#FFFFFF" }}>
                    {sec.items.map((item, idx) => renderRow(item, `${sec.key}-${item.id || idx}`))}
                  </View>
                </View>
              ))}

            {todayList.length === 0 &&
              earlierList.length === 0 &&
              lastMonthList.length === 0 &&
              lastYearList.length === 0 &&
              filteredNotifications.length > 0 && (
                <View style={{ backgroundColor: "#FFFFFF" }}>
                  {filteredNotifications.map((item, idx) => renderRow(item, `all-${item.id || idx}`))}
                </View>
              )}
          </View>
        )}
      </ScrollView>
      {/* ═══ Filter Dropdown Modal ═══ */}
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
            paddingTop: insets.top + 105,
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
              width: 200,
            }}
          >
            {[
              { id: "all", label: "All", count: categoryCounts.all },
              { id: "unread", label: "Unread", count: categoryCounts.unread },
              { id: "messages", label: "Messages", count: categoryCounts.messages },
              { id: "connections", label: "Connections", count: categoryCounts.connections },
              { id: "ally", label: "Ally", count: categoryCounts.ally },
              { id: "safety", label: "Safety", count: categoryCounts.safety },
              { id: "activity", label: "Activity", count: categoryCounts.activity },
            ].map((option) => {
              const isSelected = activeFilter === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    setActiveFilter(option.id as FilterCategory);
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