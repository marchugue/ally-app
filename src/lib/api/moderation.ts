import { apiRequest } from "./client";
import type {
  BlockRecord,
  UnblockResult,
  BlockedUserEntry,
  Report,
  RestrictRecord,
  UnrestrictResult,
  RestrictedUserEntry,
  MuteRecord,
  UnmuteResult,
  MutedUserEntry,
} from "@/types/moderation";

export function blockUser(blockedUserId: string, accessToken: string): Promise<BlockRecord> {
  return apiRequest<BlockRecord>("/moderation/block", { method: "POST", body: { blockedUserId }, accessToken });
}

export function reportUser(
  targetUserId: string,
  reason: string,
  accessToken: string,
  options?: { conversationId?: string; postId?: string; messageId?: string; notes?: string }
): Promise<Report> {
  return apiRequest<Report>("/moderation/report", {
    method: "POST",
    body: {
      targetUserId,
      reportedUserId: targetUserId,
      reason,
      violationId: reason,
      conversationId: options?.conversationId,
      postId: options?.postId,
      messageId: options?.messageId,
      notes: options?.notes,
    },
    accessToken,
  });
}

export function isUserBlocked(userId: string, accessToken: string): Promise<{ blocked: boolean }> {
  return apiRequest<{ blocked: boolean }>(`/moderation/blocked/${userId}`, { accessToken });
}

export function unblockUser(userId: string, accessToken: string): Promise<UnblockResult> {
  return apiRequest<UnblockResult>(`/moderation/block/${userId}`, { method: "DELETE", accessToken });
}

export function listBlockedUsers(accessToken: string): Promise<BlockedUserEntry[]> {
  return apiRequest<BlockedUserEntry[]>("/moderation/blocked", { accessToken });
}

// ─────────────────────────────────────────────────────────────────────────────
// Restrict API
// ─────────────────────────────────────────────────────────────────────────────

export function restrictUser(restrictedUserId: string, accessToken: string): Promise<RestrictRecord> {
  return apiRequest<RestrictRecord>("/moderation/restrict", {
    method: "POST",
    body: { restrictedUserId },
    accessToken,
  });
}

export function unrestrictUser(userId: string, accessToken: string): Promise<UnrestrictResult> {
  return apiRequest<UnrestrictResult>(`/moderation/restrict/${userId}`, { method: "DELETE", accessToken });
}

export function isUserRestricted(
  userId: string,
  accessToken: string
): Promise<{ restricted: boolean; restrictedByMe: boolean }> {
  return apiRequest<{ restricted: boolean; restrictedByMe: boolean }>(`/moderation/restricted/${userId}`, {
    accessToken,
  });
}

export function listRestrictedUsers(accessToken: string): Promise<RestrictedUserEntry[]> {
  return apiRequest<RestrictedUserEntry[]>("/moderation/restricted", { accessToken });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mute API
// ─────────────────────────────────────────────────────────────────────────────

export function muteUser(mutedUserId: string, accessToken: string): Promise<MuteRecord> {
  return apiRequest<MuteRecord>("/moderation/mute", {
    method: "POST",
    body: { mutedUserId },
    accessToken,
  });
}

export function unmuteUser(userId: string, accessToken: string): Promise<UnmuteResult> {
  return apiRequest<UnmuteResult>(`/moderation/mute/${userId}`, { method: "DELETE", accessToken });
}

export function isUserMuted(userId: string, accessToken: string): Promise<{ muted: boolean }> {
  return apiRequest<{ muted: boolean }>(`/moderation/muted/${userId}`, { accessToken });
}

export function listMutedUsers(accessToken: string): Promise<MutedUserEntry[]> {
  return apiRequest<MutedUserEntry[]>("/moderation/muted", { accessToken });
}

export interface BanStatusResponse {
  isBanned: boolean;
  isSuspended?: boolean;
  status?: 'banned' | 'suspended' | 'active';
  bannedAt: string | null;
  suspendedUntil?: string | null;
  reportId: string | null;
  docketId: string;
  violationLabel: string;
  reason: string;
  appealSubmitted: boolean;
  appealDocketId?: string;
  appealStatement?: string;
  appealSubmittedAt?: string;
}

export function getBanStatus(accessToken: string): Promise<BanStatusResponse> {
  return apiRequest<BanStatusResponse>("/moderation/ban-status", { accessToken });
}

export function submitBanAppeal(
  statement: string,
  accessToken: string,
  reportId?: string
): Promise<{ success: boolean; appealDocketId: string }> {
  return apiRequest<{ success: boolean; appealDocketId: string }>("/moderation/ban-appeal", {
    method: "POST",
    body: { statement, reportId },
    accessToken,
  });
}

export function getMyReports(accessToken: string): Promise<any[]> {
  return apiRequest<any[]>("/moderation/my-reports", { accessToken });
}

export function submitReportAppeal(
  reportId: string,
  statement: string,
  accessToken: string
): Promise<{ success: boolean; appealDocketId: string }> {
  return apiRequest<{ success: boolean; appealDocketId: string }>(`/moderation/reports/${reportId}/appeal`, {
    method: "POST",
    body: { statement },
    accessToken,
  });
}
