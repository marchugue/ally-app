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
import { ArrowLeft, Ban, UserX } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { listBlockedUsers, unblockUser } from "@/lib/api/moderation";
import { getProfilesBatch } from "@/lib/api/profiles";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { BlockedUserEntry } from "@/types/moderation";
import type { Profile } from "@/types/profile";

interface BlockedEntry extends BlockedUserEntry {
  profile?: Profile;
}

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [entries, setEntries] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockTarget, setUnblockTarget] = useState<BlockedEntry | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const loadBlocked = useCallback(async () => {
    if (!accessToken) return;
    try {
      const blocked = await listBlockedUsers(accessToken);
      // Fetch profiles for display
      if (blocked.length > 0) {
        const ids = blocked.map((b) => b.blockedUserId);
        try {
          const profiles = await getProfilesBatch(ids, accessToken);
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          setEntries(
            blocked.map((b) => ({
              ...b,
              profile: profileMap.get(b.blockedUserId),
            }))
          );
        } catch {
          setEntries(blocked);
        }
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.warn("Failed to load blocked users", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadBlocked();
      setLoading(false);
    }
    init();
  }, [loadBlocked]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBlocked();
    setRefreshing(false);
  }, [loadBlocked]);

  const handleUnblock = useCallback(async () => {
    if (!unblockTarget || !accessToken || unblocking) return;
    setUnblocking(true);
    try {
      await unblockUser(unblockTarget.blockedUserId, accessToken);
      setEntries((prev) =>
        prev.filter((e) => e.blockedUserId !== unblockTarget.blockedUserId)
      );
      setUnblockTarget(null);
    } catch (err) {
      console.warn("Failed to unblock", err);
    } finally {
      setUnblocking(false);
    }
  }, [unblockTarget, accessToken, unblocking]);

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F4EF" }}>
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
          Blocked Users
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.blockedUserId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          entries.length === 0 ? { flex: 1 } : { paddingVertical: 8, paddingBottom: 20 }
        }
        renderItem={({ item }) => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
              gap: 12,
            }}
          >
            <UserAvatar
              avatar={item.profile?.avatar_url}
              size="lg"
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#111827",
                }}
                numberOfLines={1}
              >
                {item.profile?.full_name || "Blocked User"}
              </Text>
              {item.profile?.username && (
                <Text
                  style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}
                >
                  @{item.profile.username}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => setUnblockTarget(item)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: "#E2DED7",
                backgroundColor: "#FFFFFF",
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#EF4444",
                }}
              >
                Unblock
              </Text>
            </Pressable>
          </View>
        )}
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
            icon={<Ban size={28} color="#1A6B3C" />}
            title="No blocked users"
            description="Users you block will appear here. You can unblock them at any time."
          />
        }
      />

      <ConfirmModal
        visible={!!unblockTarget}
        title="Unblock this user?"
        description={`${
          unblockTarget?.profile?.full_name || "This user"
        } will be able to message you and see your profile again.`}
        confirmLabel="Unblock"
        onConfirm={handleUnblock}
        onCancel={() => setUnblockTarget(null)}
      />
    </View>
  );
}
