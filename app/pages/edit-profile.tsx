import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import {
  ArrowLeft,
  Camera,
  Check,
  X,
  Search,
  AlertCircle,
  Upload,
  Plus,
  ChevronDown,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import {
  getMyProfile,
  updateMyProfile,
  checkUsernameAvailable,
} from "@/lib/api/profiles";
import {
  getPresetAvatars,
  uploadUserAvatar,
  type PresetAvatarRow,
} from "@/lib/api/media";
import { getLookups } from "@/lib/api/lookups";
import type { Profile, UpdateProfilePayload } from "@/types/profile";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { getDeterministicAnonymousAvatar } from "@/constants/matchOptions";
import { isUrl, resolveImageUri } from "@/components/UserAvatar";

// ── Fallback Lookup Constants (aligned with Web) ──────────────────────────
const FALLBACK_DEPARTMENTS = [
  "College of Computer Studies",
  "College of Education",
  "College of Industrial Technology",
  "College of Engineering",
];

const FALLBACK_COURSES_BY_DEPT: Record<string, string[]> = {
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

const FALLBACK_ORGANIZATIONS = [
  "Artisan's Society",
  "Adventist Ministry College and University Students' Excelsior",
  "Automotive Technology Society",
  "CHMSU-A Kabanda",
  "CHMSU-Alijis Performing Arts",
  "Circle of Peer Facilitators",
  "Computer Technology Society",
  "CHMSU Alijis Vocals",
  "CHMSU Python Esports Club",
  "CHMSU University Student Government",
  "CHMSUans Red Cross Youth Council",
  "D' Culinarianz",
  "D' Machinist",
  "Electronics and Communication Technology Society",
  "Future Technical Educators' Society",
  "Information Systems Society",
  "Information Technology Society",
  "Institute of Computer Engineers of the Philippines, Student Edition CHMSU Alijis",
  "Institute of Electronics Engineers of the Philippines-Negros Occidental Student Chapter CHMSU-Alijis",
  "Integrated Institute of Electrical Student Society",
  "Junior Safety Officer of Negros Occidental",
  "New Life Apostolic Campus Ministries",
  "Research Enthusiasts CHMSU-Alijis",
  "Philippine Institute of Cyber Security Professionals' Junior - CHMSU-A",
  "United Seniors Organization",
  "Unsullied Frisbee Club",
  "The Technopacer",
  "Youth Movers' Movement",
];

const FALLBACK_INTERESTS_BY_CATEGORY: Record<string, { label: string; color: string }[]> = {
  Technology: [
    { label: "Coding", color: "blue" },
    { label: "Web Design", color: "blue" },
    { label: "AI & ML", color: "blue" },
    { label: "Cybersecurity", color: "blue" },
    { label: "Game Dev", color: "blue" },
    { label: "Robotics", color: "blue" },
  ],
  Arts: [
    { label: "Photography", color: "pink" },
    { label: "Drawing", color: "pink" },
    { label: "Music", color: "pink" },
    { label: "Dancing", color: "pink" },
    { label: "Filmmaking", color: "pink" },
    { label: "Creative Writing", color: "pink" },
  ],
  Nature: [
    { label: "Hiking", color: "green" },
    { label: "Environment", color: "green" },
    { label: "Gardening", color: "green" },
    { label: "Camping", color: "green" },
    { label: "Bird Watching", color: "green" },
  ],
  Sports: [
    { label: "Basketball", color: "orange" },
    { label: "Volleyball", color: "orange" },
    { label: "Swimming", color: "orange" },
    { label: "Badminton", color: "orange" },
    { label: "Football", color: "orange" },
    { label: "Fitness", color: "orange" },
  ],
  Leadership: [
    { label: "Community Service", color: "purple" },
    { label: "Student Gov", color: "purple" },
    { label: "Volunteering", color: "purple" },
    { label: "Debate", color: "purple" },
    { label: "Public Speaking", color: "purple" },
  ],
  Lifestyle: [
    { label: "Cooking", color: "amber" },
    { label: "Reading", color: "amber" },
    { label: "Travel", color: "amber" },
    { label: "Anime", color: "amber" },
    { label: "Gaming", color: "amber" },
    { label: "Fashion", color: "amber" },
  ],
};

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { accessToken, user } = useAuth();

  // ── States ─────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form fields
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Avatar editor section
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarTab, setAvatarTab] = useState<"presets" | "upload">("presets");
  const [presetAvatars, setPresetAvatars] = useState<PresetAvatarRow[]>([]);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [customAvatarPreview, setCustomAvatarPreview] = useState<string | null>(null);
  const [avatarImgError, setAvatarImgError] = useState(false);

  // Live username validation
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");

  // Search & custom additions
  const [orgSearch, setOrgSearch] = useState("");
  const [interestSearch, setInterestSearch] = useState("");
  const [selectedInterestCategory, setSelectedInterestCategory] = useState<string>("All");
  const [customOrgs, setCustomOrgs] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);

  // Dynamic lookups
  const [departments, setDepartments] = useState<string[]>(FALLBACK_DEPARTMENTS);
  const [coursesByDept, setCoursesByDept] = useState<Record<string, string[]>>(
    FALLBACK_COURSES_BY_DEPT
  );
  const [organizations, setOrganizations] = useState<string[]>(FALLBACK_ORGANIZATIONS);
  const [interestsByCategory, setInterestsByCategory] = useState(
    FALLBACK_INTERESTS_BY_CATEGORY
  );

  // Modal pickers
  const [activePicker, setActivePicker] = useState<"department" | "course" | "yearLevel" | null>(
    null
  );

  // Input refs for card "Edit" buttons
  const usernameInputRef = useRef<TextInput>(null);
  const bioInputRef = useRef<TextInput>(null);
  const orgSearchInputRef = useRef<TextInput>(null);
  const interestSearchInputRef = useRef<TextInput>(null);

  // ── Palette Mappings ───────────────────────────────────────────────────
  const themeBg = isDark ? "#121212" : "#F7F4EF";
  const cardBg = isDark ? "#181818" : "#FFFFFF";
  const inputBg = isDark ? "#1F1F1F" : "#FFFFFF";
  const cardBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB";
  const brandGreen = isDark ? "#38C185" : "#1A6B3C";
  const brandGreenSoft = isDark ? "rgba(56, 193, 133, 0.15)" : "rgba(26, 107, 60, 0.08)";

  // ── Load Profile & Presets ─────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const p = await getMyProfile(accessToken);
      setProfile(p);
      setUsername(p.username || "");
      setFullName(p.full_name || "");
      setBio(p.bio || "");
      setAvatarUrl(p.avatar_url ? resolveImageUri(p.avatar_url) || p.avatar_url : null);
      setDepartment(p.department || "");
      setCourse(p.course || "");
      setYearLevel(p.year_level || "");
      setSelectedOrgs(p.organizations || []);
      setSelectedInterests(p.interests || []);

      // Custom items tracking
      const defaultOrgSet = new Set(FALLBACK_ORGANIZATIONS);
      const existingCustomOrgs = (p.organizations || []).filter((o) => !defaultOrgSet.has(o));
      setCustomOrgs(existingCustomOrgs);

      const allDefaultInterests = new Set<string>();
      Object.values(FALLBACK_INTERESTS_BY_CATEGORY).forEach((list) =>
        list.forEach((i) => allDefaultInterests.add(i.label))
      );
      const existingCustomInterests = (p.interests || []).filter(
        (i) => !allDefaultInterests.has(i)
      );
      setCustomInterests(existingCustomInterests);
    } catch (err) {
      console.warn("Failed to load profile", err);
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadProfile();
      // Load preset avatars
      try {
        const res = await getPresetAvatars();
        if (res?.avatars?.length) {
          setPresetAvatars(
            res.avatars.map((preset) => ({
              ...preset,
              url: resolveImageUri(preset.url) || preset.url,
            }))
          );
        }
      } catch {
        // Fallback gracefully
      }
      // Load dynamic lookups
      try {
        const lookups = await getLookups();
        if (lookups) {
          if (lookups.departments?.length) {
            setDepartments(lookups.departments.map((d) => d.name));
          }
          if (lookups.courses?.length && lookups.departments?.length) {
            const deptById = new Map(lookups.departments.map((d) => [d.id, d.name]));
            const nextCourses: Record<string, string[]> = {};
            lookups.courses.forEach((c) => {
              const deptName = deptById.get(c.department_id);
              if (!deptName) return;
              if (!nextCourses[deptName]) nextCourses[deptName] = [];
              nextCourses[deptName].push(c.name);
            });
            if (Object.keys(nextCourses).length > 0) {
              setCoursesByDept(nextCourses);
            }
          }
          if (lookups.organizations?.length) {
            setOrganizations(lookups.organizations.map((o) => o.name));
          }
          if (lookups.interests?.length) {
            const nextInterests: Record<string, { label: string; color: string }[]> = {};
            lookups.interests.forEach((item) => {
              if (!nextInterests[item.category]) nextInterests[item.category] = [];
              nextInterests[item.category].push({
                label: item.name,
                color: item.color || "green",
              });
            });
            if (Object.keys(nextInterests).length > 0) {
              setInterestsByCategory(nextInterests);
            }
          }
        }
      } catch {
        // Fallback lookups already seeded
      }
      setLoading(false);
    }
    init();
  }, [loadProfile]);

  // ── Live Username Validation Debounce ───────────────────────────────────
  useEffect(() => {
    const raw = username?.toLowerCase()?.trim();
    if (
      !raw ||
      raw.length < 3 ||
      raw === profile?.username?.toLowerCase() ||
      !/^[a-zA-Z0-9_]+$/.test(raw)
    ) {
      setUsernameStatus("idle");
      return;
    }
    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsernameAvailable(raw, profile?.id);
        setUsernameStatus(res.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username, profile?.username, profile?.id]);

  // ── Custom Orgs & Interests Computations ────────────────────────────────
  const allDefaultInterestsSet = useMemo(() => {
    const set = new Set<string>();
    Object.values(interestsByCategory).forEach((list) =>
      list.forEach((item) => set.add(item.label))
    );
    return set;
  }, [interestsByCategory]);

  const filteredOrganizations = useMemo(() => {
    if (!orgSearch.trim()) return organizations;
    const q = orgSearch.toLowerCase().trim();
    return organizations.filter((o) => o.toLowerCase().includes(q));
  }, [organizations, orgSearch]);

  const canAddCustomOrg = useMemo(() => {
    const q = orgSearch.trim();
    if (!q) return false;
    const lower = q.toLowerCase();
    const inDefault = organizations.some((o) => o.toLowerCase() === lower);
    const inCustom = customOrgs.some((o) => o.toLowerCase() === lower);
    return !inDefault && !inCustom;
  }, [orgSearch, organizations, customOrgs]);

  const interestCategories = useMemo(() => {
    return ["All", ...Object.keys(interestsByCategory)];
  }, [interestsByCategory]);

  const displayedInterests = useMemo(() => {
    const q = interestSearch.toLowerCase().trim();
    const map: Record<string, string[]> = {};

    Object.entries(interestsByCategory).forEach(([category, items]) => {
      if (selectedInterestCategory !== "All" && selectedInterestCategory !== category) {
        return;
      }
      const filtered = items
        .filter((item) => (!q ? true : item.label.toLowerCase().includes(q)))
        .map((item) => item.label);

      if (filtered.length > 0) {
        map[category] = filtered;
      }
    });

    return map;
  }, [interestsByCategory, interestSearch, selectedInterestCategory]);

  const canAddCustomInterest = useMemo(() => {
    const q = interestSearch.trim();
    if (!q) return false;
    const lower = q.toLowerCase();
    const inDefault = allDefaultInterestsSet.has(q);
    const inCustom = customInterests.some((i) => i.toLowerCase() === lower);
    return !inDefault && !inCustom;
  }, [interestSearch, allDefaultInterestsSet, customInterests]);

  const interestCount = selectedInterests.length;
  const isInterestsValid = interestCount >= 3;

  // ── Toggle / Add Handlers ──────────────────────────────────────────────
  const toggleOrg = (orgName: string) => {
    setSelectedOrgs((prev) =>
      prev.includes(orgName) ? prev.filter((o) => o !== orgName) : [...prev, orgName]
    );
  };

  const handleAddCustomOrg = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!customOrgs.includes(trimmed)) {
      setCustomOrgs((prev) => [...prev, trimmed]);
    }
    if (!selectedOrgs.includes(trimmed)) {
      setSelectedOrgs((prev) => [...prev, trimmed]);
    }
    setOrgSearch("");
  };

  const toggleInterest = (interestName: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestName)
        ? prev.filter((i) => i !== interestName)
        : [...prev, interestName]
    );
  };

  const handleAddCustomInterest = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!customInterests.includes(trimmed)) {
      setCustomInterests((prev) => [...prev, trimmed]);
    }
    if (!selectedInterests.includes(trimmed)) {
      setSelectedInterests((prev) => [...prev, trimmed]);
    }
    setInterestSearch("");
  };

  // ── Avatar Pickers & Upload ────────────────────────────────────────────
  const pickImageFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Photo library permission is required to choose a profile photo."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await handleUploadLocalPhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Failed to pick image", err);
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Camera permission is required to take a new profile photo."
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        await handleUploadLocalPhoto(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Failed to take photo", err);
    }
  };

  const handleUploadLocalPhoto = async (localUri: string) => {
    if (!accessToken) return;
    setCustomAvatarPreview(localUri);
    setAvatarUploading(true);

    try {
      const filename = localUri.split("/").pop() || "avatar.jpg";
      const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif",
      };
      const res = await uploadUserAvatar(
        { uri: localUri, name: filename, type: mimeMap[ext] || "image/jpeg" },
        accessToken
      );
      const resolvedUploadedUrl = resolveImageUri(res.url) || res.url;
      setAvatarUrl(resolvedUploadedUrl);
      setCustomAvatarPreview(resolvedUploadedUrl);
    } catch (err: any) {
      Alert.alert("Upload Failed", err?.message || "Failed to upload avatar photo.");
      setCustomAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const promptPhotoOptions = () => {
    Alert.alert(
      "Profile Photo",
      "Choose a method to update your photo",
      [
        { text: "Take Photo (Camera)", onPress: takePhotoWithCamera },
        { text: "Choose from Library", onPress: pickImageFromLibrary },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  // ── Save Profile ───────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!accessToken || saving) return;
    if (!isInterestsValid) {
      Alert.alert("Incomplete Interests", "Please select at least 3 campus interests to save.");
      return;
    }
    if (usernameStatus === "taken") {
      Alert.alert("Username Taken", "Please choose a different username.");
      return;
    }

    const normUsername = username.toLowerCase().trim();
    if (normUsername.length < 3 || normUsername.length > 20) {
      Alert.alert("Invalid Username", "Username must be between 3 and 20 characters.");
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const payload: UpdateProfilePayload = {
        username: normUsername,
        full_name: fullName.trim() || normUsername,
        bio: bio.trim() || null,
        avatar_url: avatarUrl ? resolveImageUri(avatarUrl) || avatarUrl : null,
        department: department || null,
        course: course || null,
        year_level: yearLevel || null,
        interests: selectedInterests,
        organizations: selectedOrgs,
      };

      const updated = await updateMyProfile(payload, accessToken);
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        router.back();
      }, 600);
    } catch (err: any) {
      Alert.alert("Save Failed", err?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // Avatar preview computation
  const resolvedAvatarKey =
    profile?.avatarKey ||
    profile?.avatar_preset_id ||
    getDeterministicAnonymousAvatar(profile?.id || user?.id);
  const rawAvatarDisplay = customAvatarPreview || avatarUrl;
  const currentAvatarDisplay = rawAvatarDisplay
    ? resolveImageUri(rawAvatarDisplay) || rawAvatarDisplay
    : null;
  useEffect(() => {
    setAvatarImgError(false);
  }, [currentAvatarDisplay]);
  const showRealAvatar = Boolean(
    currentAvatarDisplay && isUrl(currentAvatarDisplay) && !avatarImgError
  );

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: themeBg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={brandGreen} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: themeBg }}
    >
      {/* ── Top Navigation Bar ────────────────────────────────────────── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          backgroundColor: themeBg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: cardBorder,
            backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "#FFFFFF",
          }}
        >
          <ArrowLeft size={16} color={colors.textPrimary} />
          <Text
            style={{
              fontSize: 13,
              fontWeight: "600",
              color: colors.textPrimary,
            }}
          >
            Back
          </Text>
        </Pressable>

        <View style={{ alignItems: "center", flex: 1, paddingHorizontal: 8 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: "700",
              color: colors.textPrimary,
            }}
          >
            Edit Profile
          </Text>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving || !isInterestsValid || usernameStatus === "taken"}
          hitSlop={8}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 7,
            borderRadius: 12,
            backgroundColor:
              saving || !isInterestsValid || usernameStatus === "taken"
                ? isDark
                  ? "rgba(255,255,255,0.08)"
                  : "#E5E7EB"
                : brandGreen,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                color:
                  !isInterestsValid || usernameStatus === "taken"
                    ? colors.textMuted
                    : "#FFFFFF",
              }}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>

      {/* ── Scrollable Body with Hierarchical 6 Cards ─────────────────── */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── CARD 1: AVATAR ─────────────────────────────────────────── */}
        <View
          style={{
            marginBottom: 26,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Avatar
            </Text>
            <Pressable onPress={() => setAvatarEditorOpen((v) => !v)} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: brandGreen }}>
                {avatarEditorOpen ? "Done" : "Edit"}
              </Text>
            </Pressable>
          </View>

          {/* Avatar Center Context */}
          <View style={{ alignItems: "center" }}>
            <View style={{ position: "relative" }}>
              <View
                style={{
                  width: 108,
                  height: 108,
                  borderRadius: 54,
                  borderWidth: showRealAvatar ? 3 : 0,
                  borderColor: showRealAvatar ? (isDark ? "#2A2A2A" : "#FFFFFF") : "transparent",
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: showRealAvatar ? (isDark ? "#202020" : "#F3F4F6") : "transparent",
                  elevation: showRealAvatar ? 3 : 0,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: showRealAvatar ? 0.1 : 0,
                  shadowRadius: 4,
                }}
              >
                {showRealAvatar ? (
                  <Image
                    source={{ uri: currentAvatarDisplay! }}
                    onError={() => setAvatarImgError(true)}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : (
                  <AnonymousAvatar avatarKey={resolvedAvatarKey} size={108} />
                )}
              </View>

              <Pressable
                onPress={() => setAvatarEditorOpen((v) => !v)}
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: brandGreen,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: themeBg,
                  elevation: 4,
                }}
              >
                <Camera size={15} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: colors.textPrimary,
                marginTop: 12,
              }}
            >
              {fullName || profile?.full_name || "Student Ally"}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginTop: 2,
              }}
            >
              @{username || profile?.username || "username"}
            </Text>

            {/* Expandable Avatar Selector */}
            {avatarEditorOpen && (
              <View
                style={{
                  width: "100%",
                  marginTop: 18,
                  paddingTop: 18,
                  borderTopWidth: 1,
                  borderTopColor: cardBorder,
                }}
              >
                {/* Tabs */}
                <View
                  style={{
                    flexDirection: "row",
                    alignSelf: "center",
                    backgroundColor: isDark ? "#222222" : "#F3F4F6",
                    borderRadius: 12,
                    padding: 3,
                    borderWidth: 1,
                    borderColor: cardBorder,
                    marginBottom: 16,
                  }}
                >
                  {(["presets", "upload"] as const).map((tab) => {
                    const isActive = avatarTab === tab;
                    return (
                      <Pressable
                        key={tab}
                        onPress={() => setAvatarTab(tab)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 7,
                          borderRadius: 9,
                          backgroundColor: isActive
                            ? isDark
                              ? "#333333"
                              : "#FFFFFF"
                            : "transparent",
                          elevation: isActive ? 1 : 0,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color: isActive ? brandGreen : colors.textSecondary,
                          }}
                        >
                          {tab === "presets" ? "Illustrated Presets" : "Custom Photo"}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Preset Avatars Grid */}
                {avatarTab === "presets" && (
                  presetAvatars.length === 0 ? (
                    <View
                      style={{
                        padding: 16,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        backgroundColor: inputBg,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.textMuted }}>
                        No preset avatars available. Switch to Custom Photo to upload.
                      </Text>
                    </View>
                  ) : (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 10,
                        justifyContent: "center",
                        padding: 10,
                        backgroundColor: inputBg,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: cardBorder,
                        maxHeight: 220,
                      }}
                    >
                      <ScrollView
                        nestedScrollEnabled
                        contentContainerStyle={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 10,
                          justifyContent: "center",
                        }}
                      >
                        {presetAvatars.map((preset) => {
                          const resolvedPresetUrl = resolveImageUri(preset.url) || preset.url;
                          const normalizedAvatarUrl = avatarUrl ? resolveImageUri(avatarUrl) || avatarUrl : null;
                          const isSelected = normalizedAvatarUrl === resolvedPresetUrl;
                          return (
                            <Pressable
                              key={preset.id}
                              onPress={() => {
                                setAvatarUrl(resolvedPresetUrl);
                                setCustomAvatarPreview(null);
                              }}
                              style={{
                                width: 54,
                                height: 54,
                                borderRadius: 14,
                                overflow: "hidden",
                                borderWidth: 2,
                                borderColor: isSelected ? brandGreen : "transparent",
                                position: "relative",
                              }}
                            >
                              <Image
                                source={{ uri: resolvedPresetUrl }}
                                style={{ width: "100%", height: "100%" }}
                                resizeMode="cover"
                              />
                              {isSelected && (
                                <View
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: "rgba(26, 107, 60, 0.35)",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 10,
                                      backgroundColor: brandGreen,
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <Text
                                      style={{
                                        color: "#FFFFFF",
                                        fontSize: 11,
                                        fontWeight: "700",
                                      }}
                                    >
                                      ✓
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )
                )}

                {/* Custom Photo Upload */}
                {avatarTab === "upload" && (
                  <View style={{ width: "100%" }}>
                    {customAvatarPreview || (avatarUrl && isUrl(avatarUrl)) ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 14,
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: inputBg,
                          borderWidth: 1,
                          borderColor: cardBorder,
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              resolveImageUri(customAvatarPreview ?? avatarUrl) ||
                              (customAvatarPreview ?? avatarUrl!),
                          }}
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            borderWidth: 2,
                            borderColor: brandGreen,
                          }}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: "600",
                              color: brandGreen,
                            }}
                          >
                            Custom photo selected
                          </Text>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 12,
                              marginTop: 6,
                            }}
                          >
                            <Pressable onPress={promptPhotoOptions} hitSlop={6}>
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: colors.textPrimary,
                                }}
                              >
                                Change photo
                              </Text>
                            </Pressable>
                            <Text style={{ color: colors.textMuted }}>•</Text>
                            <Pressable
                              onPress={() => {
                                setCustomAvatarPreview(null);
                                setAvatarUrl(null);
                              }}
                              hitSlop={6}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "600",
                                  color: "#EF4444",
                                }}
                              >
                                Remove
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    ) : (
                      <Pressable
                        onPress={promptPhotoOptions}
                        disabled={avatarUploading}
                        style={{
                          borderWidth: 1.5,
                          borderStyle: "dashed",
                          borderColor: cardBorder,
                          borderRadius: 16,
                          paddingVertical: 24,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: inputBg,
                        }}
                      >
                        {avatarUploading ? (
                          <View style={{ alignItems: "center", gap: 8 }}>
                            <ActivityIndicator size="small" color={brandGreen} />
                            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                              Uploading photo…
                            </Text>
                          </View>
                        ) : (
                          <View style={{ alignItems: "center", gap: 6 }}>
                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: brandGreenSoft,
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Upload size={18} color={brandGreen} />
                            </View>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: "600",
                                color: colors.textPrimary,
                              }}
                            >
                              Tap to choose a photo
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.textMuted }}>
                              Take a photo or choose from library
                            </Text>
                          </View>
                        )}
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* ── CARD 2: USERNAME ───────────────────────────────────────── */}
        <View
          style={{
            marginBottom: 26,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Username
            </Text>
            <Pressable onPress={() => usernameInputRef.current?.focus()} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: brandGreen }}>
                Edit
              </Text>
            </Pressable>
          </View>

          {/* Centered Input with @ Prefix */}
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: "100%",
                maxWidth: 360,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: inputBg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor:
                  usernameStatus === "taken"
                    ? "#EF4444"
                    : usernameStatus === "available"
                    ? brandGreen
                    : cardBorder,
                paddingHorizontal: 14,
                height: 48,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.textMuted,
                  marginRight: 6,
                }}
              >
                @
              </Text>
              <TextInput
                ref={usernameInputRef}
                value={username}
                onChangeText={setUsername}
                placeholder="yourusername"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: colors.textPrimary,
                  fontWeight: "500",
                }}
              />
              <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
                {usernameStatus === "checking" && (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                )}
                {usernameStatus === "available" && (
                  <Check size={18} color={brandGreen} strokeWidth={2.5} />
                )}
                {usernameStatus === "taken" && (
                  <X size={18} color="#EF4444" strokeWidth={2.5} />
                )}
              </View>
            </View>

            {/* Helper / Status message */}
            <View style={{ marginTop: 8, minHeight: 18 }}>
              {usernameStatus === "taken" ? (
                <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "500" }}>
                  Username is already taken.
                </Text>
              ) : usernameStatus === "available" ? (
                <Text style={{ fontSize: 12, color: brandGreen, fontWeight: "500" }}>
                  Username is available!
                </Text>
              ) : (
                <Text style={{ fontSize: 12, color: colors.textMuted }}>
                  Letters, numbers, and underscores (3-20 characters).
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── CARD 3: BIO ────────────────────────────────────────────── */}
        <View
          style={{
            marginBottom: 26,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Bio
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>
                {bio.length} / 250
              </Text>
              <Pressable onPress={() => bioInputRef.current?.focus()} hitSlop={8}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: brandGreen }}>
                  Edit
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Multiline Input */}
          <View
            style={{
              backgroundColor: inputBg,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: cardBorder,
              padding: 14,
            }}
          >
            <TextInput
              ref={bioInputRef}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 250))}
              placeholder="Share a short intro about your studies, passions, or campus goals…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={{
                fontSize: 14,
                color: colors.textPrimary,
                minHeight: 76,
                textAlignVertical: "top",
                lineHeight: 20,
              }}
            />
          </View>
          <Text
            style={{
              fontSize: 11,
              color: colors.textMuted,
              marginTop: 8,
              textAlign: "center",
            }}
          >
            A short summary shown on your public profile and match card.
          </Text>
        </View>

        {/* ── CARD 4: ACADEMICS ──────────────────────────────────────── */}
        <View
          style={{
            marginBottom: 26,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Academics
            </Text>
            <Pressable onPress={() => setActivePicker("department")} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: brandGreen }}>
                Edit
              </Text>
            </Pressable>
          </View>

          {/* Academic Dropdown Fields */}
          <View style={{ gap: 12 }}>
            {/* Department */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>
                Department / College
              </Text>
              <Pressable
                onPress={() => setActivePicker("department")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: inputBg,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: department ? colors.textPrimary : colors.textMuted,
                    fontWeight: department ? "600" : "400",
                  }}
                >
                  {department || "Select Department"}
                </Text>
                <ChevronDown size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Course / Program */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>
                Degree / Program
              </Text>
              <Pressable
                onPress={() => {
                  if (!department) {
                    Alert.alert("Select Department", "Please select a department first.");
                    return;
                  }
                  setActivePicker("course");
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: inputBg,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  opacity: department ? 1 : 0.6,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: course ? colors.textPrimary : colors.textMuted,
                    fontWeight: course ? "600" : "400",
                  }}
                >
                  {course || (department ? "Select Course" : "Select Department first")}
                </Text>
                <ChevronDown size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Year Level */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>
                Year Level
              </Text>
              <Pressable
                onPress={() => setActivePicker("yearLevel")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  backgroundColor: inputBg,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: cardBorder,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: yearLevel ? colors.textPrimary : colors.textMuted,
                    fontWeight: yearLevel ? "600" : "400",
                  }}
                >
                  {yearLevel || "Select Year Level"}
                </Text>
                <ChevronDown size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── CARD 5: CAMPUS ORGANIZATIONS ─────────────────────────── */}
        <View
          style={{
            marginBottom: 26,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Campus Organizations
            </Text>
            <Pressable onPress={() => orgSearchInputRef.current?.focus()} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: brandGreen }}>
                Edit
              </Text>
            </Pressable>
          </View>

          <Text
            style={{
              fontSize: 12,
              color: colors.textMuted,
              marginBottom: 14,
              textAlign: "center",
            }}
          >
            Select clubs or student groups you are active in. Tap any item to join or leave.
          </Text>

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: inputBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: cardBorder,
              paddingHorizontal: 12,
              height: 42,
              marginBottom: 14,
            }}
          >
            <Search size={15} color={colors.textMuted} />
            <TextInput
              ref={orgSearchInputRef}
              value={orgSearch}
              onChangeText={setOrgSearch}
              placeholder="Search organizations or type to add..."
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                fontSize: 13,
                color: colors.textPrimary,
                marginLeft: 8,
              }}
            />
            {orgSearch.length > 0 && (
              <Pressable onPress={() => setOrgSearch("")} hitSlop={8}>
                <X size={15} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Option Pills (Solid if selected, outline if not) */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
            }}
          >
            {filteredOrganizations.map((org) => {
              const isSelected = selectedOrgs.includes(org);
              return (
                <Pressable
                  key={org}
                  onPress={() => toggleOrg(org)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 12,
                    backgroundColor: isSelected ? brandGreen : cardBg,
                    borderWidth: 1,
                    borderColor: isSelected ? brandGreen : cardBorder,
                    elevation: isSelected ? 1 : 0,
                  }}
                >
                  {isSelected && (
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                      ✓
                    </Text>
                  )}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: isSelected ? "600" : "500",
                      color: isSelected ? "#FFFFFF" : colors.textPrimary,
                    }}
                  >
                    {org}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Added Organizations Section (if any custom) */}
          {customOrgs.length > 0 && (
            <View
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: cardBorder,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: colors.textMuted,
                  letterSpacing: 0.5,
                  marginBottom: 10,
                }}
              >
                Added Organizations
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                {customOrgs.map((org) => {
                  const isSelected = selectedOrgs.includes(org);
                  return (
                    <Pressable
                      key={org}
                      onPress={() => toggleOrg(org)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 12,
                        backgroundColor: isSelected ? brandGreen : cardBg,
                        borderWidth: 1,
                        borderColor: isSelected ? brandGreen : cardBorder,
                      }}
                    >
                      {isSelected && (
                        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                          ✓
                        </Text>
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? "600" : "500",
                          color: isSelected ? "#FFFFFF" : colors.textPrimary,
                        }}
                      >
                        {org}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Add Custom Organization Button */}
          {canAddCustomOrg && (
            <View style={{ alignItems: "center", marginTop: 14 }}>
              <Pressable
                onPress={() => handleAddCustomOrg(orgSearch)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: brandGreen,
                  backgroundColor: brandGreenSoft,
                }}
              >
                <Plus size={14} color={brandGreen} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: brandGreen }}>
                  Add "{orgSearch.trim()}"
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* ── CARD 6: CAMPUS INTERESTS ───────────────────────────────── */}
        <View
          style={{
            marginBottom: 26,
          }}
        >
          {/* Header Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              Campus Interests
            </Text>
            <Pressable onPress={() => interestSearchInputRef.current?.focus()} hitSlop={8}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: brandGreen }}>
                Edit
              </Text>
            </Pressable>
          </View>

          {/* Validation Alert or Description */}
          {!isInterestsValid ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                padding: 10,
                borderRadius: 12,
                backgroundColor: isDark ? "rgba(217, 119, 6, 0.15)" : "#FFFBEB",
                borderWidth: 1,
                borderColor: isDark ? "rgba(217, 119, 6, 0.3)" : "#FDE68A",
                marginBottom: 14,
              }}
            >
              <AlertCircle size={15} color={isDark ? "#FBBF24" : "#D97706"} />
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? "#FBBF24" : "#B45309",
                  flex: 1,
                  lineHeight: 16,
                }}
              >
                Please select at least 3 interests to help us match you with compatible peers.
              </Text>
            </View>
          ) : (
            <Text
              style={{
                fontSize: 12,
                color: colors.textMuted,
                marginBottom: 14,
                textAlign: "center",
              }}
            >
              Choose topics you are enthusiastic about. Tap any option to toggle.
            </Text>
          )}

          {/* Search Input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: inputBg,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: cardBorder,
              paddingHorizontal: 12,
              height: 42,
              marginBottom: 12,
            }}
          >
            <Search size={15} color={colors.textMuted} />
            <TextInput
              ref={interestSearchInputRef}
              value={interestSearch}
              onChangeText={setInterestSearch}
              placeholder="Search topics (e.g. Coding, Photography, Anime)..."
              placeholderTextColor={colors.textMuted}
              style={{
                flex: 1,
                fontSize: 13,
                color: colors.textPrimary,
                marginLeft: 8,
              }}
            />
            {interestSearch.length > 0 && (
              <Pressable onPress={() => setInterestSearch("")} hitSlop={8}>
                <X size={15} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Category Filter Pills (Horizontal Scroll) */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingVertical: 4, marginBottom: 12 }}
          >
            {interestCategories.map((category) => {
              const isSelected = selectedInterestCategory === category;
              return (
                <Pressable
                  key={category}
                  onPress={() => setSelectedInterestCategory(category)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 10,
                    backgroundColor: isSelected
                      ? isDark
                        ? "#FFFFFF"
                        : "#111827"
                      : isDark
                      ? "#222222"
                      : "#F3F4F6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "600",
                      color: isSelected
                        ? isDark
                          ? "#111827"
                          : "#FFFFFF"
                        : colors.textSecondary,
                    }}
                  >
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Categorized Options Groups */}
          <View style={{ gap: 14 }}>
            {Object.entries(displayedInterests).map(([category, items]) => (
              <View key={category} style={{ alignItems: "center" }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    textTransform: "uppercase",
                    color: colors.textMuted,
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  {category}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "center",
                  }}
                >
                  {items.map((label) => {
                    const isSelected = selectedInterests.includes(label);
                    return (
                      <Pressable
                        key={label}
                        onPress={() => toggleInterest(label)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                          borderRadius: 12,
                          backgroundColor: isSelected ? brandGreen : cardBg,
                          borderWidth: 1,
                          borderColor: isSelected ? brandGreen : cardBorder,
                          elevation: isSelected ? 1 : 0,
                        }}
                      >
                        {isSelected && (
                          <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                            ✓
                          </Text>
                        )}
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: isSelected ? "600" : "500",
                            color: isSelected ? "#FFFFFF" : colors.textPrimary,
                          }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {Object.keys(displayedInterests).length === 0 && !canAddCustomInterest && (
              <Text
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  textAlign: "center",
                  paddingVertical: 12,
                }}
              >
                No interests matching "{interestSearch}".
              </Text>
            )}
          </View>

          {/* Added Custom Interests */}
          {customInterests.length > 0 && (
            <View
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: cardBorder,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  textTransform: "uppercase",
                  color: colors.textMuted,
                  letterSpacing: 0.5,
                  marginBottom: 10,
                }}
              >
                Added Interests
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                }}
              >
                {customInterests.map((interest) => {
                  const isSelected = selectedInterests.includes(interest);
                  return (
                    <Pressable
                      key={interest}
                      onPress={() => toggleInterest(interest)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingHorizontal: 12,
                        paddingVertical: 7,
                        borderRadius: 12,
                        backgroundColor: isSelected ? brandGreen : cardBg,
                        borderWidth: 1,
                        borderColor: isSelected ? brandGreen : cardBorder,
                      }}
                    >
                      {isSelected && (
                        <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                          ✓
                        </Text>
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? "600" : "500",
                          color: isSelected ? "#FFFFFF" : colors.textPrimary,
                        }}
                      >
                        {interest}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Add Custom Interest Button */}
          {canAddCustomInterest && (
            <View style={{ alignItems: "center", marginTop: 14 }}>
              <Pressable
                onPress={() => handleAddCustomInterest(interestSearch)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: brandGreen,
                  backgroundColor: brandGreenSoft,
                }}
              >
                <Plus size={14} color={brandGreen} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: brandGreen }}>
                  Add "{interestSearch.trim()}"
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Selection Modal Pickers (Department, Course, Year Level) ── */}
      <SelectionPickerModal
        visible={activePicker !== null}
        onClose={() => setActivePicker(null)}
        title={
          activePicker === "department"
            ? "Select Department"
            : activePicker === "course"
            ? "Select Degree / Program"
            : "Select Year Level"
        }
        options={
          activePicker === "department"
            ? departments
            : activePicker === "course"
            ? coursesByDept[department] || []
            : YEAR_LEVELS
        }
        selectedValue={
          activePicker === "department"
            ? department
            : activePicker === "course"
            ? course
            : yearLevel
        }
        onSelect={(val) => {
          if (activePicker === "department") {
            setDepartment(val);
            // Reset course if not in new department
            if (course && !(coursesByDept[val] || []).includes(course)) {
              setCourse("");
            }
          } else if (activePicker === "course") {
            setCourse(val);
          } else if (activePicker === "yearLevel") {
            setYearLevel(val);
          }
          setActivePicker(null);
        }}
        searchable={activePicker === "course" || activePicker === "department"}
        isDark={isDark}
        colors={colors}
      />
    </KeyboardAvoidingView>
  );
}

