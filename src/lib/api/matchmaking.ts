import { apiRequest } from "./client";

export interface MatchmakingStatus {
  inQueue: boolean;
  dailyCount: number;
  dailyLimit: number;
  match?: any;
}

export function getMatchmakingStatus(accessToken: string): Promise<MatchmakingStatus> {
  return apiRequest<MatchmakingStatus>("/matchmaking/status", { accessToken });
}

export function joinMatchmakingQueue(accessToken: string): Promise<{ success: boolean; match?: any }> {
  return apiRequest<{ success: boolean; match?: any }>("/matchmaking/queue", {
    method: "POST",
    accessToken,
  });
}

export function leaveMatchmakingQueue(accessToken: string): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/matchmaking/queue", {
    method: "DELETE",
    accessToken,
  });
}
