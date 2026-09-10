import { apiRequest } from "./client";

export interface MatchIdentityView {
  myAlias: string;
  myAvatar: string;
  partnerAlias: string;
  partnerAvatar: string;
}

export interface MatchRow {
  id: string;
  conversation_id?: string;
  status:
    | "pending"
    | "chatting"
    | "confirmed"
    | "timed_out"
    | "declined"
    | "expired"
    | "ended";
  current_stage: number;
  day_streak: number;
  streak_count?: number;
  revealed_at: string | null;
  accept_expires_at?: string;
  chat_expires_at?: string;
  my_confirmed?: boolean;
  partner_confirmed?: boolean;
  myAlias?: string;
  myAvatar?: string;
  partnerAlias?: string;
  partnerAvatar?: string;
}

export interface QueueRow {
  id: string;
  user_id: string;
  status: "searching" | "reserved" | "cancelled";
  joined_at: string;
  updated_at: string;
}

export interface MatchmakingPreferences {
  department?: string;
  course?: string;
  strictCourse?: boolean;
  specialization?: string;
  matchType?: "anonymous" | "direct";
}

export interface MatchmakingStatusResponse {
  inQueue?: boolean;
  queueEntry?: QueueRow | null;
  activeMatch?: MatchRow | null;
  activeMatches?: MatchRow[];
  identity?: MatchIdentityView | null;
  dailyMatchCount?: number;
  dailyCount?: number;
  dailyLimit?: number;
}

export function getMatchmakingStatus(
  accessToken: string
): Promise<MatchmakingStatusResponse> {
  return apiRequest<MatchmakingStatusResponse>("/match/status", {
    accessToken,
  });
}

export function joinMatchmakingQueue(
  accessToken: string,
  preferences?: MatchmakingPreferences
): Promise<QueueRow> {
  return apiRequest<QueueRow>("/match/queue", {
    method: "POST",
    body: preferences,
    accessToken,
  });
}

export function leaveMatchmakingQueue(
  accessToken: string
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/match/queue", {
    method: "DELETE",
    accessToken,
  });
}

export function acceptMatch(
  matchId: string,
  accessToken: string
): Promise<{ success: boolean; match?: MatchRow }> {
  return apiRequest<{ success: boolean; match?: MatchRow }>(
    `/match/${matchId}/accept`,
    {
      method: "POST",
      accessToken,
    }
  );
}

export function declineMatch(
  matchId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/match/${matchId}/decline`, {
    method: "POST",
    accessToken,
  });
}

export function endMatch(
  matchId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>(`/match/${matchId}/end`, {
    method: "POST",
    accessToken,
  });
}

export interface RevealPartnerView {
  userId?: string | null;
  fullName?: string | null;
  username?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  blurredAvatarUrl?: string | null;
  ageRange?: string | null;
  zodiacSign?: string | null;
  personalityType?: string | null;
  musicTaste?: string[];
  movieInterests?: string[];
  studyCategory?: string | null;
  firstNameLetter?: string | null;
  favoriteHobby?: string | null;
}

export interface RevealData {
  stage: number;
  stageName: string;
  dayStreak: number;
  compatibilityScore: number | null;
  sharedInterests: string[];
  sharedCategories: string[];
  conversationInsights: { totalMessages: number; daysActive: number } | null;
  icebreakers: string[];
  partner: RevealPartnerView;
}

export interface TimelineData {
  locked: boolean;
  blurred: boolean;
  posts: Array<{
    id: string;
    content: string;
    mediaUrls: string[];
    likesCount: number;
    commentsCount: number;
    createdAt: string;
  }>;
}

export function getMatchReveal(
  matchId: string,
  accessToken: string
): Promise<RevealData> {
  return apiRequest<RevealData>(`/match/${matchId}/reveal`, {
    accessToken,
  });
}

export function getMatchTimeline(
  matchId: string,
  accessToken: string
): Promise<TimelineData> {
  return apiRequest<TimelineData>(`/match/${matchId}/timeline`, {
    accessToken,
  });
}
