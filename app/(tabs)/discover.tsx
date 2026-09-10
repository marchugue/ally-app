import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  Animated,
  Easing,
} from "react-native";
import {
  Search,
  X,
  UserPlus,
  Check,
  Clock,
  Compass,
  UserCheck,
  SlidersHorizontal,
  Drama,
  Sparkles,
  MessageCircle,
  Building2,
  GraduationCap,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { UserAvatar } from "@/components/UserAvatar";
import { EmptyState } from "@/components/EmptyState";
import { MatchmakingOverlayModal } from "@/components/MatchmakingOverlayModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { listProfiles, getMyProfile } from "@/lib/api/profiles";
import {
  listInteractions,
  requestConnection,
  rejectConnection,
} from "@/lib/api/interaction";
import {
  getMatchmakingStatus,
  joinMatchmakingQueue,
  leaveMatchmakingQueue,
} from "@/lib/api/matchmaking";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import type { Profile, ProfileSummary } from "@/types/profile";

type ConnectionStatus = "none" | "pending" | "accepted";
type FilterTab = "all" | "suggested" | "allies";
type SortOption = "match" | "newest" | "name";

interface StudentMatchCard {
  profile: ProfileSummary & {
    bio?: string | null;
    department?: string | null;
    year_level?: string | null;
    interests?: string[];
    organizations?: string[];
  };
  matchPercentage: number;
  sharedInterests: string[];
}

const DEPARTMENTS = [
  "College of Computer Studies",
  "College of Engineering",
  "College of Industrial Technology",
  "College of Business & Management",
  "College of Education",
];

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function ShinyFindMatchButton({
  onPress,
  remainingCount,
}: {
  onPress: () => void;
  remainingCount: number;
}) {
  const shineAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    ).start();
  }, []);

  const translateX = shineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 160],
  });

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: "#FFC107",
        paddingHorizontal: 18,
        height: 50,
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: "#F59E0B",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        shadowColor: "#FFC107",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
        position: "relative",
      }}
    >
      {/* Slanted 45 Deg Low-Opacity White Rectangle Shine (Strictly Clipped Inside Button) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -25,
          bottom: -25,
          width: 36,
          backgroundColor: "rgba(255, 255, 255, 0.45)",
          transform: [{ translateX }, { rotate: "45deg" }],
        }}
      />

      <Text style={{ fontSize: 13, fontWeight: "900", color: "#451A03", letterSpacing: -0.2 }}>
        Find Match
      </Text>
      <Text style={{ fontSize: 9, color: "#78350F", marginTop: 0, fontWeight: "800" }}>
        {remainingCount} left today
      </Text>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();

  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [passedUsers, setPassedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Matchmaking State (Powered by real backend Socket.IO & REST)
  const matchmaking = useMatchmaking();
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("match");

  // Selected Student Detail Modal
  const [selectedMatch, setSelectedMatch] = useState<StudentMatchCard | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken || !user) return;
    try {
      const [myProfile, profiles, interactions] = await Promise.all([
        getMyProfile(accessToken).catch(() => null),
        listProfiles(accessToken, user.id),
        listInteractions(accessToken).catch(() => []),
      ]);

      setCurrentUserProfile(myProfile);

      const connMap: Record<string, ConnectionStatus> = {};
      (interactions ?? []).forEach((r: any) => {
        if (r.target_user_id) connMap[r.target_user_id] = r.status;
        if (r.user_id && r.user_id !== user.id) connMap[r.user_id] = r.status;
      });

      setConnections(connMap);
      setPeople((profiles || []).filter((p: any) => p.id !== user.id));
    } catch (err) {
      console.warn("Failed to load discover data", err);
    }
  }, [accessToken, user]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadData();
      setLoading(false);
    }
    init();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), matchmaking.refreshStatus()]);
    setRefreshing(false);
  }, [loadData, matchmaking]);

  // Matchmaking Queue Handler
  const handleToggleMatchQueue = async () => {
    if (matchmaking.dailyMatchCount >= matchmaking.dailyLimit) {
      Alert.alert(
        "Daily Limit Reached",
        `You have reached your ${matchmaking.dailyLimit} daily anonymous matches.`
      );
      return;
    }
    setShowMatchOverlay(true);
    if (matchmaking.phase === "idle" || matchmaking.phase === "ended") {
      matchmaking.joinQueue();
    }
  };

  // Connection Request Handler
  const handleConnect = useCallback(
    async (targetId: string) => {
      if (
        !accessToken ||
        connections[targetId] === "pending" ||
        connections[targetId] === "accepted"
      )
        return;

      setConnections((prev) => ({ ...prev, [targetId]: "pending" }));
      try {
        await requestConnection(targetId, accessToken);
      } catch {
        setConnections((prev) => ({ ...prev, [targetId]: "none" }));
      }
    },
    [accessToken, connections]
  );

  // Pass User Handler
  const handlePassUser = useCallback((targetId: string) => {
    setPassedUsers((prev) => new Set(prev).add(targetId));
  }, []);

  // Navigate to Message Chat
  const handleMessageUser = useCallback((targetUserId: string) => {
    router.push({
      pathname: "/(tabs)/messages",
      params: { targetUserId },
    } as any);
  }, []);

  const handleNavigateProfile = (targetUserId: string) => {
    router.push({
      pathname: "/pages/user-profile",
      params: { userId: targetUserId },
    } as any);
  };

  // Calculate Match Score & Filtered People List
  const computedMatches = useMemo(() => {
    const myInterests = new Set(currentUserProfile?.interests || []);

    return people
      .filter((p) => !passedUsers.has(p.id))
      .map((p) => {
        const theirInterests = p.interests || [];
        const shared = theirInterests.filter((i: string) => myInterests.has(i));
        
        let score = 50; // base score
        if (myInterests.size > 0) {
          score += Math.round((shared.length / Math.max(myInterests.size, 1)) * 40);
        }
        if (p.course && currentUserProfile?.course && p.course === currentUserProfile.course) {
          score += 10;
        }
        const matchPercentage = Math.min(99, Math.max(60, score));

        return {
          profile: p,
          matchPercentage,
          sharedInterests: shared,
        } as StudentMatchCard;
      })
      .filter((m) => {
        const p = m.profile;
        const status = connections[p.id] || "none";

        if (activeTab === "suggested" && status !== "none") return false;
        if (activeTab === "allies" && status !== "accepted") return false;

        if (selectedDept && p.department !== selectedDept) return false;
        if (selectedYear && p.year_level !== selectedYear) return false;

        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase().trim();
          return (
            p.full_name?.toLowerCase().includes(q) ||
            p.username?.toLowerCase().includes(q) ||
            p.course?.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "match") return b.matchPercentage - a.matchPercentage;
        if (sortBy === "newest") return (b.profile.id || "").localeCompare(a.profile.id || "");
        return (a.profile.full_name || "").localeCompare(b.profile.full_name || "");
      });
  }, [people, passedUsers, currentUserProfile, connections, activeTab, selectedDept, selectedYear, searchQuery, sortBy]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#F9FAFB", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#1A6B3C" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB", paddingTop: insets.top }}>
      {/* ═══ Anonymous Match Full-Bleed Top Card ═══ */}
      <Pressable
        onPress={handleToggleMatchQueue}
        style={{
          backgroundColor: "#1A6B3C",
          borderBottomLeftRadius: 28,
          borderBottomRightRadius: 28,
          paddingHorizontal: 20,
          paddingVertical: 24,
          minHeight: 104,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          shadowColor: "#1A6B3C",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Drama size={26} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: "#FFFFFF" }}>
              Anonymous Match
            </Text>
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
              Connect with compatible CHMSU students
            </Text>
          </View>
        </View>

        <ShinyFindMatchButton
          onPress={handleToggleMatchQueue}
          remainingCount={Math.max(0, matchmaking.dailyLimit - matchmaking.dailyMatchCount)}
        />
      </Pressable>

      {/* ═══ Search & Filters Header ═══ */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {/* Search Box */}
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFFFFF",
              borderRadius: 14,
              paddingHorizontal: 12,
              height: 44,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name, username, course..."
              placeholderTextColor="#9CA3AF"
              style={{
                flex: 1,
                fontSize: 14,
                color: "#111827",
                height: "100%",
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <X size={16} color="#9CA3AF" />
              </Pressable>
            )}
          </View>

          {/* Filter Modal Toggle Button */}
          <Pressable
            onPress={() => setShowFilterModal(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: selectedDept || selectedYear ? "#1A6B3C" : "#FFFFFF",
              borderWidth: 1,
              borderColor: selectedDept || selectedYear ? "#1A6B3C" : "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlidersHorizontal size={18} color={selectedDept || selectedYear ? "#FFFFFF" : "#4B5563"} />
          </Pressable>
        </View>

        {/* Tab Pills */}
        <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
          <Pressable
            onPress={() => setActiveTab("all")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: activeTab === "all" ? "#1A6B3C" : "#FFFFFF",
              borderWidth: 1,
              borderColor: activeTab === "all" ? "#1A6B3C" : "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: activeTab === "all" ? "#FFFFFF" : "#4B5563",
              }}
            >
              All Matches ({computedMatches.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("suggested")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: activeTab === "suggested" ? "#1A6B3C" : "#FFFFFF",
              borderWidth: 1,
              borderColor: activeTab === "suggested" ? "#1A6B3C" : "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: activeTab === "suggested" ? "#FFFFFF" : "#4B5563",
              }}
            >
              Suggested
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("allies")}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 16,
              backgroundColor: activeTab === "allies" ? "#1A6B3C" : "#FFFFFF",
              borderWidth: 1,
              borderColor: activeTab === "allies" ? "#1A6B3C" : "#E5E7EB",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: activeTab === "allies" ? "#FFFFFF" : "#4B5563",
              }}
            >
              My Allies
            </Text>
          </Pressable>
        </View>
      </View>

      {/* ═══ Discover Cards List ═══ */}
      <FlatList
        data={computedMatches}
        keyExtractor={(item) => item.profile.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
          />
        }
        contentContainerStyle={
          computedMatches.length === 0
            ? { flex: 1, paddingHorizontal: 16 }
            : { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 6 }
        }
        renderItem={({ item }) => {
          const p = item.profile;
          const status = connections[p.id] || "none";

          return (
            <Pressable
              onPress={() => setSelectedMatch(item)}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#F3F4F6",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.03,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              {/* Card Header Region with Match Badge */}
              <View
                style={{
                  backgroundColor: "rgba(26,107,60,0.04)",
                  padding: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: "#F9FAFB",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Pressable
                    onPress={() => handleNavigateProfile(p.id)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
                  >
                    <UserAvatar avatar={p.avatar_url} size="lg" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
                        {p.full_name || `@${p.username}`}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                        @{p.username}
                      </Text>
                    </View>
                  </Pressable>

                  {/* Match Percentage Badge */}
                  <View
                    style={{
                      backgroundColor: "#F0FDF4",
                      borderWidth: 1,
                      borderColor: "#86EFAC",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#16A34A" }}>
                      {item.matchPercentage}% Match
                    </Text>
                  </View>
                </View>

                {/* Course & Year Tag */}
                {Boolean(p.course) && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "#1A6B3C",
                        backgroundColor: "#FFFFFF",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                      }}
                      numberOfLines={1}
                    >
                      {p.course}
                    </Text>
                  </View>
                )}
              </View>

              {/* Shared Interests Pills */}
              {item.sharedInterests.length > 0 && (
                <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 6 }}>
                    {item.sharedInterests.length} shared interest{item.sharedInterests.length > 1 ? "s" : ""}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {item.sharedInterests.slice(0, 3).map((interest) => (
                      <View
                        key={interest}
                        style={{
                          backgroundColor: "#F3F4F6",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: "#374151", fontWeight: "500" }}>
                          {interest}
                        </Text>
                      </View>
                    ))}
                    {item.sharedInterests.length > 3 && (
                      <Text style={{ fontSize: 11, color: "#9CA3AF", alignSelf: "center" }}>
                        +{item.sharedInterests.length - 3} more
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Card Action Buttons (Pass, Connect, Message) */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  gap: 8,
                  borderTopWidth: 1,
                  borderTopColor: "#F3F4F6",
                }}
              >
                {status === "none" && (
                  <Pressable
                    onPress={() => handlePassUser(p.id)}
                    style={{
                      flex: 1,
                      backgroundColor: "#F3F4F6",
                      paddingVertical: 9,
                      borderRadius: 10,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 4,
                    }}
                  >
                    <X size={14} color="#6B7280" />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280" }}>Pass</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => handleConnect(p.id)}
                  disabled={status === "accepted" || status === "pending"}
                  style={{
                    flex: 2,
                    backgroundColor:
                      status === "accepted"
                        ? "#F0FDF4"
                        : status === "pending"
                        ? "#FEF3C7"
                        : "#1A6B3C",
                    paddingVertical: 9,
                    borderRadius: 10,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                    borderWidth: status === "none" ? 0 : 1,
                    borderColor:
                      status === "accepted"
                        ? "#86EFAC"
                        : status === "pending"
                        ? "#FDE68A"
                        : "transparent",
                  }}
                >
                  {status === "accepted" ? (
                    <UserCheck size={14} color="#16A34A" />
                  ) : status === "pending" ? (
                    <Clock size={14} color="#D97706" />
                  ) : (
                    <UserPlus size={14} color="#FFFFFF" />
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color:
                        status === "accepted"
                          ? "#16A34A"
                          : status === "pending"
                          ? "#D97706"
                          : "#FFFFFF",
                    }}
                  >
                    {status === "none"
                      ? "Connect"
                      : status === "pending"
                      ? "Request Sent"
                      : "Connected"}
                  </Text>
                </Pressable>

                {status === "accepted" && (
                  <Pressable
                    onPress={() => handleMessageUser(p.id)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: "#F0FDF4",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: "#86EFAC",
                    }}
                  >
                    <MessageCircle size={16} color="#16A34A" />
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<Compass size={32} color="#1A6B3C" />}
            title={
              searchQuery
                ? "No matching students"
                : activeTab === "allies"
                ? "No Allies yet"
                : "No students found"
            }
            description={
              searchQuery
                ? `No student matching "${searchQuery}" was found.`
                : activeTab === "allies"
                ? "Connect with fellow students to build your campus network."
                : "Try expanding your filter parameters or check back later."
            }
          />
        }
      />

      {/* ═══ Filter Modal ═══ */}
      <Modal visible={showFilterModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>Filter & Sort</Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>

            {/* Department Filter */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Department</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <Pressable
                onPress={() => setSelectedDept("")}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: !selectedDept ? "#1A6B3C" : "#F3F4F6",
                  marginRight: 8,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: !selectedDept ? "#FFFFFF" : "#374151" }}>All Departments</Text>
              </Pressable>
              {DEPARTMENTS.map((dept) => (
                <Pressable
                  key={dept}
                  onPress={() => setSelectedDept(dept)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: selectedDept === dept ? "#1A6B3C" : "#F3F4F6",
                    marginRight: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selectedDept === dept ? "#FFFFFF" : "#374151" }}>{dept.replace("College of ", "")}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Year Level Filter */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Year Level</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <Pressable
                onPress={() => setSelectedYear("")}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  backgroundColor: !selectedYear ? "#1A6B3C" : "#F3F4F6",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: !selectedYear ? "#FFFFFF" : "#374151" }}>All Years</Text>
              </Pressable>
              {YEAR_LEVELS.map((yr) => (
                <Pressable
                  key={yr}
                  onPress={() => setSelectedYear(yr)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: selectedYear === yr ? "#1A6B3C" : "#F3F4F6",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: selectedYear === yr ? "#FFFFFF" : "#374151" }}>{yr}</Text>
                </Pressable>
              ))}
            </View>

            {/* Sort Option */}
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8 }}>Sort By</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
              {[
                { id: "match", label: "Highest Match %" },
                { id: "newest", label: "Newest Members" },
                { id: "name", label: "Name A-Z" },
              ].map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setSortBy(opt.id as SortOption)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: sortBy === opt.id ? "#1A6B3C" : "#F3F4F6",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: "700", color: sortBy === opt.id ? "#FFFFFF" : "#374151" }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setShowFilterModal(false)}
              style={{
                backgroundColor: "#1A6B3C",
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>Apply Filters</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ═══ Student Detail Bottom Sheet Modal ═══ */}
      {selectedMatch && (
        <Modal visible transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 24 }}>
              {/* Header Gradient Region */}
              <View style={{ backgroundColor: "#1A6B3C", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flexDirection: "row", gap: 14, flex: 1 }}>
                    <UserAvatar avatar={selectedMatch.profile.avatar_url} size="xl" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 20, fontWeight: "700", color: "#FFFFFF" }}>{selectedMatch.profile.full_name || `@${selectedMatch.profile.username}`}</Text>
                      <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>@{selectedMatch.profile.username}</Text>
                      {Boolean(selectedMatch.profile.course) && (
                        <Text style={{ fontSize: 12, color: "#FFFFFF", marginTop: 4, opacity: 0.9 }}>{selectedMatch.profile.course}</Text>
                      )}
                    </View>
                  </View>
                  <Pressable onPress={() => setSelectedMatch(null)}>
                    <X size={22} color="#FFFFFF" />
                  </Pressable>
                </View>

                {/* Compatibility Badge */}
                <View style={{ marginTop: 14, backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: "flex-start" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#FFFFFF" }}>⚡ {selectedMatch.matchPercentage}% Compatibility Match</Text>
                </View>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Shared Interests */}
                {selectedMatch.sharedInterests.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>
                      {selectedMatch.sharedInterests.length} Shared Interest{selectedMatch.sharedInterests.length > 1 ? "s" : ""}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {selectedMatch.sharedInterests.map((interest) => (
                        <View key={interest} style={{ backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#86EFAC", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: "600", color: "#16A34A" }}>{interest}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action Button */}
                <Pressable
                  onPress={() => {
                    handleConnect(selectedMatch.profile.id);
                    setSelectedMatch(null);
                  }}
                  style={{
                    backgroundColor: "#1A6B3C",
                    paddingVertical: 14,
                    borderRadius: 14,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  <UserPlus size={16} color="#FFFFFF" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>Send Connection Request</Text>
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* ═══ Matchmaking Fullscreen Queue Overlay Modal ═══ */}
      <MatchmakingOverlayModal
        visible={showMatchOverlay || matchmaking.phase === "searching" || matchmaking.phase === "pending"}
        onClose={() => setShowMatchOverlay(false)}
        matchmaking={matchmaking}
      />
    </View>
  );
}
