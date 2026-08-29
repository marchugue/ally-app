import { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { router } from "expo-router";
import { Search, X, MessageCircle, UserPlus, Trash2 } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { FilterChip } from "@/components/FilterChip";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { listConversations, clearConversation } from "@/lib/api/conversation";
import { getOnlinePresence } from "@/lib/api/presense";
import { getSocket } from "@/lib/socket";
import type { Conversation } from "@/types/conversation";

function getParticipantInfo(conv: any, myId: string) {
  const isAnonymous = Boolean(
    conv.variant ? conv.variant !== "regular" : (conv.is_anonymous || conv.type === "anonymous")
  );

  if (isAnonymous) {
    return {
      participantId: conv.matchInfo?.matchId || conv.id || "anonymous",
      participantName: conv.matchInfo?.partnerAlias || "Anonymous",
      participantAvatar: conv.matchInfo?.partnerAvatar || null,
      isAnonymous: true,
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
  };
}

function getLastMessage(conv: Conversation) {
  if (!conv.messages || conv.messages.length === 0) return null;
  return conv.messages[conv.messages.length - 1];
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
  swipeableRefs: React.MutableRefObject<Map<string, any>>;
  onDeletePrompt: (id: string, name: string) => void;
}

function SwipeableRow({
  item,
  info,
  lastMsg,
  isOnline,
  isMine,
  swipeableRefs,
  onDeletePrompt,
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
        /* Layer 2 (Lower): Red background + trash icon revealed on swipe */
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
      {/* Layer 1 (Top): Chat content — background matches page surface */}
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/pages/conversation" as any,
            params: {
              conversationId: item.id,
              prefillName: info.participantName,
              prefillAvatar: info.participantAvatar || "",
            },
          })
        }
        android_ripple={{ color: "rgba(0,0,0,0.04)" }}
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#F9FAFB" : "#FFFFFF",
        })}
      >
        <View
          className="w-full flex-row items-start px-5 py-3"
          style={{ flexDirection: "row", width: "100%", flexWrap: "nowrap" }}
        >
          {/* Avatar */}
          <View className="shrink-0" style={{ flexShrink: 0 }}>
            <UserAvatar
              avatar={info.participantAvatar}
              size="md"
              online={isOnline}
            />
          </View>

          {/* Details */}
          <View
            className="flex-1 min-w-0 mx-3"
            style={{ flex: 1, flexBasis: 0, minWidth: 0, overflow: "hidden" }}
          >
            <Text
              className="text-[15px] font-bold text-[#111827]"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {info.participantName}
            </Text>
            <Text
              className="text-[13px] mt-0.5"
              style={{
                color: lastMsg ? "#6B7280" : "#9CA3AF",
                fontStyle: lastMsg ? "normal" : "italic",
              }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {lastMsg
                ? `${isMine ? "You: " : ""}${lastMsg.content || (lastMsg.image_url ? "📷 Photo" : "")}`
                : "Start the conversation"}
            </Text>
          </View>

          {/* Timestamp */}
          {lastMsg ? (
            <View className="shrink-0 pt-0.5" style={{ flexShrink: 0 }}>
              <Text className="text-[11px] text-[#9CA3AF]">
                {formatRelativeTime(lastMsg.created_at)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </ReanimatedSwipeable>
  );
}

export default function MessagesScreen() {
  const { user, accessToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [variantFilter, setVariantFilter] = useState<"all" | "regular" | "anonymous">("all");
  // id of conversation pending delete confirmation shown in Modal
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>("");
  const swipeableRefs = useRef<Map<string, any>>(new Map());

  const closeAllSwipeables = useCallback(() => {
    swipeableRefs.current.forEach((ref) => ref?.close());
  }, []);

  const handleCancelDelete = useCallback(() => {
    setDeleteTargetId(null);
    setDeleteTargetName("");
    closeAllSwipeables();
  }, [closeAllSwipeables]);

  const loadConversations = useCallback(async (silent = false) => {
    if (!accessToken) return;
    try {
      const convs = await listConversations(accessToken);
      // Sort by most recent message / activity timestamp
      convs.sort((a, b) => {
        const aTime = getLastMessage(a)?.created_at || a.updated_at;
        const bTime = getLastMessage(b)?.created_at || b.updated_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      // Deduplicate by participantId (EXACT web version behavior from useConversations.ts)
      const deduped = new Map<string, Conversation>();
      convs.forEach((conv) => {
        const info = getParticipantInfo(conv, user?.id || "");
        if (!deduped.has(info.participantId)) {
          deduped.set(info.participantId, conv);
        }
      });
      setConversations(Array.from(deduped.values()));
    } catch (err) {
      console.warn("Failed to load conversations", err);
    }
  }, [accessToken, user?.id]);

  const loadOnlineStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      const { online } = await getOnlinePresence(accessToken);
      setOnlineUsers(new Set(online.map((e) => e.user_id)));
    } catch {
      // Presence is best-effort
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([loadConversations(), loadOnlineStatus()]);
      setLoading(false);
    }
    init();

    // Fallback poll if the socket disconnects.
    const interval = setInterval(() => {
      loadConversations(true);
      loadOnlineStatus();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadConversations, loadOnlineStatus]);

  // Instant list refresh when a message arrives on any device.
  useEffect(() => {
    if (!accessToken) return;

    const socket = getSocket(accessToken);
    if (!socket) return;

    const onMessageNew = () => {
      void loadConversations(true);
      void loadOnlineStatus();
    };
    const onConnect = () => {
      void loadConversations(true);
      void loadOnlineStatus();
    };

    socket.on("conversation:message_new", onMessageNew);
    socket.on("connect", onConnect);

    return () => {
      socket.off("conversation:message_new", onMessageNew);
      socket.off("connect", onConnect);
    };
  }, [accessToken, loadConversations, loadOnlineStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadConversations(), loadOnlineStatus()]);
    setRefreshing(false);
  }, [loadConversations, loadOnlineStatus]);

  const handleHide = useCallback(
    async (id: string) => {
      setDeleteTargetId(null);
      setDeleteTargetName("");
      closeAllSwipeables();
      // Optimistically remove from list immediately
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // Permanent delete: clears message history + hides from list
      if (accessToken) {
        clearConversation(id, accessToken).catch(() => {
          // Silently ignore — local removal already happened
        });
      }
    },
    [accessToken, closeAllSwipeables]
  );

  const filteredConversations = conversations.filter((conv: any) => {
    const isAnonymous = Boolean(
      conv.variant ? conv.variant !== "regular" : (conv.is_anonymous || conv.type === "anonymous")
    );
    if (variantFilter === "regular" && isAnonymous) return false;
    if (variantFilter === "anonymous" && !isAnonymous) return false;

    if (!searchQuery.trim()) return true;
    const info = getParticipantInfo(conv, user?.id || "");
    const query = searchQuery.toLowerCase();
    return info.participantName.toLowerCase().includes(query);
  });

  if (loading) {
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
              marginHorizontal: 32,
              width: "85%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            {/* Icon */}
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

            {/* Buttons */}
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

      {/* Subheader: Chats & Person with Plus */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 4,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontFamily: "Fraunces_700Bold",
            color: "#1A6B3C",
            letterSpacing: -0.5,
          }}
        >
          Chats
        </Text>

        <Pressable
          onPress={() => router.push("/pages/requests" as any)}
          hitSlop={10}
        >
          <UserPlus size={20} color="#1A6B3C" />
        </Pressable>
      </View>

      {/* Search bar */}
      <View className="px-4 pb-3">
        <View
          className="flex-row items-center bg-gray-100 rounded-full px-3.5"
          style={{ paddingVertical: 8 }}
        >
          <Search size={16} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations…"
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
      <View className="flex-row items-center px-4 pb-3 gap-2">
        {([
          { key: "all", label: "All chats" },
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
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={filteredConversations}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : String(index))}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          filteredConversations.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
        }
        renderItem={({ item }) => {
          const info = getParticipantInfo(item, user?.id || "");
          const lastMsg = getLastMessage(item);
          const isOnline = !info.isAnonymous && onlineUsers.has(info.participantId);
          const isMine = lastMsg?.sender_id === user?.id;

          return (
            <SwipeableRow
              item={item}
              info={info}
              lastMsg={lastMsg}
              isOnline={isOnline}
              isMine={isMine}
              swipeableRefs={swipeableRefs}
              onDeletePrompt={(id, name) => {
                setDeleteTargetId(id);
                setDeleteTargetName(name);
              }}
            />
          );
        }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: "#F3F4F6",
              marginLeft: 72,
              marginRight: 20,
            }}
          />
        )}
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
