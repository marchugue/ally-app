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
  ActivityIndicator,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bell,
  CheckCheck,
  UserPlus,
  MessageCircle,
  Heart,
  Drama,
  Sparkles,
  Trash2,
  Flame,
  Check,
  X,
  Filter,
  ShieldAlert,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { acceptConnection, rejectConnection } from "@/lib/api/interaction";
import { followUser, getFollowStatus } from "@/lib/api/follow";
import { listConversations } from "@/lib/api/conversation";
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
  deleteNotification,
} from "@/lib/api/notification";
import type { NotificationItem, NotificationCategory } from "@/types/notification";
import type { Conversation } from "@/types/conversation";

type FilterCategory = NotificationCategory;

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

function getDateGroup(dateInput?: string): DateGroupKey {
  if (!dateInput) return "earlier";
  const d = new Date(dateInput);
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
    t.includes("accepted") ||
    t.includes("follower")
  ) {
    return "connections";
  }
  if (t.includes("match") || t.includes("ally") || t.includes("stage")) return "ally";
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

  if (!avatarKey) {
    const seed = item.from_user_id || item.id || "default";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    avatarKey = ANIMAL_KEYS[hash % ANIMAL_KEYS.length];
  }

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

function extractSubtext(item: NotificationItem): string {
  const rawDesc = (item.description || item.message || "").trim();
  if (!rawDesc) return "";
  if (rawDesc.includes('commented: "')) {
    return rawDesc.replace(/^commented:\s*"/i, "").replace(/"$/, "");
  }
  if (rawDesc.includes('replied: "')) {
    return rawDesc.replace(/^replied:\s*"/i, "").replace(/"$/, "");
  }
  if (
    rawDesc === "liked your post." ||
    rawDesc === "liked your comment." ||
    rawDesc === "Someone commented on your post." ||
    rawDesc === "Someone liked your post." ||
    rawDesc === "Someone replied to your comment." ||
    rawDesc.startsWith("Someone ") ||
    rawDesc === item.title
  ) {
    return "";
  }
  return rawDesc;
}

function getActionText(item: NotificationItem): string {
  const unreadCount = item.unread_count ?? (item as any).unreadCount ?? 1;
  switch (item.type) {
    case "message":
    case "anon_match":
      if (unreadCount > 1) {
        return `(${unreadCount} new messages)`;
      }
      return item.type === "anon_match" ? "messaged you" : "sent you a message";
    case "post_comment":
    case "comment":
      return "commented on your post";
    case "post_like":
    case "like":
      return "liked your post";
    case "comment_reply":
      return "replied to your comment";
    case "comment_like":
      return "liked your comment";
    case "comment_mention":
      return "mentioned you in a comment";
    case "friend_request":
    case "connection_request":
      return "sent you a match request";
    case "new_follower":
      return "started following you";
    case "accepted":
    case "connection_accepted":
      return "accepted your connection request";
    case "match":
      return "matched with you!";
    case "streak_reminder":
      return "🔥";
    case "admin_warning":
    case "safety":
    case "emergency":
    case "safety_alert":
      return "⚠️ Account & Safety Alert";
    default:
      return item.title || "interacted with your post";
  }
}

