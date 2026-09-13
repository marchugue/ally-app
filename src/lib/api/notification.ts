import { apiRequest } from "./client";
import type { NotificationItem } from "@/types/notification";

function stripMetaPrefix(desc: string | undefined | null): string {
  if (!desc) return "";
  return desc.replace(/^<!--meta:\{[^}]*\}-->/i, "").trim();
}

export async function getFriendRequestNotifications(accessToken: string): Promise<NotificationItem[]> {
  const data = await apiRequest<any[]>("/notifications/friend-requests", { accessToken });
  const list = Array.isArray(data) ? data : (data as any)?.data || [];
  return list.map((row: any) => {
    const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
    const username = fromUser?.username || row.username || "";
    const fullName = fromUser?.full_name || "";
    const authorName = fullName || username || (row.author_name && row.author_name !== row.title ? row.author_name : "Someone");
    const avatarUrl = fromUser?.avatar_url || row.avatar_url || row.user_avatar;
    const description = stripMetaPrefix(row.description || row.message || "");
    const fromUserId = row.from_user_id || fromUser?.id || row.fromUserId;
    const isRead = Boolean(row.is_read ?? row.isRead ?? row.read ?? false);

    return {
      ...row,
      id: row.id,
      from_user_id: fromUserId,
      fromUserId: fromUserId,
      from_user: fromUser,
      avatar_url: avatarUrl,
      author_name: authorName,
      username: username,
      description: description,
      message: description || `${authorName} sent you a connection request`,
      isRead,
      read: isRead,
      is_read: isRead,
    };
  });
}

export function markAllNotificationsRead(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications/read-all", { method: "PATCH", accessToken, noContent: true });
}

export async function listNotifications(accessToken: string): Promise<NotificationItem[]> {
  const data = await apiRequest<any[]>("/notifications", { accessToken });
  const list = Array.isArray(data) ? data : (data as any)?.data || [];
  return list.map((row: any) => {
    const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
    const username = fromUser?.username || row.username || "";
    const fullName = fromUser?.full_name || "";
    const authorName = username || fullName || (row.author_name && row.author_name !== row.title ? row.author_name : "Someone");
    const avatarUrl = fromUser?.avatar_url || row.avatar_url || row.user_avatar;
    const description = stripMetaPrefix(row.description || row.message || "");

    const postId = row.post_id || row.target_id || row.resource_id || "";
    const commentId = row.comment_id || "";
    const fromUserId = row.from_user_id || fromUser?.id || row.fromUserId;
    const isRead = Boolean(row.is_read ?? row.isRead ?? row.read ?? false);

    return {
      ...row,
      id: row.id,
      from_user_id: fromUserId,
      fromUserId: fromUserId,
      from_user: fromUser,
      avatar_url: avatarUrl,
      author_name: authorName,
      username: username,
      description: description,
      post_id: postId,
      comment_id: commentId,
      isRead,
      read: isRead,
      is_read: isRead,
    };
  });
}

export function markNotificationRead(id: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH", accessToken, noContent: true });
}

export function clearAllNotifications(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications", { method: "DELETE", accessToken, noContent: true });
}