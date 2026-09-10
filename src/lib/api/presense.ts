import { apiRequest } from "./client";

export interface PresenceEntry { user_id: string; last_seen?: string; }
export interface OnlinePresenceResponse {
  userIds?: string[];
  online?: PresenceEntry[];
}

export function sendHeartbeat(accessToken: string): Promise<void> {
  return apiRequest<void>("/presence/heartbeat", { method: "POST", accessToken, noContent: true });
}

export function getOnlinePresence(accessToken: string): Promise<OnlinePresenceResponse> {
  return apiRequest<OnlinePresenceResponse>("/presence/online", { accessToken });
}