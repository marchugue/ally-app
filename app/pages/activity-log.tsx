// app/pages/activity-log.tsx
//
// Facebook-style Activity Log screen for Ally Mobile.
// Chronological date groupings, category filter pills, device/IP audit trails,
// and record deletion / bulk clearing capabilities.

import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  SectionList,
  RefreshControl,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  History,
  Trash2,
  FileText,
  MessageSquare,
  Heart,
  UserPlus,
  UserMinus,
  UserX,
  KeyRound,
  LogIn,
  Shield,
  ShieldCheck,
  Smartphone,
  Laptop,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  listActivityLogs,
  deleteActivityLog,
  clearActivityLogs,
} from "@/lib/api/activityLogs";
import { ConfirmModal } from "@/components/ConfirmModal";
import type {
  ActivityBucket,
  ActivityLogRow,
  ActivityGroup,
} from "@/types/activity";

interface SectionData {
  title: string;
  data: ActivityLogRow[];
}

const BUCKET_FILTERS: Array<{ id: ActivityBucket | "all"; label: string }> = [
  { id: "all", label: "All Activity" },
  { id: "content", label: "Posts & Comments" },
  { id: "connections", label: "Allies & Follows" },
  { id: "security", label: "Security & Logins" },
  { id: "safety", label: "Privacy & Safety" },
];

