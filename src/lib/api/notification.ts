import { apiRequest } from "./client";
import type { NotificationItem } from "@/types/notification";

export function getFriendRequestNotifications(accessToken: string): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>("/notifications/friend-requests", { accessToken });
}

export function markAllNotificationsRead(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications/read-all", { method: "PATCH", accessToken, noContent: true });
}

export function listNotifications(accessToken: string): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>("/notifications", { accessToken });
}

export function markNotificationRead(id: string, accessToken: string): Promise<void> {
  return apiRequest<void>(`/notifications/${id}/read`, { method: "PATCH", accessToken, noContent: true });
}

export function clearAllNotifications(accessToken: string): Promise<void> {
  return apiRequest<void>("/notifications", { method: "DELETE", accessToken, noContent: true });
}