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
import { ArrowLeft, ShieldAlert } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { listRestrictedUsers, unrestrictUser } from "@/lib/api/moderation";
import { getProfilesBatch } from "@/lib/api/profiles";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import type { RestrictedUserEntry } from "@/types/moderation";
import type { Profile } from "@/types/profile";

interface RestrictedEntry extends RestrictedUserEntry {
  profile?: Profile;
}

export default function RestrictedUsersScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [entries, setEntries] = useState<RestrictedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unrestrictTarget, setUnrestrictTarget] = useState<RestrictedEntry | null>(null);
  const [unrestricting, setUnrestricting] = useState(false);

  const loadRestricted = useCallback(async () => {
    if (!accessToken) return;
    try {
      const restricted = await listRestrictedUsers(accessToken);
      // Fetch profiles for display
      if (restricted.length > 0) {
        const ids = restricted.map((b) => b.restrictedUserId);
        try {
          const profiles = await getProfilesBatch(ids, accessToken);
          const profileMap = new Map(profiles.map((p) => [p.id, p]));
          setEntries(
            restricted.map((b) => ({
              ...b,
              profile: profileMap.get(b.restrictedUserId),
            }))
          );
        } catch {
          setEntries(restricted);
        }
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.warn("Failed to load restricted users", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadRestricted();
      setLoading(false);
    }
    init();
  }, [loadRestricted]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRestricted();
    setRefreshing(false);
  }, [loadRestricted]);

  const handleUnrestrict = useCallback(async () => {
    if (!unrestrictTarget || !accessToken || unrestricting) return;
    setUnrestricting(true);
    try {
      await unrestrictUser(unrestrictTarget.restrictedUserId, accessToken);
      setEntries((prev) =>
        prev.filter((e) => e.restrictedUserId !== unrestrictTarget.restrictedUserId)
      );
      setUnrestrictTarget(null);
    } catch (err) {
      console.warn("Failed to unrestrict", err);
    } finally {
      setUnrestricting(false);
    }
  }, [unrestrictTarget, accessToken, unrestricting]);

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
          Restricted Users
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.restrictedUserId}
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
                {item.profile?.full_name || "Restricted User"}
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
              onPress={() => setUnrestrictTarget(item)}
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
                  color: "#D97706",
                }}
              >
                Unrestrict
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
            icon={<ShieldAlert size={28} color="#D97706" />}
            title="No restricted users"
            description="Users you restrict will appear here. Mutual presence will be hidden."
          />
        }
      />

      <ConfirmModal
        visible={!!unrestrictTarget}
        title="Unrestrict this user?"
        description={`${
          unrestrictTarget?.profile?.full_name || "This user"
        } and you will be able to see each other's online status again.`}
        confirmLabel="Unrestrict"
        onConfirm={handleUnrestrict}
        onCancel={() => setUnrestrictTarget(null)}
      />
    </View>
  );
}
