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
  Linking,
  Dimensions,
} from "react-native";
import {
  Search,
  SlidersHorizontal,
  MessageCircle,
  UserPlus,
  Check,
  Compass,
  X,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
} from "lucide-react-native";
import Svg, { Defs, LinearGradient as LinearGradientSvg, Stop, Path, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { usePresence } from "@/context/PresenceContext";
import { MatchmakingOverlayModal } from "@/components/MatchmakingOverlayModal";
import AlertMessage from "@/components/AlertMessage";
import { useAuth } from "@/lib/auth/AuthContext";
import { listProfiles, getMyProfile } from "@/lib/api/profiles";
import { listInteractions, requestConnection } from "@/lib/api/interaction";
import { getOrCreateConversationWithUser } from "@/lib/api/conversation";
import { getLookups } from "@/lib/api/lookups";
import {
  getMatchmakingStatus,
  MatchmakingPreferences,
} from "@/lib/api/matchmaking";
import { useMatchmaking } from "@/hooks/useMatchmaking";
import {
  getDeterministicAnonymousAvatar,
} from "@/constants/matchOptions";
import type { Profile } from "@/types/profile";

// ── Types ────────────────────────────────────────────────────────────────────
interface Student {
  id: string;
  name: string;
  username: string | null;
  email: string;
  course: string;
  yearLevel: string;
  department: string;
  bio: string;
  avatar: string;
  avatarKey?: string | null;
  avatarPresetId?: string | null;
  interests: string[];
  organizations: string[];
  isVerified: boolean;
  isAlly?: boolean;
}

interface MatchCard {
  student: Student;
  sharedInterests: string[];
  sharedOrgs: string[];
  matchPercentage: number;
  connectionStatus: "none" | "pending" | "accepted";
}

// ── Default Academic Fallbacks ───────────────────────────────────────────────
const DEFAULT_DEPARTMENTS = [
  "College of Computer Studies",
  "College of Education",
  "College of Industrial Technology",
  "College of Engineering",
];

const DEFAULT_COURSES_BY_DEPT: Record<string, string[]> = {
  "College of Computer Studies": ["Information Technology", "Information System"],
  "College of Education": ["Technical Vocational Teacher Education"],
  "College of Industrial Technology": [
    "Automotive",
    "Architectural Drafting",
    "Computer Technology",
    "Culinary",
    "Electrical",
    "Electronics",
    "Mechanical Technology",
  ],
  "College of Engineering": ["Computer Engineering", "Electronics Engineering"],
};

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// ── Tag Color Map ────────────────────────────────────────────────────────────
const INTEREST_COLOR_MAP: Record<string, string> = {
  Coding: "blue",
  "Web Design": "blue",
  "AI & ML": "blue",
  Cybersecurity: "blue",
  "Game Dev": "blue",
  Robotics: "blue",
  Photography: "pink",
  Drawing: "pink",
  Music: "pink",
  Dancing: "pink",
  Filmmaking: "pink",
  "Creative Writing": "pink",
  Hiking: "green",
  Environment: "green",
  Gardening: "green",
  Camping: "green",
  "Bird Watching": "green",
  Basketball: "orange",
  Volleyball: "orange",
  Swimming: "orange",
  Badminton: "orange",
  Football: "orange",
  Fitness: "orange",
  "Community Service": "purple",
  "Student Gov": "purple",
  Volunteering: "purple",
  Debate: "purple",
  "Public Speaking": "purple",
  Cooking: "amber",
  Reading: "amber",
  Travel: "amber",
  Anime: "amber",
  Gaming: "amber",
  Fashion: "amber",
};

const TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  pink: { bg: "#FDF2F8", text: "#BE185D", border: "#FBCFE8" },
  green: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" },
  orange: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  purple: { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF" },
  amber: { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  shared: { bg: "#ECFDF5", text: "#15803D", border: "#86EFAC" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function getAnonymousName(student: Student, avatarKey: string): string {
  if (student.name && student.name.toLowerCase().startsWith("anonymous")) {
    return student.name;
  }
  const key = avatarKey || "peer";
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
  return `Anonymous ${capitalized}`;
}

function calculateMatchPercentage(userA: Student, userB: Student): number {
  if (!userA || !userB) return 20;

  const aInterests = Array.isArray(userA.interests) ? userA.interests : [];
  const bInterests = Array.isArray(userB.interests) ? userB.interests : [];
  const aOrgs = Array.isArray(userA.organizations) ? userA.organizations : [];
  const bOrgs = Array.isArray(userB.organizations) ? userB.organizations : [];

  const sharedInterests = aInterests.filter((i) => bInterests.includes(i));
  const sharedOrgs = aOrgs.filter((o) => bOrgs.includes(o));

  const sameDept = Boolean(
    userA.department &&
      userB.department &&
      userA.department.toLowerCase() === userB.department.toLowerCase()
  );
  const sameCourse = Boolean(
    userA.course &&
      userB.course &&
      userA.course.toLowerCase() === userB.course.toLowerCase()
  );
  const sameYear = Boolean(
    userA.yearLevel &&
      userB.yearLevel &&
      userA.yearLevel.toLowerCase() === userB.yearLevel.toLowerCase()
  );

  const totalUnique = new Set([...aInterests, ...bInterests]).size;
  let interestScore = 0;
  if (totalUnique > 0 && sharedInterests.length > 0) {
    interestScore =
      (sharedInterests.length / totalUnique) * 45 +
      Math.min(sharedInterests.length * 3, 10);
  }

  let academicScore = 0;
  if (sameCourse) academicScore += 15;
  else if (sameDept) academicScore += 8;
  if (sameYear) academicScore += 5;

  const orgScore = Math.min(sharedOrgs.length * 5, 15);
  const baseScore = 15;

  const total = Math.round(baseScore + interestScore + academicScore + orgScore);
  return Math.min(Math.max(total, 15), 99);
}

function getMatchBadgeStyle(percentage: number, sharedCount: number) {
  let color = "gray";
  if (sharedCount >= 4 || percentage >= 80) color = "green";
  else if (sharedCount >= 2 || percentage >= 60) color = "orange";
  else if (sharedCount >= 1 || percentage >= 40) color = "yellow";

  const map: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    green: { bg: "#ECFDF5", text: "#166534", border: "#86EFAC", dot: "#22C55E" },
    orange: { bg: "#FFF7ED", text: "#9A3412", border: "#FED7AA", dot: "#F97316" },
    yellow: { bg: "#FEFCE8", text: "#854D0E", border: "#FEF08A", dot: "#EAB308" },
    gray: { bg: "#F3F4F6", text: "#4B5563", border: "#E5E7EB", dot: "#9CA3AF" },
  };
  return map[color] || map.gray;
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken } = useAuth();
  const { isOnline, gameOnlineCount } = usePresence();

  const [currentUser, setCurrentUser] = useState<Student | null>(null);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [coursesByDept, setCoursesByDept] = useState<Record<string, string[]>>(DEFAULT_COURSES_BY_DEPT);

  // Discover Directory & Filters state
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    department: "",
    course: "",
    yearLevel: "",
    sortBy: "all",
  });
  const [connections, setConnections] = useState<Record<string, "none" | "pending" | "accepted">>({});
  const [dismissedStudentIds, setDismissedStudentIds] = useState<Set<string>>(new Set());
  const [selectedCard, setSelectedCard] = useState<MatchCard | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "warning" | "info" } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<MatchCard[]>([]);

  // Selection Picker Modals for Filter Drawer
  const [pickerModal, setPickerModal] = useState<"department" | "course" | "year" | null>(null);

  // Matchmaking hook (Socket.IO + REST backend)
  const matchmaking = useMatchmaking();
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);

  // Auto-navigate to conversation room ONLY when a match is freshly connected
  useEffect(() => {
    if (matchmaking.roomReady?.conversationId) {
      const conversationId = matchmaking.roomReady.conversationId;
      matchmaking.clearRoomReady();
      setShowMatchOverlay(false);
      setToast({ message: "✨ Match Connected! Chatting with your anonymous ally.", type: "success" });
      router.push({
        pathname: "/pages/conversation" as any,
        params: { conversationId, id: conversationId },
      });
    }
  }, [matchmaking.roomReady]);

  // Load Lookup Options
  useEffect(() => {
    getLookups()
      .then((data) => {
        if (data.departments && data.departments.length > 0) {
          const deptNames = data.departments.map((d) => d.name).filter(Boolean);
          setDepartments(deptNames);

          const deptById = new Map(data.departments.map((d) => [d.id, d.name]));
          const nextCourses: Record<string, string[]> = {};
          (data.courses || []).forEach((c) => {
            const dName = deptById.get(c.department_id);
            if (!dName) return;
            if (!nextCourses[dName]) nextCourses[dName] = [];
            nextCourses[dName].push(c.name);
          });
          if (Object.keys(nextCourses).length > 0) {
            setCoursesByDept(nextCourses);
          }
        }
      })
      .catch(() => {
        // Fallback already pre-populated
      });
  }, []);

  // Main data loader
  const loadMatches = useCallback(async () => {
    if (!accessToken || !user) {
      setMatches([]);
      setIsLoading(false);
      return;
    }

    try {
      const [rawMyProfile, rawOthers, rawInteractions, matchStatus] = await Promise.all([
        getMyProfile(accessToken).catch(() => null),
        listProfiles(accessToken, user.id).catch(() => []),
        listInteractions(accessToken).catch(() => []),
        getMatchmakingStatus(accessToken).catch(() => null),
      ]);

      const myEmail = rawMyProfile?.email || user.email || "";
      const currentStudent: Student = {
        id: rawMyProfile?.id || user.id,
        name: rawMyProfile?.full_name || rawMyProfile?.username || "You",
        username: rawMyProfile?.username || null,
        email: myEmail,
        course: rawMyProfile?.course || "Unknown Course",
        yearLevel: rawMyProfile?.year_level || "Unknown Year",
        department: rawMyProfile?.department || "Unknown Department",
        bio: rawMyProfile?.bio || "",
        avatar: rawMyProfile?.avatar_url || "",
        avatarKey: rawMyProfile?.avatarKey || rawMyProfile?.avatar_preset_id || null,
        avatarPresetId: rawMyProfile?.avatar_preset_id || null,
        interests: rawMyProfile?.interests || [],
        organizations: rawMyProfile?.organizations || [],
        isVerified: myEmail.toLowerCase().endsWith("@chmsu.edu.ph"),
      };
      setCurrentUser(currentStudent);

      const connectionMap: Record<string, "none" | "pending" | "accepted"> = {};
      (rawInteractions ?? []).forEach((r: any) => {
        if (r.target_user_id) connectionMap[r.target_user_id] = r.status;
        if (r.user_id && r.user_id !== user.id) connectionMap[r.user_id] = r.status;
      });
      setConnections(connectionMap);

      const activePartnerIds = new Set<string>();
      (matchStatus?.activeMatches ?? []).forEach((m: any) => {
        const partnerId = m.user_a_id === user.id ? m.user_b_id : m.user_a_id;
        if (partnerId) activePartnerIds.add(partnerId);
      });

      const nonAllyNonMatchStudents: Student[] = (rawOthers as any[])
        .filter((p) => {
          if (p.id === user.id) return false;
          if (p.is_ally || p.isAlly) return false;
          if (connectionMap[p.id] === "accepted") return false;
          if (activePartnerIds.has(p.id)) return false;
          return true;
        })
        .map((p) => {
          const email = p.email || "";
          const avatarKey =
            p.avatarKey ||
            p.avatar_preset_id ||
            getDeterministicAnonymousAvatar(p.id);
          return {
            id: p.id,
            name: p.full_name || (p.username ? `@${p.username}` : "Student"),
            username: p.username || null,
            email,
            course: p.course || "Unknown Course",
            yearLevel: p.year_level || p.yearLevel || "Student",
            department: p.department || "Unknown Department",
            bio: p.bio || "",
            avatar: p.avatar_url || "",
            avatarKey,
            avatarPresetId: p.avatar_preset_id || avatarKey,
            interests: p.interests || [],
            organizations: p.organizations || [],
            isVerified: email.toLowerCase().endsWith("@chmsu.edu.ph"),
            isAlly: Boolean(p.is_ally || p.isAlly),
          };
        });

      const allMatches: MatchCard[] = nonAllyNonMatchStudents
        .map((student) => {
          const myInterests = currentStudent.interests || [];
          const studentInterests = student.interests || [];
          const sharedInterests = studentInterests.filter((i) => myInterests.includes(i));
          const sharedOrgs = (student.organizations || []).filter((o) =>
            (currentStudent.organizations || []).includes(o)
          );
          const matchPercentage = calculateMatchPercentage(currentStudent, student);
          return {
            student,
            sharedInterests,
            sharedOrgs,
            matchPercentage,
            connectionStatus: connectionMap[student.id] || "none",
          };
        })
        .sort((a, b) => b.matchPercentage - a.matchPercentage);

      setMatches(allMatches);
    } catch (err: any) {
      setBanner(err.message || "Failed to load discovery students.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadMatches(), matchmaking.refreshStatus()]);
    setRefreshing(false);
  }, [loadMatches, matchmaking]);

  // Available degree courses given active department filter
  const availableCourses = useMemo(() => {
    if (filters.department && coursesByDept?.[filters.department]) {
      return coursesByDept[filters.department];
    }
    return Array.from(new Set(Object.values(coursesByDept || {}).flat()));
  }, [filters.department, coursesByDept]);

  // Filter & Sort
  const filtered = useMemo(() => {
    return matches
      .filter((m) => {
        if (user && m.student.id === user.id) return false;
        if (m.student.isAlly) return false;
        if (connections[m.student.id] === "accepted") return false;
        if (dismissedStudentIds.has(m.student.id)) return false;

        const q = search.toLowerCase().trim();
        if (q) {
          const nameMatch = (m.student.name || "").toLowerCase().includes(q);
          const courseMatch = (m.student.course || "").toLowerCase().includes(q);
          const deptMatch = (m.student.department || "").toLowerCase().includes(q);
          const interestMatch = (m.student.interests || []).some((i) =>
            i.toLowerCase().includes(q)
          );
          if (!nameMatch && !courseMatch && !deptMatch && !interestMatch) return false;
        }

        if (filters.department && m.student.department !== filters.department) {
          return false;
        }

        if (filters.course && m.student.course !== filters.course) {
          return false;
        }

        if (filters.yearLevel && m.student.yearLevel !== filters.yearLevel) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === "popular") {
          const popA = (a.student as any).followersCount ?? (a.student as any).followers_count ?? 0;
          const popB = (b.student as any).followersCount ?? (b.student as any).followers_count ?? 0;
          return popB - popA;
        }
        if (filters.sortBy === "newest") return b.student.id.localeCompare(a.student.id);
        if (filters.sortBy === "name") return (a.student.name || "").localeCompare(b.student.name || "");
        // Default: prioritize highest compatibility match percentage
        return b.matchPercentage - a.matchPercentage;
      });
  }, [matches, connections, search, filters, user, dismissedStudentIds]);

  // Connection Handler
  const handleConnect = async (studentId: string) => {
    if (connections[studentId] && connections[studentId] !== "none") return;
    setConnections((prev) => ({ ...prev, [studentId]: "pending" }));

    try {
      if (accessToken) {
        await requestConnection(studentId, accessToken);
        setToast({ message: "Connection request sent!", type: "success" });
      }
    } catch (err: any) {
      setConnections((prev) => ({ ...prev, [studentId]: "none" }));
      setToast({ message: err.message || "Failed to send request", type: "error" });
    }
  };

  // Message Handler
  const handleMessage = async (studentId: string) => {
    if (!accessToken) {
      router.push("/(tabs)/messages" as any);
      return;
    }

    try {
      const res = await getOrCreateConversationWithUser(studentId, accessToken);
      if (res?.conversationId) {
        router.push({
          pathname: "/pages/conversation" as any,
          params: { conversationId: res.conversationId, id: res.conversationId },
        });
      } else {
        router.push("/(tabs)/messages" as any);
      }
    } catch (err: any) {
      setToast({ message: err.message || "Could not start conversation", type: "error" });
    }
  };

  // Anonymous Matchmaking Queue Trigger
  const DAILY_LIMIT = matchmaking.dailyLimit || 5;
  const isInQueue = matchmaking.phase === "searching" || matchmaking.phase === "pending";
  const canMatch = matchmaking.dailyMatchCount < DAILY_LIMIT && !isInQueue;

  const handleFindMatch = async () => {
    if (!user || !accessToken) {
      Alert.alert("Sign In Required", "Please sign in to find a campus match.");
      return;
    }

    if (matchmaking.dailyMatchCount >= DAILY_LIMIT) {
      setToast({
        message: `Daily match quota reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Please try again tomorrow!`,
        type: "warning",
      });
      return;
    }

    if (!canMatch) return;

    setShowMatchOverlay(true);

    const preferences: MatchmakingPreferences = {
      department: filters.department || undefined,
      course: filters.course || undefined,
      strictCourse: Boolean(filters.course),
      matchType: "anonymous",
    };

    try {
      await matchmaking.joinQueue(preferences);
    } catch (err: any) {
      console.warn("Could not join matchmaking queue:", err);
    }
  };

  // Games Portal Trigger (Opens In-App WebView)
  const handleOpenGames = () => {
    router.push("/pages/game-portal" as any);
  };

  const activeFiltersCount =
    (filters.department ? 1 : 0) +
    (filters.course ? 1 : 0) +
    (filters.yearLevel ? 1 : 0) +
    (filters.sortBy !== "all" ? 1 : 0);
  const hasActiveFilter = activeFiltersCount > 0 || Boolean(search);

  const handleResetFilters = () => {
    setFilters({ department: "", course: "", yearLevel: "", sortBy: "all" });
    setSearch("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F4EF", paddingTop: insets.top }}>
      {/* Toast Alert */}
      {toast && (
        <AlertMessage
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(null)}
        />
      )}

      {/* ═══ Header Title Bar ═══ */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <Text
            style={{
              fontFamily: "Fraunces-Bold",
              fontSize: 26,
              fontWeight: "700",
              color: "#111827",
              letterSpacing: -0.5,
            }}
          >
            Discover
          </Text>
          <Text
            style={{
              fontFamily: "PlusJakartaSans",
              fontSize: 12,
              color: "#6B7280",
              marginTop: 1,
            }}
          >
            Connect with verified CHMSU peers
          </Text>
        </View>

        <Pressable
          onPress={onRefresh}
          hitSlop={8}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <RotateCcw size={16} color="#6B7280" />
        </Pressable>
      </View>

      {/* ═══ Main Scrollable Feed List ═══ */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.student.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B3C"
            colors={["#1A6B3C"]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 32,
          paddingTop: 8,
        }}
        ListHeaderComponent={
          <View style={{ marginBottom: 14 }}>
            {/* Banner Notice */}
            {banner && (
              <View
                style={{
                  marginBottom: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#FDE68A",
                  backgroundColor: "#FFFBEB",
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text
                  style={{
                    fontFamily: "PlusJakartaSans",
                    fontSize: 12,
                    color: "#92400E",
                    flex: 1,
                    marginRight: 8,
                  }}
                >
                  {banner}
                </Text>
                <Pressable onPress={() => setBanner(null)} hitSlop={8}>
                  <X size={15} color="#B45309" />
                </Pressable>
              </View>
            )}

            {/* ═══ Top Quick Action Cards: Anonymous & Games ═══ */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              {/* Card 1: Anonymous */}
              <Pressable
                onPress={isInQueue ? () => void matchmaking.leaveQueue() : handleFindMatch}
                disabled={!canMatch && !isInQueue}
                style={{
                  flex: 1,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: isInQueue ? "rgba(245, 158, 11, 0.5)" : "rgba(16, 185, 129, 0.35)",
                  backgroundColor: "#FFFFFF",
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                }}
              >
                <LinearGradient
                  colors={
                    isInQueue
                      ? ["rgba(245, 158, 11, 0.25)", "rgba(217, 119, 6, 0.25)", "rgba(234, 179, 8, 0.25)"]
                      : ["rgba(26, 107, 60, 0.25)", "rgba(16, 185, 129, 0.25)", "rgba(56, 193, 133, 0.20)"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 22,
                    paddingHorizontal: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Icon */}
                  {isInQueue ? (
                    <ActivityIndicator color="#D97706" size="large" style={{ marginBottom: 10, height: 40 }} />
                  ) : (
                    <View style={{ marginBottom: 10 }}>
                      <Svg width={40} height={40} viewBox="0 0 24 24">
                        <Defs>
                          <LinearGradientSvg id="anon-grad" x1="0" y1="0" x2="1" y2="1">
                            <Stop offset="0" stopColor="#38C185" />
                            <Stop offset="1" stopColor="#1A6B3C" />
                          </LinearGradientSvg>
                        </Defs>
                        <Path
                          d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
                          fill="url(#anon-grad)"
                        />
                        <Circle cx="8" cy="10" r="1.25" fill="#FFFFFF" fillOpacity="0.9" />
                        <Circle cx="12" cy="10" r="1.25" fill="#FFFFFF" fillOpacity="0.9" />
                        <Circle cx="16" cy="10" r="1.25" fill="#FFFFFF" fillOpacity="0.9" />
                      </Svg>
                    </View>
                  )}

                  {/* Title */}
                  <Text
                    style={{
                      fontFamily: "Fraunces-Bold",
                      fontSize: 18,
                      fontWeight: "700",
                      color: "#111827",
                      textAlign: "center",
                    }}
                  >
                    {isInQueue ? "Searching..." : "Anonymous"}
                  </Text>

                  {/* Attempts */}
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 11,
                      fontWeight: "600",
                      color: isInQueue ? "#92400E" : "#065F46",
                      marginTop: 4,
                      textAlign: "center",
                    }}
                  >
                    {isInQueue
                      ? "Peer search · Cancel"
                      : `${Math.max(0, DAILY_LIMIT - matchmaking.dailyMatchCount)} attempts left`}
                  </Text>
                </LinearGradient>
              </Pressable>

              {/* Card 2: Games */}
              <Pressable
                onPress={handleOpenGames}
                style={{
                  flex: 1,
                  borderRadius: 24,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: "rgba(245, 158, 11, 0.35)",
                  backgroundColor: "#FFFFFF",
                  elevation: 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                }}
              >
                <LinearGradient
                  colors={["rgba(232, 168, 56, 0.25)", "rgba(245, 158, 11, 0.25)", "rgba(240, 178, 71, 0.20)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 22,
                    paddingHorizontal: 12,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* Gamepad Icon */}
                  <View style={{ marginBottom: 10 }}>
                    <Svg width={40} height={40} viewBox="0 0 24 24">
                      <Defs>
                        <LinearGradientSvg id="game-grad" x1="0" y1="0" x2="1" y2="1">
                          <Stop offset="0" stopColor="#FBBF24" />
                          <Stop offset="0.5" stopColor="#F59E0B" />
                          <Stop offset="1" stopColor="#EA580C" />
                        </LinearGradientSvg>
                      </Defs>
                      <Path
                        d="M7 6H17C19.2 6 21 7.8 21 10V14C21 17.3 18.3 20 15 20C13.8 20 12.7 19.5 12 18.7C11.3 19.5 10.2 20 9 20C5.7 20 3 17.3 3 14V10C3 7.8 4.8 6 7 6Z"
                        fill="url(#game-grad)"
                      />
                      <Path
                        d="M7 11V15M5 13H9"
                        stroke="#FFFFFF"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Circle cx="15.5" cy="11.5" r="1.1" fill="#FFFFFF" />
                      <Circle cx="18" cy="13.5" r="1.1" fill="#FFFFFF" />
                      <Circle cx="15.5" cy="15.5" r="1.1" fill="#FFFFFF" />
                      <Circle cx="13" cy="13.5" r="1.1" fill="#FFFFFF" />
                    </Svg>
                  </View>

                  {/* Title */}
                  <Text
                    style={{
                      fontFamily: "Fraunces-Bold",
                      fontSize: 18,
                      fontWeight: "700",
                      color: "#111827",
                      textAlign: "center",
                    }}
                  >
                    Games
                  </Text>

                  {/* Players Online */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 11,
                        fontWeight: "600",
                        color: "#92400E",
                      }}
                    >
                      {gameOnlineCount} {gameOnlineCount === 1 ? "player" : "players"} online
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>

            {/* ═══ Setup Profile Prompt (if user hasn't set interests) ═══ */}
            {!isLoading &&
              (!currentUser?.username || !currentUser?.interests || currentUser.interests.length === 0) && (
                <View
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: "rgba(16, 185, 129, 0.25)",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: "rgba(26, 107, 60, 0.1)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Compass size={22} color="#1A6B3C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: "Fraunces-Bold",
                          fontSize: 15,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                      >
                        Maximize your Match Accuracy 🎯
                      </Text>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 12,
                          color: "#6B7280",
                          marginTop: 2,
                        }}
                      >
                        Pick your passions and academic courses to find the highest-scoring peers!
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => router.push("/pages/edit-profile")}
                    style={{
                      marginTop: 12,
                      backgroundColor: "#1A6B3C",
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#FFFFFF",
                      }}
                    >
                      Setup Interests
                    </Text>
                    <ArrowRight size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              )}

            {/* ═══ Search & Controls Bar ═══ */}
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 14,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              {/* Search Row */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Search Input */}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: "#F9FAFB",
                    borderRadius: 14,
                    paddingHorizontal: 12,
                    height: 44,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                  }}
                >
                  <Search size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search students by name, course, interests..."
                    placeholderTextColor="#9CA3AF"
                    style={{
                      flex: 1,
                      fontFamily: "PlusJakartaSans",
                      fontSize: 13,
                      color: "#111827",
                      height: "100%",
                    }}
                  />
                  {search.length > 0 && (
                    <Pressable onPress={() => setSearch("")} hitSlop={8}>
                      <X size={15} color="#9CA3AF" />
                    </Pressable>
                  )}
                </View>

                {/* Filters Toggle Button */}
                <Pressable
                  onPress={() => setShowFilters(!showFilters)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 14,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: showFilters || activeFiltersCount > 0 ? "rgba(26, 107, 60, 0.1)" : "#F9FAFB",
                    borderWidth: 1,
                    borderColor: showFilters || activeFiltersCount > 0 ? "rgba(26, 107, 60, 0.4)" : "#E5E7EB",
                  }}
                >
                  <SlidersHorizontal
                    size={16}
                    color={showFilters || activeFiltersCount > 0 ? "#1A6B3C" : "#4B5563"}
                  />
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 12,
                      fontWeight: "700",
                      color: showFilters || activeFiltersCount > 0 ? "#1A6B3C" : "#4B5563",
                    }}
                  >
                    Filters
                  </Text>
                  {activeFiltersCount > 0 && (
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        backgroundColor: "#1A6B3C",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF" }}>
                        {activeFiltersCount}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>

              {/* Quick College Pills Bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingTop: 12 }}
              >
                {["All", ...departments].map((dept) => {
                  const val = dept === "All" ? "" : dept;
                  const isSel = filters.department === val;
                  const short = dept === "All" ? "All Colleges" : dept.replace("College of ", "");
                  const count =
                    dept === "All"
                      ? matches.length
                      : matches.filter((m) => m.student.department === dept).length;

                  return (
                    <Pressable
                      key={dept}
                      onPress={() => {
                        setFilters((prev) => ({
                          ...prev,
                          department: val,
                          course: val && coursesByDept?.[val]?.includes(prev.course) ? prev.course : "",
                        }));
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 20,
                        backgroundColor: isSel ? "#1A6B3C" : "#F3F4F6",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 12,
                          fontWeight: "600",
                          color: isSel ? "#FFFFFF" : "#4B5563",
                        }}
                      >
                        {short}
                      </Text>
                      <View
                        style={{
                          backgroundColor: isSel ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.06)",
                          paddingHorizontal: 6,
                          paddingVertical: 1,
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 10,
                            fontWeight: "800",
                            color: isSel ? "#FFFFFF" : "#6B7280",
                          }}
                        >
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Expanded Filters Section (College, Degree Course, Year Level) */}
              {showFilters && (
                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: "#F3F4F6",
                    gap: 10,
                  }}
                >
                  {/* Department Field */}
                  <View>
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      College / Department
                    </Text>
                    <Pressable
                      onPress={() => setPickerModal("department")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#F9FAFB",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 13,
                          color: filters.department ? "#111827" : "#6B7280",
                        }}
                        numberOfLines={1}
                      >
                        {filters.department
                          ? filters.department.replace("College of ", "")
                          : "All Colleges"}
                      </Text>
                      <ChevronDown size={16} color="#6B7280" />
                    </Pressable>
                  </View>

                  {/* Course Field */}
                  <View>
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Degree Course
                    </Text>
                    <Pressable
                      onPress={() => setPickerModal("course")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#F9FAFB",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 13,
                          color: filters.course ? "#111827" : "#6B7280",
                        }}
                        numberOfLines={1}
                      >
                        {filters.course || "All Degree Courses"}
                      </Text>
                      <ChevronDown size={16} color="#6B7280" />
                    </Pressable>
                  </View>

                  {/* Year Level Field */}
                  <View>
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      Year Level
                    </Text>
                    <Pressable
                      onPress={() => setPickerModal("year")}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: "#F9FAFB",
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "#E5E7EB",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 13,
                          color: filters.yearLevel ? "#111827" : "#6B7280",
                        }}
                        numberOfLines={1}
                      >
                        {filters.yearLevel || "All Year Levels"}
                      </Text>
                      <ChevronDown size={16} color="#6B7280" />
                    </Pressable>
                  </View>

                  {/* Sort By Filter */}
                  <View>
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 11,
                        fontWeight: "700",
                        color: "#6B7280",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Sort By
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {[
                        { id: "all", label: "Highest Match %" },
                        { id: "popular", label: "🔥 Popular" },
                        { id: "newest", label: "Newest" },
                        { id: "name", label: "Name A-Z" },
                      ].map((opt) => (
                        <Pressable
                          key={opt.id}
                          onPress={() => setFilters((prev) => ({ ...prev, sortBy: opt.id }))}
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            backgroundColor: filters.sortBy === opt.id ? "#1A6B3C" : "#F3F4F6",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "PlusJakartaSans",
                              fontSize: 11,
                              fontWeight: "700",
                              color: filters.sortBy === opt.id ? "#FFFFFF" : "#374151",
                            }}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Reset Filters Option */}
                  {hasActiveFilter && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 11,
                          color: "#9CA3AF",
                        }}
                      >
                        Active criteria applied.
                      </Text>
                      <Pressable
                        onPress={handleResetFilters}
                        style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                      >
                        <RotateCcw size={12} color="#1A6B3C" />
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 12,
                            fontWeight: "700",
                            color: "#1A6B3C",
                          }}
                        >
                          Reset filters
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const student = item.student;
          const status = connections[student.id] || "none";
          const effectiveAvatarKey =
            student.avatarKey ||
            student.avatarPresetId ||
            getDeterministicAnonymousAvatar(student.id);
          const anonName = getAnonymousName(student, effectiveAvatarKey);

          const interests = student.interests || [];
          const sortedInterests = [
            ...item.sharedInterests,
            ...interests.filter((i) => !item.sharedInterests.includes(i)),
          ];

          const firstInterest = sortedInterests[0];
          const isFirstLong = Boolean(firstInterest && firstInterest.length > 9);
          const canShowTwo =
            !isFirstLong &&
            sortedInterests.length >= 2 &&
            firstInterest.length + sortedInterests[1].length <= 16;
          const maxToShow = canShowTwo ? 2 : 1;
          const displayedInterests = sortedInterests.slice(0, maxToShow);
          const remainingCount = sortedInterests.length - maxToShow;

          const badgeStyle = getMatchBadgeStyle(item.matchPercentage, item.sharedInterests.length);

          return (
            <Pressable
              onPress={() => setSelectedCard(item)}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 20,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 3,
                elevation: 1,
              }}
            >
              {/* Top Row: Anonymous Avatar on Left, Match Badge & Dismiss X on Right */}
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                {/* Left: Avatar with Online indicator */}
                <View style={{ position: "relative" }}>
                  <AnonymousAvatar avatarKey={effectiveAvatarKey} size={52} />
                  {isOnline(student.id) && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: "#22C55E",
                        borderWidth: 2,
                        borderColor: "#FFFFFF",
                      }}
                    />
                  )}
                </View>

                {/* Right: Dismiss X Button */}
                <Pressable
                  onPress={() => {
                    setDismissedStudentIds((prev) => new Set([...prev, student.id]));
                    setToast({ message: `Dismissed ${anonName}`, type: "info" });
                  }}
                  hitSlop={8}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#F9FAFB",
                  }}
                >
                  <X size={15} color="#9CA3AF" />
                </Pressable>
              </View>

              {/* Middle: Anonymous Name & Academic Info */}
              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    fontFamily: "Fraunces-Bold",
                    fontSize: 16,
                    fontWeight: "700",
                    color: "#111827",
                  }}
                  numberOfLines={1}
                >
                  {anonName}
                </Text>
                <Text
                  style={{
                    fontFamily: "PlusJakartaSans",
                    fontSize: 12,
                    color: "#6B7280",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {student.course || student.department?.replace("College of ", "") || "CHMSU Student"}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <View
                    style={{
                      backgroundColor: "#F3F4F6",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 10,
                        fontWeight: "600",
                        color: "#374151",
                      }}
                    >
                      {student.yearLevel || "Student"}
                    </Text>
                  </View>
                  {Boolean(student.department) && (
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 11,
                        color: "#9CA3AF",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {student.department.replace("College of ", "")}
                    </Text>
                  )}
                </View>
              </View>

              {/* Interests Row (Single-line responsive) */}
              <View style={{ marginTop: 10, marginBottom: 12 }}>
                {interests.length === 0 ? (
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 11,
                      color: "#9CA3AF",
                      fontStyle: "italic",
                    }}
                  >
                    No interests listed
                  </Text>
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "nowrap" }}>
                    {displayedInterests.map((interest) => {
                      const isShared = item.sharedInterests.includes(interest);
                      const catColor = INTEREST_COLOR_MAP[interest] || "blue";
                      const tStyle = isShared ? TAG_STYLES.shared : (TAG_STYLES[catColor] || TAG_STYLES.blue);

                      return (
                        <View
                          key={interest}
                          style={{
                            backgroundColor: tStyle.bg,
                            borderWidth: 1,
                            borderColor: tStyle.border,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 3,
                            maxWidth: 130,
                          }}
                        >
                          {isShared && (
                            <Text style={{ fontSize: 10, color: "#15803D" }}>✦</Text>
                          )}
                          <Text
                            style={{
                              fontFamily: "PlusJakartaSans",
                              fontSize: 11,
                              fontWeight: "600",
                              color: tStyle.text,
                            }}
                            numberOfLines={1}
                          >
                            {interest}
                          </Text>
                        </View>
                      );
                    })}

                    {remainingCount > 0 && (
                      <View
                        style={{
                          backgroundColor: "#F3F4F6",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 10,
                            fontWeight: "700",
                            color: "#6B7280",
                          }}
                        >
                          +{remainingCount} more
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Bottom: Action Button */}
              {status === "accepted" ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      flex: 1,
                      backgroundColor: "rgba(26, 107, 60, 0.1)",
                      borderRadius: 12,
                      paddingVertical: 10,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Check size={14} color="#1A6B3C" strokeWidth={2.5} />
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#1A6B3C",
                      }}
                    >
                      Connected
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleMessage(student.id)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      backgroundColor: "#1A6B3C",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MessageCircle size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : status === "pending" ? (
                <View
                  style={{
                    backgroundColor: "#FEF3C7",
                    borderWidth: 1,
                    borderColor: "#FDE68A",
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#B45309",
                    }}
                  >
                    Request Sent
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleConnect(student.id)}
                  style={{
                    backgroundColor: "#1A6B3C",
                    borderRadius: 12,
                    paddingVertical: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    shadowColor: "#1A6B3C",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 1,
                  }}
                >
                  <UserPlus size={15} color="#FFFFFF" strokeWidth={2.2} />
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 13,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    Connect
                  </Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#1A6B3C" />
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 24,
                padding: 24,
                alignItems: "center",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                marginTop: 8,
              }}
            >
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(26, 107, 60, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Compass size={28} color="#1A6B3C" />
              </View>

              <Text
                style={{
                  fontFamily: "Fraunces-Bold",
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                No students match your filter
              </Text>
              <Text
                style={{
                  fontFamily: "PlusJakartaSans",
                  fontSize: 12,
                  color: "#6B7280",
                  textAlign: "center",
                  marginBottom: 16,
                  lineHeight: 18,
                }}
              >
                We couldn't find anyone matching your current search terms. Try clearing your filters or launch an anonymous match!
              </Text>

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {hasActiveFilter && (
                  <Pressable
                    onPress={handleResetFilters}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#E5E7EB",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RotateCcw size={14} color="#4B5563" />
                    <Text
                      style={{
                        fontFamily: "PlusJakartaSans",
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#4B5563",
                      }}
                    >
                      Clear Filters
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleFindMatch}
                  disabled={!canMatch}
                  style={{
                    backgroundColor: "#1A6B3C",
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Sparkles size={14} color="#FFFFFF" />
                  <Text
                    style={{
                      fontFamily: "PlusJakartaSans",
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    Pair Anonymously Now
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        }
      />

      {/* ═══ Profile Discovery Detail Modal ═══ */}
      {selectedCard && (() => {
        const student = selectedCard.student;
        const selectedAvatarKey =
          student.avatarKey ||
          student.avatarPresetId ||
          getDeterministicAnonymousAvatar(student.id);
        const selectedAnonName = getAnonymousName(student, selectedAvatarKey);
        const cardStatus = connections[student.id] || "none";

        return (
          <Modal visible transparent animationType="slide">
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
              <View
                style={{
                  backgroundColor: "#FFFFFF",
                  borderTopLeftRadius: 28,
                  borderTopRightRadius: 28,
                  maxHeight: "88%",
                  overflow: "hidden",
                }}
              >
                {/* Modal Header with Rich Forest Green Gradient */}
                <LinearGradient
                  colors={["#1A6B3C", "#14532D", "#0A331C"]}
                  style={{ padding: 20, position: "relative" }}
                >
                  <Pressable
                    onPress={() => setSelectedCard(null)}
                    hitSlop={8}
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: "rgba(255, 255, 255, 0.2)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={18} color="#FFFFFF" />
                  </Pressable>

                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14, paddingRight: 32 }}>
                    <View style={{ position: "relative" }}>
                      <AnonymousAvatar avatarKey={selectedAvatarKey} size={64} />
                      {isOnline(student.id) && (
                        <View
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: "#22C55E",
                            borderWidth: 2,
                            borderColor: "#FFFFFF",
                          }}
                        />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: "Fraunces-Bold",
                          fontSize: 20,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                        numberOfLines={1}
                      >
                        {selectedAnonName}
                      </Text>

                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 12,
                          color: "#D1FAE5",
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {student.course || student.department?.replace("College of ", "") || "CHMSU Student"}
                      </Text>

                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                        <View
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.2)",
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: 10,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "PlusJakartaSans",
                              fontSize: 11,
                              fontWeight: "600",
                              color: "#FFFFFF",
                            }}
                          >
                            {student.yearLevel || "Student"}
                          </Text>
                        </View>

                        {student.isVerified && (
                          <View
                            style={{
                              backgroundColor: "rgba(16, 185, 129, 0.25)",
                              borderWidth: 1,
                              borderColor: "rgba(16, 185, 129, 0.4)",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 10,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <ShieldCheck size={12} color="#6EE7B7" />
                            <Text
                              style={{
                                fontFamily: "PlusJakartaSans",
                                fontSize: 10,
                                fontWeight: "700",
                                color: "#D1FAE5",
                              }}
                            >
                              Verified CHMSU
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </LinearGradient>

                {/* Modal Body */}
                <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
                  {/* Match Compatibility Highlight */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      backgroundColor: "rgba(26, 107, 60, 0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(26, 107, 60, 0.15)",
                      borderRadius: 18,
                      padding: 16,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Sparkles size={14} color="#1A6B3C" />
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 13,
                            fontWeight: "700",
                            color: "#1A6B3C",
                          }}
                        >
                          Peer Compatibility
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 11,
                          color: "#6B7280",
                          marginTop: 3,
                        }}
                      >
                        {selectedCard.sharedInterests.length > 0
                          ? "Shared campus passions and college synergy"
                          : "Calculated from campus discovery preferences"}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={{
                          fontFamily: "Fraunces-Bold",
                          fontSize: 26,
                          fontWeight: "800",
                          color: "#1A6B3C",
                        }}
                      >
                        {selectedCard.matchPercentage}%
                      </Text>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 9,
                          fontWeight: "800",
                          color: "#9CA3AF",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}
                      >
                        Match
                      </Text>
                    </View>
                  </View>

                  {/* About / Bio */}
                  {Boolean(student.bio) && (
                    <View>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#9CA3AF",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        About
                      </Text>
                      <View
                        style={{
                          backgroundColor: "#F9FAFB",
                          padding: 14,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: "#E5E7EB",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 13,
                            color: "#374151",
                            fontStyle: "italic",
                            lineHeight: 18,
                          }}
                        >
                          "{student.bio}"
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Shared Interests */}
                  {selectedCard.sharedInterests.length > 0 && (
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Sparkles size={13} color="#1A6B3C" />
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#1A6B3C",
                            textTransform: "uppercase",
                          }}
                        >
                          {selectedCard.sharedInterests.length} Shared Interest
                          {selectedCard.sharedInterests.length > 1 ? "s" : ""}
                        </Text>
                      </View>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {selectedCard.sharedInterests.map((interest) => (
                          <View
                            key={interest}
                            style={{
                              backgroundColor: "#ECFDF5",
                              borderWidth: 1,
                              borderColor: "#86EFAC",
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 10,
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Text style={{ fontSize: 10, color: "#15803D" }}>✦</Text>
                            <Text
                              style={{
                                fontFamily: "PlusJakartaSans",
                                fontSize: 12,
                                fontWeight: "600",
                                color: "#15803D",
                              }}
                            >
                              {interest}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Other Passions */}
                  {student.interests &&
                    student.interests.filter((i) => !selectedCard.sharedInterests.includes(i)).length > 0 && (
                      <View>
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 11,
                            fontWeight: "700",
                            color: "#9CA3AF",
                            textTransform: "uppercase",
                            marginBottom: 8,
                          }}
                        >
                          Other Passions
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {student.interests
                            .filter((i) => !selectedCard.sharedInterests.includes(i))
                            .map((interest) => {
                              const catColor = INTEREST_COLOR_MAP[interest] || "blue";
                              const tStyle = TAG_STYLES[catColor] || TAG_STYLES.blue;
                              return (
                                <View
                                  key={interest}
                                  style={{
                                    backgroundColor: tStyle.bg,
                                    borderWidth: 1,
                                    borderColor: tStyle.border,
                                    paddingHorizontal: 10,
                                    paddingVertical: 5,
                                    borderRadius: 10,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: "PlusJakartaSans",
                                      fontSize: 12,
                                      fontWeight: "600",
                                      color: tStyle.text,
                                    }}
                                  >
                                    {interest}
                                  </Text>
                                </View>
                              );
                            })}
                        </View>
                      </View>
                    )}

                  {/* Student Organizations */}
                  {student.organizations && student.organizations.length > 0 && (
                    <View>
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 11,
                          fontWeight: "700",
                          color: "#9CA3AF",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Student Organizations
                      </Text>
                      <View style={{ gap: 6 }}>
                        {student.organizations.map((org) => {
                          const isSharedOrg = Boolean(currentUser?.organizations?.includes(org));
                          return (
                            <View
                              key={org}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                                paddingHorizontal: 12,
                                paddingVertical: 9,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: isSharedOrg ? "rgba(26, 107, 60, 0.25)" : "#E5E7EB",
                                backgroundColor: isSharedOrg ? "rgba(26, 107, 60, 0.08)" : "#F9FAFB",
                              }}
                            >
                              <Text style={{ fontSize: 13 }}>🏛️</Text>
                              <Text
                                style={{
                                  fontFamily: "PlusJakartaSans",
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: isSharedOrg ? "#1A6B3C" : "#374151",
                                  flex: 1,
                                }}
                                numberOfLines={1}
                              >
                                {org}
                              </Text>
                              {isSharedOrg && (
                                <View
                                  style={{
                                    backgroundColor: "rgba(26, 107, 60, 0.15)",
                                    paddingHorizontal: 6,
                                    paddingVertical: 2,
                                    borderRadius: 6,
                                  }}
                                >
                                  <Text
                                    style={{
                                      fontFamily: "PlusJakartaSans",
                                      fontSize: 9,
                                      fontWeight: "800",
                                      color: "#1A6B3C",
                                    }}
                                  >
                                    Shared Org!
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Footer */}
                <View
                  style={{
                    padding: 16,
                    borderTopWidth: 1,
                    borderTopColor: "#F3F4F6",
                    backgroundColor: "#FFFFFF",
                  }}
                >
                  {cardStatus === "none" && (
                    <Pressable
                      onPress={() => {
                        handleConnect(student.id);
                        setSelectedCard(null);
                      }}
                      style={{
                        backgroundColor: "#1A6B3C",
                        paddingVertical: 13,
                        borderRadius: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <UserPlus size={16} color="#FFFFFF" strokeWidth={2.2} />
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#FFFFFF",
                        }}
                      >
                        Connect With Student
                      </Text>
                    </Pressable>
                  )}

                  {cardStatus === "pending" && (
                    <View
                      style={{
                        backgroundColor: "#FEF3C7",
                        borderWidth: 1,
                        borderColor: "#FDE68A",
                        paddingVertical: 13,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#B45309",
                        }}
                      >
                        ⏳ Connection Request Pending
                      </Text>
                    </View>
                  )}

                  {cardStatus === "accepted" && (
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: "rgba(26, 107, 60, 0.1)",
                          paddingVertical: 13,
                          borderRadius: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Check size={16} color="#1A6B3C" strokeWidth={2.5} />
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#1A6B3C",
                          }}
                        >
                          Connected Ally
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => {
                          setSelectedCard(null);
                          handleMessage(student.id);
                        }}
                        style={{
                          backgroundColor: "#1A6B3C",
                          paddingVertical: 13,
                          paddingHorizontal: 20,
                          borderRadius: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <MessageCircle size={16} color="#FFFFFF" />
                        <Text
                          style={{
                            fontFamily: "PlusJakartaSans",
                            fontSize: 14,
                            fontWeight: "700",
                            color: "#FFFFFF",
                          }}
                        >
                          Chat
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        );
      })()}

      {/* ═══ Picker Selection Modal (for College, Course, Year) ═══ */}
      <Modal visible={pickerModal !== null} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "75%",
              padding: 20,
              paddingBottom: insets.bottom + 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: "Fraunces-Bold",
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#111827",
                }}
              >
                {pickerModal === "department"
                  ? "Select College"
                  : pickerModal === "course"
                  ? "Select Degree Course"
                  : "Select Year Level"}
              </Text>
              <Pressable onPress={() => setPickerModal(null)} hitSlop={8}>
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {/* Option "All" */}
              <Pressable
                onPress={() => {
                  if (pickerModal === "department") {
                    setFilters((prev) => ({ ...prev, department: "", course: "" }));
                  } else if (pickerModal === "course") {
                    setFilters((prev) => ({ ...prev, course: "" }));
                  } else if (pickerModal === "year") {
                    setFilters((prev) => ({ ...prev, yearLevel: "" }));
                  }
                  setPickerModal(null);
                }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  backgroundColor:
                    (pickerModal === "department" && !filters.department) ||
                    (pickerModal === "course" && !filters.course) ||
                    (pickerModal === "year" && !filters.yearLevel)
                      ? "#1A6B3C"
                      : "#F3F4F6",
                }}
              >
                <Text
                  style={{
                    fontFamily: "PlusJakartaSans",
                    fontSize: 13,
                    fontWeight: "600",
                    color:
                      (pickerModal === "department" && !filters.department) ||
                      (pickerModal === "course" && !filters.course) ||
                      (pickerModal === "year" && !filters.yearLevel)
                        ? "#FFFFFF"
                        : "#374151",
                  }}
                >
                  {pickerModal === "department"
                    ? "All Colleges"
                    : pickerModal === "course"
                    ? "All Degree Courses"
                    : "All Year Levels"}
                </Text>
              </Pressable>

              {/* Specific Options */}
              {pickerModal === "department" &&
                departments.map((dept) => {
                  const isSel = filters.department === dept;
                  return (
                    <Pressable
                      key={dept}
                      onPress={() => {
                        setFilters((prev) => ({
                          ...prev,
                          department: dept,
                          course: coursesByDept?.[dept]?.includes(prev.course) ? prev.course : "",
                        }));
                        setPickerModal(null);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: isSel ? "#1A6B3C" : "#F3F4F6",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 13,
                          fontWeight: "600",
                          color: isSel ? "#FFFFFF" : "#374151",
                        }}
                      >
                        {dept.replace("College of ", "")}
                      </Text>
                    </Pressable>
                  );
                })}

              {pickerModal === "course" &&
                availableCourses.map((c) => {
                  const isSel = filters.course === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        setFilters((prev) => ({ ...prev, course: c }));
                        setPickerModal(null);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: isSel ? "#1A6B3C" : "#F3F4F6",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 13,
                          fontWeight: "600",
                          color: isSel ? "#FFFFFF" : "#374151",
                        }}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}

              {pickerModal === "year" &&
                YEAR_LEVELS.map((y) => {
                  const isSel = filters.yearLevel === y;
                  return (
                    <Pressable
                      key={y}
                      onPress={() => {
                        setFilters((prev) => ({ ...prev, yearLevel: y }));
                        setPickerModal(null);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        backgroundColor: isSel ? "#1A6B3C" : "#F3F4F6",
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "PlusJakartaSans",
                          fontSize: 13,
                          fontWeight: "600",
                          color: isSel ? "#FFFFFF" : "#374151",
                        }}
                      >
                        {y}
                      </Text>
                    </Pressable>
                  );
                })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ═══ Matchmaking Fullscreen Queue Overlay Modal ═══ */}
      <MatchmakingOverlayModal
        visible={
          showMatchOverlay ||
          matchmaking.phase === "searching" ||
          matchmaking.phase === "pending" ||
          matchmaking.phase === "accepted"
        }
        onClose={() => setShowMatchOverlay(false)}
        matchmaking={matchmaking}
      />
    </View>
  );
}
