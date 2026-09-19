import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
  Keyboard,
  Alert,
  Image,
} from "react-native";
import { getFluentEmojiUrl } from "@/lib/fluentEmoji";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  Plus,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listMessages,
  sendMessage,
  markConversationRead,
  getConversationById,
  setMessageReaction,
  restoreConversationStreak,
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
import { FluentEmojiPickerModal } from "@/components/FluentEmojiPickerModal";
import { MatchRevealSheet } from "@/components/MatchRevealSheet";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
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

const CACHE_KEY_PREFIX = "ally_chat_cache_";
const MAX_CACHED_MESSAGES = 50;

const MAX_CHAT_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface MobileChatCache {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
  cachedAt: number;
}

function getCacheKey(convId: string, userId?: string | null): string {
  return userId ? `${CACHE_KEY_PREFIX}${userId}_${convId}` : `${CACHE_KEY_PREFIX}${convId}`;
}

async function getCachedMessagesMobile(convId: string, userId?: string | null): Promise<MobileChatCache | null> {
  try {
    const key = getCacheKey(convId, userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.messages)) {
      const cachedAt = Number(parsed.cachedAt) || 0;
      if (Date.now() - cachedAt > MAX_CHAT_CACHE_AGE_MS) {
        await AsyncStorage.removeItem(key).catch(() => {});
        return null;
      }
      return {
        messages: parsed.messages,
        hasMore: Boolean(parsed.hasMore),
        nextCursor: parsed.nextCursor ?? null,
        cachedAt,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

async function setCachedMessagesMobile(
  convId: string,
  messages: Message[],
  hasMore: boolean,
  nextCursor: string | null,
  userId?: string | null
) {
  try {
    const confirmed = messages.filter(
      (m) => !m.id.startsWith("temp-") && m.status !== "failed" && m.status !== "sending"
    );
    const toCache = confirmed.slice(-MAX_CACHED_MESSAGES);
    await AsyncStorage.setItem(
      getCacheKey(convId, userId),
      JSON.stringify({
        messages: toCache,
        hasMore,
        nextCursor,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // ignore
  }
}

interface StreakNoticeAnchor {
  messageId: string;
  timestamp: number;
}
const streakNoticeAnchorMap = new Map<string, StreakNoticeAnchor>();

function getStreakAnchorKey(convId: string): string {
  return `@streak_anchor_${convId}`;
}

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
    prefillDayStreak,
    prefillStreakActiveToday,
    prefillStreakRestoreDeadline,
  } = useLocalSearchParams<{
    conversationId?: string;
    id?: string;
    prefillName?: string;
    prefillAvatar?: string;
    prefillUserId?: string;
    isAnonymous?: string;
    prefillDayStreak?: string;
    prefillStreakActiveToday?: string;
    prefillStreakRestoreDeadline?: string;
  }>();

  const conversationId = rawConvId || rawId || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  // If prefill data is passed from messages list, skip loading screen entirely
  const [loading, setLoading] = useState(!prefillName);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(
    prefillName
      ? ({ id: prefillUserId, full_name: prefillName, avatar_url: prefillAvatar || null } as any)
      : null
  );
  const { isOnline: checkIsOnline } = usePresence();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [activeTimeMessageId, setActiveTimeMessageId] = useState<string | null>(null);

  const handleToggleTime = useCallback((messageId: string) => {
    setActiveTimeMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  // Anonymous Matchmaking State
  const [isAnonymous, setIsAnonymous] = useState(isAnonymousParam === "true");
  const [partnerUserId, setPartnerUserId] = useState<string | null>(null);

  const isOnline = Boolean(
    (otherProfile?.id && otherProfile.id !== "anonymous" && checkIsOnline(otherProfile.id)) ||
    (partnerUserId && checkIsOnline(partnerUserId))
  );
  const [matchInfo, setMatchInfo] = useState<any>(null);
  const [convStreak, setConvStreak] = useState<number>(
    prefillDayStreak !== undefined ? parseInt(prefillDayStreak, 10) || 0 : 0
  );
  const [convStreakActiveToday, setConvStreakActiveToday] = useState<boolean>(
    prefillStreakActiveToday === "true"
  );
  /** ISO UTC string deadline for restoring a lapsed streak. Null when window expired or streak is active. */
  const [streakRestoreDeadline, setStreakRestoreDeadline] = useState<string | null>(
    prefillStreakRestoreDeadline || null
  );
  /** Realtime countdown tick — increments every minute to re-derive hoursRemaining without re-fetching */
  const [nowTick, setNowTick] = useState(0);
  const [conversationVariant, setConversationVariant] = useState<string | null>(
    isAnonymousParam === "true" ? "anonymous" : null
  );

  const isEnded =
    conversationVariant === "anonymous_ended" ||
    Boolean(matchInfo?.ended);
  const [showRevealSheet, setShowRevealSheet] = useState(false);
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);
  const [draftText, setDraftText] = useState("");

  // Context menu
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showReactions, setShowReactions] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);

  // Streak active today — derived purely from backend state (convStreakActiveToday).
  // The backend is the source of truth; we do NOT re-derive from message history
  // to avoid false positives caused by timezone or clock drift.
  const isStreakActiveToday = convStreakActiveToday || Boolean(matchInfo?.streakActiveToday);

  // ── Restore window derived values ─────────────────────────────────────
  // True when the streak has lapsed AND the backend restore deadline hasn't passed yet.
  const deadlineRaw = streakRestoreDeadline ?? matchInfo?.streakRestoreDeadline ?? null;
  const canRestoreStreak = useMemo(() => {
    return Boolean(deadlineRaw && new Date() < new Date(deadlineRaw));
  }, [deadlineRaw, nowTick]);
  // Hours remaining (floor), updated every minute by the tick interval below.
  const restoreHoursRemaining = useMemo(() => {
    if (!deadlineRaw) return 0;
    const diffMs = new Date(deadlineRaw).getTime() - Date.now();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  }, [deadlineRaw, nowTick]);

  // Exact timestamp when the streak lapsed (deadline minus 42 hours window).
  const streakEndedAt = useMemo(() => {
    if (!deadlineRaw) return null;
    return new Date(new Date(deadlineRaw).getTime() - 42 * 60 * 60 * 1000);
  }, [deadlineRaw]);

  // Overflow menu
  const [showOverflow, setShowOverflow] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);

  // ── Minute-tick for realtime deadline countdown ──────────────────────
  useEffect(() => {
    if (!deadlineRaw) return;
    const interval = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [deadlineRaw]);


  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load anchor from AsyncStorage if not already in memory
  useEffect(() => {
    if (!conversationId) return;
    if (!streakNoticeAnchorMap.has(conversationId)) {
      AsyncStorage.getItem(getStreakAnchorKey(conversationId))
        .then((raw) => {
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed?.messageId) {
                streakNoticeAnchorMap.set(conversationId, parsed);
              }
            } catch {
              streakNoticeAnchorMap.set(conversationId, { messageId: raw, timestamp: Date.now() });
            }
          }
        })
        .catch(() => {});
    }
  }, [conversationId]);

  type ChatItem =
    | { type: 'message'; data: Message }
    | { type: 'streak_notice'; id: '__streak_notice__' };

  const showStreakNotice = !isEnded && convStreak === 0;

  // In an inverted list, index 0 is at the bottom (newest message).
  // The streak notice is inserted chronologically based on when the streak ended,
  // so newer messages naturally stack below it!
  const invertedChatItems = useMemo<ChatItem[]>(() => {
    const sorted = [...messages]; // chronological: oldest to newest
    if (!showStreakNotice) {
      if (conversationId && streakNoticeAnchorMap.has(conversationId)) {
        streakNoticeAnchorMap.delete(conversationId);
        AsyncStorage.removeItem(getStreakAnchorKey(conversationId)).catch(() => {});
      }
      return sorted.reverse().map((m) => ({ type: 'message', data: m }));
    }

    const endedTime = streakEndedAt ? new Date(streakEndedAt).getTime() : NaN;

    let insertIdx: number;
    if (!isNaN(endedTime)) {
      const idx = sorted.findIndex((m) => {
        const msgTime = new Date(m.created_at || (m as any).timestamp).getTime();
        return !isNaN(msgTime) && msgTime > endedTime;
      });
      insertIdx = idx !== -1 ? idx : sorted.length;
    } else {
      // Anchoring logic for when streakEndedAt is not available
      const savedAnchor = conversationId ? streakNoticeAnchorMap.get(conversationId) : undefined;
      if (savedAnchor) {
        if (savedAnchor.messageId === '__START__') {
          insertIdx = 0;
        } else {
          const anchorIdx = sorted.findIndex((m) => m.id === savedAnchor.messageId);
          if (anchorIdx !== -1) {
            insertIdx = anchorIdx + 1;
          } else if (savedAnchor.timestamp) {
            const timeIdx = sorted.findIndex((m) => {
              const msgTime = new Date(m.created_at || (m as any).timestamp).getTime();
              return !isNaN(msgTime) && msgTime > savedAnchor.timestamp;
            });
            insertIdx = timeIdx !== -1 ? timeIdx : 0;
          } else {
            insertIdx = 0;
          }
        }
      } else if (sorted.length > 0) {
        const lastMsg = sorted[sorted.length - 1];
        const newAnchor: StreakNoticeAnchor = {
          messageId: lastMsg.id,
          timestamp: new Date(lastMsg.created_at || (lastMsg as any).timestamp).getTime() || Date.now(),
        };
        if (conversationId) {
          streakNoticeAnchorMap.set(conversationId, newAnchor);
          AsyncStorage.setItem(getStreakAnchorKey(conversationId), JSON.stringify(newAnchor)).catch(() => {});
        }
        insertIdx = sorted.length;
      } else {
        insertIdx = 0;
      }
    }

    const items: ChatItem[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i === insertIdx) {
        items.push({ type: 'streak_notice', id: '__streak_notice__' });
      }
      items.push({ type: 'message', data: sorted[i] });
    }
    if (insertIdx === sorted.length) {
      items.push({ type: 'streak_notice', id: '__streak_notice__' });
    }

    return items.reverse();
  }, [messages, showStreakNotice, streakEndedAt, conversationId]);

  // ── Instant Navigation (0ms display) ──────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    hasLoadedOnceRef.current = false;
    getCachedMessagesMobile(conversationId, user?.id).then((cached) => {
      if (cached && cached.messages.length > 0 && !hasLoadedOnceRef.current) {
        setMessages(cached.messages);
        setHasMore(cached.hasMore);
        setNextCursor(cached.nextCursor);
        setLoading(false);
      }
    });
  }, [conversationId, user?.id]);

  // ── Load messages & profile ───────────────────────────────────────────
  const loadMessages = useCallback(async (_silent = false) => {
    if (!conversationId || !accessToken) return;
    try {
      const res = await listMessages(conversationId, accessToken, { limit: 30 });
      const msgs = res.messages;
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);

      setMessages((prev) => {
        const pending = prev.filter(
          (m) => m.id.startsWith("temp-") || m.status === "sending" || m.status === "failed"
        );

        // Keep any older messages already loaded into history before msgs
        const serverIds = new Set(msgs.map((m) => m.id));
        const firstServerTime = msgs.length > 0 ? new Date(msgs[0].created_at).getTime() : Infinity;
        const olderHistory = prev.filter(
          (m) => !serverIds.has(m.id) && !m.id.startsWith("temp-") && new Date(m.created_at).getTime() < firstServerTime
        );

        const combined = [...olderHistory, ...msgs];

        if (pending.length === 0) {
          setCachedMessagesMobile(conversationId, combined, res.hasMore, res.nextCursor, user?.id);
          return combined;
        }

        // Retain any pending/sending/failed messages that haven't been reconciled into msgs yet
        const result = [...combined];
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
        setCachedMessagesMobile(conversationId, combined, res.hasMore, res.nextCursor, user?.id);
        return result;
      });

      hasLoadedOnceRef.current = true;

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

  const loadOlderMessages = useCallback(async () => {
    if (!hasMore || !nextCursor || isLoadingOlder || !accessToken || !conversationId) return;
    setIsLoadingOlder(true);
    try {
      const res = await listMessages(conversationId, accessToken, {
        limit: 30,
        before: nextCursor,
      });
      setHasMore(res.hasMore);
      setNextCursor(res.nextCursor);
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const olderFiltered = res.messages.filter((m) => !existingIds.has(m.id));
        return [...olderFiltered, ...prev];
      });
    } catch (err) {
      console.warn("Failed to load older messages", err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [hasMore, nextCursor, isLoadingOlder, accessToken, conversationId]);

  const loadConversation = useCallback(async () => {
    if (!conversationId || !accessToken || !user) return;
    try {
      const conv = await getConversationById(conversationId, accessToken);
      const streak = conv.dayStreak ?? conv.matchInfo?.dayStreak ?? 0;
      const activeToday = Boolean(conv.streakActiveToday ?? conv.matchInfo?.streakActiveToday ?? false);
      const deadline = conv.streakRestoreDeadline ?? conv.matchInfo?.streakRestoreDeadline ?? null;
      setConvStreak(streak);
      setConvStreakActiveToday(activeToday);
      setStreakRestoreDeadline(deadline);

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
      const rawMsg = payload.message as any;
      const incomingMsg: Message = {
        ...rawMsg,
        image_url: rawMsg.image_url || rawMsg.imageUrl || null,
        status: "sent",
      };
      (incomingMsg as any).imageUrl = rawMsg.imageUrl || rawMsg.image_url || null;
      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingMsg.id)) return prev;

        let nextList: Message[];
        // Reconcile optimistic temp message if already present
        const pendingIndex = prev.findIndex(
          (m) =>
            m.id.startsWith("temp-") &&
            m.sender_id === incomingMsg.sender_id &&
            m.content === incomingMsg.content
        );
        if (pendingIndex !== -1) {
          nextList = [...prev];
          nextList[pendingIndex] = incomingMsg;
        } else {
          nextList = [...prev, incomingMsg];
        }
        setCachedMessagesMobile(conversationId, nextList, hasMore, nextCursor, user?.id);
        return nextList;
      });
      markConversationRead(conversationId, new Date().toISOString(), accessToken).catch(() => { });
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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
        // 'inactive' status → streak lapsed. 'restored' → streak brought back.
        // Do NOT treat dayStreak===0 alone as inactive (could be a valid day-1 restore).
        const isInactive = payload.status === "inactive";
        const isRestored = payload.status === "restored";
        const streak = isInactive ? 0 : (payload.dayStreak ?? payload.streak ?? convStreak);
        const activeToday = isInactive ? false : (payload.streakActiveToday ?? convStreakActiveToday);
        setConvStreak(streak);
        setConvStreakActiveToday(activeToday);
        // When restored, clear the deadline window immediately
        if (isRestored) setStreakRestoreDeadline(null);
        setMatchInfo((prev: any) => ({
          ...prev,
          dayStreak: streak,
          streakActiveToday: activeToday,
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
  }, [conversationId, accessToken, loadMessages, matchInfo?.id, convStreak]);

  // Midnight streak expiry is handled server-side (streakReminder.service.ts).
  // The backend emits 'conversation:streak_updated' with status:'inactive' and
  // dayStreak:0 at 12:00 AM PHT, which the onStreakUpdate handler above picks up.
  // A client-side watcher is not needed and can cause stale-closure race conditions.

  // ── Restore streak ────────────────────────────────────────────────────
  const handleRestoreStreak = useCallback(async () => {
    if (!conversationId || !accessToken) return;
    try {
      const result = await restoreConversationStreak(conversationId, accessToken);
      // Optimistically update local state — socket will confirm shortly
      setConvStreak(result.newStreak);
      setConvStreakActiveToday(true);
      setStreakRestoreDeadline(null); // window consumed
      setMatchInfo((prev: any) => prev ? { ...prev, dayStreak: result.newStreak, streakActiveToday: true } : prev);
      Alert.alert(
        "Successfully restored",
        `Your streak is back! You have ${result.restoresRemaining} restore${result.restoresRemaining !== 1 ? "s" : ""} remaining.`
      );
    } catch (err: any) {
      Alert.alert("Couldn't Restore", err?.message ?? "You may be out of restore tokens.");
    }
  }, [conversationId, accessToken]);

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
      (optimisticMsg as any).imageUrl = imageUrl || null;

      // 1. Immediately display message on screen (0ms delay)
      setMessages((prev) => [...prev, optimisticMsg]);

      // 2. Immediately scroll to bottom (offset 0 in inverted list)
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
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
          let updated: Message[];
          if (prev.some((m) => m.id === savedMsg.id)) {
            updated = prev.filter((m) => m.id !== tempId);
          } else {
            updated = prev.map((m) => (m.id === tempId ? { ...savedMsg, status: "sent" } : m));
          }
          setCachedMessagesMobile(conversationId, updated, hasMore, nextCursor, user?.id);
          return updated;
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

  // ── Pick media & take photo handlers (up to 6 images) ────────────────
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
        allowsMultipleSelection: true,
        selectionLimit: 6,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;

      const assets = result.assets.slice(0, 6);
      const uploadPromises = assets.map(async (asset) => {
        const filename = asset.fileName || asset.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
        const mime = asset.mimeType || (/\.png$/i.test(filename) ? "image/png" : "image/jpeg");
        const uploadRes = await uploadChatFile(
          { uri: asset.uri, name: filename, type: mime },
          accessToken
        );
        return uploadRes?.url;
      });

      const uploadedUrls = (await Promise.all(uploadPromises)).filter((url): url is string => Boolean(url));
      if (uploadedUrls.length > 0) {
        const payloadImageUrl = uploadedUrls.length === 1 ? uploadedUrls[0] : JSON.stringify(uploadedUrls);
        await handleSend("", payloadImageUrl);
      }
    } catch (err: any) {
      console.warn("Failed to pick and send image", err);
      Alert.alert("Upload Failed", err?.message || "Could not upload image. Please try again.");
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
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      const asset = result.assets[0];
      const filename = asset.fileName || asset.uri.split("/").pop() || `camera_${Date.now()}.jpg`;
      const mime = asset.mimeType || (/\.png$/i.test(filename) ? "image/png" : "image/jpeg");

      const uploadRes = await uploadChatFile(
        { uri: asset.uri, name: filename, type: mime },
        accessToken
      );
      if (uploadRes?.url) {
        await handleSend("", uploadRes.url);
      }
    } catch (err: any) {
      console.warn("Failed to take photo and send", err);
      Alert.alert("Camera Failed", err?.message || "Could not upload photo. Please try again.");
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

                {/* Streak badge — no background pill, just flame icon + count text */}
                {(convStreak || matchInfo?.dayStreak || 0) > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Flame size={14} color={isStreakActiveToday ? "#eb5600" : "#9CA3AF"} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: isStreakActiveToday ? "#eb5600" : "#9CA3AF",
                      }}
                    >
                      {(convStreak || matchInfo?.dayStreak || 0)}d
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

                {/* Streak badge — no background pill, just flame icon + count text */}
                {(convStreak || matchInfo?.dayStreak || 0) > 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                    <Flame size={14} color={isStreakActiveToday ? "#eb5600" : "#9CA3AF"} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: isStreakActiveToday ? "#eb5600" : "#9CA3AF",
                      }}
                    >
                      {(convStreak || matchInfo?.dayStreak || 0)}d
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
      <KeyboardHugView style={{ flex: 1 }} keyboardVerticalOffset={Math.max(insets.bottom, 8)}>
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

        {/* ── Streak Ended Notice — removed from here, now rendered inside FlatList ── */}


        {/* ── Messages list ────────────────────────────────────────────────── */}

        <KeyboardGestureArea style={{ flex: 1 }} interpolator="ios">
          <FlatList
            ref={flatListRef}
            data={invertedChatItems}
            style={{ flex: 1 }}
            keyExtractor={(item, index) => (item.type === 'message' ? (item.data.id ? `${item.data.id}-${index}` : `msg-${index}`) : '__streak_notice__')}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={10}
            removeClippedSubviews={Platform.OS === "android"}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            inverted
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              isLoadingOlder ? (
                <View style={{ paddingVertical: 14, alignItems: "center", justifyContent: "center", transform: [{ scaleY: -1 }] }}>
                  <ActivityIndicator size="small" color="#1A6B3C" />
                </View>
              ) : null
            }
            contentContainerStyle={{
              paddingVertical: 12,
            }}
            extraData={invertedChatItems}
            renderItem={({ item, index }) => {
              if (item.type === 'streak_notice') {
                return (
                  <View
                    style={{
                      paddingVertical: 16,
                      paddingHorizontal: 24,
                      alignItems: "center",
                      transform: [{ scaleY: -1 }],
                    }}
                  >
                    {canRestoreStreak ? (
                      <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20 }}>
                        Your daily streak has ended.{" "}
                        <Text
                          onPress={handleRestoreStreak}
                          style={{ color: "#1A6B3C", fontWeight: "700", textDecorationLine: "underline" }}
                        >
                          Restore Streak
                        </Text>
                        {restoreHoursRemaining > 0 && (
                          <Text style={{ color: "#C4B8A8" }}>{` (${restoreHoursRemaining}h left)`}</Text>
                        )}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 13, color: "#9CA3AF", textAlign: "center", lineHeight: 20 }}>
                        Your streak has ended. Keep chatting to start a new one! 🔥
                      </Text>
                    )}
                  </View>
                );
              }

              // Inverted list: index 0 is the newest message
              // index - 1 is newer chronologically
              // index + 1 is older chronologically
              const olderItem = index < invertedChatItems.length - 1 ? invertedChatItems[index + 1] : null;
              const newerItem = index > 0 ? invertedChatItems[index - 1] : null;
              const older = olderItem?.type === 'message' ? olderItem.data : null;
              const newer = newerItem?.type === 'message' ? newerItem.data : null;
              const hasOlder = canGroupMessages(item.data, older);
              const hasNewer = canGroupMessages(item.data, newer);

              let groupPosition: MessageGroupPosition = "single";
              if (!hasOlder && hasNewer) {
                groupPosition = "first";
              } else if (hasOlder && hasNewer) {
                groupPosition = "middle";
              } else if (hasOlder && !hasNewer) {
                groupPosition = "last";
              }

              const isMine = item.data.sender_id === user?.id;
              const partnerDisplayName = isAnonymous
                ? (matchInfo?.partnerAlias || prefillName || "Anonymous Ally")
                : (otherProfile?.username || otherProfile?.full_name || prefillName || "User");
              const senderName = isMine ? "Me" : partnerDisplayName;

              return (
                <SwipeableChatBubble
                  message={item.data}
                  isMine={isMine}
                  groupPosition={groupPosition}
                  senderName={senderName}
                  onLongPress={handleLongPress}
                  onReply={(msg) => setReplyTo(msg)}
                  onRetry={handleRetry}
                  isActiveTime={activeTimeMessageId === item.data.id}
                  onToggleTime={handleToggleTime}
                />
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", padding: 32, transform: [{ scaleY: -1 }] }}>
                <Text style={{ fontSize: 14, color: "#9CA3AF", textAlign: "center" }}>
                  Say hello! 👋{"\n"}Start the conversation.
                </Text>
              </View>
            }
          />
        </KeyboardGestureArea>

        {/* ── Input ────────────────────────────────────────────────────────── */}
        <View
          style={{
            paddingBottom: Math.max(insets.bottom, 8),
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
      </KeyboardHugView>

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
            {REACTION_EMOJIS.map((emoji) => {
              const fluentUrl = getFluentEmojiUrl(emoji, { animated: true });
              return (
                <Pressable
                  key={emoji}
                  onPress={() => handleReaction(emoji)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  android_ripple={{ color: "rgba(0,0,0,0.06)" }}
                >
                  {fluentUrl ? (
                    <Image
                      source={{ uri: fluentUrl }}
                      style={{ width: 32, height: 32 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  )}
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                setShowReactions(false);
                setShowFullEmojiPicker(true);
              }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#F9FAFB",
              }}
              android_ripple={{ color: "rgba(0,0,0,0.06)" }}
            >
              <Plus size={20} color="#6B7280" />
            </Pressable>
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

      {/* ── Full Microsoft Fluent Emoji Picker Modal ──────────────────────── */}
      <FluentEmojiPickerModal
        visible={showFullEmojiPicker}
        onClose={() => {
          setShowFullEmojiPicker(false);
          setSelectedMessage(null);
        }}
        onSelect={(emoji) => {
          handleReaction(emoji);
          setShowFullEmojiPicker(false);
        }}
      />

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
