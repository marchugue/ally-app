import { apiRequest } from "./client";
import type { BlockRecord, UnblockResult, BlockedUserEntry, Report } from "@/types/moderation";

export function blockUser(blockedUserId: string, accessToken: string): Promise<BlockRecord> {
  return apiRequest<BlockRecord>("/moderation/block", { method: "POST", body: { blockedUserId }, accessToken });
}

export function reportUser(targetUserId: string, reason: string, accessToken: string): Promise<Report> {
  return apiRequest<Report>("/moderation/report", {
    method: "POST",
    body: { targetUserId, reason },
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