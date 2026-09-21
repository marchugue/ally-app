import React, { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import {
  getMemoryConversations,
  getCachedConversations,
  setCachedConversations,
  primeChatCacheFromConversation,
} from "@/lib/chatCache";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { router, useFocusEffect } from "expo-router";
import { Search, X, MessageCircle, Trash2, Drama, Flame } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { FilterChip } from "@/components/FilterChip";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { listConversations, hideConversation } from "@/lib/api/conversation";
import { usePresence } from "@/context/PresenceContext";
import { getSocket } from "@/lib/socket";
import { setAppBadgeCount } from "@/lib/pushNotifications";
import type { Conversation } from "@/types/conversation";

function getParticipantInfo(conv: any, myId: string) {
  const isAnonymous = Boolean(
    conv.variant ? conv.variant !== "regular" : (conv.is_anonymous || conv.type === "anonymous")
  );

  const dayStreak = conv.matchInfo?.dayStreak ?? conv.dayStreak ?? 0;
  const streakActiveToday = Boolean(conv.matchInfo?.streakActiveToday ?? conv.streakActiveToday ?? false);

  if (isAnonymous) {
    return {
      participantId: conv.matchInfo?.id || conv.matchInfo?.matchId || conv.id || "anonymous",
      participantName: conv.matchInfo?.partnerAlias || "Anonymous Ally",
      participantAvatar: conv.matchInfo?.partnerAvatar || "fox",
      isAnonymous: true,
      stage: conv.matchInfo?.stage ?? 0,
      dayStreak,
      streakActiveToday,
      ended: conv.variant === "anonymous_ended" || Boolean(conv.matchInfo?.ended),
    };
  }

  const members = (conv.conversation_members || []) as any[];
  const otherMember = members.find((m: any) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : (m.profiles || m);
    return profile && String(profile.id || profile.user_id).toLowerCase() !== String(myId).toLowerCase();
  });

  const profile = otherMember
    ? (Array.isArray(otherMember.profiles) ? otherMember.profiles[0] : (otherMember.profiles || otherMember))
    : null;

  return {
    participantId: profile?.id || profile?.user_id || conv.id,
    participantName: profile?.full_name || (profile?.username ? `@${profile.username}` : "Student"),
    participantAvatar: profile?.avatar_url || null,
    isAnonymous: false,
    dayStreak,
    streakActiveToday,
  };
}

function getLastMessage(conv: Conversation) {
  if (!conv.messages || conv.messages.length === 0) return null;
  return conv.messages[conv.messages.length - 1];
}

