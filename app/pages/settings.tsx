import {
  View,
  Text,
  Pressable,
  ScrollView,
  Linking,
  Alert,
  Switch,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  ChevronRight,
  Pencil,
  Lock,
  Ban,
  Trash2,
  LogOut,
  Shield,
  Info,
  RotateCw,
  Flame,
  MessageSquare,
  Bell,
  UserCheck,
  Smartphone,
  Clock,
  Check,
  Volume2,
  Eye,
  EyeOff,
  ShieldCheck,
  History,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useNetwork } from "@/context/NetworkContext";
import { getMyPreferences, updateMyPreferences } from "@/lib/api/profiles";
import { changePassword } from "@/lib/api/auth";
import type { UserPreferences, UpdateUserPreferencesPayload } from "@/types/profile";
import { ConfirmModal } from "@/components/ConfirmModal";

const DEFAULT_PREFERENCES: UserPreferences = {
  user_id: "",
  discovery_enabled: true,
  match_gender_preference: "any",
  match_department_preference: "any",
  match_same_year_only: false,
  interests_strict_match: false,
  show_online_status: true,
  show_last_active: true,
  read_receipts_enabled: true,
  account_privacy: "public",
  profile_visibility: "campus",
  feed_post_audience: "campus",
  typing_indicators_enabled: true,
  auto_reveal_identity_stage: 4,
  notify_chat_messages: true,
  notify_match_requests: true,
  notify_streak_reminders: true,
  notify_confessions: true,
  notify_sound_enabled: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "07:00",
};