function getActionMeta(action: string, bucket: ActivityBucket) {
  if (action.includes("login")) {
    return { icon: LogIn, color: "#1A6B3C", bg: "#E8F5E9" };
  }
  if (action.includes("password")) {
    return { icon: KeyRound, color: "#D97706", bg: "#FEF3C7" };
  }
  if (action.includes("blocked")) {
    return { icon: UserX, color: "#DC2626", bg: "#FEE2E2" };
  }
  if (action.includes("comment")) {
    return { icon: MessageSquare, color: "#2563EB", bg: "#DBEAFE" };
  }
  if (action.includes("reaction") || action.includes("like")) {
    return { icon: Heart, color: "#E11D48", bg: "#FFE4E6" };
  }
  if (action.includes("ally") || action.includes("connected") || action.includes("follow")) {
    return { icon: UserPlus, color: "#0D9488", bg: "#CCFBF1" };
  }
  if (action.includes("unfollow") || action.includes("removed")) {
    return { icon: UserMinus, color: "#6B7280", bg: "#F3F4F6" };
  }

  switch (bucket) {
    case "security":
      return { icon: ShieldCheck, color: "#D97706", bg: "#FEF3C7" };
    case "connections":
      return { icon: UserPlus, color: "#0D9488", bg: "#CCFBF1" };
    case "safety":
      return { icon: Shield, color: "#7C3AED", bg: "#EDE9FE" };
    default:
      return { icon: FileText, color: "#2563EB", bg: "#DBEAFE" };
  }
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ActivityLogScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [activeBucket, setActiveBucket] = useState<ActivityBucket | "all">("all");
  const [sections, setSections] = useState<SectionData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Modals & targets
  const [deleteTarget, setDeleteTarget] = useState<ActivityLogRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadLogs = useCallback(
    async (bucket: ActivityBucket | "all", cursor?: string, append = false) => {
      if (!accessToken) return;
      try {
        if (!append) setLoading(true);
        else setLoadingMore(true);

        const res = await listActivityLogs(accessToken, {
          bucket,
          cursor,
          limit: 20,
        });

        const newSections: SectionData[] = (res.groups || []).map((g: ActivityGroup) => ({
          title: g.dateLabel,
          data: g.items,
        }));

        if (append) {
          setSections((prev) => {
            const map = new Map<string, ActivityLogRow[]>();
            prev.forEach((s) => map.set(s.title, [...s.data]));
            newSections.forEach((s) => {
              if (map.has(s.title)) {
                map.set(s.title, [...map.get(s.title)!, ...s.data]);
              } else {
                map.set(s.title, s.data);
              }
            });
            return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
          });
        } else {
          setSections(newSections);
        }

        setTotalCount(res.totalCount || 0);
        setNextCursor(res.nextCursor);
      } catch (err) {
        console.warn("Failed to load activity logs:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [accessToken]
  );

  useEffect(() => {
    loadLogs(activeBucket);
  }, [activeBucket, loadLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLogs(activeBucket);
    setRefreshing(false);
  }, [activeBucket, loadLogs]);

  const handleDeleteItem = async () => {
    if (!deleteTarget || !accessToken || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteActivityLog(deleteTarget.id, accessToken);
      setSections((prev) =>
        prev
          .map((sec) => ({
            ...sec,
            data: sec.data.filter((item) => item.id !== deleteTarget.id),
          }))
          .filter((sec) => sec.data.length > 0)
      );
      setTotalCount((c) => Math.max(0, c - 1));
      setDeleteTarget(null);
    } catch (err) {
      console.warn("Failed to delete activity item:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClearBucket = async () => {
    if (!accessToken || isClearing) return;
    setIsClearing(true);
    try {
      const bucketParam = activeBucket === "all" ? undefined : activeBucket;
      await clearActivityLogs(accessToken, bucketParam);
      setSections([]);
      setTotalCount(0);
      setNextCursor(undefined);
      setShowClearConfirm(false);
    } catch (err) {
      console.warn("Failed to clear activity logs:", err);
    } finally {
      setIsClearing(false);
    }
  };

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
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <ArrowLeft size={22} color="#111827" />
          </Pressable>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  fontFamily: "Fraunces_700Bold",
                  fontSize: 18,
                  color: "#111827",
                }}
              >
                Activity Log
              </Text>
              <View
                style={{
                  backgroundColor: "#E8F5E9",
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: "PlusJakartaSans_700Bold",
                    fontSize: 10,
                    color: "#1A6B3C",
                  }}
                >
                  {totalCount}
                </Text>
              </View>
            </View>
            <Text
              style={{
                fontFamily: "PlusJakartaSans_500Medium",
                fontSize: 11,
                color: "#6B7280",
                marginTop: 1,
              }}
            >
              Your history, logins & interactions
            </Text>
          </View>
        </View>

        {totalCount > 0 && (
          <Pressable
            onPress={() => setShowClearConfirm(true)}
            hitSlop={8}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: "#FEE2E2",
            }}
          >
            <Text
              style={{
                fontFamily: "PlusJakartaSans_600SemiBold",
                fontSize: 11,
                color: "#DC2626",
              }}
            >
              Clear
            </Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View
        style={{
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#EAE7E1",
          paddingVertical: 10,
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {BUCKET_FILTERS.map((tab) => {
            const isActive = activeBucket === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveBucket(tab.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: isActive ? "#1A6B3C" : "#F3F4F6",
                }}
              >
                <Text
                  style={{
                    fontFamily: "PlusJakartaSans_600SemiBold",
                    fontSize: 12,
                    color: isActive ? "#FFFFFF" : "#4B5563",
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Body List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#1A6B3C" />
          <Text
            style={{
              fontFamily: "PlusJakartaSans_500Medium",
              fontSize: 12,
              color: "#6B7280",
              marginTop: 10,
            }}
          >
            Loading activity history...
          </Text>
        </View>
      ) : sections.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: "#EDEBE6",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 12,
            }}
          >
            <History size={26} color="#9CA3AF" />
          </View>
          <Text
            style={{
              fontFamily: "Fraunces_700Bold",
              fontSize: 16,
              color: "#1F2937",
              textAlign: "center",
            }}
          >
            No activity found
          </Text>
          <Text
            style={{
              fontFamily: "PlusJakartaSans_400Regular",
              fontSize: 12,
              color: "#6B7280",
              textAlign: "center",
              marginTop: 4,
              maxWidth: 240,
            }}
          >
            Actions taken in this category will be recorded here for your personal reference.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1A6B3C"
            />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderSectionHeader={({ section: { title } }) => (
            <View
              style={{
                backgroundColor: "#F7F4EF",
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces_700Bold",
                  fontSize: 12,
                  color: "#4B5563",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const { icon: ActionIcon, color, bg } = getActionMeta(item.action, item.bucket);
            const isMobile = item.device_info?.toLowerCase().includes("mobile");

            return (
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  marginHorizontal: 16,
                  marginBottom: 8,
                  borderRadius: 14,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: "#EAE7E1",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: bg,
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 2,
                    }}
                  >
                    <ActionIcon size={18} color={color} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans_700Bold",
                          fontSize: 13,
                          color: "#111827",
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans_400Regular",
                          fontSize: 10,
                          color: "#9CA3AF",
                          marginLeft: 6,
                        }}
                      >
                        {formatTime(item.created_at)}
                      </Text>
                    </View>

                    {item.summary ? (
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans_400Regular",
                          fontSize: 12,
                          color: "#4B5563",
                          marginTop: 2,
                        }}
                        numberOfLines={2}
                      >
                        {item.summary}
                      </Text>
                    ) : null}

                    {/* Audit trail device pill */}
                    {item.device_info ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 6,
                          alignSelf: "flex-start",
                          backgroundColor: "#F3F4F6",
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 6,
                        }}
                      >
                        {isMobile ? (
                          <Smartphone size={10} color="#6B7280" />
                        ) : (
                          <Laptop size={10} color="#6B7280" />
                        )}
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans_500Medium",
                            fontSize: 10,
                            color: "#6B7280",
                          }}
                        >
                          {item.device_info}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <Pressable
                  onPress={() => setDeleteTarget(item)}
                  hitSlop={10}
                  style={{
                    padding: 6,
                    marginLeft: 6,
                  }}
                >
                  <Trash2 size={14} color="#9CA3AF" />
                </Pressable>
              </View>
            );
          }}
          ListFooterComponent={
            nextCursor ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <Pressable
                  onPress={() => loadLogs(activeBucket, nextCursor, true)}
                  disabled={loadingMore}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: "#E8F5E9",
                  }}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#1A6B3C" />
                  ) : (
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans_700Bold",
                        fontSize: 12,
                        color: "#1A6B3C",
                      }}
                    >
                      Load older activities
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : null
          }
        />
      )}

      {/* Delete Item Confirm Modal */}
      <ConfirmModal
        visible={Boolean(deleteTarget)}
        title="Delete Activity Record?"
        description="This activity record will be removed from your activity log. This action cannot be undone."
        confirmLabel={isDeleting ? "Deleting..." : "Delete Record"}
        cancelLabel="Cancel"
        destructive
        onConfirm={handleDeleteItem}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Clear Bucket Confirm Modal */}
      <ConfirmModal
        visible={showClearConfirm}
        title="Clear Activity Log?"
        description={`Are you sure you want to clear activities for ${
          activeBucket === "all" ? "all categories" : activeBucket
        }? This cannot be undone.`}
        confirmLabel={isClearing ? "Clearing..." : "Clear Log"}
        cancelLabel="Cancel"
        destructive
        onConfirm={handleClearBucket}
        onCancel={() => setShowClearConfirm(false)}
      />
    </View>
  );
}
