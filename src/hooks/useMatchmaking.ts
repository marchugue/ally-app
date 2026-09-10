import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { getSocket } from "@/lib/socket";
import {
  getMatchmakingStatus,
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
  acceptMatch as apiAcceptMatch,
  declineMatch as apiDeclineMatch,
  endMatch as apiEndMatch,
  MatchIdentityView,
  MatchRow,
  QueueRow,
  MatchmakingPreferences,
} from "@/lib/api/matchmaking";

export type MatchPhase =
  | "idle"
  | "searching"
  | "pending"
  | "accepted"
  | "chatting"
  | "ended";

export interface UseMatchmakingResult {
  phase: MatchPhase;
  loading: boolean;
  error: string | null;
  dailyMatchCount: number;
  dailyLimit: number;
  pendingMatch: MatchRow | null;
  activeMatch: MatchRow | null;
  activeMatches: MatchRow[];
  identity: MatchIdentityView | null;
  compatibilityScore: number | null;
  acceptCountdown: number;
  waitingForPartner: boolean;
  endedReason: string | null;
  roomReady: {
    matchId: string;
    conversationId: string;
    identity?: MatchIdentityView;
  } | null;
  clearRoomReady: () => void;
  joinQueue: (preferences?: MatchmakingPreferences) => Promise<void>;
  leaveQueue: () => Promise<void>;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  endCurrentMatch: (matchId?: string) => Promise<void>;
  resetPhase: () => void;
  refreshStatus: () => Promise<void>;
}

