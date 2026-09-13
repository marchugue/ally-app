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
import { ArrowLeft, UserPlus, Check, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { getFriendRequestNotifications } from "@/lib/api/notification";
import {
  acceptConnection,
  rejectConnection,
} from "@/lib/api/interaction";
import type { NotificationItem } from "@/types/notification";

export default function RequestsScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();
  const [requests, setRequests] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const loadRequests = useCallback(async () => {
    if (!accessToken) return;
    try {
      const items = await getFriendRequestNotifications(accessToken);
      setRequests(items);
    } catch (err) {
      console.warn("Failed to load requests", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadRequests();
      setLoading(false);
    }
    init();
  }, [loadRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, [loadRequests]);

  const handleAccept = useCallback(
    async (item: NotificationItem) => {
      const requesterId = item.from_user_id || item.fromUserId;
      if (!accessToken || !requesterId) return;
      setProcessing((prev) => new Set(prev).add(item.id));
      try {
        await acceptConnection(requesterId, accessToken);
        setRequests((prev) => prev.filter((r) => r.id !== item.id));
      } catch (err) {
        console.warn("Failed to accept", err);
      } finally {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }
    },
    [accessToken]
  );

  const handleReject = useCallback(
    async (item: NotificationItem) => {
      const requesterId = item.from_user_id || item.fromUserId;
      if (!accessToken || !requesterId) return;
      setProcessing((prev) => new Set(prev).add(item.id));
      try {
        await rejectConnection(requesterId, accessToken);
        setRequests((prev) => prev.filter((r) => r.id !== item.id));
      } catch (err) {
        console.warn("Failed to reject", err);
      } finally {
        setProcessing((prev) => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
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
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E2DED7",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
          Connection Requests
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          requests.length === 0 ? { flex: 1 } : { paddingVertical: 8, paddingBottom: 20 }
        }
        renderItem={({ item }) => {
          const isProcessing = processing.has(item.id);
          const fromUser = Array.isArray(item.from_user) ? item.from_user[0] : item.from_user;
          const avatarUrl = item.avatar_url || fromUser?.avatar_url || item.user_avatar;
          const name = item.author_name || item.username || fromUser?.full_name || fromUser?.username || "Student";
          const message = item.message || item.description || "Sent you a connection request";

          return (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 14,
                gap: 12,
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              <UserAvatar avatar={avatarUrl} fallback="👤" size="md" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#111827",
                  }}
                  numberOfLines={1}
                >
                  {name}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6B7280",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {message}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  onPress={() => handleAccept(item)}
                  disabled={isProcessing}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#1A6B3C",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={18} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => handleReject(item)}
                  disabled={isProcessing}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: "#F0EDE8",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#E2DED7",
                  }}
                >
                  <X size={18} color="#6B7280" />
                </Pressable>
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => (
          <View
            style={{
              height: 1,
              backgroundColor: "#F0EDE8",
              marginLeft: 88,
              marginRight: 20,
            }}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon={<UserPlus size={28} color="#1A6B3C" />}
            title="No pending requests"
            description="Connection requests from other students will appear here."
          />
        }
      />
    </View>
  );
}
