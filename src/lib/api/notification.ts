import { apiRequest } from "./client";
import type { NotificationItem } from "@/types/notification";

export function getFriendRequestNotifications(accessToken: string): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>("/notifications/friend-requests", { accessToken });
}

export function markAllNotificationsRead(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications/read-all", { method: "PATCH", accessToken, noContent: true });
}

export async function listNotifications(accessToken: string): Promise<NotificationItem[]> {
  const data = await apiRequest<any[]>("/notifications", { accessToken });
  return (data || []).map((row) => {
    const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
    const username = fromUser?.username || row.username || "";
    const fullName = fromUser?.full_name || "";
    const authorName = username || fullName || (row.author_name && row.author_name !== row.title ? row.author_name : "Someone");
    const avatarUrl = fromUser?.avatar_url || row.avatar_url || row.user_avatar;
    const description = row.description || row.message || "";

    const postId = row.post_id || row.target_id || row.resource_id || "";

    return {
      ...row,
      avatar_url: avatarUrl,
      author_name: authorName,
      username: username,
      description: description,
      post_id: postId,
    };
  });
}

export function markNotificationRead(id: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH", accessToken, noContent: true });
}

export function clearAllNotifications(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications", { method: "DELETE", accessToken, noContent: true });
}