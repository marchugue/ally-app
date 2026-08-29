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
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth/AuthContext";
import { getMyProfile, updateMyProfile } from "@/lib/api/profiles";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/Button";
import AlertMessage from "@/components/AlertMessage";
import type { Profile, UpdateProfilePayload } from "@/types/profile";

const AVATAR_OPTIONS = [
  "😊","😎","🤓","🤔","😴","🥳","👽","👻",
  "🤖","👾","🦊","🐱","🐶","🐼","🐸","🦉",
  "🦄","🦖","🐙","🐡",
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Editable fields
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");

  const loadProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const p = await getMyProfile(accessToken);
      setProfile(p);
      setUsername(p.username || "");
      setBio(p.bio || "");
      setAvatar(p.avatar_url || "😊");
    } catch (err) {
      console.warn("Failed to load profile", err);
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

    const payload: UpdateProfilePayload = {};
    if (username !== profile?.username) payload.username = username;
    if (bio !== (profile?.bio || "")) payload.bio = bio || null;
    if (avatar !== profile?.avatar_url) payload.avatar_url = avatar || null;

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setSuccess(true);
      return;
    }

    try {
      const updated = await updateMyProfile(payload, accessToken);
      setProfile(updated);
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#1A6B3C" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F7F4EF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
          Edit Profile
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 32,
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
              backgroundColor: "#16A34A12",
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#16A34A33",
            }}
          >
            <Check size={16} color="#16A34A" />
            <Text style={{ fontSize: 13, color: "#16A34A", fontWeight: "500" }}>
              Profile updated successfully!
            </Text>
          </View>
        ) : null}

        {/* Avatar picker */}
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <UserAvatar avatar={avatar} size="xl" />
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: "#6B7280",
              marginTop: 12,
              marginBottom: 10,
            }}
          >
            Choose avatar
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -4 }}
          >
            <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 4 }}>
              {AVATAR_OPTIONS.map((opt, i) => (
                <Pressable
                  key={i}
                  onPress={() => setAvatar(opt)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: avatar === opt ? "#1A6B3C" : "#E2DED7",
                    backgroundColor: avatar === opt ? "#1A6B3C12" : "#FFFFFF",
                  }}
                >
                  <Text style={{ fontSize: 22 }}>{opt}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Username */}
        <FieldLabel label="Username" />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E2DED7",
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 16,
          }}
        >
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            style={{ fontSize: 15, color: "#111827" }}
          />
        </View>

        {/* Bio */}
        <FieldLabel label="Bio" optional />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#E2DED7",
            paddingHorizontal: 14,
            paddingVertical: 12,
            marginBottom: 8,
          }}
        >
          <TextInput
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, 250))}
            placeholder="Tell your friends about yourself"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            style={{
              fontSize: 15,
              color: "#111827",
              minHeight: 80,
              textAlignVertical: "top",
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 11,
            color: "#9CA3AF",
            textAlign: "right",
            marginBottom: 24,
          }}
        >
          {bio.length}/250
        </Text>

        {/* Read-only fields */}
        {profile?.department && (
          <>
            <FieldLabel label="Department" />
            <ReadOnlyField value={profile.department} />
          </>
        )}
        {profile?.course && (
          <>
            <FieldLabel label="Course" />
            <ReadOnlyField value={profile.course} />
          </>
        )}
        {profile?.year_level && (
          <>
            <FieldLabel label="Year Level" />
            <ReadOnlyField value={profile.year_level} />
          </>
        )}

        {/* Save button */}
        <View style={{ marginTop: 8 }}>
          <Button
            label={saving ? "Saving…" : "Save Changes"}
            onPress={handleSave}
            loading={saving}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <Text
      style={{
        fontSize: 12,
        fontWeight: "600",
        color: "#374151",
        marginBottom: 6,
      }}
    >
      {label}
      {optional && (
        <Text style={{ color: "#9CA3AF", fontWeight: "400" }}> (optional)</Text>
      )}
    </Text>
  );
}

function ReadOnlyField({ value }: { value: string }) {
  return (
    <View
      style={{
        backgroundColor: "#F0EDE8",
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
      }}
    >
      <Text style={{ fontSize: 15, color: "#6B7280" }}>{value}</Text>
    </View>
  );
}
