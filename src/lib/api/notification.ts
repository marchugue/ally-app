import { apiRequest } from "./client";
import type { NotificationItem, NotificationCategory } from "@/types/notification";

function parseMeta(desc: string | undefined | null): { cleanDesc: string; meta?: any } {
  if (!desc) return { cleanDesc: "" };
  const match = desc.match(/^<!--meta:(\{.*?\})-->\s*(.*)$/s);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      return { cleanDesc: match[2], meta: parsed };
    } catch {
      return { cleanDesc: desc };
    }
  }
  return { cleanDesc: desc };
}

function deriveCategory(type?: string): NotificationCategory {
  if (!type) return "activity";
  const t = type.toLowerCase();
  if (t === "message") return "messages";
  if (
    t.includes("friend") ||
    t.includes("connection") ||
    t.includes("request") ||
    t.includes("accepted")
  ) {
    return "connections";
  }
  if (t.includes("match") || t.includes("ally")) return "ally";
  if (
    t.includes("safety") ||
    t.includes("emergency") ||
    t.includes("alert") ||
    t.includes("warning")
  ) {
    return "safety";
  }
  return "activity";
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
    const { cleanDesc, meta } = parseMeta(row.description || row.message || "");
    const fromUserId = row.from_user_id || fromUser?.id || row.fromUserId || meta?.from_user_id;
    const isRead = Boolean(row.is_read ?? row.isRead ?? row.read ?? false);

    return {
      ...row,
      id: row.id,
      category: row.category || meta?.category || "connections",
      group_key: row.group_key || meta?.group_key,
      groupKey: row.group_key || meta?.group_key,
      unread_count: row.unread_count ?? meta?.unread_count ?? 1,
      unreadCount: row.unread_count ?? meta?.unread_count ?? 1,
      from_user_id: fromUserId,
      fromUserId: fromUserId,
      from_user: fromUser,
      avatar_url: avatarUrl,
      author_name: authorName,
      username: username,
      description: cleanDesc,
      message: cleanDesc || `${authorName} sent you a connection request`,
      isRead,
      read: isRead,
      is_read: isRead,
    };
  });
}

export function markAllNotificationsRead(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications/read-all", { method: "PATCH", accessToken, noContent: true });
}

export async function listNotifications(accessToken: string, category?: string): Promise<NotificationItem[]> {
  const query = category && category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
  const data = await apiRequest<any[]>(`/notifications${query}`, { accessToken });
  const list = Array.isArray(data) ? data : (data as any)?.data || [];
  return list.map((row: any) => {
    const fromUser = Array.isArray(row.from_user) ? row.from_user[0] : row.from_user;
    const username = fromUser?.username || row.username || "";
    const fullName = fromUser?.full_name || "";
    const authorName = username || fullName || (row.author_name && row.author_name !== row.title ? row.author_name : "Someone");
    const avatarUrl = fromUser?.avatar_url || row.avatar_url || row.user_avatar;
    const { cleanDesc, meta } = parseMeta(row.description || row.message || "");

    const categoryDerived = row.category || meta?.category || deriveCategory(row.type);
    const groupKey = row.group_key || meta?.group_key;
    const unreadCount = row.unread_count ?? meta?.unread_count ?? 1;

    const postId = row.post_id || row.target_id || row.resource_id || meta?.target_id || "";
    const commentId = row.comment_id || "";
    const fromUserId = row.from_user_id || fromUser?.id || row.fromUserId || meta?.from_user_id;
    const isRead = Boolean(row.is_read ?? row.isRead ?? row.read ?? false);

    return {
      ...row,
      id: row.id,
      category: categoryDerived,
      group_key: groupKey,
      groupKey: groupKey,
      unread_count: unreadCount,
      unreadCount: unreadCount,
      from_user_id: fromUserId,
      fromUserId: fromUserId,
      from_user: fromUser,
      avatar_url: avatarUrl,
      author_name: authorName,
      username: username,
      description: cleanDesc,
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

export function markTargetNotificationsRead(targetId: string, accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications/read-target", {
    method: "PATCH",
    body: { targetId },
    accessToken,
    noContent: true,
  });
}

export function clearAllNotifications(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications", { method: "DELETE", accessToken, noContent: true });
}