interface PickerOption<T> {
  value: T;
  label: string;
  sublabel?: string;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken, deleteAccount, signOut } = useAuth();
  const { currentVersion, checkForUpdates } = useNetwork();

  // Confirmation modals
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [showPassText, setShowPassText] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Preference state
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // Modal selection picker state
  const [activePicker, setActivePicker] = useState<{
    title: string;
    description?: string;
    options: PickerOption<any>[];
    selectedValue: any;
    onSelect: (val: any) => void;
  } | null>(null);

  // Fetch preferences on mount
  useEffect(() => {
    if (!accessToken) return;
    getMyPreferences(accessToken)
      .then((data) => {
        if (data) setPreferences(data);
      })
      .catch((err) => {
        console.warn("[Settings] Failed to fetch preferences:", err);
      });
  }, [accessToken]);

  // Patch preferences handler with optimistic update
  const handleUpdatePreference = useCallback(
    async (updates: UpdateUserPreferencesPayload) => {
      setPreferences((prev) => ({ ...prev, ...updates }));

      if (!accessToken) return;
      try {
        await updateMyPreferences(updates, accessToken);
      } catch (err: any) {
        console.warn("[Settings] Failed to save preference:", err);
        Alert.alert("Error", "Could not save settings. Please try again.");
        // Rollback
        getMyPreferences(accessToken).then((data) => {
          if (data) setPreferences(data);
        }).catch(() => {});
      }
    },
    [accessToken]
  );

  const handleSignOut = async () => {
    setShowLogoutConfirm(false);
    await signOut();
  };

  const handleManualCheckForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      const res = await checkForUpdates(true);
      if (res.message) {
        Alert.alert("App Version", res.message);
      }
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
    } catch (err) {
      console.warn("Failed to delete account", err);
      Alert.alert("Error", "Could not delete account. Please try again later.");
      setDeleting(false);
    }
  };

  const handleChangePasswordSubmit = async () => {
    if (!currentPass) {
      Alert.alert("Missing Current Password", "Please enter your current password.");
      return;
    }
    if (newPass.length < 8) {
      Alert.alert("Weak Password", "New password must be at least 8 characters long.");
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert("Password Mismatch", "New passwords do not match.");
      return;
    }
    if (!accessToken) {
      Alert.alert("Not Authenticated", "Please sign in again to update your password.");
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(currentPass, newPass, accessToken);
      setShowPasswordModal(false);
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      Alert.alert("Success", "Your password has been changed successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not change password. Check your current password.");
    } finally {
      setSavingPassword(false);
    }
  };

  // Human-readable labels
  const visibilityLabels: Record<string, string> = {
    campus: "Campus Allies (Verified Students)",
    matches_only: "Connected Friends Only",
    hidden: "Hidden / Incognito",
  };

  const feedAudienceLabels: Record<string, string> = {
    campus: "Campus Public (All Students)",
    matches_only: "Mutual Allies Only",
    anonymous_only: "Always Post Anonymously",
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
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <ArrowLeft size={22} color="#111827" />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
          Settings
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SECTION 1: ACCOUNT & PROFILE */}
        <SectionHeader label="Account & Profile" />
        <View style={{ backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE7E1", borderBottomWidth: 1, borderBottomColor: "#EAE7E1" }}>
          {/* User Email & Verified Status */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: "#F0EDE8",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 11, color: "#9CA3AF", fontWeight: "700", textTransform: "uppercase" }}>
                Signed In Account
              </Text>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827", marginTop: 2 }}>
                {user?.email || "Student Account"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(26,107,60,0.1)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <ShieldCheck size={14} color="#1A6B3C" />
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#1A6B3C" }}>
                Verified
              </Text>
            </View>
          </View>

          <SettingsRow
            icon={Pencil}
            label="Edit Profile"
            onPress={() => router.push("/pages/edit-profile" as any)}
          />
          <SettingsRow
            icon={Lock}
            label="Change Password"
            onPress={() => setShowPasswordModal(true)}
          />
        </View>

        {/* SECTION 2: PRIVACY & SAFETY */}
        <SectionHeader label="Privacy & Safety" />
        <View style={{ backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE7E1", borderBottomWidth: 1, borderBottomColor: "#EAE7E1" }}>
          <SettingsToggleRow
            icon={Shield}
            label="Private Account"
            description="Only allies can see your posts. Your profile page stays reachable and anonymous to everyone else."
            value={preferences.account_privacy === "private"}
            onValueChange={(val) =>
              handleUpdatePreference({ account_privacy: val ? "private" : "public" })
            }
          />

          <SettingsToggleRow
            icon={Smartphone}
            label="Show Online Status"
            description="Display the green active indicator when using the app."
            value={preferences.show_online_status}
            onValueChange={(val) => handleUpdatePreference({ show_online_status: val })}
          />

          <SettingsToggleRow
            icon={Clock}
            label="Show Last Active"
            description="Show when you were last seen across chat headers."
            value={preferences.show_last_active}
            onValueChange={(val) => handleUpdatePreference({ show_last_active: val })}
          />

          <SettingsToggleRow
            icon={UserCheck}
            label="Read Receipts"
            description="Allow chat partners to see when you've read messages."
            value={preferences.read_receipts_enabled}
            onValueChange={(val) => handleUpdatePreference({ read_receipts_enabled: val })}
          />

          <SettingsValueRow
            label="Profile Visibility"
            valueText={visibilityLabels[preferences.profile_visibility || "campus"] || "Campus Allies"}
            onPress={() =>
              setActivePicker({
                title: "Profile Visibility",
                description: "Control who can view your full bio and profile details.",
                options: [
                  { value: "campus", label: "Campus Allies", sublabel: "All verified students on campus" },
                  { value: "matches_only", label: "Connected Friends Only", sublabel: "Only mutual connections" },
                  { value: "hidden", label: "Hidden / Incognito", sublabel: "Hide profile from student listings" },
                ],
                selectedValue: preferences.profile_visibility || "campus",
                onSelect: (val) => handleUpdatePreference({ profile_visibility: val }),
              })
            }
          />

          <SettingsValueRow
            label="Default Feed Audience"
            valueText={feedAudienceLabels[preferences.feed_post_audience || "campus"] || "Campus Public"}
            onPress={() =>
              setActivePicker({
                title: "Default Feed Audience",
                description: "Initial audience when drafting campus confessions.",
                options: [
                  { value: "campus", label: "Campus Public", sublabel: "Visible to all verified students" },
                  { value: "matches_only", label: "Mutual Allies Only", sublabel: "Visible only to connected allies" },
                  { value: "anonymous_only", label: "Always Anonymous", sublabel: "Mask your name and avatar" },
                ],
                selectedValue: preferences.feed_post_audience || "campus",
                onSelect: (val) => handleUpdatePreference({ feed_post_audience: val }),
              })
            }
          />

          <SettingsRow
            icon={Ban}
            label="Blocked Users"
            onPress={() => router.push("/pages/blocked-users" as any)}
          />

          <SettingsRow
            icon={Shield}
            label="Privacy Policy"
            onPress={() => Linking.openURL("https://ally-jis.com/privacy")}
          />
        </View>

        {/* SECTION 3: NOTIFICATIONS & ALERTS */}
        <SectionHeader label="Notifications & Alerts" />
        <View style={{ backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE7E1", borderBottomWidth: 1, borderBottomColor: "#EAE7E1" }}>
          <SettingsToggleRow
            icon={Flame}
            label="Streak Reminders (10:00 PM)"
            description="Daily notification reminder if your streak hasn't been activated."
            value={preferences.notify_streak_reminders}
            onValueChange={(val) => handleUpdatePreference({ notify_streak_reminders: val })}
          />

          <SettingsToggleRow
            icon={MessageSquare}
            label="Direct Chat Messages"
            description="Push notifications for new chat messages."
            value={preferences.notify_chat_messages}
            onValueChange={(val) => handleUpdatePreference({ notify_chat_messages: val })}
          />

          <SettingsToggleRow
            icon={Bell}
            label="Match & Ally Requests"
            description="Alerts when an Ally connection is requested."
            value={preferences.notify_match_requests !== false}
            onValueChange={(val) => handleUpdatePreference({ notify_match_requests: val })}
          />

          <SettingsToggleRow
            icon={Bell}
            label="Confessions & Feed Alerts"
            description="Updates on reactions, replies, and trending campus posts."
            value={preferences.notify_confessions !== false}
            onValueChange={(val) => handleUpdatePreference({ notify_confessions: val })}
          />

          <SettingsToggleRow
            icon={Volume2}
            label="In-App Sound Effects"
            description="Audio chimes for messages and interactions."
            value={preferences.notify_sound_enabled}
            onValueChange={(val) => handleUpdatePreference({ notify_sound_enabled: val })}
          />

          <SettingsToggleRow
            icon={Clock}
            label="Quiet Hours (Do Not Disturb)"
            description="Mute push alerts between 10:00 PM and 7:00 AM."
            value={preferences.quiet_hours_enabled}
            onValueChange={(val) => handleUpdatePreference({ quiet_hours_enabled: val })}
          />
        </View>

        {/* SECTION 4: ACTIVITY LOG */}
        <SectionHeader label="Activity Log" />
        <View style={{ backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE7E1", borderBottomWidth: 1, borderBottomColor: "#EAE7E1" }}>
          <SettingsRow
            icon={History}
            label="Activity Log"
            onPress={() => router.push("/pages/activity-log" as any)}
          />
        </View>

        {/* SECTION 5: APP & DANGER ZONE */}
        <SectionHeader label="App & Danger Zone" />
        <View style={{ backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#EAE7E1", borderBottomWidth: 1, borderBottomColor: "#EAE7E1" }}>
          <SettingsRow
            icon={RotateCw}
            label={checkingUpdate ? "Checking for updates…" : "Check for Updates"}
            onPress={handleManualCheckForUpdates}
          />
          <SettingsRow
            icon={LogOut}
            label="Log Out"
            onPress={() => setShowLogoutConfirm(true)}
          />
          <SettingsRow
            icon={Trash2}
            label="Delete Account Permanently"
            onPress={() => setShowDeleteConfirm(true)}
            destructive
          />
        </View>

        {/* About App Footer */}
        <SectionHeader label="About" />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderTopWidth: 1,
            borderTopColor: "#EAE7E1",
            borderBottomWidth: 1,
            borderBottomColor: "#EAE7E1",
          }}
        >
          <Info size={18} color="#9CA3AF" />
          <Text style={{ fontSize: 14, color: "#6B7280" }}>
            Ally-jis v{currentVersion}
          </Text>
        </View>

        <Text
          style={{
            fontSize: 11,
            color: "#9CA3AF",
            textAlign: "center",
            marginTop: 24,
            paddingHorizontal: 32,
            lineHeight: 16,
          }}
        >
          Made for CHMSU Alijis Campus students.{"\n"}© 2026 Ally-jis
        </Text>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
          onPress={() => setShowPasswordModal(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Lock size={20} color="#1A6B3C" />
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                Change Password
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: "#6B7280", marginBottom: 18 }}>
              Ensure your account uses a strong password with at least 8 characters.
            </Text>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
                  Current Password
                </Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    value={currentPass}
                    onChangeText={setCurrentPass}
                    secureTextEntry={!showPassText}
                    placeholder="••••••••"
                    placeholderTextColor="#9CA3AF"
                    style={{
                      borderWidth: 1,
                      borderColor: "#D1D5DB",
                      borderRadius: 12,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      paddingRight: 40,
                      fontSize: 14,
                      color: "#111827",
                    }}
                  />
                  <Pressable
                    onPress={() => setShowPassText(!showPassText)}
                    style={{ position: "absolute", right: 12, top: 12 }}
                  >
                    {showPassText ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                  </Pressable>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
                  New Password (min 8 chars)
                </Text>
                <TextInput
                  value={newPass}
                  onChangeText={setNewPass}
                  secureTextEntry={!showPassText}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    borderWidth: 1,
                    borderColor: "#D1D5DB",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: "#111827",
                  }}
                />
              </View>

              <View>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
                  Confirm New Password
                </Text>
                <TextInput
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry={!showPassText}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  style={{
                    borderWidth: 1,
                    borderColor: "#D1D5DB",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    fontSize: 14,
                    color: "#111827",
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <Pressable
                onPress={() => setShowPasswordModal(false)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#4B5563" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleChangePasswordSubmit}
                disabled={savingPassword}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: "#1A6B3C",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  opacity: savingPassword ? 0.6 : 1,
                }}
              >
                {savingPassword && <ActivityIndicator size="small" color="#FFFFFF" />}
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>
                  {savingPassword ? "Updating…" : "Update Password"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Generic Selection Picker Modal */}
      {activePicker && (
        <Modal
          visible={Boolean(activePicker)}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePicker(null)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => setActivePicker(null)}
          >
            <Pressable
              style={{
                backgroundColor: "#FFFFFF",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingHorizontal: 20,
                paddingTop: 24,
                paddingBottom: insets.bottom + 24,
                maxHeight: "80%",
              }}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
                {activePicker.title}
              </Text>
              {activePicker.description ? (
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 4, marginBottom: 16 }}>
                  {activePicker.description}
                </Text>
              ) : (
                <View style={{ height: 16 }} />
              )}

              <ScrollView showsVerticalScrollIndicator={false}>
                {activePicker.options.map((opt) => {
                  const isSelected = activePicker.selectedValue === opt.value;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      onPress={() => {
                        activePicker.onSelect(opt.value);
                        setActivePicker(null);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        backgroundColor: isSelected ? "rgba(26,107,60,0.08)" : "#F9F8F6",
                        borderWidth: 1,
                        borderColor: isSelected ? "#1A6B3C" : "#EAE7E1",
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "700",
                            color: isSelected ? "#1A6B3C" : "#111827",
                          }}
                        >
                          {opt.label}
                        </Text>
                        {opt.sublabel && (
                          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                            {opt.sublabel}
                          </Text>
                        )}
                      </View>
                      {isSelected && <Check size={18} color="#1A6B3C" />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* Confirmation Modals */}
      <ConfirmModal
        visible={showLogoutConfirm}
        title="Log out?"
        description="You'll need to sign back in to access your account."
        confirmLabel="Log Out"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete your account?"
        description="This action is permanent. All your data, posts, chat history, and connections will be permanently wiped."
        confirmLabel={deleting ? "Deleting…" : "Delete Account"}
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#9CA3AF",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  onPress,
  destructive,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      style={{
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#F0EDE8",
      }}
    >
      <Icon size={18} color={destructive ? "#EF4444" : "#374151"} />
      <Text
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: "500",
          color: destructive ? "#EF4444" : "#111827",
        }}
      >
        {label}
      </Text>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}

function SettingsValueRow({
  label,
  valueText,
  onPress,
}: {
  label: string;
  valueText: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.04)" }}
      style={{
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F0EDE8",
      }}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: "#111827" }}>
          {label}
        </Text>
        <Text style={{ fontSize: 12, color: "#1A6B3C", fontWeight: "600", marginTop: 2 }}>
          {valueText}
        </Text>
      </View>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}

function SettingsToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon?: any;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#F0EDE8",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", flex: 1, paddingRight: 16, gap: 12 }}>
        {Icon && (
          <View style={{ marginTop: 2 }}>
            <Icon size={18} color="#4B5563" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#111827" }}>
            {label}
          </Text>
          {description && (
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 16 }}>
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#E5E7EB", true: "#1A6B3C" }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}
