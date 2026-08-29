import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Bell, CheckCheck, UserPlus } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notification";
import type { NotificationItem } from "@/types/notification";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return `${Math.floor(diffDay / 7)}w`;
}

export default function NotificationsScreen() {
  const { accessToken } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!accessToken) return;
    try {
      const items = await listNotifications(accessToken);
      setNotifications(items);
    } catch (err) {
      console.warn("Failed to load notifications", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadNotifications();
      setLoading(false);
    }
    init();
  }, [loadNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!accessToken) return;
    try {
      await markAllNotificationsRead(accessToken);
      // Reload to reflect read states
      await loadNotifications();
    } catch (err) {
      console.warn("Failed to mark all read", err);
    }
  }, [accessToken, loadNotifications]);

  const handleTapNotification = useCallback(
    async (item: NotificationItem) => {
      if (!accessToken) return;
      // Mark this notification as read
      markNotificationRead(item.id, accessToken).catch(() => {});

      // Navigate based on type
      if (item.type === "friend_request") {
        router.push("/pages/requests" as any);
      }
    },
    [accessToken]
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Notifications"
        right={
          notifications.length > 0 ? (
            <Pressable onPress={handleMarkAllRead} hitSlop={8}>
              <CheckCheck size={20} color="#1A6B3C" />
            </Pressable>
          ) : undefined
        }
      />

      {/* Quick actions */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: "#E2DED7",
        }}
      >
        <Pressable
          onPress={() => router.push("/pages/requests" as any)}
          android_ripple={{ color: "rgba(0,0,0,0.04)" }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: "#FFFFFF",
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: "#E2DED7",
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#1A6B3C12",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <UserPlus size={18} color="#1A6B3C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
              Connection Requests
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280" }}>
              View pending friend requests
            </Text>
          </View>
        </Pressable>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          notifications.length === 0 ? { flex: 1 } : { paddingBottom: 20 }
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleTapNotification(item)}
            android_ripple={{ color: "rgba(0,0,0,0.04)" }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "#1A6B3C10",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={18} color="#1A6B3C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: "#111827",
                  lineHeight: 20,
                }}
              >
                {item.message}
              </Text>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: "#F0EDE8",
              marginLeft: 72,
              marginRight: 20,
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<Bell size={28} color="#1A6B3C" />}
            title="No notifications yet"
            description="Likes, follows, and comments will appear here."
          />
        }
      />
    </View>
  );
}