import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import {
  ChevronLeft,
  Check,
  Camera,
  User,
  BookOpen,
  GraduationCap,
  Building2,
  Sparkles,
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { getMyProfile, updateMyProfile } from "@/lib/api/profiles";
import { uploadUserAvatar } from "@/lib/api/media";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/Button";
import AlertMessage from "@/components/AlertMessage";
import type { Profile, UpdateProfilePayload } from "@/types/profile";

const COLORS = {
  forest: "#1A6B3C",
  forestDark: "#134F2C",
  forestLight: "#E8F5E9",
  bg: "#FFFFFF",
  cardBg: "#FAFAFA",
  border: "#E8E6E1",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
};

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [department, setDepartment] = useState("");
  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");

  const pickImageFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Photo library permission is required to select a profile picture."
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
        setAvatarUrl(result.assets[0].uri);
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
          "Camera permission is required to take a new profile picture."
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        setAvatarUrl(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Failed to take photo", err);
    }
  };

  const handleAvatarPress = () => {
    Alert.alert(
      "Change Profile Picture",
      "Select an option to update your photo",
      [
        { text: "Take Photo (Camera)", onPress: takePhotoWithCamera },
        { text: "Choose from Library", onPress: pickImageFromLibrary },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const p = await getMyProfile(accessToken);
      setProfile(p);
      setFullName(p.full_name || "");
      setUsername(p.username || "");
      setBio(p.bio || "");
      setAvatarUrl(p.avatar_url || "😊");
      setDepartment(p.department || "");
      setCourse(p.course || "");
      setYearLevel(p.year_level || "");
    } catch (err) {
      console.warn("Failed to load profile", err);
      setError("Failed to load profile details.");
    }
  }, [accessToken]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await loadProfile();
      setLoading(false);
    }
    init();
  }, [loadProfile]);

  const handleSave = async () => {
    if (!accessToken || saving) return;
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      // If the avatar was changed and is a local file URI, upload it to R2 first.
      let finalAvatarUrl = avatarUrl;
      const isLocalFile = avatarUrl.startsWith("file://") || avatarUrl.startsWith("content://");
      const avatarChanged = avatarUrl !== (profile?.avatar_url || "");

      if (avatarChanged && isLocalFile) {
        const filename = avatarUrl.split("/").pop() || "avatar.jpg";
        const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          gif: "image/gif",
        };
        const result = await uploadUserAvatar(
          { uri: avatarUrl, name: filename, type: mimeMap[ext] || "image/jpeg" },
          accessToken
        );
        finalAvatarUrl = result.url;
      }

      const payload: UpdateProfilePayload = {};
      if (fullName !== (profile?.full_name || "")) payload.full_name = fullName;
      if (username !== (profile?.username || "")) payload.username = username;
      if (bio !== (profile?.bio || "")) payload.bio = bio || null;
      if (finalAvatarUrl !== (profile?.avatar_url || "")) payload.avatar_url = finalAvatarUrl || null;
      if (department !== (profile?.department || "")) payload.department = department || null;
      if (course !== (profile?.course || "")) payload.course = course || null;
      if (yearLevel !== (profile?.year_level || "")) payload.year_level = yearLevel || null;

      if (Object.keys(payload).length === 0) {
        setSuccess(true);
        return;
      }

      const updated = await updateMyProfile(payload, accessToken);
      setProfile(updated);
      setAvatarUrl(updated.avatar_url || avatarUrl);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={COLORS.forest} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingBottom: 12,
          paddingHorizontal: 16,
          backgroundColor: COLORS.bg,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "#F3F4F6",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={22} color={COLORS.textPrimary} />
        </Pressable>

        <Text style={{ fontSize: 17, fontWeight: "700", color: COLORS.textPrimary }}>
          Edit Profile
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          hitSlop={10}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.forest} />
          ) : (
            <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.forest }}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: insets.bottom + 40,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={{ marginBottom: 16 }}>
            <AlertMessage message={error} type="error" />
          </View>
        ) : null}

        {success ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(22, 163, 74, 0.08)",
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "rgba(22, 163, 74, 0.25)",
            }}
          >
            <Check size={18} color="#16A34A" />
            <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "600" }}>
              Profile updated successfully!
            </Text>
          </View>
        ) : null}

        {/* ── Avatar Customization Section ── */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <Pressable onPress={handleAvatarPress} style={{ alignItems: "center" }} hitSlop={10}>
            <View style={{ position: "relative" }}>
              <View
                style={{
                  borderRadius: 56,
                  borderWidth: 3,
                  borderColor: COLORS.forestLight,
                  padding: 2,
                  backgroundColor: COLORS.bg,
                }}
              >
                <UserAvatar avatar={avatarUrl} size="xl" />
              </View>
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  backgroundColor: COLORS.forest,
                  borderRadius: 16,
                  width: 32,
                  height: 32,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                  elevation: 2,
                }}
              >
                <Camera size={16} color="#FFFFFF" />
              </View>
            </View>

            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: COLORS.forest,
                marginTop: 10,
              }}
            >
              Change photo
            </Text>
          </Pressable>
        </View>

        {/* ── Personal Info Group ── */}
        <SectionHeader icon={<User size={15} color={COLORS.forest} />} title="Personal Info" />

        {/* Full Name */}
        <InputField
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
        />

        {/* Username */}
        <InputField
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="username"
          autoCapitalize="none"
        />

        {/* Bio */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>Bio</Text>
            <Text style={{ fontSize: 11, color: COLORS.textMuted }}>{bio.length}/250</Text>
          </View>
          <View
            style={{
              backgroundColor: "#FAFAFA",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.border,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <TextInput
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 250))}
              placeholder="Tell your campus allies about yourself..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              style={{
                fontSize: 15,
                color: COLORS.textPrimary,
                minHeight: 80,
                textAlignVertical: "top",
              }}
            />
          </View>
        </View>

        {/* ── Academic Details Group ── */}
        <SectionHeader icon={<GraduationCap size={15} color={COLORS.forest} />} title="Academic Details" />

        {/* College / Department */}
        <InputField
          label="College / Department"
          value={department}
          onChangeText={setDepartment}
          placeholder="e.g. College of Computer Studies"
        />

        {/* Course */}
        <InputField
          label="Course / Program"
          value={course}
          onChangeText={setCourse}
          placeholder="e.g. BS Information Technology"
        />

        {/* Year Level */}
        <InputField
          label="Year Level"
          value={yearLevel}
          onChangeText={setYearLevel}
          placeholder="e.g. 3rd Year"
        />

        {/* ── Save Changes Button ── */}
        <View style={{ marginTop: 12 }}>
          <Button
            label={saving ? "Saving Changes..." : "Save Changes"}
            onPress={handleSave}
            loading={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
        marginTop: 4,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: COLORS.forestLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 15, fontWeight: "700", color: COLORS.textPrimary }}>
        {title}
      </Text>
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          backgroundColor: "#FAFAFA",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          autoCapitalize={autoCapitalize}
          style={{ fontSize: 15, color: COLORS.textPrimary }}
        />
      </View>
    </View>
  );
}
