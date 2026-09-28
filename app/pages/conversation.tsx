import React, { Component, useCallback, useEffect, useState, useRef, useMemo } from "react";
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
  Dimensions,
  useWindowDimensions,
  StyleSheet,
  Animated,
  Share,
  StatusBar,
  TouchableOpacity,
  UIManager,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { requireOptionalNativeModule } from "expo-modules-core";
import { getFluentEmojiUrl } from "@/lib/fluentEmoji";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getMemoryChat,
  getCachedChat,
  setCachedChat,
} from "@/lib/chatCache";
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
  ChevronRight,
  LogOut,
  Plus,
  Reply,
  Copy,
  Share2,
  Send,
  Trash2,
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
  deleteMessage as apiDeleteMessage,
  hideConversation as apiHideConversation,
} from "@/lib/api/conversation";
import * as Notifications from "expo-notifications";
import {
  setAppBadgeCount,
  dismissPresentedNotificationByConversationId,
  setActiveConversationId,
} from "@/lib/pushNotifications";
import { getProfilesBatch } from "@/lib/api/profiles";
import { usePresence } from "@/context/PresenceContext";
import { blockUser, reportUser } from "@/lib/api/moderation";
import { endMatch as apiEndMatch } from "@/lib/api/matchmaking";
import { stageName } from "@/constants/matchOptions";
import { getSocket } from "@/lib/socket";
import * as ImagePicker from "expo-image-picker";
import { uploadChatFile, type LocalFile } from "@/lib/api/media";
import { SwipeableChatBubble } from "@/components/SwipeableChatBubble";
import { ChatBubble, isOnlyEmoji, type BubbleLayout } from "@/components/ChatBubble";
import { ChatInput } from "@/components/ChatInput";
import { MessageImageViewer } from "@/components/MessageImageViewer";
import { UserAvatar, resolveImageUri } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { ChatStreakBadge } from "@/components/ChatStreakBadge";
import { FluentEmojiPickerModal } from "@/components/FluentEmojiPickerModal";
import { OfflineAnimatedEmoji } from "@/components/OfflineAnimatedEmoji";
// MatchRevealSheet replaced by standalone roadmap page
import { RoadmapProgressionBadge } from "@/components/RoadmapProgressionBadge";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { KeyboardGestureArea } from "react-native-keyboard-controller";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ReportModal } from "@/components/ReportModal";
import { BlurView } from "expo-blur";
import type { Message, Conversation, MessageGroupPosition } from "@/types/conversation";
import type { Profile } from "@/types/profile";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"];

const isNativeBlurAvailable =
  Platform.OS !== "web" &&
  (Platform.OS === "ios" ||
    Boolean(
      UIManager.getViewManagerConfig?.("ExpoBlurView") ||
      (UIManager as any)?.hasViewManagerConfig?.("ExpoBlurView") ||
      (UIManager as any)?.ExpoBlurView
    ));

function AnimatedReactionEmoji({
  emoji,
  index,
  onPress,
}: {
  emoji: string;
  index: number;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 180,
      friction: 10,
      delay: index * 35,
      useNativeDriver: true,
    }).start();
  }, [index, scaleAnim]);

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1.35,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
          <OfflineAnimatedEmoji
            emoji={emoji}
            size={32}
            preferLottie={true}
            fallbackText={emoji}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}



async function safeCopyToClipboard(text: string): Promise<void> {
  // 1. Web browser: modern navigator.clipboard
  if (Platform.OS === "web") {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch { }
  }

  // 2. Mobile: safely check if ExpoClipboard is compiled into the native binary
  try {
    const ExpoClipboard = requireOptionalNativeModule<{ setStringAsync?: (text: string) => Promise<boolean> }>("ExpoClipboard");
    if (ExpoClipboard && typeof ExpoClipboard.setStringAsync === "function") {
      await ExpoClipboard.setStringAsync(text);
      return;
    }
  } catch {
    // Native module not linked in current dev binary
  }

  // 3. Graceful fallback: open native Share dialog so user can still copy or share text
  try {
    await Share.share({ message: text });
  } catch { }
}

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
// No hard poll — socket delivers messages in real-time.
// onConnect handler below reconciles anything missed on reconnect.

function sortMessagesChronologically(list: Message[]): Message[] {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.created_at || (a as any).timestamp || 0).getTime();
    const timeB = new Date(b.created_at || (b as any).timestamp || 0).getTime();
    if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
      return timeA - timeB;
    }
    return (a.id || "").localeCompare(b.id || "");
  });
}

