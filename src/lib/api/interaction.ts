import { apiRequest } from "./client";
import type {
  Interaction,
  InteractionStatusResponse,
  PaginatedAllyList,
} from "@/types/interaction";

export function listInteractions(accessToken: string): Promise<Interaction[]> {
  return apiRequest<Interaction[]>("/interactions", { accessToken });
}

export function getIncomingInteractions(requesterIds: string[], accessToken: string): Promise<Interaction[]> {
  return apiRequest<Interaction[]>("/interactions/incoming", {
    method: "POST",
    body: { requesterIds },
    accessToken,
  });
}

export function requestConnection(targetUserId: string, accessToken: string): Promise<void> {
  return apiRequest<void>("/interactions/request", {
    method: "POST",
    body: { targetUserId },
    accessToken,
    noContent: true,
  });
}

export function acceptConnection(requesterId: string, accessToken: string): Promise<{ conversationId: string }> {
  return apiRequest<{ conversationId: string }>("/interactions/accept", {
    method: "POST",
    body: { requesterId },
    accessToken,
  });
}

export function rejectConnection(targetUserId: string, accessToken: string): Promise<void> {
  return apiRequest<void>("/interactions/reject", {
    method: "POST",
    body: { targetUserId },
    accessToken,
    noContent: true,
  });
}

export function getInteractionStatus(targetUserId: string, accessToken: string): Promise<InteractionStatusResponse> {
  return apiRequest<InteractionStatusResponse>(`/interactions/status/${targetUserId}`, { accessToken });
}

export function listAllies(
  userId: string,
  accessToken: string,
  cursor?: string | null
): Promise<PaginatedAllyList> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiRequest<PaginatedAllyList>(`/interactions/allies/${userId}${qs}`, { accessToken });
}