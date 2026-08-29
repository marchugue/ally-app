import { apiRequest } from "./client";
import type {
  ConversationMembership,
  Conversation,
  Message,
  MessageReaction,
  SendMessagePayload,
} from "@/types/conversation";

export function getMyMemberships(accessToken: string): Promise<ConversationMembership[]> {
  return apiRequest<ConversationMembership[]>("/conversations/memberships/me", { accessToken });
}

export function getOrCreateConversationWithUser(
  otherUserId: string,
  accessToken: string
): Promise<{ conversationId: string }> {
  return apiRequest<{ conversationId: string }>(`/conversations/with-user/${otherUserId}`, { accessToken });
}

export function listConversations(accessToken: string): Promise<Conversation[]> {
  return apiRequest<Conversation[]>("/conversations", { accessToken });
}

export function createConversation(targetUserId: string, accessToken: string): Promise<{ conversationId: string }> {
  return apiRequest<{ conversationId: string }>("/conversations", {
    method: "POST",
    body: { targetUserId },
    accessToken,
  });
}

export function getConversationById(id: string, accessToken: string): Promise<Conversation> {
  return apiRequest<Conversation>(`/conversations/${id}`, { accessToken });
}

export function markConversationRead(id: string, readAt: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/conversations/${id}/read`, {
    method: "PATCH",
    body: { readAt },
    accessToken,
    noContent: true,
  });
}

export function listMessages(id: string, accessToken: string): Promise<Message[]> {
  return apiRequest<Message[]>(`/conversations/${id}/messages`, { accessToken });
}

export function sendMessage(id: string, payload: SendMessagePayload, accessToken: string): Promise<Message> {
  return apiRequest<Message>(`/conversations/${id}/messages`, {
    method: "POST",
    body: payload,
    accessToken,
  });
}

export function setMessageReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  accessToken: string
): Promise<MessageReaction[]> {
  return apiRequest<MessageReaction[]>(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: "PUT",
    body: { emoji },
    accessToken,
  });
}

export function setIcebreakers(id: string, enabled: boolean, accessToken: string): Promise<void> {
  return apiRequest<void>(`/conversations/${id}/icebreakers`, {
    method: "PATCH",
    body: { enabled },
    accessToken,
    noContent: true,
  });
}

export function getIcebreakers(id: string, accessToken: string): Promise<{ data: boolean }> {
  return apiRequest<{ data: boolean }>(`/conversations/${id}/icebreakers`, { accessToken });
}

/** Hide from my chat list only — backend: DELETE /conversations/:id */
export function hideConversation(id: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/conversations/${id}`, {
    method: "DELETE",
    accessToken,
    noContent: true,
  });
}

/** Permanently clear message history for caller — backend: POST /conversations/:id/clear */
export function clearConversation(id: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/conversations/${id}/clear`, {
    method: "POST",
    accessToken,
    noContent: true,
  });
}

/** Undo a hide — backend: POST /conversations/:id/unhide */
export function unhideConversation(id: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/conversations/${id}/unhide`, {
    method: "POST",
    accessToken,
    noContent: true,
  });
}