function getUnreadInfo(conv: Conversation, myId: string) {
  if (!myId) return { unreadCount: 0, isUnread: false };
  const members = (conv.conversation_members || []) as any[];
  const myMember = members.find((m: any) => {
    const profile = Array.isArray(m.profiles) ? m.profiles[0] : (m.profiles || m);
    const mUserId = m.user_id || profile?.id;
    return String(mUserId).toLowerCase() === String(myId).toLowerCase();
  });

  const lastReadAt = myMember?.last_read_at ? new Date(myMember.last_read_at).getTime() : 0;
  const messages = conv.messages || [];

  let unreadCount = 0;
  for (const msg of messages) {
    if (msg.sender_id && String(msg.sender_id).toLowerCase() !== String(myId).toLowerCase()) {
      const msgTime = new Date(msg.created_at).getTime();
      if (msgTime > lastReadAt) {
        unreadCount++;
      }
    }
  }

  return {
    unreadCount,
    isUnread: unreadCount > 0,
  };
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w`;
}

const POLL_INTERVAL_MS = 5000;

/* ─── Extracted SwipeableRow ─── */
interface SwipeableRowProps {
  item: Conversation;
  info: ReturnType<typeof getParticipantInfo>;
  lastMsg: ReturnType<typeof getLastMessage>;
  isOnline: boolean;
  isMine: boolean;
  unreadInfo: { unreadCount: number; isUnread: boolean };
  swipeableRefs: React.MutableRefObject<Map<string, any>>;
  onDeletePrompt: (id: string, name: string) => void;
  onOpen: (item: Conversation, info: ReturnType<typeof getParticipantInfo>) => void;
  disabled: boolean;
  isNavigatingThis: boolean;
}

const SwipeableRow = React.memo(function SwipeableRow({
  item,
  info,
  lastMsg,
  isOnline,
  isMine,
  unreadInfo,
  swipeableRefs,
  onDeletePrompt,
  onOpen,
  disabled,
  isNavigatingThis,
}: SwipeableRowProps) {
  const swipeRef = useRef<any>(null);

  useEffect(() => {
    swipeableRefs.current.set(item.id, swipeRef.current);
    return () => {
      swipeableRefs.current.delete(item.id);
    };
  }, [item.id, swipeableRefs]);

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      overshootRight={false}
      rightThreshold={60}
      onSwipeableWillOpen={() => {
        swipeableRefs.current.forEach((ref, key) => {
          if (key !== item.id) ref?.close();
        });
      }}
      onSwipeableOpen={() => {
        onDeletePrompt(item.id, info.participantName);
      }}
      renderRightActions={() => (
        <Pressable
          onPress={() => onDeletePrompt(item.id, info.participantName)}
          style={{
            backgroundColor: "#EF4444",
            justifyContent: "center",
            alignItems: "center",
            width: 90,
          }}
        >
          <Trash2 size={22} color="#FFFFFF" />
          <Text
            style={{
              color: "#FFFFFF",
              fontWeight: "600",
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Delete
          </Text>
        </Pressable>
      )}
    >
      <Pressable
        disabled={disabled}
        onPress={() => onOpen(item, info)}
        android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        style={({ pressed }) => ({
          opacity: isNavigatingThis ? 0.65 : 1,
          backgroundColor: isNavigatingThis
            ? "#F3F4F6"
            : pressed
              ? "#F9FAFB"
              : unreadInfo.isUnread
                ? "#F0FDF4"
                : "#FFFFFF",
        })}
      >
        <View
          className="w-full flex-row items-center px-5 py-3.5"
          style={{ flexDirection: "row", width: "100%", flexWrap: "nowrap" }}
        >
          {/* Avatar */}
          <View className="shrink-0" style={{ flexShrink: 0 }}>
            {info.isAnonymous ? (
              <AnonymousAvatar avatarKey={info.participantAvatar} size={56} />
            ) : (
              <UserAvatar
                avatar={info.participantAvatar}
                size="lg"
                online={isOnline}
              />
            )}
          </View>

          {/* Details */}
          <View
            className="flex-1 min-w-0 ml-4 mr-2"
            style={{ flex: 1, flexBasis: 0, minWidth: 0, overflow: "hidden" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text
                className={`text-[15px] ${unreadInfo.isUnread ? "font-extrabold text-[#111827]" : "font-bold text-[#111827]"}`}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {info.participantName}
              </Text>
              {info.isAnonymous && <Drama size={13} color="#1A6B3C" />}
              {info.dayStreak > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 2,
                    backgroundColor: info.streakActiveToday ? "rgba(235, 86, 0, 0.1)" : "#F3F4F6",
                    paddingHorizontal: 5,
                    paddingVertical: 1,
                    borderRadius: 6,
                  }}
                >
                  <Flame size={11} color={info.streakActiveToday ? "#eb5600" : "#9CA3AF"} />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: info.streakActiveToday ? "#eb5600" : "#9CA3AF",
                    }}
                  >
                    {info.dayStreak}d
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="text-[13px] mt-0.5"
              style={{
                color: unreadInfo.isUnread ? "#111827" : lastMsg ? "#6B7280" : "#9CA3AF",
                fontWeight: unreadInfo.isUnread ? "700" : "400",
                fontStyle: (lastMsg && lastMsg.is_deleted) ? "italic" : lastMsg ? "normal" : "italic",
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {lastMsg
                ? lastMsg.is_deleted
                  ? "Message deleted"
                  : `${isMine ? "You: " : ""}${lastMsg.content || (lastMsg.image_url ? "📷 Photo" : "")}`
                : "Start the conversation"}
            </Text>
          </View>

          {/* Timestamp & Red Unread Badge */}
          <View className="shrink-0 items-end justify-center" style={{ flexShrink: 0, alignItems: "flex-end" }}>
            {lastMsg ? (
              <Text
                style={{
                  fontSize: 11,
                  color: unreadInfo.isUnread ? "#1A6B3C" : "#9CA3AF",
                  fontWeight: unreadInfo.isUnread ? "700" : "400",
                  marginBottom: unreadInfo.isUnread ? 4 : 0,
                }}
              >
                {formatRelativeTime(lastMsg.created_at)}
              </Text>
            ) : null}

            {unreadInfo.isUnread && (
              <View
                style={{
                  backgroundColor: "#EF4444",
                  borderRadius: 999,
                  minWidth: 20,
                  height: 20,
                  paddingHorizontal: 6,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 2,
                }}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>
                  {unreadInfo.unreadCount > 99 ? "99+" : unreadInfo.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const PAGE_SIZE = 20; // conversations shown per page (client-side virtual pagination)

export default function MessagesScreen() {
  const { user, accessToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    user?.id ? getMemoryConversations(user.id) || [] : []
  );
  const { isOnline: checkIsOnline, refreshOnlineUsers } = usePresence();
  // If we already have cached conversations in memory, skip the full-screen loading spinner (0ms display)
  const [loading, setLoading] = useState(() => !(user?.id && (getMemoryConversations(user.id)?.length || 0) > 0));
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const isNavigatingRef = useRef(false);
  const isNavigating = Boolean(navigatingId) || isNavigatingRef.current;

  const [variantFilter, setVariantFilter] = useState<"all" | "regular" | "anonymous">("all");
  const searchInputRef = useRef<TextInput>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>("");
  const swipeableRefs = useRef<Map<string, any>>(new Map());

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Sync app icon badge count to total unread messages across conversations
  const totalUnreadCount = useMemo(() => {
    if (!user?.id) return 0;
    return conversations.reduce((acc, conv) => acc + getUnreadInfo(conv, user.id).unreadCount, 0);
  }, [conversations, user?.id]);

  useEffect(() => {
    setAppBadgeCount(totalUnreadCount);
  }, [totalUnreadCount]);

  // Safety fallback: ensure navigation lock auto-clears even if route transition stalls
  useEffect(() => {
    if (navigatingId) {
      const timer = setTimeout(() => {
        isNavigatingRef.current = false;
        setNavigatingId(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [navigatingId]);

  const closeAllSwipeables = useCallback(() => {
    swipeableRefs.current.forEach((ref) => ref?.close());
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTargetId(null);
    setDeleteTargetName("");
    closeAllSwipeables();
  }, [closeAllSwipeables]);

  const loadConversations = useCallback(async (_silent = false) => {
    if (!accessToken) return;
    try {
      const convs = await listConversations(accessToken);
      // Sort by most recent message / activity timestamp
      convs.sort((a, b) => {
        const aTime = getLastMessage(a)?.created_at || a.updated_at;
        const bTime = getLastMessage(b)?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      // Deduplicate by participantId
      const deduped = new Map<string, Conversation>();
      convs.forEach((conv) => {
        const info = getParticipantInfo(conv, user?.id || "");
        if (!deduped.has(info.participantId)) {
          deduped.set(info.participantId, conv);
        }
      });
      const finalConvs = Array.from(deduped.values());
      setConversations(finalConvs);
      if (user?.id) {
        void setCachedConversations(user.id, finalConvs);
      }
    } catch (err) {
      console.warn("Failed to load conversations", err);
    }
  }, [accessToken, user?.id]);

  useEffect(() => {
    let isMounted = true;
    async function init() {
      if (user?.id) {
        const cached = await getCachedConversations(user.id);
        if (cached && cached.length > 0 && isMounted) {
          setConversations(cached);
          setLoading(false);
        }
      }
      await Promise.all([loadConversations(true), refreshOnlineUsers()]);
      if (isMounted) setLoading(false);
    }
    init();
    // No fallback poll — useFocusEffect + sockets handle active updates.
    // 24h AsyncStorage cache covers cold starts.
    return () => { isMounted = false; };
  }, [loadConversations, refreshOnlineUsers, user?.id]);

  // Re-fetch when navigating back to the Messages tab to instantly reflect read status changes,
  // and immediately reset navigation lock so items are pressable again!
  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      setNavigatingId(null);
      void loadConversations(true);
      void refreshOnlineUsers();
    }, [loadConversations, refreshOnlineUsers])
  );

  // Real-time update on socket message
  useEffect(() => {
    if (!accessToken) return;

    const socket = getSocket(accessToken);
    if (!socket) return;

    // Optimistically merge an incoming message into the local conversations list
    // so the last-message preview and unread badge update instantly without a
    // round-trip to the server. Falls back to a full reload only when the
    // conversation isn't already known locally.
    const onMessageNew = (payload: any) => {
      const incomingConvId: string = payload?.conversationId ?? payload?.message?.conversation_id ?? "";
      const incomingMsg = payload?.message;
      if (!incomingConvId || !incomingMsg) {
        // Unknown payload shape — fall back to a full reload
        void loadConversations(true);
        return;
      }
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === incomingConvId);
        if (idx === -1) {
          // New conversation not yet in list — reload to fetch it
          void loadConversations(true);
          return prev;
        }
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          messages: [...(updated[idx].messages ?? []), incomingMsg],
          updated_at: incomingMsg.created_at ?? updated[idx].updated_at,
        };
        // Re-sort: most recent first
        updated.sort((a, b) => {
          const aTime = getLastMessage(a)?.created_at || a.updated_at;
          const bTime = getLastMessage(b)?.created_at || b.updated_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });
        return updated;
      });
    };

    const onConnect = () => {
      void loadConversations(true);
      void refreshOnlineUsers();
    };

    const onStreakUpdated = (payload: any) => {
      // Only update local state — no full reload needed for a streak change
      setConversations((prev) =>
        prev.map((c) => {
          const isMatch =
            (payload?.conversationId && c.id === payload.conversationId) ||
            (payload?.matchId && c.matchInfo?.matchId === payload.matchId);
          if (!isMatch) return c;
          const isInactive = payload.status === "inactive" || payload.dayStreak === 0 || payload.streak === 0;
          const streak = isInactive ? 0 : (payload.dayStreak ?? payload.streak ?? c.dayStreak ?? 0);
          const activeToday = isInactive ? false : (payload.streakActiveToday ?? true);
          return {
            ...c,
            dayStreak: streak,
            streakActiveToday: activeToday,
            matchInfo: c.matchInfo
              ? { ...c.matchInfo, dayStreak: streak, streakActiveToday: activeToday }
              : c.matchInfo,
          };
        })
      );
    };

    socket.on("conversation:message_new", onMessageNew);
    socket.on("conversation:streak_updated", onStreakUpdated);
    socket.on("matchmaking:streak_update", onStreakUpdated);
    socket.on("connect", onConnect);

    return () => {
      socket.off("conversation:message_new", onMessageNew);
      socket.off("conversation:streak_updated", onStreakUpdated);
      socket.off("matchmaking:streak_update", onStreakUpdated);
      socket.off("connect", onConnect);
    };
  }, [accessToken, loadConversations, refreshOnlineUsers]);

  // Midnight end-of-day watcher on mobile
  useEffect(() => {
    let lastDate = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const interval = setInterval(() => {
      const currentDate = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
      if (currentDate !== lastDate) {
        lastDate = currentDate;
        // Day has ended! Reset unactivated streaks
        setConversations((prev) =>
          prev.map((c) => {
            if (c.dayStreak && !c.streakActiveToday && !c.matchInfo?.streakActiveToday) {
              return {
                ...c,
                dayStreak: 0,
                streakActiveToday: false,
                matchInfo: c.matchInfo
                  ? { ...c.matchInfo, dayStreak: 0, streakActiveToday: false }
                  : c.matchInfo,
              };
            }
            return c;
          })
        );
        void loadConversations(true);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConversations(), refreshOnlineUsers()]);
    setRefreshing(false);
  }, [loadConversations, refreshOnlineUsers]);

  const handleHide = useCallback(
    async (id: string) => {
      setDeleteTargetId(null);
      setDeleteTargetName("");
      closeAllSwipeables();
      // Optimistic remove from local list
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (accessToken) {
        // hideConversation removes from YOUR list only — does not wipe message history
        hideConversation(id, accessToken).catch(() => {});
      }
    },
    [accessToken, closeAllSwipeables]
  );

  const filteredConversations = useMemo(() => conversations.filter((conv: any) => {
    const isAnonymous = Boolean(
      conv.variant ? conv.variant !== "regular" : (conv.is_anonymous || conv.type === "anonymous")
    );
    if (variantFilter === "regular" && isAnonymous) return false;
    if (variantFilter === "anonymous" && !isAnonymous) return false;
    if (!searchQuery.trim()) return true;
    const info = getParticipantInfo(conv, user?.id || "");
    const lastMsg = getLastMessage(conv);
    const query = searchQuery.toLowerCase();
    return (
      info.participantName.toLowerCase().includes(query) ||
      (lastMsg?.content || "").toLowerCase().includes(query)
    );
  }), [conversations, variantFilter, searchQuery, user?.id]);

  // Virtual pagination: show first visibleCount items, expand on scroll
  const paginatedConversations = useMemo(
    () => filteredConversations.slice(0, visibleCount),
    [filteredConversations, visibleCount]
  );

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredConversations.length));
  }, [filteredConversations.length]);

  const handleOpenConversation = useCallback(
    (item: Conversation, info: ReturnType<typeof getParticipantInfo>) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      setNavigatingId(item.id);

      // Prime chat cache with whatever messages this conversation already has
      if (item.messages && item.messages.length > 0) {
        primeChatCacheFromConversation(item.id, item.messages, user?.id);
      }

      router.push({
        pathname: "/pages/conversation" as any,
        params: {
          conversationId: item.id,
          prefillName: info.participantName,
          prefillAvatar: info.participantAvatar || "",
          prefillUserId: info.isAnonymous ? "" : (info.participantId || ""),
          isAnonymous: info.isAnonymous ? "true" : "false",
          prefillDayStreak: String(info.dayStreak ?? 0),
          prefillStreakActiveToday: info.streakActiveToday ? "true" : "false",
          prefillStreakRestoreDeadline: (item.streakRestoreDeadline || item.matchInfo?.streakRestoreDeadline || "") as string,
        },
      });
    },
    [user?.id]
  );

  // ── Memoized FlatList renderItem ──────────────────────────────────────
  const renderConversationItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const info = getParticipantInfo(item, user?.id || "");
      const lastMsg = getLastMessage(item);
      const isOnline = !info.isAnonymous && checkIsOnline(info.participantId);
      const isMine = lastMsg?.sender_id === user?.id;
      const unreadInfo = getUnreadInfo(item, user?.id || "");
      return (
        <SwipeableRow
          item={item}
          info={info}
          lastMsg={lastMsg}
          isOnline={isOnline}
          isMine={isMine}
          unreadInfo={unreadInfo}
          swipeableRefs={swipeableRefs}
          onDeletePrompt={(id, name) => {
            setDeleteTargetId(id);
            setDeleteTargetName(name);
          }}
          onOpen={handleOpenConversation}
          disabled={isNavigating}
          isNavigatingThis={navigatingId === item.id}
        />
      );
    },
    [user?.id, checkIsOnline, swipeableRefs, handleOpenConversation, isNavigating, navigatingId]
  );



  if (loading && conversations.length === 0) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <ScreenHeader title="Messages" hideAccent />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteTargetId !== null}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDelete}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={handleCancelDelete}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              width: "90%",
              maxWidth: 400,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#FEF2F2",
                alignItems: "center",
                justifyContent: "center",
                alignSelf: "center",
                marginBottom: 16,
              }}
            >
              <Trash2 size={24} color="#EF4444" />
            </View>

            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: "#111827",
                textAlign: "center",
                marginBottom: 6,
              }}
            >
              Delete Conversation
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#6B7280",
                textAlign: "center",
                marginBottom: 24,
                lineHeight: 20,
              }}
            >
              Remove your chat with{" "}
              <Text style={{ fontWeight: "700", color: "#111827" }}>
                {deleteTargetName}
              </Text>
              {"? This will hide it from your chat list."}
            </Text>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={handleCancelDelete}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  backgroundColor: "#F9FAFB",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#374151" }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => deleteTargetId && handleHide(deleteTargetId)}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: "#EF4444",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Search bar */}
      <View className="px-4 pt-3.5 pb-3">
        <View
          className="flex-row items-center bg-gray-100 rounded-full px-3.5"
          style={{ paddingVertical: 8 }}
        >
          <Search size={16} color="#9CA3AF" />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search chats..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 text-textPrimary text-sm font-jakarta"
            style={{ paddingVertical: 0 }}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <X size={15} color="#9CA3AF" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter Chips: All chats, Chatmates, Anonymous */}
      <View className="pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {([
            { key: "all", label: "All Chats" },
            { key: "regular", label: "Chatmates" },
            { key: "anonymous", label: "Anonymous" },
          ] as const).map((opt) => (
            <FilterChip
              key={opt.key}
              label={opt.label}
              active={variantFilter === opt.key}
              onPress={() => setVariantFilter(opt.key)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={paginatedConversations}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : String(index))}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          paginatedConversations.length === 0
            ? { flex: 1 }
            : { paddingBottom: 20 }
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        renderItem={renderConversationItem}

        ListEmptyComponent={
          <EmptyState
            icon={<MessageCircle size={28} color="#1A6B3C" />}
            title="No conversations yet"
            description="Start connecting with classmates and your conversations will appear here."
          />
        }
      />
    </View>
  );
}