export function useMatchmaking(): UseMatchmakingResult {
  const { accessToken } = useAuth();
  const [phase, setPhase] = useState<MatchPhase>("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [queueEntry, setQueueEntry] = useState<QueueRow | null>(null);
  const [activeMatches, setActiveMatches] = useState<MatchRow[]>([]);
  const [pendingMatch, setPendingMatch] = useState<MatchRow | null>(null);
  const [identity, setIdentity] = useState<MatchIdentityView | null>(null);
  const [compatibilityScore, setCompatibilityScore] = useState<number | null>(null);
  const [acceptCountdown, setAcceptCountdown] = useState<number>(30);
  const [waitingForPartner, setWaitingForPartner] = useState(false);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [dailyMatchCount, setDailyMatchCount] = useState<number>(0);
  const [dailyLimit, setDailyLimit] = useState<number>(5);
  const [roomReady, setRoomReady] = useState<{
    matchId: string;
    conversationId: string;
    identity?: MatchIdentityView;
  } | null>(null);

  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (seconds: number = 30) => {
      clearCountdown();
      setAcceptCountdown(seconds);
      countdownTimerRef.current = setInterval(() => {
        setAcceptCountdown((prev) => {
          if (prev <= 1) {
            clearCountdown();
            setPhase("ended");
            setEndedReason("Match acceptance window expired.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearCountdown]
  );

  const refreshStatus = useCallback(async () => {
    if (!accessToken) return;
    try {
      const status = await getMatchmakingStatus(accessToken);
      if (status.dailyMatchCount !== undefined) {
        setDailyMatchCount(status.dailyMatchCount);
      } else if (status.dailyCount !== undefined) {
        setDailyMatchCount(status.dailyCount);
      }
      if (status.dailyLimit !== undefined) {
        setDailyLimit(status.dailyLimit);
      }

      const matches = status.activeMatches || (status.activeMatch ? [status.activeMatch] : []);
      setActiveMatches(matches);

      const pending = matches.find((m) => m.status === "pending") || null;
      setPendingMatch(pending);

      if (status.identity) {
        setIdentity(status.identity);
      }

      if (status.queueEntry && status.queueEntry.status === "searching") {
        setQueueEntry(status.queueEntry);
        setPhase("searching");
      } else if (pending) {
        setPhase("pending");
        if (pending.accept_expires_at) {
          const remainingSecs = Math.max(
            0,
            Math.floor((new Date(pending.accept_expires_at).getTime() - Date.now()) / 1000)
          );
          startCountdown(remainingSecs || 30);
        }
      } else if (phase === "searching" && !status.queueEntry) {
        // queue ended
      }
    } catch (err: any) {
      console.warn("Failed to load matchmaking status:", err);
    }
  }, [accessToken, phase, startCountdown]);

  useEffect(() => {
    refreshStatus();
  }, [accessToken, refreshStatus]);

  // Socket.IO lifecycle listener
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    const onMatchFound = (payload: any) => {
      console.log("⚡ [Matchmaking] match_found:", payload);
      if (payload?.identity) {
        setIdentity(payload.identity);
      }
      if (payload?.compatibilityScore) {
        setCompatibilityScore(payload.compatibilityScore);
      }
      if (payload?.matchId) {
        setPendingMatch({
          id: payload.matchId,
          status: "pending",
          current_stage: 0,
          day_streak: 0,
          revealed_at: null,
          myAlias: payload.identity?.myAlias,
          myAvatar: payload.identity?.myAvatar,
          partnerAlias: payload.identity?.partnerAlias,
          partnerAvatar: payload.identity?.partnerAvatar,
        });
      }
      setWaitingForPartner(false);
      setPhase("pending");
      const durationSeconds = payload?.expiresInMs
        ? Math.floor(payload.expiresInMs / 1000)
        : 30;
      startCountdown(durationSeconds);
    };

    const onRoomReady = (payload: any) => {
      console.log("⚡ [Matchmaking] room_ready:", payload);
      clearCountdown();
      setWaitingForPartner(false);
      setPhase("accepted");
      setRoomReady(payload);
    };

    const onPartnerAccepted = () => {
      console.log("⚡ [Matchmaking] partner_accepted");
    };

    const onPartnerDeclined = () => {
      console.log("⚡ [Matchmaking] partner_declined");
      clearCountdown();
      setWaitingForPartner(false);
      setEndedReason("Your match declined the conversation.");
      setPhase("ended");
    };

    const onMatchTimedOut = () => {
      console.log("⚡ [Matchmaking] match_timed_out");
      clearCountdown();
      setWaitingForPartner(false);
      setEndedReason("Nobody accepted in time.");
      setPhase("ended");
    };

    const onChatExpired = () => {
      console.log("⚡ [Matchmaking] chat_expired");
      setEndedReason("Chat expired before first message was sent.");
      setPhase("ended");
    };

    const onMatchEnded = () => {
      console.log("⚡ [Matchmaking] match_ended");
      setEndedReason("Your match ended the anonymous chat.");
      setPhase("ended");
    };

    socket.on("matchmaking:match_found", onMatchFound);
    socket.on("matchmaking:room_ready", onRoomReady);
    socket.on("matchmaking:partner_accepted", onPartnerAccepted);
    socket.on("matchmaking:partner_declined", onPartnerDeclined);
    socket.on("matchmaking:match_timed_out", onMatchTimedOut);
    socket.on("matchmaking:chat_expired", onChatExpired);
    socket.on("matchmaking:match_ended", onMatchEnded);

    return () => {
      socket.off("matchmaking:match_found", onMatchFound);
      socket.off("matchmaking:room_ready", onRoomReady);
      socket.off("matchmaking:partner_accepted", onPartnerAccepted);
      socket.off("matchmaking:partner_declined", onPartnerDeclined);
      socket.off("matchmaking:match_timed_out", onMatchTimedOut);
      socket.off("matchmaking:chat_expired", onChatExpired);
      socket.off("matchmaking:match_ended", onMatchEnded);
      clearCountdown();
    };
  }, [accessToken, startCountdown, clearCountdown]);

  const joinQueue = useCallback(
    async (preferences?: MatchmakingPreferences) => {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      setEndedReason(null);
      setRoomReady(null);
      setWaitingForPartner(false);
      try {
        const entry = await joinMatchmakingQueue(accessToken, preferences);
        setQueueEntry(entry as QueueRow);
        setPhase("searching");
      } catch (err: any) {
        const msg = err?.message || "Could not join matchmaking queue";
        setError(msg);
        console.warn("joinQueue error:", err);
      } finally {
        setLoading(false);
      }
    },
    [accessToken]
  );

  const leaveQueue = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      await leaveMatchmakingQueue(accessToken);
      setQueueEntry(null);
      setPhase("idle");
    } catch (err: any) {
      console.warn("leaveQueue error:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  const accept = useCallback(async () => {
    if (!accessToken || !pendingMatch) return;
    setLoading(true);
    try {
      await apiAcceptMatch(pendingMatch.id, accessToken);
      setWaitingForPartner(true);
    } catch (err: any) {
      console.warn("acceptMatch error:", err);
      setError(err?.message || "Failed to accept match");
    } finally {
      setLoading(false);
    }
  }, [accessToken, pendingMatch]);

  const decline = useCallback(async () => {
    if (!accessToken || !pendingMatch) return;
    setLoading(true);
    clearCountdown();
    try {
      await apiDeclineMatch(pendingMatch.id, accessToken);
      setPendingMatch(null);
      setPhase("idle");
    } catch (err: any) {
      console.warn("declineMatch error:", err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, pendingMatch, clearCountdown]);

  const endCurrentMatch = useCallback(
    async (matchId?: string) => {
      const id = matchId || pendingMatch?.id || activeMatches[0]?.id;
      if (!accessToken || !id) return;
      try {
        await apiEndMatch(id, accessToken);
        refreshStatus();
      } catch (err: any) {
        console.warn("endMatch error:", err);
      }
    },
    [accessToken, pendingMatch, activeMatches, refreshStatus]
  );

  const clearRoomReady = useCallback(() => setRoomReady(null), []);
  const resetPhase = useCallback(() => {
    clearCountdown();
    setPhase("idle");
    setEndedReason(null);
    setWaitingForPartner(false);
    setPendingMatch(null);
  }, [clearCountdown]);

  return {
    phase,
    loading,
    error,
    dailyMatchCount,
    dailyLimit,
    pendingMatch,
    activeMatch: activeMatches[0] || null,
    activeMatches,
    identity,
    compatibilityScore,
    acceptCountdown,
    waitingForPartner,
    endedReason,
    roomReady,
    clearRoomReady,
    joinQueue,
    leaveQueue,
    accept,
    decline,
    endCurrentMatch,
    resetPhase,
    refreshStatus,
  };
}
