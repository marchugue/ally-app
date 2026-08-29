import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Compass, UserPlus, Check, Clock } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/EmptyState";
import { useAuth } from "@/lib/auth/AuthContext";
import { listProfiles } from "@/lib/api/profiles";
import {
  listInteractions,
  requestConnection,
} from "@/lib/api/interaction";
import type { ProfileSummary } from "@/types/profile";

type ConnectionStatus = "none" | "pending" | "accepted";

export default function DiscoverScreen() {
  const { user, accessToken } = useAuth();
  const [people, setPeople] = useState<ProfileSummary[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPeople = useCallback(async () => {
    if (!accessToken || !user) return;
    try {
      const [profiles, interactions] = await Promise.all([
        listProfiles(accessToken, user.id),
        listInteractions(accessToken),
      ]);
      const connMap: Record<string, ConnectionStatus> = {};
      (interactions ?? []).forEach((r: any) => {
        connMap[r.target_user_id] = r.status;
      });
      setConnections(connMap);
      setPeople(profiles);
    } catch (err) {
      console.warn("Failed to load discover", err);
    }
  }, [accessToken, user]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadPeople();
      setLoading(false);
    }
    init();
  }, [loadPeople]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPeople();
    setRefreshing(false);
  }, [loadPeople]);

  const handleConnect = useCallback(
    async (targetId: string) => {
      if (
        !accessToken ||
        connections[targetId] === "pending" ||
        connections[targetId] === "accepted"
      )
        return;

      // Optimistic
      setConnections((prev) => ({ ...prev, [targetId]: "pending" }));
      try {
        await requestConnection(targetId, accessToken);
      } catch {
        setConnections((prev) => ({ ...prev, [targetId]: "none" }));
      }
    },
    [accessToken, connections]
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
      <ScreenHeader title="Discover" subtitle="Find your campus community" />

      <FlatList
        data={people}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          people.length === 0 ? { flex: 1 } : { paddingVertical: 8, paddingBottom: 20 }
        }
        renderItem={({ item }) => {
          const status = connections[item.id] || "none";
          return (
            <Pressable
              android_ripple={{ color: "rgba(0,0,0,0.04)" }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 20,
                paddingVertical: 12,
                gap: 12,
              }}
            >
              <UserAvatar avatar={null} size="lg" />

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "600",
                    color: "#111827",
                  }}
                  numberOfLines={1}
                >
                  {item.full_name || `@${item.username}`}
                </Text>
                <Text
                  style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}
                  numberOfLines={1}
                >
                  @{item.username}
                </Text>
              </View>

              <Pressable
                onPress={() => handleConnect(item.id)}
                disabled={status === "accepted"}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor:
                    status === "accepted"
                      ? "#1A6B3C"
                      : status === "pending"
                      ? "#E8A838"
                      : "#E2DED7",
                  backgroundColor:
                    status === "accepted"
                      ? "#1A6B3C08"
                      : status === "pending"
                      ? "#E8A83810"
                      : "transparent",
                }}
              >
                {status === "accepted" ? (
                  <Check size={13} color="#1A6B3C" />
                ) : status === "pending" ? (
                  <Clock size={13} color="#E8A838" />
                ) : (
                  <UserPlus size={13} color="#6B7280" />
                )}
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color:
                      status === "accepted"
                        ? "#1A6B3C"
                        : status === "pending"
                        ? "#E8A838"
                        : "#6B7280",
                  }}
                >
                  {status === "none"
                    ? "Connect"
                    : status === "pending"
                    ? "Requested"
                    : "Connected"}
                </Text>
              </Pressable>
            </Pressable>
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
            icon={<Compass size={28} color="#1A6B3C" />}
            title="No one to discover"
            description="Check back later for new students on campus."
          />
        }
      />
    </View>
  );
}