// ── Reusable Selection Picker Modal ──────────────────────────────────────
function SelectionPickerModal({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  searchable = false,
  isDark,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selectedValue: string;
  onSelect: (val: string) => void;
  searchable?: boolean;
  isDark: boolean;
  colors: any;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) setQuery("");
  }, [visible]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase().trim();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const brandGreen = isDark ? "#38C185" : "#1A6B3C";
  const modalBg = isDark ? "#181818" : "#FFFFFF";
  const modalBorder = isDark ? "rgba(255, 255, 255, 0.1)" : "#E5E7EB";
  const inputBg = isDark ? "#222222" : "#F3F4F6";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: modalBg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: modalBorder,
            maxHeight: "80%",
            paddingBottom: insets.bottom + 16,
          }}
        >
          {/* Sheet Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginTop: 10,
              marginBottom: 12,
            }}
          />

          {/* Modal Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: modalBorder,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Optional Search */}
          {searchable && options.length > 5 && (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: inputBg,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  height: 38,
                }}
              >
                <Search size={14} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search options..."
                  placeholderTextColor={colors.textMuted}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: colors.textPrimary,
                    marginLeft: 8,
                  }}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery("")} hitSlop={6}>
                    <X size={14} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {/* Options List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
            renderItem={({ item }) => {
              const isSelected = selectedValue === item;
              return (
                <Pressable
                  onPress={() => onSelect(item)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: isSelected
                      ? isDark
                        ? "rgba(56, 193, 133, 0.12)"
                        : "rgba(26, 107, 60, 0.08)"
                      : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: isSelected ? "600" : "400",
                      color: isSelected ? brandGreen : colors.textPrimary,
                      flex: 1,
                    }}
                  >
                    {item}
                  </Text>
                  {isSelected && (
                    <Check size={18} color={brandGreen} strokeWidth={2.5} />
                  )}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 24, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: colors.textMuted }}>
                  No options found.
                </Text>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
