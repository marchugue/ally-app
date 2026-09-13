import { apiRequest } from "./client";
import type {
  AllyFilterParams,
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
  cursorOrParams?: string | null | AllyFilterParams
): Promise<PaginatedAllyList> {
  const params: AllyFilterParams =
    typeof cursorOrParams === "string"
      ? { cursor: cursorOrParams }
      : cursorOrParams || {};

  const query = new URLSearchParams();
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.search) query.set("search", params.search);
  if (params.department) query.set("department", params.department);
  if (params.course) query.set("course", params.course);
  if (params.year_level) query.set("year_level", params.year_level);
  if (params.sortBy) query.set("sortBy", params.sortBy);

  const qs = query.toString();
  return apiRequest<PaginatedAllyList>(`/interactions/allies/${userId}${qs ? `?${qs}` : ""}`, { accessToken });
}