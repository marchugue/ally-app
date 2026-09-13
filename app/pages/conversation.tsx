import { useCallback, useEffect, useState, useRef, useMemo } from "react";
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
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  MoreVertical,
  Shield,
  ShieldCheck,
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
import * as ImagePicker from "expo-image-picker";
import { uploadChatFile } from "@/lib/api/media";
import { SwipeableChatBubble } from "@/components/SwipeableChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { MatchRevealSheet } from "@/components/MatchRevealSheet";
import { useKeyboard } from "@/hooks/useKeyboard";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { Message, Conversation, MessageGroupPosition } from "@/types/conversation";
import type { Profile } from "@/types/profile";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "👎"];
const GROUPING_MAX_GAP_MS = 5 * 60 * 1000;

function canGroupMessages(current: Message, adjacent: Message | null | undefined): boolean {
  if (!adjacent) return false;
  if (current.sender_id !== adjacent.sender_id) return false;
  if (current.status === "failed" || adjacent.status === "failed") return false;

  const curTime = new Date(current.created_at).getTime();
  const adjTime = new Date(adjacent.created_at).getTime();
  if (isNaN(curTime) || isNaN(adjTime)) return true;
  return Math.abs(curTime - adjTime) <= GROUPING_MAX_GAP_MS;
}
const POLL_INTERVAL_MS = 3000;

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const {
    conversationId: rawConvId,
    id: rawId,
    prefillName,
    prefillAvatar,
    prefillUserId,
    isAnonymous: isAnonymousParam,
  } = useLocalSearchParams<{
    conversationId?: string;
    id?: string;
    prefillName?: string;
    prefillAvatar?: string;
    prefillUserId?: string;
    isAnonymous?: string;
  }>();

  const conversationId = rawConvId || rawId || "";

  const [messages, setMessages] = useState<Message[]>([]);
  // If prefill data is passed from messages list, skip loading screen entirely
  const [loading, setLoading] = useState(!prefillName);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(
    prefillName
      ? ({ id: prefillUserId, full_name: prefillName, avatar_url: prefillAvatar || null } as any)
      : null
  );
  const { isOnline: checkIsOnline } = usePresence();
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Anonymous Matchmaking State
  const [isAnonymous, setIsAnonymous] = useState(isAnonymousParam === "true");
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);

  const isOnline = Boolean(
    (otherProfile?.id && otherProfile.id !== "anonymous" && checkIsOnline(otherProfile.id)) ||
    (partnerUserId && checkIsOnline(partnerUserId))
  );
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

  // Check if streak was activated today (both participants sent at least 1 message today)
  const isStreakActiveToday = useMemo(() => {
    if (Boolean(matchInfo?.streakActiveToday)) return true;
    if (!messages.length || !user?.id) return false;

    // Evaluate in both PHT (UTC+8) and device local date
    const phtToday = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
    const localToday = new Date().toISOString().slice(0, 10);

    const hasBothOnDate = (targetDate: string) => {
      let myMsg = false;
      let partnerMsg = false;
      for (const msg of messages) {
        if (!msg.created_at) continue;
        const msgPht = new Date(new Date(msg.created_at).getTime() + 8 * 3600_000)
          .toISOString()
          .slice(0, 10);
        const msgLocal = new Date(msg.created_at).toISOString().slice(0, 10);

        if (msgPht === targetDate || msgLocal === targetDate) {
          if (msg.sender_id === user.id) {
            myMsg = true;
          } else if (msg.sender_id) {
            partnerMsg = true;
          }
        }
        if (myMsg && partnerMsg) return true;
      }
      return myMsg && partnerMsg;
    };

    return hasBothOnDate(phtToday) || hasBothOnDate(localToday);
  }, [messages, user?.id, matchInfo?.streakActiveToday]);

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
      setMessages((prev) => {
        const pending = prev.filter(
          (m) => m.id.startsWith("temp-") || m.status === "sending" || m.status === "failed"
        );
        if (pending.length === 0) return msgs;

        // Retain any pending/sending/failed messages that haven't been reconciled into msgs yet
        const result = [...msgs];
        for (const p of pending) {
          const alreadyInList = result.some(
            (m) =>
              m.id === p.id ||
              (m.content === p.content &&
                m.sender_id === p.sender_id &&
                Math.abs(new Date(m.created_at).getTime() - new Date(p.created_at).getTime()) < 15000)
          );
          if (!alreadyInList) {
            result.push(p);
          }
        }
        return result;
      });

      // Mark as read
      if (msgs.length > 0) {
        markConversationRead(
          conversationId,
          new Date().toISOString(),
          accessToken
        ).catch(() => { });
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
        const members = (conv.conversation_members as any[]) || [];
        const otherMember = members.find((m: any) => {
          const uid = m.user_id || m.profiles?.id || m.id;
          return uid && uid !== user.id;
        });
        if (otherMember?.user_id) {
          setPartnerUserId(otherMember.user_id);
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
      const incomingMsg: Message = { ...payload.message, status: "sent" };
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;

        // Reconcile optimistic temp message if already present
        const pendingIndex = prev.findIndex(
          (m) =>
            m.id.startsWith("temp-") &&
            m.sender_id === incomingMsg.sender_id &&
            m.content === incomingMsg.content
        );
        if (pendingIndex !== -1) {
          const next = [...prev];
          next[pendingIndex] = incomingMsg;
          return next;
        }

        return [...prev, incomingMsg];
      });
      markConversationRead(conversationId, new Date().toISOString(), accessToken).catch(() => { });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    };

    const onConnect = () => void loadMessages(true);

    const onStageUpdated = (payload: any) => {
      if (payload?.matchId === matchInfo?.id || payload?.conversationId === conversationId) {
        setMatchInfo((prev: any) => ({
          ...prev,
          stage: payload.stage ?? prev?.stage,
          dayStreak: payload.dayStreak ?? prev?.dayStreak,
          streakActiveToday: true,
        }));
      }
    };

    const onStreakUpdate = (payload: any) => {
      if (payload?.matchId === matchInfo?.id || payload?.conversationId === conversationId) {
        setMatchInfo((prev: any) => ({
          ...prev,
          dayStreak: payload.dayStreak ?? prev?.dayStreak,
          streakActiveToday: true,
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
    socket.on("conversation:streak_updated", onStreakUpdate);
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
      socket.off("conversation:streak_updated", onStreakUpdate);
      socket.off("matchmaking:stage_updated", onStageUpdated);
      socket.off("matchmaking:streak_update", onStreakUpdate);
      socket.off("matchmaking:match_ended", onMatchEnded);
      socket.off("matchmaking:chat_expired", onMatchEnded);
      socket.off("connect", onConnect);
    };
  }, [conversationId, accessToken, loadMessages, matchInfo?.id]);

  // ── Send message (Optimistic UI — 0ms instant display) ───────────────
  const handleSend = useCallback(
    async (content: string, imageUrl?: string | null) => {
      if (!conversationId || !accessToken || !user) return;

      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const activeReply = replyTo;
      setReplyTo(null);

      const optimisticMsg: Message = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        image_url: imageUrl || null,
        created_at: new Date().toISOString(),
        reply_to_message_id: activeReply?.id || null,
        replied_message: activeReply || null,
        reactions: [],
        status: "sending",
      };

      // 1. Immediately display message on screen (0ms delay)
      setMessages((prev) => [...prev, optimisticMsg]);

      // 2. Immediately scroll to bottom
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });

      // 3. Send to server in background
      try {
        const savedMsg = await sendMessage(
          conversationId,
          {
            content,
            imageUrl: imageUrl || null,
            replyToMessageId: activeReply?.id || null,
          },
          accessToken
        );

        // Replace temp optimistic message with real saved message and mark sent
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMsg.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? { ...savedMsg, status: "sent" } : m));
        });
      } catch (err) {
        console.warn("Failed to send message", err);
        // Retain message and mark as failed so user can tap to retry
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, status: "failed" } : m))
        );
      }
    },
    [conversationId, accessToken, user, replyTo]
  );

  // ── Pick media & take photo handlers ─────────────────────────────────
  const handlePickMedia = useCallback(async () => {
    if (!conversationId || !accessToken) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Photo library permission is required to send photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const filename = asset.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      const uploadRes = await uploadChatFile(
        { uri: asset.uri, name: filename, type },
        accessToken
      );
      if (uploadRes?.url) {
        await handleSend("", uploadRes.url);
      }
    } catch (err) {
      console.warn("Failed to pick and send image", err);
      Alert.alert("Upload Failed", "Could not upload image. Please try again.");
    }
  }, [conversationId, accessToken, handleSend]);

  const handleTakePhoto = useCallback(async () => {
    if (!conversationId || !accessToken) return;
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const filename = asset.uri.split("/").pop() || `camera_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      const uploadRes = await uploadChatFile(
        { uri: asset.uri, name: filename, type },
        accessToken
      );
      if (uploadRes?.url) {
        await handleSend("", uploadRes.url);
      }
    } catch (err) {
      console.warn("Failed to take photo and send", err);
      Alert.alert("Camera Failed", "Could not upload photo. Please try again.");
    }
  }, [conversationId, accessToken, handleSend]);

  // ── Retry failed message ─────────────────────────────────────────────
  const handleRetry = useCallback(
    async (failedMsg: Message) => {
      if (!conversationId || !accessToken || !user) return;
      const targetId = failedMsg.id;

      // Set status back to sending
      setMessages((prev) =>
        prev.map((m) => (m.id === targetId ? { ...m, status: "sending" } : m))
      );

      try {
        const savedMsg = await sendMessage(
          conversationId,
          {
            content: failedMsg.content,
            replyToMessageId: failedMsg.reply_to_message_id,
          },
          accessToken
        );

        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMsg.id)) {
            return prev.filter((m) => m.id !== targetId);
          }
          return prev.map((m) => (m.id === targetId ? { ...savedMsg, status: "sent" } : m));
        });
      } catch (err) {
        console.warn("Failed to retry message", err);
        setMessages((prev) =>
          prev.map((m) => (m.id === targetId ? { ...m, status: "failed" } : m))
        );
      }
    },
    [conversationId, accessToken, user]
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
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* ── Header (fixed — stays above keyboard) ───────────────────────── */}
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#111827", maxWidth: 160 }}
                  numberOfLines={1}
                >
                  {matchInfo?.partnerAlias || prefillName || "Anonymous Ally"}
                </Text>
                <Drama size={15} color="#1A6B3C" />


                {/* Streak badge placed right next to active ally badge */}
                {(matchInfo?.dayStreak ?? 0) > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 2,
                      backgroundColor: isStreakActiveToday ? "rgba(235, 86, 0, 0.1)" : "#F3F4F6",
                      paddingHorizontal: 6,
                      paddingVertical: 1.5,
                      borderRadius: 8,
                    }}
                  >
                    <Flame size={12} color={isStreakActiveToday ? "#eb5600" : "#9CA3AF"} />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isStreakActiveToday ? "#eb5600" : "#9CA3AF",
                      }}
                    >
                      {matchInfo?.dayStreak}
                    </Text>
                  </View>
                )}
              </View>

              {/* Online / Offline status right on the bottom of the anonymous name */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isEnded ? "#EF4444" : isOnline ? "#16A34A" : "#9CA3AF",
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: isEnded ? "#EF4444" : isOnline ? "#16A34A" : "#9CA3AF",
                    fontWeight: "500",
                  }}
                >
                  {isEnded ? "Chat Ended" : isOnline ? "Online" : "Offline"}
                </Text>
              </View>
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
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#111827", maxWidth: 160 }}
                  numberOfLines={1}
                >
                  {otherProfile?.full_name || otherProfile?.username || "User"}
                </Text>


                {(matchInfo?.dayStreak ?? 0) > 0 && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 2,
                      backgroundColor: isStreakActiveToday ? "rgba(235, 86, 0, 0.1)" : "#F3F4F6",
                      paddingHorizontal: 6,
                      paddingVertical: 1.5,
                      borderRadius: 8,
                    }}
                  >
                    <Flame size={12} color={isStreakActiveToday ? "#eb5600" : "#9CA3AF"} />
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: isStreakActiveToday ? "#eb5600" : "#9CA3AF",
                      }}
                    >
                      {matchInfo?.dayStreak}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isOnline ? "#16A34A" : "#9CA3AF",
                  }}
                />
                <Text style={{ fontSize: 11, color: isOnline ? "#16A34A" : "#9CA3AF", fontWeight: "500" }}>
                  {isOnline ? "Online" : "Offline"}
                </Text>
              </View>
            </View>
          </>
        )}

        <Pressable onPress={() => setShowOverflow(true)} hitSlop={10}>
          <MoreVertical size={20} color="#6B7280" />
        </Pressable>
      </View>

      {/* ── Scrollable chat area — lifts with keyboard, header stays put ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
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
          style={{ flex: 1 }}
          keyExtractor={(item, index) => (item.id ? `${item.id}-${index}` : `msg-${index}`)}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={Platform.OS === "android"}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{
            paddingVertical: 12,
            flexGrow: 1,
            justifyContent: messages.length === 0 ? "center" : "flex-end",
          }}
          extraData={messages}
          renderItem={({ item, index }) => {
            const prev = index > 0 ? messages[index - 1] : null;
            const next = index < messages.length - 1 ? messages[index + 1] : null;
            const hasPrev = canGroupMessages(item, prev);
            const hasNext = canGroupMessages(item, next);

            let groupPosition: MessageGroupPosition = "single";
            if (!hasPrev && hasNext) {
              groupPosition = "first";
            } else if (hasPrev && hasNext) {
              groupPosition = "middle";
            } else if (hasPrev && !hasNext) {
              groupPosition = "last";
            }

            const isMine = item.sender_id === user?.id;
            const partnerDisplayName = isAnonymous
              ? (matchInfo?.partnerAlias || prefillName || "Anonymous Ally")
              : (otherProfile?.username || otherProfile?.full_name || prefillName || "User");
            const senderName = isMine ? "Me" : partnerDisplayName;

            return (
              <SwipeableChatBubble
                message={item}
                isMine={isMine}
                groupPosition={groupPosition}
                senderName={senderName}
                onLongPress={handleLongPress}
                onReply={(msg) => setReplyTo(msg)}
                onRetry={handleRetry}
              />
            );
          }}
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
            paddingBottom: isKeyboardVisible ? 0 : Math.max(insets.bottom, 8),
            backgroundColor: "#FFFFFF",
            zIndex: 20,
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
              onPickMedia={handlePickMedia}
              onTakePhoto={handleTakePhoto}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              draftText={draftText}
            />
          )}
        </View>
      </KeyboardAvoidingView>

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



            {isAnonymous && !isEnded && (
              <OverflowRow
                icon={LogOut}
                label="End Match"
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
        title="End Match?"
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
    </View>
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