function reconcileMessageList(
  currentList: Message[],
  incomingMsg: Message,
  clientMsgId?: string | null
): Message[] {
  const targetClientId = clientMsgId || incomingMsg.clientMessageId || null;
  const existingIdIndex = currentList.findIndex((m) => m.id === incomingMsg.id);
  const optimisticIndex = targetClientId
    ? currentList.findIndex(
        (m) =>
          m.clientMessageId === targetClientId ||
          m.id === targetClientId ||
          (m.id.startsWith("cmsg-") && m.id === targetClientId) ||
          (m.id.startsWith("temp-") && m.id === targetClientId)
      )
    : -1;

  let nextList = [...currentList];

  if (existingIdIndex !== -1 && optimisticIndex !== -1 && existingIdIndex !== optimisticIndex) {
    // Drop optimistic placeholder since real server message already exists
    nextList = nextList.filter((_, idx) => idx !== optimisticIndex);
    const updatedIdx = nextList.findIndex((m) => m.id === incomingMsg.id);
    if (updatedIdx !== -1) {
      nextList[updatedIdx] = {
        ...nextList[updatedIdx],
        ...incomingMsg,
        clientMessageId: targetClientId || nextList[updatedIdx].clientMessageId,
        status: incomingMsg.status || "sent",
      };
    }
  } else if (optimisticIndex !== -1) {
    // Reconcile optimistic message in-place
    nextList[optimisticIndex] = {
      ...nextList[optimisticIndex],
      ...incomingMsg,
      clientMessageId: targetClientId || nextList[optimisticIndex].clientMessageId,
      status: incomingMsg.status || "sent",
    };
  } else if (existingIdIndex !== -1) {
    // In-place update of existing server message
    nextList[existingIdIndex] = {
      ...nextList[existingIdIndex],
      ...incomingMsg,
      clientMessageId: targetClientId || nextList[existingIdIndex].clientMessageId,
      status: incomingMsg.status || nextList[existingIdIndex].status || "sent",
    };
  } else {
    // New message (partner sent or newly arrived)
    nextList.push(incomingMsg);
  }

  return sortMessagesChronologically(nextList);
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
  const { width: windowWidth } = useWindowDimensions();
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

  const initialCached = useMemo(
    () => (conversationId ? getMemoryChat(conversationId, user?.id) : null),
    [conversationId, user?.id]
  );
  const [messages, setMessages] = useState<Message[]>(() => initialCached?.messages || []);
  const [hasMore, setHasMore] = useState(() => initialCached?.hasMore ?? false);
  const [nextCursor, setNextCursor] = useState<string | null>(() => initialCached?.nextCursor ?? null);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  // If prefill data is passed OR cached messages exist in memory, skip loading screen entirely (0ms display)
  const [loading, setLoading] = useState(() => !prefillName && (initialCached?.messages?.length || 0) === 0);
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
  // showRevealSheet removed — replaced by router navigation to pages/roadmap
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);
  const [draftText, setDraftText] = useState("");

  // Context menu
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<BubbleLayout | null>(null);
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
  const [showReportModal, setShowReportModal] = useState(false);
  const [showDeleteConvConfirm, setShowDeleteConvConfirm] = useState(false);
  // Web-mirror image viewer state
  const [viewingImageMessage, setViewingImageMessage] = useState<Message | null>(null);
  const [viewingImageIndex, setViewingImageIndex] = useState(0);

  // ── Minute-tick for realtime deadline countdown ──────────────────────
  useEffect(() => {
    if (!deadlineRaw) return;
    const interval = setInterval(() => setNowTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [deadlineRaw]);


  const flatListRef = useRef<FlatList>(null);

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
        .catch(() => { });
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
        AsyncStorage.removeItem(getStreakAnchorKey(conversationId)).catch(() => { });
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
          AsyncStorage.setItem(getStreakAnchorKey(conversationId), JSON.stringify(newAnchor)).catch(() => { });
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
    getCachedChat(conversationId, user?.id).then((cached) => {
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
          (m) =>
            m.id.startsWith("temp-") ||
            m.id.startsWith("cmsg-") ||
            m.status === "sending" ||
            m.status === "failed"
        );

        // Keep any older messages already loaded into history before msgs
        const serverIds = new Set(msgs.map((m) => m.id));
        const firstServerTime = msgs.length > 0 ? new Date(msgs[0].created_at).getTime() : Infinity;
        const olderHistory = prev.filter(
          (m) =>
            !serverIds.has(m.id) &&
            !m.id.startsWith("temp-") &&
            !m.id.startsWith("cmsg-") &&
            new Date(m.created_at).getTime() < firstServerTime
        );

        const combined = [...olderHistory, ...msgs].map((m) => {
          const prevMsg = prev.find((p) => p.id === m.id);
          if (prevMsg?.is_deleted) {
            return { ...m, is_deleted: true, content: "", image_url: null, reactions: [] };
          }
          return m;
        });

        if (pending.length === 0) {
          const sorted = sortMessagesChronologically(combined);
          setCachedChat(conversationId, sorted, res.hasMore, res.nextCursor, user?.id);
          return sorted;
        }

        // Retain any pending/sending/failed messages that haven't been reconciled into msgs yet
        const result = [...combined];
        for (const p of pending) {
          const alreadyInList = result.some(
            (m) =>
              m.id === p.id ||
              (p.clientMessageId && m.clientMessageId === p.clientMessageId) ||
              (m.content === p.content &&
                m.sender_id === p.sender_id &&
                Math.abs(new Date(m.created_at).getTime() - new Date(p.created_at).getTime()) < 15000)
          );
          if (!alreadyInList) {
            result.push(p);
          }
        }
        const sorted = sortMessagesChronologically(result);
        setCachedChat(conversationId, sorted, res.hasMore, res.nextCursor, user?.id);
        return sorted;
      });

      hasLoadedOnceRef.current = true;

      // Mark as read
      if (msgs.length > 0) {
        markConversationRead(
          conversationId,
          new Date().toISOString(),
          accessToken
        ).catch(() => { });

        dismissPresentedNotificationByConversationId(conversationId).catch(() => null);

        if (Notifications && typeof Notifications.getBadgeCountAsync === "function") {
          Notifications.getBadgeCountAsync().then((count) => {
            setAppBadgeCount(Math.max(0, count - 1));
          }).catch(() => null);
        }
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
      // If prefill was supplied or cached messages exist, messages load in background while
      // header already shows the correct name/avatar — no blocking loading screen.
      if (!prefillName && messages.length === 0) setLoading(true);
      await Promise.all([loadMessages(true), loadConversation()]);
      setLoading(false);
    }
    init();
    // No hard poll — socket onConnect below handles reconnect catch-up.
  }, [loadMessages, loadConversation, prefillName, messages.length]);

  // Real-time delivery via Socket.io (same events as the web client).
  useEffect(() => {
    if (!conversationId || !accessToken) return;

    const socket = getSocket(accessToken);
    if (!socket) return;

    const onMessageNew = (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId !== conversationId) return;
      const rawMsg = payload.message as any;
      const isMine = rawMsg.sender_id === user?.id || rawMsg.senderId === user?.id;
      const incomingMsg: Message = {
        ...rawMsg,
        image_url: rawMsg.image_url || rawMsg.imageUrl || null,
        clientMessageId: rawMsg.clientMessageId || rawMsg.client_message_id || null,
        status: isMine ? (rawMsg.status || "sent") : "delivered",
      };
      (incomingMsg as any).imageUrl = rawMsg.imageUrl || rawMsg.image_url || null;

      setMessages((prev) => {
        const nextList = reconcileMessageList(prev, incomingMsg, incomingMsg.clientMessageId);
        setCachedChat(conversationId, nextList, hasMore, nextCursor, user?.id);
        return nextList;
      });

      if (!isMine) {
        markConversationRead(conversationId, new Date().toISOString(), accessToken).catch(() => { });
        dismissPresentedNotificationByConversationId(conversationId).catch(() => null);
      }

      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 50);
    };

    const onConversationRead = (payload: { conversationId: string; userId: string; readAt: string }) => {
      if (payload?.conversationId !== conversationId) return;
      if (payload.userId === user?.id) return; // Only process read receipts from other members
      setMessages((prev) => {
        let changed = false;
        const updated = prev.map((m) => {
          if (m.sender_id === user?.id && m.status !== "read" && m.status !== "failed") {
            changed = true;
            return { ...m, status: "read" as const };
          }
          return m;
        });
        if (changed && conversationId) {
          setCachedChat(conversationId, updated, hasMore, nextCursor, user?.id);
        }
        return changed ? updated : prev;
      });
    };

    const onConnect = () => void loadMessages(true);

    const onStageUpdated = (payload: any) => {
      if (
        payload?.matchId === matchInfo?.id ||
        payload?.matchId === matchInfo?.matchId ||
        payload?.conversationId === conversationId
      ) {
        setMatchInfo((prev: any) => ({
          ...prev,
          stage: payload.stage ?? prev?.stage,
          stagePoints: payload.stagePoints ?? 0,
          dayStreak: payload.dayStreak ?? prev?.dayStreak,
          streakActiveToday: true,
        }));
      }
    };

    const onPointsUpdated = (payload: any) => {
      if (
        payload?.matchId === matchInfo?.id ||
        payload?.matchId === matchInfo?.matchId
      ) {
        setMatchInfo((prev: any) => ({
          ...prev,
          stagePoints: payload.stagePoints ?? prev?.stagePoints,
          matchPoints: payload.matchPoints ?? prev?.matchPoints,
          stage: payload.stage ?? prev?.stage,
        }));
      }
    };

    const onStreakUpdate = (payload: any) => {
      if (payload?.matchId === matchInfo?.id || payload?.conversationId === conversationId) {
        // 'inactive' status → streak lapsed. 'restored' → streak brought back.
        // Do NOT treat dayStreak===0 alone as inactive (could be a valid day-1 restore).
        const isInactive =
          payload.status === "inactive" ||
          payload.streakStatus === "inactive" ||
          payload.streakStatus === "expired";
        const isRestored = payload.status === "restored";
        const streak = isInactive ? 0 : (payload.currentStreak ?? payload.dayStreak ?? convStreak);
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

    const onMessageDeleted = (payload: any) => {
      if (payload?.conversationId === conversationId && payload?.messageId) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === payload.messageId
              ? { ...m, is_deleted: true, content: "", image_url: null, reactions: [] }
              : m
          );
          if (conversationId) {
            setCachedChat(conversationId, updated, hasMore, nextCursor, user?.id);
          }
          return updated;
        });
      }
    };

    socket.on("conversation:message_new", onMessageNew);
    socket.on("conversation:read", onConversationRead);
    socket.on("conversation:message_deleted", onMessageDeleted);
    socket.on("conversation:streak_updated", onStreakUpdate);
    socket.on("matchmaking:stage_updated", onStageUpdated);
    socket.on("match:points_updated", onPointsUpdated);
    socket.on("matchmaking:match_ended", onMatchEnded);
    socket.on("matchmaking:chat_expired", onMatchEnded);
    socket.on("connect", onConnect);

    if (socket.connected) {
      void loadMessages(true);
    }
    setActiveConversationId(conversationId);
    dismissPresentedNotificationByConversationId(conversationId).catch(() => null);

    return () => {
      setActiveConversationId(null);
      socket.off("conversation:message_new", onMessageNew);
      socket.off("conversation:read", onConversationRead);
      socket.off("conversation:message_deleted", onMessageDeleted);
      socket.off("conversation:streak_updated", onStreakUpdate);
      socket.off("matchmaking:stage_updated", onStageUpdated);
      socket.off("match:points_updated", onPointsUpdated);
      socket.off("matchmaking:match_ended", onMatchEnded);
      socket.off("matchmaking:chat_expired", onMatchEnded);
      socket.off("connect", onConnect);
    };
    // NOTE: convStreak intentionally excluded from deps — it changes on every
    // streak tick, which would cause the socket to re-attach constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, accessToken, loadMessages, matchInfo?.id, user?.id]);

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

  // ── Send message (Optimistic UI — 0ms instant display with clientMessageId reconciliation) ───
  const handleSend = useCallback(
    async (content: string, media?: LocalFile[] | string | null) => {
      if (!conversationId || !accessToken || !user) return;

      const clientMessageId = `cmsg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const activeReply = replyTo;
      setReplyTo(null);

      // Derive optimistic image URL (single local URI or stringified JSON array of local URIs)
      let optimisticImageUrl: string | null = null;
      if (Array.isArray(media) && media.length > 0) {
        optimisticImageUrl = media.length === 1 ? media[0].uri : JSON.stringify(media.map((f) => f.uri));
      } else if (typeof media === "string" && media) {
        optimisticImageUrl = media;
      }

      const optimisticMsg: Message = {
        id: clientMessageId,
        clientMessageId,
        conversation_id: conversationId,
        sender_id: user.id,
        content,
        image_url: optimisticImageUrl,
        created_at: new Date().toISOString(),
        reply_to_message_id: activeReply?.id || null,
        replied_message: activeReply || null,
        reactions: [],
        status: "sending",
      };
      (optimisticMsg as any).imageUrl = optimisticImageUrl;

      // 1. Immediately display message on screen (0ms delay)
      setMessages((prev) => {
        const nextList = sortMessagesChronologically([...prev, optimisticMsg]);
        setCachedChat(conversationId, nextList, hasMore, nextCursor, user?.id);
        return nextList;
      });

      // 2. Immediately scroll to bottom (offset 0 in inverted list)
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      });

      // 3. Process upload if LocalFile[] provided, then send to server in background
      try {
        let finalImageUrl: string | null = null;
        if (Array.isArray(media) && media.length > 0) {
          const uploadPromises = media.map((file) => uploadChatFile(file, accessToken));
          const uploadRes = await Promise.all(uploadPromises);
          const urls = uploadRes.map((r) => r?.url).filter((u): u is string => Boolean(u));
          finalImageUrl = urls.length === 1 ? urls[0] : JSON.stringify(urls);
        } else if (typeof media === "string" && media) {
          finalImageUrl = media;
        }

        const savedMsg = await sendMessage(
          conversationId,
          {
            content,
            imageUrl: finalImageUrl,
            replyToMessageId: activeReply?.id || null,
            clientMessageId,
          },
          accessToken
        );

        // Reconcile optimistic message with confirmed server message in-place
        const confirmedMsg: Message = {
          ...savedMsg,
          clientMessageId,
          status: "sent",
        };

        setMessages((prev) => {
          const updated = reconcileMessageList(prev, confirmedMsg, clientMessageId);
          setCachedChat(conversationId, updated, hasMore, nextCursor, user?.id);
          return updated;
        });
      } catch (err) {
        console.warn("Failed to send message", err);
        // Retain message and mark as failed so user can tap to retry
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.clientMessageId === clientMessageId || m.id === clientMessageId
              ? { ...m, status: "failed" as const }
              : m
          );
          setCachedChat(conversationId, updated, hasMore, nextCursor, user?.id);
          return updated;
        });
      }
    },
    [conversationId, accessToken, user, replyTo, hasMore, nextCursor]
  );

  // ── Pick media & take photo handlers (up to 6 images) ────────────────
  const handlePickMedia = useCallback(async () => {
    if (!conversationId || !accessToken) return;
    if (isAnonymous && (matchInfo?.stage ?? 1) < 3) {
      Alert.alert("Feature Locked", "Photo and media sharing unlocks at Stage 3 of your roadmap.");
      return;
    }
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
  }, [conversationId, accessToken, handleSend, isAnonymous, matchInfo?.stage]);

  const handleTakePhoto = useCallback(async () => {
    if (!conversationId || !accessToken) return;
    if (isAnonymous && (matchInfo?.stage ?? 1) < 3) {
      Alert.alert("Feature Locked", "Photo and media sharing unlocks at Stage 3 of your roadmap.");
      return;
    }
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
  }, [conversationId, accessToken, handleSend, isAnonymous, matchInfo?.stage]);

  // ── Retry failed message (Optimistic background retry with clientMessageId) ───
  const handleRetry = useCallback(
    async (failedMsg: Message) => {
      if (!conversationId || !accessToken || !user) return;
      const targetClientId = failedMsg.clientMessageId || failedMsg.id;

      // 1. Immediately transition status back to "sending" (0ms UI update)
      setMessages((prev) =>
        prev.map((m) =>
          (m.clientMessageId && m.clientMessageId === targetClientId) || m.id === targetClientId
            ? { ...m, status: "sending" as const }
            : m
        )
      );

      try {
        const savedMsg = await sendMessage(
          conversationId,
          {
            content: failedMsg.content,
            imageUrl: failedMsg.image_url,
            replyToMessageId: failedMsg.reply_to_message_id,
            clientMessageId: targetClientId,
          },
          accessToken
        );

        const confirmedMsg: Message = {
          ...savedMsg,
          clientMessageId: targetClientId,
          status: "sent",
        };

        setMessages((prev) => {
          const updated = reconcileMessageList(prev, confirmedMsg, targetClientId);
          setCachedChat(conversationId, updated, hasMore, nextCursor, user?.id);
          return updated;
        });
      } catch (err) {
        console.warn("Failed to retry message", err);
        setMessages((prev) => {
          const updated = prev.map((m) =>
            (m.clientMessageId && m.clientMessageId === targetClientId) || m.id === targetClientId
              ? { ...m, status: "failed" as const }
              : m
          );
          setCachedChat(conversationId, updated, hasMore, nextCursor, user?.id);
          return updated;
        });
      }
    },
    [conversationId, accessToken, user, hasMore, nextCursor]
  );

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // ── Reactions ─────────────────────────────────────────────────────────
  const handleReaction = useCallback(
    async (emoji: string) => {
      if (!selectedMessage || !conversationId || !accessToken) return;
      setShowReactions(false);
      setSelectedLayout(null);
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
    const targetId = partnerUserId || (otherProfile?.id && otherProfile.id !== "anonymous" ? otherProfile.id : null);
    if (!targetId || !accessToken) return;
    setShowBlockConfirm(false);
    try {
      await blockUser(targetId, accessToken);
      router.back();
    } catch (err) {
      console.warn("Failed to block user", err);
    }
  }, [partnerUserId, otherProfile, accessToken]);

  const handleReportSubmit = useCallback(async (reason: string, details?: string) => {
    const targetId = partnerUserId || (otherProfile?.id && otherProfile.id !== "anonymous" ? otherProfile.id : null);
    if (!targetId || !accessToken) {
      throw new Error("Unable to identify user to report");
    }
    const fullReason = details ? `${reason} - ${details}` : reason;
    await reportUser(targetId, fullReason, accessToken, {
      conversationId: conversationId || undefined,
      notes: details,
    });
  }, [partnerUserId, otherProfile, accessToken, conversationId]);

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
  const handleLongPress = (message: Message, layout?: BubbleLayout) => {
    setSelectedMessage(message);
    setSelectedLayout(layout || null);
    setShowReactions(true);
  };

  // ── Memoized FlatList renderItem ──────────────────────────────────────
  // Extracted so FlatList doesn't recreate the function reference on every render.
  const renderChatItem = useCallback(
    ({ item, index }: { item: ChatItem; index: number }) => {
      if (item.type === 'streak_notice') {
        return (
          <View
            style={{
              paddingVertical: 16,
              paddingHorizontal: 24,
              alignItems: "center",
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

      // In an inverted list, index 0 = newest. index+1 = older, index-1 = newer.
      const olderItem = index < invertedChatItems.length - 1 ? invertedChatItems[index + 1] : null;
      const newerItem = index > 0 ? invertedChatItems[index - 1] : null;
      const older = olderItem?.type === 'message' ? olderItem.data : null;
      const newer = newerItem?.type === 'message' ? newerItem.data : null;
      const hasOlder = canGroupMessages(item.data, older);
      const hasNewer = canGroupMessages(item.data, newer);

      let groupPosition: MessageGroupPosition = "single";
      if (!hasOlder && hasNewer) groupPosition = "first";
      else if (hasOlder && hasNewer) groupPosition = "middle";
      else if (hasOlder && !hasNewer) groupPosition = "last";

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
          onImagePress={(msg, idx) => {
            setViewingImageIndex(idx);
            setViewingImageMessage(msg);
          }}
          isActiveTime={activeTimeMessageId === item.data.id}
          onToggleTime={handleToggleTime}
        />
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      invertedChatItems, canRestoreStreak, restoreHoursRemaining, handleRestoreStreak,
      user?.id, isAnonymous, matchInfo?.partnerAlias, otherProfile, prefillName,
      handleRetry, activeTimeMessageId, handleToggleTime, setReplyTo,
    ]
  );


  if (loading && !prefillName) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#EBF5EE", overflow: "hidden" }}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      {/* ── Conversation Theme Background (Mobile - zoomed responsive, no vertical repeat) ── */}
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
        <Image
          source={require("../../assets/images/chat-theme-bg.png")}
          style={[
            StyleSheet.absoluteFill,
            {
              width: "100%",
              height: "100%",
              transform: [{ scale: windowWidth < 500 ? 1.25 : 1.05 }],
            },
          ]}
          resizeMode="cover"
        />
      </View>

      {/* ── Header (fixed — stays above keyboard) ───────────────────────── */}
      <LinearGradient
        colors={["#FFFFFF", "rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0)"]}
        locations={[0, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          zIndex: 10,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>

        {isAnonymous ? (
          <Pressable
            onPress={() => router.push({ pathname: "/pages/roadmap" as any, params: { matchId: matchInfo?.matchId || matchInfo?.id || conversationId, stage: String(matchInfo?.stage ?? 1), stagePoints: String(matchInfo?.stagePoints ?? 0), dayStreak: String(convStreak || matchInfo?.dayStreak || 0), partnerAlias: matchInfo?.partnerAlias || prefillName || "Anonymous Ally", partnerAvatar: matchInfo?.partnerAvatar || prefillAvatar || "fox" } })}
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

                {/* Streak badge — mirrors web */}
                {(convStreak || matchInfo?.dayStreak || 0) > 0 && (
                  <ChatStreakBadge
                    dayStreak={convStreak || matchInfo?.dayStreak || 0}
                    isStreakActiveToday={isStreakActiveToday}
                    size="md"
                  />
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

                {/* Streak badge — mirrors web */}
                {(convStreak || matchInfo?.dayStreak || 0) > 0 && (
                  <ChatStreakBadge
                    dayStreak={convStreak || matchInfo?.dayStreak || 0}
                    isStreakActiveToday={isStreakActiveToday}
                    size="md"
                  />
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
      </LinearGradient>

      <KeyboardHugView
        style={{ flex: 1 }}
        keyboardVerticalOffset={Math.max(insets.bottom, 8)}
        activeKeyboardGap={6}
      >
        {/* ── Anonymous Roadmap & Level Progression (Top Right Corner) ───────── */}
        {isAnonymous && (
          <RoadmapProgressionBadge
            stage={matchInfo?.stage ?? 1}
            stagePoints={matchInfo?.stagePoints ?? 0}
            dayStreak={convStreak || matchInfo?.dayStreak || 0}
            avatarKey={matchInfo?.partnerAvatar || prefillAvatar || "fox"}
            onPress={() => router.push({ pathname: "/pages/roadmap" as any, params: { matchId: matchInfo?.matchId || matchInfo?.id || conversationId, stage: String(matchInfo?.stage ?? 1), stagePoints: String(matchInfo?.stagePoints ?? 0), dayStreak: String(convStreak || matchInfo?.dayStreak || 0), partnerAlias: matchInfo?.partnerAlias || prefillName || "Anonymous Ally", partnerAvatar: matchInfo?.partnerAvatar || prefillAvatar || "fox" } })}
            style={{ position: "absolute", top: 10, right: 14, zIndex: 30 }}
          />
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
            keyExtractor={(item, index) =>
              item.type === 'message'
                ? (item.data.id ? `${item.data.id}-${index}` : `msg-${index}`)
                : '__streak_notice__'
            }
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
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={renderChatItem}
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
            backgroundColor: "transparent",
            zIndex: 20,
            maxWidth: 720,
            width: "100%",
            alignSelf: "center",
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
              onCancelReply={handleCancelReply}
              draftText={draftText}
              canUploadImages={!isAnonymous || (matchInfo?.stage ?? 1) >= 3}
            />
          )}
        </View>
      </KeyboardHugView>

      {/* ── Anchored Quick React & Options Modal ───────────────────────── */}
      <Modal
        visible={showReactions && !!selectedMessage}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          setShowReactions(false);
          setSelectedMessage(null);
          setSelectedLayout(null);
        }}
      >
        {/* Full-screen backdrop with intensity 80 blur */}
        {Platform.OS === "web" ? (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(0, 0, 0, 0.65)",
                backdropFilter: "blur(80px)",
                WebkitBackdropFilter: "blur(80px)",
              } as any,
            ]}
          />
        ) : isNativeBlurAvailable ? (
          <BlurView
            intensity={80}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(10, 15, 29, 0.82)" },
            ]}
          />
        )}

        {/* Tap backdrop to dismiss */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setShowReactions(false);
            setSelectedMessage(null);
            setSelectedLayout(null);
          }}
        />

        {selectedMessage && (() => {
          const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
          const isSelectedMine = selectedMessage.sender_id === user?.id;

          const rawImages = selectedMessage.image_url || (selectedMessage as any).imageUrl;
          let parsedImages: string[] = [];
          if (Array.isArray(rawImages)) {
            parsedImages = rawImages.map(resolveImageUri).filter((u): u is string => Boolean(u));
          } else if (typeof rawImages === "string") {
            const trimmed = rawImages.trim();
            if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
              try {
                const arr = JSON.parse(trimmed);
                if (Array.isArray(arr)) {
                  parsedImages = arr.map(resolveImageUri).filter((u): u is string => Boolean(u));
                }
              } catch { }
            }
            if (parsedImages.length === 0) {
              const uri = resolveImageUri(trimmed);
              if (uri) parsedImages = [uri];
            }
          }

          const isSelectedEmojiOnly = parsedImages.length === 0 && isOnlyEmoji(selectedMessage.content);

          const isValidNum = (n: any): n is number => typeof n === "number" && Number.isFinite(n);

          const bubbleWidth = isValidNum(selectedLayout?.width) && selectedLayout.width > 0
            ? selectedLayout.width
            : Math.min(260, SCREEN_WIDTH * 0.75);
          const bubbleHeight = isValidNum(selectedLayout?.height) && selectedLayout.height > 0
            ? selectedLayout.height
            : (isSelectedEmojiOnly ? 50 : 60);
          const rawX = isValidNum(selectedLayout?.x)
            ? selectedLayout.x
            : (isSelectedMine ? SCREEN_WIDTH - bubbleWidth - 16 : 16);
          const rawY = isValidNum(selectedLayout?.y)
            ? selectedLayout.y
            : (SCREEN_HEIGHT - bubbleHeight) / 2;

          const REACTIONS_HEIGHT = 56;
          const optionCount = 2 + (Boolean(selectedMessage.content) ? 1 : 0) + 1 + (isSelectedMine ? 1 : 0) + (!isSelectedMine ? 1 : 0);
          const OPTIONS_HEIGHT = optionCount * 44 + 14;
          const GAP = 12;
          const PADDING = 16;

          // Fixed position in one place for all messages (centered vertically)
          const availableBubbleHeight = Math.max(
            50,
            SCREEN_HEIGHT - insets.top - insets.bottom - REACTIONS_HEIGHT - OPTIONS_HEIGHT - GAP * 3 - 32
          );
          const effectiveBubbleHeight = Math.min(bubbleHeight, availableBubbleHeight);
          const totalPopupHeight = REACTIONS_HEIGHT + GAP + effectiveBubbleHeight + GAP + OPTIONS_HEIGHT;
          const fixedTopY = Math.max(
            insets.top + 16,
            Math.round((SCREEN_HEIGHT - totalPopupHeight) / 2) - 10
          );

          const reactionsTop = fixedTopY;
          const messageTop = fixedTopY + REACTIONS_HEIGHT + GAP;
          const optionsTop = messageTop + effectiveBubbleHeight + GAP;

          // Horizontal alignment: right-aligned if sent by me, left-aligned if received
          const clampedMessageX = isSelectedMine
            ? SCREEN_WIDTH - bubbleWidth - PADDING
            : PADDING;

          const reactionsWidth = Math.min(REACTION_EMOJIS.length * 44 + 56, SCREEN_WIDTH - 24);
          const reactionsLeft = isSelectedMine
            ? SCREEN_WIDTH - reactionsWidth - PADDING
            : PADDING;

          const optionsWidth = 210;
          const optionsLeft = isSelectedMine
            ? SCREEN_WIDTH - optionsWidth - PADDING
            : PADDING;

          return (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {/* 1. Quick Reactions Bar on TOP of message */}
              <View
                style={{
                  position: "absolute",
                  left: reactionsLeft,
                  top: reactionsTop,
                  width: reactionsWidth,
                  height: REACTIONS_HEIGHT,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 10,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.22,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                {REACTION_EMOJIS.map((emoji, index) => (
                  <AnimatedReactionEmoji
                    key={emoji}
                    emoji={emoji}
                    index={index}
                    onPress={() => handleReaction(emoji)}
                  />
                ))}
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => {
                    setShowReactions(false);
                    setShowFullEmojiPicker(true);
                  }}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#F3F4F6",
                  }}
                  hitSlop={6}
                >
                  <Plus size={18} color="#4B5563" />
                </TouchableOpacity>
              </View>

              {/* 2. Anchored Message Bubble (Lifted) */}
              <View
                style={{
                  position: "absolute",
                  left: clampedMessageX,
                  top: messageTop,
                  width: bubbleWidth,
                  minHeight: bubbleHeight,
                  backgroundColor: isSelectedEmojiOnly
                    ? "transparent"
                    : isSelectedMine
                      ? "#1A6B3C"
                      : "#F3F4F6",
                  borderRadius: isSelectedEmojiOnly ? 0 : 18,
                  paddingHorizontal: isSelectedEmojiOnly ? 0 : 14,
                  paddingVertical: isSelectedEmojiOnly ? 0 : 10,
                  justifyContent: "center",
                  shadowColor: isSelectedEmojiOnly ? "transparent" : "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isSelectedEmojiOnly ? 0 : 0.2,
                  shadowRadius: 10,
                  elevation: isSelectedEmojiOnly ? 0 : 6,
                }}
              >
                {parsedImages.length > 0 && (
                  <Image
                    source={{ uri: parsedImages[0] }}
                    style={{
                      width: "100%",
                      height: Math.min(bubbleHeight, 220),
                      borderRadius: 14,
                      marginBottom: selectedMessage.content ? 8 : 0,
                    }}
                    resizeMode="cover"
                  />
                )}
                {Boolean(selectedMessage.content) && (
                  <Text
                    style={
                      isSelectedEmojiOnly
                        ? {
                          fontSize: 38,
                          lineHeight: 46,
                          textAlign: isSelectedMine ? "right" : "left",
                        }
                        : {
                          fontSize: 15,
                          lineHeight: 20,
                          color: isSelectedMine ? "#FFFFFF" : "#111827",
                        }
                    }
                  >
                    {selectedMessage.content}
                  </Text>
                )}
              </View>

              {/* 3. Options Menu on BOTTOM of message */}
              <View
                style={{
                  position: "absolute",
                  left: optionsLeft,
                  top: optionsTop,
                  width: optionsWidth,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 20,
                  paddingVertical: 6,
                  paddingHorizontal: 16,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.14,
                  shadowRadius: 18,
                  elevation: 10,
                }}
              >
                {/* Reply */}
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={() => {
                    setReplyTo(selectedMessage);
                    setShowReactions(false);
                    setSelectedMessage(null);
                    setSelectedLayout(null);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Reply size={20} color="#111827" />
                  <Text style={{ fontSize: 16, color: "#111827", fontWeight: "400" }}>
                    Reply
                  </Text>
                </TouchableOpacity>

                {/* Forward */}
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={async () => {
                    const shareText = selectedMessage.content || parsedImages[0];
                    setShowReactions(false);
                    setSelectedMessage(null);
                    setSelectedLayout(null);
                    if (shareText) {
                      try {
                        await Share.share({ message: shareText });
                      } catch { }
                    }
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Send size={20} color="#111827" />
                  <Text style={{ fontSize: 16, color: "#111827", fontWeight: "400" }}>
                    Forward
                  </Text>
                </TouchableOpacity>

                {/* Copy */}
                {Boolean(selectedMessage.content) && (
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={async () => {
                      if (selectedMessage.content) {
                        await safeCopyToClipboard(selectedMessage.content);
                      }
                      setShowReactions(false);
                      setSelectedMessage(null);
                      setSelectedLayout(null);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Copy size={20} color="#111827" />
                    <Text style={{ fontSize: 16, color: "#111827", fontWeight: "400" }}>
                      Copy
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Delete for me */}
                <TouchableOpacity
                  activeOpacity={0.6}
                  onPress={async () => {
                    const msgId = selectedMessage.id;
                    const convId = selectedMessage.conversation_id || conversationId;
                    setMessages((prev) => prev.filter((m) => m.id !== msgId));
                    setShowReactions(false);
                    setSelectedMessage(null);
                    setSelectedLayout(null);
                    if (accessToken) {
                      apiDeleteMessage(convId, msgId, "delete_for_me", accessToken).catch(() => {});
                    }
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 10,
                  }}
                >
                  <Trash2 size={20} color="#111827" />
                  <Text style={{ fontSize: 16, color: "#111827", fontWeight: "400" }}>
                    Delete for me
                  </Text>
                </TouchableOpacity>

                {/* Delete for everyone (available only for messages created by caller) */}
                {isSelectedMine && (
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={async () => {
                      const msgId = selectedMessage.id;
                      const convId = selectedMessage.conversation_id || conversationId;
                      // Optimistically tombstone in-place — instant UI swap
                      setMessages((prev) => {
                        const updated = prev.map((m) =>
                          m.id === msgId
                            ? { ...m, is_deleted: true, content: "", image_url: null, reactions: [] }
                            : m
                        );
                        if (convId) {
                          setCachedChat(convId, updated, hasMore, nextCursor, user?.id);
                        }
                        return updated;
                      });
                      setShowReactions(false);
                      setSelectedMessage(null);
                      setSelectedLayout(null);
                      if (accessToken && convId) {
                        apiDeleteMessage(convId, msgId, "delete_for_everyone", accessToken).catch(() => {});
                      }
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Trash2 size={20} color="#EF4444" />
                    <Text style={{ fontSize: 16, color: "#EF4444", fontWeight: "400" }}>
                      Delete for everyone
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Report (partner message) */}
                {!isSelectedMine && (
                  <TouchableOpacity
                    activeOpacity={0.6}
                    onPress={() => {
                      setShowReactions(false);
                      setSelectedMessage(null);
                      setSelectedLayout(null);
                      setShowReportModal(true);
                    }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Flag size={20} color="#EF4444" />
                    <Text style={{ fontSize: 16, color: "#EF4444", fontWeight: "400" }}>
                      Report
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}
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
                  router.push({ pathname: "/pages/roadmap" as any, params: { matchId: matchInfo?.matchId || matchInfo?.id || conversationId, stage: String(matchInfo?.stage ?? 1), stagePoints: String(matchInfo?.stagePoints ?? 0), dayStreak: String(convStreak || matchInfo?.dayStreak || 0), partnerAlias: matchInfo?.partnerAlias || prefillName || "Anonymous Ally", partnerAvatar: matchInfo?.partnerAvatar || prefillAvatar || "fox" } });
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
              icon={Trash2}
              label="Delete conversation"
              onPress={() => {
                setShowOverflow(false);
                setShowDeleteConvConfirm(true);
              }}
              destructive
            />
            <OverflowRow
              icon={Flag}
              label={isAnonymous ? "Report match" : "Report user"}
              onPress={() => {
                setShowOverflow(false);
                setShowReportModal(true);
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
        visible={showDeleteConvConfirm}
        title="Delete conversation?"
        description="This will remove the conversation from your chat list. The other person won't be notified."
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          setShowDeleteConvConfirm(false);
          if (accessToken && conversationId) {
            await apiHideConversation(conversationId, accessToken).catch(() => {});
          }
          router.back();
        }}
        onCancel={() => setShowDeleteConvConfirm(false)}
      />

      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmitReport={handleReportSubmit}
        targetType="user"
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

      {/* ── Web-Mirror Chat Message Image Viewer ─────────────────────────── */}
      <MessageImageViewer
        visible={Boolean(viewingImageMessage)}
        message={viewingImageMessage}
        initialIndex={viewingImageIndex}
        onClose={() => setViewingImageMessage(null)}
        onReply={(msg) => {
          setReplyTo(msg);
          setViewingImageMessage(null);
        }}
      />
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
