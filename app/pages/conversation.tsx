import { useCallback, useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Keyboard,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  MoreVertical,
  Shield,
  Flag,
  Ban,
  Drama,
  Sparkles,
  Flame,
  ChevronRight,
  LogOut,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listMessages,
  sendMessage,
  markConversationRead,
  getConversationById,
  setMessageReaction,
} from "@/lib/api/conversation";
import { getProfilesBatch } from "@/lib/api/profiles";
import { usePresence } from "@/context/PresenceContext";
import { blockUser, reportUser } from "@/lib/api/moderation";
import { endMatch as apiEndMatch } from "@/lib/api/matchmaking";
import { stageName } from "@/constants/matchOptions";
import { getSocket } from "@/lib/socket";
import { SwipeableChatBubble } from "@/components/SwipeableChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { MatchRevealSheet } from "@/components/MatchRevealSheet";
import { useKeyboard } from "@/hooks/useKeyboard";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { Message, Conversation } from "@/types/conversation";
import type { Profile } from "@/types/profile";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "👎"];
const POLL_INTERVAL_MS = 3000;

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const {
    conversationId,
    prefillName,
    prefillAvatar,
    prefillUserId,
    isAnonymous: isAnonymousParam,
  } = useLocalSearchParams<{
    conversationId: string;
    prefillName?: string;
    prefillAvatar?: string;
    prefillUserId?: string;
    isAnonymous?: string;
  }>();

  const [messages, setMessages] = useState<Message[]>([]);
  // If prefill data is passed from messages list, skip loading screen entirely
  const [loading, setLoading] = useState(!prefillName);
  const [sending, setSending] = useState(false);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(
    prefillName
      ? ({ id: prefillUserId, full_name: prefillName, avatar_url: prefillAvatar || null } as any)
      : null
  );
  const { isOnline: checkIsOnline } = usePresence();
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Anonymous Matchmaking State
  const [isAnonymous, setIsAnonymous] = useState(isAnonymousParam === "true");

  const isOnline = !isAnonymous && Boolean(otherProfile?.id && checkIsOnline(otherProfile.id));
  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [conversationVariant, setConversationVariant] = useState<string | null>(
    isAnonymousParam === "true" ? "anonymous" : null
  );
  const [showRevealSheet, setShowRevealSheet] = useState(false);
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);
  const [draftText, setDraftText] = useState("");

  // Context menu
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  // Overflow menu
  const [showOverflow, setShowOverflow] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  const { isKeyboardVisible } = useKeyboard();
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isKeyboardVisible) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [isKeyboardVisible]);

  // ── Load messages & profile ───────────────────────────────────────────
  const loadMessages = useCallback(async (_silent = false) => {
    if (!conversationId || !accessToken) return;
    try {
      const msgs = await listMessages(conversationId, accessToken);
      setMessages(msgs);

      // Mark as read
      if (msgs.length > 0) {
        markConversationRead(
          conversationId,
          new Date().toISOString(),
          accessToken
        ).catch(() => {});
      }
    } catch (err) {
      console.warn("Failed to load messages", err);
    }
  }, [conversationId, accessToken]);

  const loadConversation = useCallback(async () => {
    if (!conversationId || !accessToken || !user) return;
    try {
      const conv = await getConversationById(conversationId, accessToken);
      const isAnon =
        conv.variant === "anonymous" ||
        conv.variant === "anonymous_ended" ||
        Boolean(conv.matchInfo) ||
        isAnonymousParam === "true";

      if (isAnon) {
        setIsAnonymous(true);
        setConversationVariant(
          conv.variant || (conv.matchInfo?.ended ? "anonymous_ended" : "anonymous")
        );
        if (conv.matchInfo) {
          setMatchInfo(conv.matchInfo);
        }
        setOtherProfile({
          id: conv.matchInfo?.id || "anonymous",
          full_name: conv.matchInfo?.partnerAlias || prefillName || "Anonymous Ally",
          avatar_url: conv.matchInfo?.partnerAvatar || prefillAvatar || "fox",
        } as any);
        return;
      }

      const members = conv.conversation_members as any[];
      const otherMember = members?.find((m: any) => {
        const p = m.profiles || m;
        return (p.id || p.user_id) !== user.id;
      });
      if (otherMember) {
        const otherId = otherMember.profiles?.id || otherMember.id || otherMember.user_id;
        if (otherId) {
          const profiles = await getProfilesBatch([otherId], accessToken);
          if (profiles.length > 0) setOtherProfile(profiles[0]);
        }
      }
    } catch (err) {
      console.warn("Failed to load conversation details", err);
    }
  }, [conversationId, accessToken, user, isAnonymousParam, prefillName, prefillAvatar]);

  useEffect(() => {
    async function init() {
      // If prefill was supplied, messages can load in background while header
      // already shows the correct name/avatar — no blocking loading screen.
      if (!prefillName) setLoading(true);
      await Promise.all([loadMessages(), loadConversation()]);
      setLoading(false);
    }
    init();

    // Fallback poll — reconciles anything missed if the socket drops.
    pollRef.current = setInterval(() => loadMessages(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadMessages, loadConversation, prefillName]);

  // Real-time delivery via Socket.io (same events as the web client).
  useEffect(() => {
    if (!conversationId || !accessToken) return;

    const socket = getSocket(accessToken);
    if (!socket) return;

    const onMessageNew = (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId !== conversationId) return;
      setMessages((prev) =>
        prev.some((m) => m.id === payload.message.id) ? prev : [...prev, payload.message]
      );
      markConversationRead(conversationId, new Date().toISOString(), accessToken).catch(() => {});
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const onConnect = () => void loadMessages(true);

    const onStageUpdated = (payload: any) => {
      if (payload?.matchId === matchInfo?.id || payload?.conversationId === conversationId) {
        setMatchInfo((prev: any) => ({
          ...prev,
          stage: payload.stage ?? prev?.stage,
          dayStreak: payload.dayStreak ?? prev?.dayStreak,
        }));
      }
    };

    const onStreakUpdate = (payload: any) => {
      if (payload?.matchId === matchInfo?.id) {
        setMatchInfo((prev: any) => ({
          ...prev,
          dayStreak: payload.dayStreak ?? prev?.dayStreak,
        }));
      }
    };

    const onMatchEnded = (payload: any) => {
      if (payload?.matchId === matchInfo?.id || !payload?.matchId) {
        setConversationVariant("anonymous_ended");
        setMatchInfo((prev: any) => ({ ...prev, ended: true }));
      }
    };

    socket.on("conversation:message_new", onMessageNew);
    socket.on("matchmaking:stage_updated", onStageUpdated);
    socket.on("matchmaking:streak_update", onStreakUpdate);
    socket.on("matchmaking:match_ended", onMatchEnded);
    socket.on("matchmaking:chat_expired", onMatchEnded);
    socket.on("connect", onConnect);

    if (socket.connected) {
      void loadMessages(true);
    }

    return () => {
      socket.off("conversation:message_new", onMessageNew);
      socket.off("matchmaking:stage_updated", onStageUpdated);
      socket.off("matchmaking:streak_update", onStreakUpdate);
      socket.off("matchmaking:match_ended", onMatchEnded);
      socket.off("matchmaking:chat_expired", onMatchEnded);
      socket.off("connect", onConnect);
    };
  }, [conversationId, accessToken, loadMessages, matchInfo?.id]);

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (content: string) => {
      if (!conversationId || !accessToken) return;
      setSending(true);
      try {
        const newMsg = await sendMessage(
          conversationId,
          {
            content,
            replyToMessageId: replyTo?.id || null,
          },
          accessToken
        );
        setMessages((prev) => [...prev, newMsg]);
        setReplyTo(null);
        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } catch (err) {
        console.warn("Failed to send message", err);
      } finally {
        setSending(false);
      }
    },
    [conversationId, accessToken, replyTo]
  );

  // ── Reactions ─────────────────────────────────────────────────────────
  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!selectedMessage || !conversationId || !accessToken) return;
      setShowReactions(false);
      try {
        const updatedReactions = await setMessageReaction(
          conversationId,
          selectedMessage.id,
          emoji,
          accessToken
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === selectedMessage.id
              ? { ...m, reactions: updatedReactions }
              : m
          )
        );
      } catch (err) {
        console.warn("Failed to set reaction", err);
      }
      setSelectedMessage(null);
    },
    [selectedMessage, conversationId, accessToken]
  );

  // ── Block / Report ────────────────────────────────────────────────────
  const handleBlock = useCallback(async () => {
    if (!otherProfile || !accessToken) return;
    setShowBlockConfirm(false);
    try {
      await blockUser(otherProfile.id, accessToken);
      router.back();
    } catch (err) {
      console.warn("Failed to block user", err);
    }
  }, [otherProfile, accessToken]);

  const handleReport = useCallback(async () => {
    if (!otherProfile || !accessToken) return;
    setShowReportConfirm(false);
    try {
      await reportUser(otherProfile.id, "Reported from chat", accessToken);
    } catch (err) {
      console.warn("Failed to report user", err);
    }
  }, [otherProfile, accessToken]);

  const isEnded =
    conversationVariant === "anonymous_ended" ||
    Boolean(matchInfo?.ended);

  const handleEndMatch = useCallback(async () => {
    const id = matchInfo?.matchId || matchInfo?.id || conversationId;
    if (!id || !accessToken) return;
    setShowEndMatchConfirm(false);
    try {
      await apiEndMatch(id, accessToken);
      setConversationVariant("anonymous_ended");
      setMatchInfo((prev: any) => ({ ...prev, ended: true }));
    } catch (err) {
      console.warn("Failed to end match", err);
    }
  }, [matchInfo, conversationId, accessToken]);

  // ── Long press handler ────────────────────────────────────────────────
  const handleLongPress = (message: Message) => {
    setSelectedMessage(message);
    setShowReactions(true);
  };

  if (loading && !prefillName) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
        backgroundColor: "#FFFFFF",
      }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E2DED7",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>

        {isAnonymous ? (
          <Pressable
            onPress={() => setShowRevealSheet(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <AnonymousAvatar
              avatarKey={matchInfo?.partnerAvatar || prefillAvatar || "fox"}
              size={40}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}
                  numberOfLines={1}
                >
                  {matchInfo?.partnerAlias || prefillName || "Anonymous Ally"}
                </Text>
                <Drama size={15} color="#1A6B3C" />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: isEnded ? "#EF4444" : "#1A6B3C",
                  fontWeight: "600",
                }}
              >
                {isEnded
                  ? "Chat Ended"
                  : `${stageName(matchInfo?.stage ?? 0)} • 🔥 ${matchInfo?.dayStreak ?? 0}d streak`}
              </Text>
            </View>
          </Pressable>
        ) : (
          <>
            <UserAvatar
              avatar={otherProfile?.avatar_url}
              size="md"
              online={isOnline}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}
                numberOfLines={1}
              >
                {otherProfile?.full_name || otherProfile?.username || "User"}
              </Text>
              <Text style={{ fontSize: 11, color: isOnline ? "#16A34A" : "#9CA3AF" }}>
                {isOnline ? "Online" : "Offline"}
              </Text>
            </View>
          </>
        )}

        <Pressable onPress={() => setShowOverflow(true)} hitSlop={10}>
          <MoreVertical size={20} color="#6B7280" />
        </Pressable>
      </View>

      {/* ── Anonymous Progression Banner ─────────────────────────────────── */}
      {isAnonymous && !isEnded && (
        <Pressable
          onPress={() => setShowRevealSheet(true)}
          style={{
            backgroundColor: "rgba(26, 107, 60, 0.08)",
            paddingVertical: 8,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottomWidth: 1,
            borderBottomColor: "rgba(26, 107, 60, 0.12)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Flame size={14} color="#EA580C" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A6B3C" }}>
              Stage {matchInfo?.stage ?? 0}: {stageName(matchInfo?.stage ?? 0)}
            </Text>
            <Text style={{ fontSize: 11, color: "#64748B" }}>
              • {matchInfo?.dayStreak ?? 0}d streak
            </Text>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Sparkles size={12} color="#1A6B3C" />
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#1A6B3C" }}>
              View Clues
            </Text>
            <ChevronRight size={13} color="#1A6B3C" />
          </View>
        </Pressable>
      )}

      {/* ── Chat Ended Banner ────────────────────────────────────────────── */}
      {isEnded && (
        <View
          style={{
            backgroundColor: "#FEF2F2",
            paddingVertical: 8,
            paddingHorizontal: 16,
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: "#FEE2E2",
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>
            This anonymous conversation has ended. Messages are read-only.
          </Text>
        </View>
      )}

      {/* ── Messages list ────────────────────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `msg-${index}`)}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === "android"}
        contentContainerStyle={{
          paddingVertical: 12,
          flexGrow: 1,
          justifyContent: messages.length === 0 ? "center" : "flex-end",
        }}
        renderItem={({ item }) => (
          <SwipeableChatBubble
            message={item}
            isMine={item.sender_id === user?.id}
            onLongPress={handleLongPress}
            onReply={(msg) => setReplyTo(msg)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: 32 }}>
            <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>
              Say hello! 👋{"\n"}Start the conversation.
            </Text>
          </View>
        }
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
      />

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <View
        style={{
          paddingBottom:
            Platform.OS === "ios"
              ? isKeyboardVisible
                ? 6
                : Math.max(insets.bottom, 8)
              : 8,
          backgroundColor: "#FFFFFF",
        }}
      >
        {isEnded ? (
          <View
            style={{
              paddingVertical: 14,
              paddingHorizontal: 20,
              alignItems: "center",
              backgroundColor: "#F8FAFC",
              borderTopWidth: 1,
              borderTopColor: "#E2E8F0",
            }}
          >
            <Text style={{ fontSize: 13, color: "#94A3B8", fontStyle: "italic" }}>
              Conversation ended • Read-only mode
            </Text>
          </View>
        ) : (
          <ChatInput
            onSend={handleSend}
            sending={sending}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            draftText={draftText}
          />
        )}
      </View>

      {/* ── Reaction picker modal ────────────────────────────────────────── */}
      <Modal
        visible={showReactions}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowReactions(false);
          setSelectedMessage(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.3)",
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={() => {
            setShowReactions(false);
            setSelectedMessage(null);
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 28,
              flexDirection: "row",
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleReaction(emoji)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                android_ripple={{ color: "rgba(0,0,0,0.06)" }}
              >
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          {/* Reply shortcut */}
          {selectedMessage && (
            <Pressable
              onPress={() => {
                setReplyTo(selectedMessage);
                setShowReactions(false);
                setSelectedMessage(null);
              }}
              style={{
                marginTop: 12,
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                paddingHorizontal: 20,
                paddingVertical: 12,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
                elevation: 4,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#1A6B3C" }}>
                Reply
              </Text>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {/* ── Overflow menu ────────────────────────────────────────────────── */}
      <Modal
        visible={showOverflow}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOverflow(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)" }}
          onPress={() => setShowOverflow(false)}
        >
          <Pressable
            style={{
              marginTop: "auto",
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: insets.bottom + 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#E2DED7",
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            {isAnonymous ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#E2DED7",
                }}
              >
                <AnonymousAvatar
                  avatarKey={matchInfo?.partnerAvatar || prefillAvatar || "fox"}
                  size={48}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                    {matchInfo?.partnerAlias || prefillName || "Anonymous Ally"}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#1A6B3C", fontWeight: "600" }}>
                    {stageName(matchInfo?.stage ?? 0)} • {matchInfo?.dayStreak ?? 0}d streak
                  </Text>
                </View>
              </View>
            ) : otherProfile ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#E2DED7",
                }}
              >
                <UserAvatar avatar={otherProfile.avatar_url} size="lg" online={isOnline} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}>
                    {otherProfile.full_name}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#6B7280" }}>
                    @{otherProfile.username}
                  </Text>
                </View>
              </View>
            ) : null}

            {isAnonymous && (
              <OverflowRow
                icon={Sparkles}
                label="View Clues & Roadmap"
                onPress={() => {
                  setShowOverflow(false);
                  setShowRevealSheet(true);
                }}
              />
            )}

            {!isAnonymous && (
              <OverflowRow
                icon={Shield}
                label="View profile"
                onPress={() => {
                  setShowOverflow(false);
                }}
              />
            )}

            {isAnonymous && !isEnded && (
              <OverflowRow
                icon={LogOut}
                label="End Anonymous Chat"
                onPress={() => {
                  setShowOverflow(false);
                  setShowEndMatchConfirm(true);
                }}
                destructive
              />
            )}

            <OverflowRow
              icon={Flag}
              label={isAnonymous ? "Report match" : "Report user"}
              onPress={() => {
                setShowOverflow(false);
                setShowReportConfirm(true);
              }}
            />
            <OverflowRow
              icon={Ban}
              label={isAnonymous ? "Block match" : "Block user"}
              onPress={() => {
                setShowOverflow(false);
                setShowBlockConfirm(true);
              }}
              destructive
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Confirm modals ───────────────────────────────────────────────── */}
      <ConfirmModal
        visible={showBlockConfirm}
        title="Block this user?"
        description="They won't be able to message you or see your profile. You can unblock them later from settings."
        confirmLabel="Block"
        destructive
        onConfirm={handleBlock}
        onCancel={() => setShowBlockConfirm(false)}
      />

      <ConfirmModal
        visible={showReportConfirm}
        title="Report this user?"
        description="We'll review their account for any violations. Your report is confidential."
        confirmLabel="Report"
        destructive
        onConfirm={handleReport}
        onCancel={() => setShowReportConfirm(false)}
      />

      <ConfirmModal
        visible={showEndMatchConfirm}
        title="End Anonymous Chat?"
        description="This will lock the conversation into read-only mode for both of you. You will not be able to send further messages."
        confirmLabel="End Chat"
        destructive
        onConfirm={handleEndMatch}
        onCancel={() => setShowEndMatchConfirm(false)}
      />

      {/* ── Match Reveal & Roadmap Sheet ──────────────────────────────────── */}
      {isAnonymous && (
        <MatchRevealSheet
          visible={showRevealSheet}
          onClose={() => setShowRevealSheet(false)}
          matchId={matchInfo?.matchId || matchInfo?.id || conversationId}
          stage={matchInfo?.stage ?? 0}
          dayStreak={matchInfo?.dayStreak ?? 0}
          partnerAlias={matchInfo?.partnerAlias || prefillName || "Anonymous Ally"}
          partnerAvatar={matchInfo?.partnerAvatar || prefillAvatar || "fox"}
          onSelectIcebreaker={(text) => setDraftText(text)}
          onMatchEnded={() => {
            setConversationVariant("anonymous_ended");
            setMatchInfo((prev: any) => ({ ...prev, ended: true }));
          }}
          ended={isEnded}
        />
      )}
    </KeyboardAvoidingView>
  );
}

function OverflowRow({
  icon: Icon,
  label,
  onPress,
  destructive,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
      }}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
    >
      <Icon size={18} color={destructive ? "#EF4444" : "#374151"} />
      <Text
        style={{
          fontSize: 15,
          fontWeight: "500",
          color: destructive ? "#EF4444" : "#111827",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