/** Check if a conversation exists on the user's chat list and whether it has ended */
function checkConversationStatus(
  convs: Conversation[],
  targetConvId?: string | null,
  targetUserId?: string | null
): { exists: boolean; isEnded: boolean; conversation?: Conversation } {
  if (!convs || convs.length === 0) {
    return { exists: false, isEnded: false };
  }

  let matched: Conversation | undefined;

  // 1. Match by conversation ID
  if (targetConvId) {
    matched = convs.find(
      (c) => String(c.id).toLowerCase() === String(targetConvId).toLowerCase()
    );
  }

  // 2. Match by anonymous matchInfo ID
  if (!matched && (targetUserId || targetConvId)) {
    const searchId = String(targetUserId || targetConvId).toLowerCase();
    matched = convs.find((c) => {
      const matchId = c.matchInfo?.id || c.matchInfo?.matchId;
      return matchId && String(matchId).toLowerCase() === searchId;
    });
  }

  // 3. Match by conversation member ID
  if (!matched && targetUserId) {
    const searchUserId = String(targetUserId).toLowerCase();
    matched = convs.find((c) => {
      const members = (c.conversation_members || []) as any[];
      return members.some((m: any) => {
        const p = Array.isArray(m.profiles) ? m.profiles[0] : (m.profiles || m);
        const uid = m.user_id || p?.id || p?.user_id;
        return uid && String(uid).toLowerCase() === searchUserId;
      });
    });
  }

  if (!matched) {
    return { exists: false, isEnded: false };
  }

  const isEnded =
    matched.variant === "anonymous_ended" || Boolean(matched.matchInfo?.ended);

  return { exists: true, isEnded, conversation: matched };
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userConversations, setUserConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [handledRequests, setHandledRequests] = useState<Record<string, "accepted" | "declined">>({});
  const [followStatusMap, setFollowStatusMap] = useState<Record<string, boolean>>({});
  const [dismissedCtaMap, setDismissedCtaMap] = useState<Record<string, boolean>>({});
  const [followBusyMap, setFollowBusyMap] = useState<Record<string, boolean>>({});

  const loadNotifications = useCallback(
    async (showSkeleton = false) => {
      if (!accessToken) {
        setNotifications([]);
        setUserConversations([]);
        setLoading(false);
        return;
      }
      if (showSkeleton) setLoading(true);
      try {
        const [items, convs] = await Promise.all([
          listNotifications(accessToken).catch(() => []),
          listConversations(accessToken).catch(() => []),
        ]);

        setUserConversations(convs);

        if (!items || items.length === 0) {
          setNotifications([]);
        } else {
          const filtered = items.filter((n) => {
            if (EXCLUDED_NOTIFICATION_TYPES.includes(n.type)) return false;

            // If it's a message, anonymous match, or streak reminder:
            // Check if it exists on the chat list and is not ended.
            // If the person is not existing on the chatlistwindow or ended, remove it.
            if (
              n.type === "message" ||
              n.type === "anon_match" ||
              n.type === "streak_reminder"
            ) {
              const convStatus = checkConversationStatus(
                convs,
                n.target_id || (n as any).conversationId || n.post_id,
                n.from_user_id || (n as any).fromUserId
              );
              if (!convStatus.exists || convStatus.isEnded) {
                // Delete invalid notification from backend asynchronously
                void deleteNotification(n.id, accessToken).catch(() => null);
                return false;
              }
            }

            return true;
          });

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

  // Initial load
  useEffect(() => {
    if (accessToken) {
      void loadNotifications(true);
    }
  }, [accessToken, loadNotifications]);

  // Screen focus + polling interval fallback
  useFocusEffect(
    useCallback(() => {
      void loadNotifications(notifications.length === 0);
      const interval = setInterval(() => {
        void loadNotifications(false);
      }, 60000);

      return () => clearInterval(interval);
    }, [loadNotifications, notifications.length])
  );

  // Socket realtime listeners
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

  // Check follow status for new_follower notifications
  useEffect(() => {
    if (!accessToken || notifications.length === 0) return;
    const followerUserIds = new Set<string>();
    for (const n of notifications) {
      if (n.type === "new_follower") {
        const uId = n.from_user_id || (n as any).fromUserId || n.target_id;
        if (uId && followStatusMap[uId] === undefined) {
          followerUserIds.add(uId);
        }
      }
    }
    if (followerUserIds.size === 0) return;

    followerUserIds.forEach(async (uId) => {
      try {
        const res = await getFollowStatus(uId, accessToken);
        setFollowStatusMap((prev) => ({ ...prev, [uId]: Boolean(res?.isFollowing) }));
      } catch {
        // ignore
      }
    });
  }, [accessToken, notifications, followStatusMap]);

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

  // Match request inline accept/decline
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

  // Follow back inline CTA
  const handleFollowBackInline = useCallback(
    async (item: NotificationItem) => {
      const followerTargetId = item.from_user_id || (item as any).fromUserId || item.target_id;
      if (!accessToken || !followerTargetId || followBusyMap[followerTargetId]) return;

      setFollowBusyMap((prev) => ({ ...prev, [followerTargetId]: true }));
      try {
        await followUser(followerTargetId, accessToken);
        setFollowStatusMap((prev) => ({ ...prev, [followerTargetId]: true }));
        await markNotificationRead(item.id, accessToken).catch(() => {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, isRead: true, read: true } : n))
        );
      } catch (err) {
        console.warn("Failed to follow back inline:", err);
      } finally {
        setFollowBusyMap((prev) => ({ ...prev, [followerTargetId]: false }));
      }
    },
    [accessToken, followBusyMap]
  );

  const handleDismissFollowCta = useCallback((notifId: string) => {
    setDismissedCtaMap((prev) => ({ ...prev, [notifId]: true }));
    if (accessToken) {
      void markNotificationRead(notifId, accessToken).catch(() => {});
    }
  }, [accessToken]);

  // Tap notification: redirect to conversation/person or remove if ended/not found
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

      // Dismiss from device notification tray
      if (
        item.type === "message" ||
        item.type === "anon_match" ||
        item.type === "streak_reminder" ||
        item.type === "accepted"
      ) {
        const targetConvId = item.target_id || item.post_id;
        if (targetConvId) {
          dismissPresentedNotificationByConversationId(targetConvId).catch(() => null);
        }
      } else if (item.type === "friend_request" || item.type === "connection_request") {
        dismissPresentedNotificationsByCategory("connections").catch(() => null);
      } else if (item.category) {
        dismissPresentedNotificationsByCategory(item.category).catch(() => null);
      }

      // Check conversation status for message/chat notifications
      if (
        item.type === "message" ||
        item.type === "anon_match" ||
        item.type === "streak_reminder" ||
        item.type === "accepted" ||
        item.type === "connection_accepted"
      ) {
        let convs = userConversations;
        if (accessToken && (!convs || convs.length === 0)) {
          convs = await listConversations(accessToken).catch(() => []);
          setUserConversations(convs);
        }

        const convStatus = checkConversationStatus(
          convs,
          item.target_id || (item as any).conversationId || item.post_id,
          item.from_user_id || (item as any).fromUserId
        );

        // If the person is not existing on the chatlistwindow or they don't have conversation or ended, remove that notification
        if (!convStatus.exists || convStatus.isEnded) {
          setNotifications((prev) => prev.filter((n) => n.id !== item.id));
          if (accessToken) {
            void deleteNotification(item.id, accessToken).catch(() => null);
          }
          Alert.alert(
            "Conversation Unavailable",
            convStatus.isEnded
              ? "This conversation has ended and has been removed."
              : "No active conversation was found with this user."
          );
          return;
        }

        // Redirect to that person in conversation
        router.push({
          pathname: "/pages/conversation" as any,
          params: { conversationId: convStatus.conversation!.id },
        });
        return;
      }

      // Match request notification routing
      if (item.type === "friend_request" || item.type === "connection_request") {
        if (handledRequests[item.id] === "accepted") {
          const convStatus = checkConversationStatus(
            userConversations,
            item.target_id || item.post_id,
            item.from_user_id || (item as any).fromUserId
          );
          if (convStatus.exists && !convStatus.isEnded) {
            router.push({
              pathname: "/pages/conversation" as any,
              params: { conversationId: convStatus.conversation!.id },
            });
          } else {
            router.push("/(tabs)/messages" as any);
          }
        } else {
          router.push("/pages/requests" as any);
        }
        return;
      }

      // New follower notification routing
      if (item.type === "new_follower") {
        const followerTargetId = item.from_user_id || (item as any).fromUserId || item.target_id;
        if (followerTargetId) {
          router.push({
            pathname: "/pages/user-profile" as any,
            params: { userId: followerTargetId },
          });
        }
        return;
      }

      // Match routing
      if (item.type === "match") {
        router.push("/(tabs)/discover" as any);
        return;
      }

      // Post / Comments routing
      if (
        item.type === "comment_reply" ||
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
        return;
      }

      // Redirection from backend fallback
      if (item.redirection?.route) {
        router.push({
          pathname: item.redirection.route as any,
          params: item.redirection.params || {},
        });
      }
    },
    [accessToken, handledRequests, userConversations]
  );

  // If already followed back, hide new_follower notification matching web
  const visibleNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (EXCLUDED_NOTIFICATION_TYPES.includes(n.type)) return false;
      if (n.type === "new_follower") {
        const followerTargetId = n.from_user_id || (n as any).fromUserId || n.target_id;
        if (followerTargetId && followStatusMap[followerTargetId]) {
          return false;
        }
      }
      return true;
    });
  }, [notifications, followStatusMap]);

  const unreadCount = useMemo(() => {
    return visibleNotifications.filter((n) => !(n.is_read ?? n.isRead ?? n.read ?? false)).length;
  }, [visibleNotifications]);

  const categoryCounts = useMemo(() => {
    const counts = {
      all: visibleNotifications.length,
      unread: 0,
      messages: 0,
      connections: 0,
      ally: 0,
      safety: 0,
      activity: 0,
    };
    for (const n of visibleNotifications) {
      const isUnread = !(n.is_read ?? n.isRead ?? n.read ?? false);
      if (isUnread) counts.unread++;
      const cat = n.category || deriveCategory(n.type);
      if (cat in counts && cat !== "all" && cat !== "unread") {
        counts[cat as keyof typeof counts]++;
      }
    }
    return counts;
  }, [visibleNotifications]);

  const filteredNotifications = useMemo(() => {
    return visibleNotifications.filter((n) => {
      const isUnread = !(n.is_read ?? n.isRead ?? n.read ?? false);
      if (activeFilter === "unread") return isUnread;
      if (activeFilter === "all") return true;
      const cat = n.category || deriveCategory(n.type);
      return cat === activeFilter;
    });
  }, [visibleNotifications, activeFilter]);

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
    let badgeBg = "#4B5563";

    switch (item.type) {
      case "message":
        badgeIcon = <MessageCircle size={10} color="#FFFFFF" />;
        badgeBg = "#2563EB";
        break;
      case "comment":
      case "post_comment":
      case "comment_reply":
      case "comment_mention":
        badgeIcon = <MessageCircle size={10} color="#FFFFFF" />;
        badgeBg = "#EC4899";
        break;
      case "like":
      case "post_like":
      case "comment_like":
        badgeIcon = <Heart size={10} color="#FFFFFF" fill="#FFFFFF" />;
        badgeBg = "#EF4444";
        break;
      case "friend_request":
      case "connection_request":
      case "new_follower":
        badgeIcon = <UserPlus size={10} color="#FFFFFF" />;
        badgeBg = "#1A6B3C";
        break;
      case "accepted":
      case "connection_accepted":
        badgeIcon = <Text style={{ fontSize: 9, lineHeight: 10 }}>🤝</Text>;
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
      case "safety":
      case "safety_alert":
      case "emergency":
      case "admin_warning":
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
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(235, 86, 0, 0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>🔥</Text>
          </View>
          <View
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
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
            size={44}
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
            bottom: -1,
            right: -1,
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

    const name = anonInfo.isAnon
      ? anonInfo.anonName!
      : item.type === "streak_reminder"
      ? "Streak Reminder"
      : item.username || item.author_name || fromUser?.username || fromUser?.full_name || "Someone";

    const actionText = getActionText(item);
    const isMatchReq = item.type === "friend_request" || item.type === "connection_request";
    const isFollower = item.type === "new_follower";
    const followerTargetId = item.from_user_id || (item as any).fromUserId || item.target_id;
    const isFollowDismissed = Boolean(dismissedCtaMap[item.id]);
    const isFollowBusy = Boolean(followerTargetId && followBusyMap[followerTargetId]);

    const reqStatus = handledRequests[item.id];
    const isBusy = busyIds[item.id];

    let subtext = "";
    if (item.type === "streak_reminder") {
      subtext = (item.description || item.message || "Your streak is not yet activated! Send a message to keep it going.").trim();
    } else if (isFollower && isFollowDismissed) {
      subtext = item.description || "Someone started following you.";
    } else if (!isMatchReq && !isFollower) {
      subtext = extractSubtext(item);
    }

    return (
      <TouchableOpacity
        key={key || item.id}
        onPress={() => handleTapNotification(item)}
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: isUnread ? "rgba(26,107,60,0.035)" : "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#F3F4F6",
          gap: 12,
        }}
      >
        {renderNotificationAvatar(item)}

        <View style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>
          {/* Author Name + Action Text */}
          <Text
            style={{
              fontSize: 13.5,
              lineHeight: 18,
            }}
            numberOfLines={2}
          >
            <Text style={{ fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
              {name}
            </Text>
            <Text
              style={{
                fontFamily: "PlusJakartaSans",
                fontWeight: isUnread ? "600" : "400",
                color: isUnread ? "#1F2937" : "#4B5563",
              }}
            >
              {` ${actionText}`}
            </Text>
          </Text>

          {/* Match Request Accept/Decline CTAs */}
          {isMatchReq ? (
            reqStatus === "accepted" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                <Check size={13} color="#1A6B3C" strokeWidth={2.5} />
                <Text style={{ fontSize: 12, fontFamily: "PlusJakartaSans-Bold", color: "#1A6B3C" }}>
                  Match Request Accepted
                </Text>
              </View>
            ) : reqStatus === "declined" ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                <X size={13} color="#6B7280" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>
                  Match Request Declined
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, maxWidth: 300 }}>
                <TouchableOpacity
                  onPress={() => handleAcceptInline(item)}
                  disabled={isBusy}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    backgroundColor: "#1A6B3C",
                    paddingVertical: 7.5,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    opacity: isBusy ? 0.6 : 1,
                  }}
                >
                  <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={{ fontSize: 12, fontFamily: "PlusJakartaSans-Bold", color: "#FFFFFF" }}>
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
                    paddingVertical: 7.5,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
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
          ) : isFollower && !isFollowDismissed ? (
            /* New Follower Follow-back CTAs */
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, maxWidth: 260 }}>
              <TouchableOpacity
                onPress={() => handleFollowBackInline(item)}
                disabled={isFollowBusy}
                activeOpacity={0.7}
                style={{
                  flex: 1,
                  backgroundColor: "#1A6B3C",
                  paddingVertical: 7.5,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  opacity: isFollowBusy ? 0.6 : 1,
                }}
              >
                {isFollowBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <UserPlus size={13} color="#FFFFFF" strokeWidth={2.5} />
                )}
                <Text style={{ fontSize: 12, fontFamily: "PlusJakartaSans-Bold", color: "#FFFFFF" }}>
                  {isFollowBusy ? "Checking..." : "Follow Back"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDismissFollowCta(item.id)}
                disabled={isFollowBusy}
                activeOpacity={0.7}
                style={{
                  backgroundColor: "#F3F4F6",
                  paddingVertical: 7.5,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  opacity: isFollowBusy ? 0.6 : 1,
                }}
              >
                <X size={13} color="#4B5563" />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#4B5563" }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            Boolean(subtext) && (
              <Text
                style={{
                  fontFamily: "PlusJakartaSans",
                  fontSize: 13,
                  color: isUnread ? "#4B5563" : "#6B7280",
                  marginTop: 3,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {subtext}
              </Text>
            )
          )}
        </View>

        {/* Right side: Timestamp & Unread Dot (No Reply button) */}
        <View
          style={{
            alignItems: "flex-end",
            alignSelf: "flex-start",
            paddingTop: 1,
            gap: 6,
            flexShrink: 0,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "500",
              color: "#9CA3AF",
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
                backgroundColor: "#1A6B3C",
              }}
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* ═══ Top Sticky Header with Seamless Transparent Blend (No Hard Divider) ═══ */}
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
        {/* Solid Header Content Bar */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 8,
            position: "relative",
            minHeight: insets.top + 48,
            justifyContent: "center",
          }}
        >
          {/* Centered Notification Label + Badge + Filter */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontFamily: "Fraunces_700Bold",
                fontSize: 24,
                color: "#1A6B3C",
                letterSpacing: -0.5,
              }}
            >
              Notification
            </Text>

            {unreadCount > 0 && (
              <View
                style={{
                  backgroundColor: "#1A6B3C",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>
                  {unreadCount}
                </Text>
              </View>
            )}

            {/* Borderless circular filter icon button */}
            <TouchableOpacity
              onPress={() => setShowFilterDropdown(true)}
              hitSlop={8}
              activeOpacity={0.7}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <Filter size={17} color="#1A6B3C" strokeWidth={2.2} />
              {activeFilter !== "all" && (
                <View
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: "#1A6B3C",
                    borderWidth: 1.5,
                    borderColor: "#FFFFFF",
                  }}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* Right aligned action buttons */}
          <View
            style={{
              position: "absolute",
              right: 16,
              top: insets.top + 8,
              bottom: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                hitSlop={6}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: "rgba(26,107,60,0.08)",
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderRadius: 10,
                }}
              >
                <CheckCheck size={13} color="#1A6B3C" strokeWidth={2.5} />
                <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans-Bold", color: "#1A6B3C" }}>
                  Read All
                </Text>
              </TouchableOpacity>
            )}

            {notifications.length > 0 && (
              <TouchableOpacity
                onPress={handleClearAll}
                hitSlop={6}
                activeOpacity={0.7}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  backgroundColor: "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 size={14} color="#6B7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Seamless Transparent Gradient Blend: Smoothly dissolves scrolling content */}
        <LinearGradient
          colors={["#FFFFFF", "rgba(255, 255, 255, 0.9)", "rgba(255, 255, 255, 0.4)", "rgba(255, 255, 255, 0)"]}
          style={{ height: 28, width: "100%" }}
          pointerEvents="none"
        />
      </View>

      {/* ═══ Content List ═══ */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
            progressViewOffset={insets.top + 48}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 54,
          paddingBottom: 40,
        }}
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      >
        {loading ? (
          <View style={{ padding: 16, gap: 14 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingVertical: 10,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: "#E5E7EB",
                    opacity: 0.6,
                  }}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <View
                    style={{
                      height: 14,
                      width: "45%",
                      borderRadius: 7,
                      backgroundColor: "#E5E7EB",
                      opacity: 0.6,
                    }}
                  />
                  <View
                    style={{
                      height: 12,
                      width: "70%",
                      borderRadius: 6,
                      backgroundColor: "#F3F4F6",
                      opacity: 0.8,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={{ padding: 48, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 24,
                backgroundColor: "rgba(26,107,60,0.08)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Bell size={30} color="#1A6B3C" />
            </View>
            <Text
              style={{
                fontFamily: "Fraunces_700Bold",
                fontSize: 18,
                color: "#111827",
                marginBottom: 6,
              }}
            >
              You're all caught up! 🎉
            </Text>
            <Text
              style={{
                fontFamily: "PlusJakartaSans",
                fontSize: 13,
                color: "#6B7280",
                textAlign: "center",
                lineHeight: 18,
              }}
            >
              New likes, comments, and connection requests will appear here.
            </Text>
          </View>
        ) : (
          <View style={{ paddingBottom: 40 }}>
            {[
              { key: "today", label: "Today", items: todayList },
              { key: "earlier", label: "Earlier", items: earlierList },
              { key: "last_month", label: "Last Month", items: lastMonthList },
              { key: "last_year", label: "Last Year", items: lastYearList },
            ]
              .filter((sec) => sec.items.length > 0)
              .map((sec, secIdx) => (
                <View key={sec.key}>
                  {/* Web-style sleek centered horizontal divider */}
                  <View
                    style={{
                      position: "relative",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: secIdx === 0 ? 12 : 20,
                      marginBottom: 8,
                      paddingHorizontal: 16,
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 16,
                        right: 16,
                        height: 1,
                        backgroundColor: "#F3F4F6",
                      }}
                    />
                    <View style={{ backgroundColor: "#FFFFFF", paddingHorizontal: 12 }}>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans-Bold",
                          fontSize: 10.5,
                          color: "#9CA3AF",
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                        }}
                      >
                        {sec.label}
                      </Text>
                    </View>
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

      {/* ═══ Filter Dropdown Modal (Matching Web Filter Popover) ═══ */}
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
            alignItems: "center",
            paddingTop: insets.top + 52,
          }}
          onPress={() => setShowFilterDropdown(false)}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 18,
              padding: 6,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 14,
              elevation: 8,
              width: 220,
            }}
          >
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderBottomWidth: 1,
                borderBottomColor: "#F3F4F6",
                marginBottom: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontFamily: "PlusJakartaSans-Bold",
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  letterSpacing: 1.2,
                }}
              >
                Filter by
              </Text>
            </View>
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
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: isSelected ? "rgba(26,107,60,0.08)" : "transparent",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {isSelected ? (
                      <Check size={14} color="#1A6B3C" strokeWidth={2.5} />
                    ) : (
                      <View style={{ width: 14 }} />
                    )}
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontFamily: isSelected ? "PlusJakartaSans-Bold" : "PlusJakartaSans",
                        color: isSelected ? "#1A6B3C" : "#374151",
                      }}
                    >
                      {option.label}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: isSelected ? "#1A6B3C" : "#F3F4F6",
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontFamily: "PlusJakartaSans-Bold",
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