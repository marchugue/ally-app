// 1. React & React Native
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 2. Navigation & Safe Area
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Storage & Context
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth/AuthContext";
import { useNetwork } from "@/context/NetworkContext";

// 4. API & Types
import { changePassword } from "@/lib/api/auth";
import { getMyPreferences, updateMyPreferences } from "@/lib/api/profiles";
import type { UpdateUserPreferencesPayload, UserPreferences } from "@/types/profile";

// 5. Icons
import {
  ArrowLeft,
  Ban,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Flame,
  History,
  Key,
  Lock,
  MessageSquare,
  Moon,
  Pencil,
  RotateCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserCheck,
  Volume2,
} from "lucide-react-native";

// 6. Components
import { ConfirmModal } from "@/components/ConfirmModal";
import { PasswordStrengthMeter } from "@/components/buttons/password";

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

  // Help & FAQ modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Privacy Controls Modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Dark Mode state (preview feature)
  const [darkMode, setDarkMode] = useState(false);

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

  // Load dark mode state & preferences on mount
  useEffect(() => {
    AsyncStorage.getItem("ally_dark_mode")
      .then((val) => {
        if (val === "true") setDarkMode(true);
      })
      .catch(() => {});

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
        getMyPreferences(accessToken)
          .then((data) => {
            if (data) setPreferences(data);
          })
          .catch(() => {});
      }
    },
    [accessToken]
  );

  const handleToggleDarkMode = async (val: boolean) => {
    setDarkMode(val);
    try {
      await AsyncStorage.setItem("ally_dark_mode", val ? "true" : "false");
    } catch {}
    Alert.alert(
      val ? "Dark Mode Enabled" : "Dark Mode Disabled",
      val
        ? "Dark mode theme preview has been toggled on."
        : "Standard theme restored."
    );
  };

  const handleOpenPermissions = async () => {
    try {
      await Linking.openSettings();
    } catch {
      Alert.alert("Permissions", "Please manage app permissions in your device settings.");
    }
  };

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

  const currentVisibilityText = visibilityLabels[preferences.profile_visibility || "campus"] || "Campus Allies";
  const currentFeedAudienceText = feedAudienceLabels[preferences.feed_post_audience || "campus"] || "Campus Public";

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F8FA" }}>
      {/* Top Header with Back Navigation */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "#E5E7EB",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 3,
            elevation: 1,
          }}
        >
          <ArrowLeft size={18} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Large Page Title */}
      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 }}>
        <Text
          style={{
            fontSize: 32,
            fontFamily: "PlusJakartaSans-Bold",
            color: "#111827",
            letterSpacing: -0.6,
          }}
        >
          Setting
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 48,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 1. ACCOUNT (ALWAYS ON TOP) ── */}
        <SectionTitle title="Account" />

        {/* User Account / Email */}
        <SettingCard
          icon={ShieldCheck}
          title={user?.email ? user.email.split("@")[0] : "Verified Student"}
          badgeText="Verified"
          badgeColor="#1A6B3C"
          badgeBgColor="rgba(26,107,60,0.1)"
        />

        {/* Edit Profile */}
        <SettingCard
          icon={Pencil}
          title="Edit Profile"
          onPress={() => router.push("/pages/edit-profile" as any)}
        />

        {/* Change Password */}
        <SettingCard
          icon={Key}
          title="Change Password"
          onPress={() => setShowPasswordModal(true)}
        />

        {/* ── 2. PRIVACY & SECURITY ── */}
        <SectionTitle title="Privacy & Security" />

        {/* Privacy Controls */}
        <SettingCard
          icon={Lock}
          title="Privacy Controls"
          onPress={() => setShowPrivacyModal(true)}
        />

        {/* Permissions */}
        <SettingCard
          icon={Shield}
          title="Permissions"
          onPress={handleOpenPermissions}
        />

        {/* Private Account */}
        <SettingToggleCard
          icon={EyeOff}
          title="Private Account"
          value={preferences.account_privacy === "private"}
          onValueChange={(val) =>
            handleUpdatePreference({ account_privacy: val ? "private" : "public" })
          }
        />

        {/* Online Status */}
        <SettingToggleCard
          icon={Smartphone}
          title="Online Status"
          value={preferences.show_online_status}
          onValueChange={(val) => handleUpdatePreference({ show_online_status: val })}
        />

        {/* Last Active Timestamp */}
        <SettingToggleCard
          icon={Clock}
          title="Last Active Timestamp"
          value={preferences.show_last_active}
          onValueChange={(val) => handleUpdatePreference({ show_last_active: val })}
        />

        {/* Read Receipts */}
        <SettingToggleCard
          icon={UserCheck}
          title="Read Receipts"
          value={preferences.read_receipts_enabled}
          onValueChange={(val) => handleUpdatePreference({ read_receipts_enabled: val })}
        />

        {/* Blocked Users */}
        <SettingCard
          icon={Ban}
          title="Blocked Users"
          onPress={() => router.push("/pages/blocked-users" as any)}
        />

        {/* Restricted Users */}
        <SettingCard
          icon={ShieldAlert}
          title="Restricted Users"
          onPress={() => router.push("/pages/restricted-users" as any)}
        />

        {/* Privacy Policy */}
        <SettingCard
          icon={ShieldCheck}
          title="Privacy Policy"
          onPress={() => Linking.openURL("https://ally-jis.com/privacy")}
        />

        {/* ── 3. APPEARANCE & ALERTS ── */}
        <SectionTitle title="Appearance & Alerts" />

        {/* Dark Mode */}
        <SettingToggleCard
          icon={Sun}
          title="Dark Mode"
          value={darkMode}
          onValueChange={handleToggleDarkMode}
        />

        {/* Notifications / Direct Chat */}
        <SettingToggleCard
          icon={Bell}
          title="Direct Chat Messages"
          value={preferences.notify_chat_messages}
          onValueChange={(val) => handleUpdatePreference({ notify_chat_messages: val })}
        />

        {/* Match & Ally Requests */}
        <SettingToggleCard
          icon={Bell}
          title="Match & Ally Requests"
          value={preferences.notify_match_requests}
          onValueChange={(val) => handleUpdatePreference({ notify_match_requests: val })}
        />

        {/* Streak Reminders */}
        <SettingToggleCard
          icon={Flame}
          title="Streak Reminders"
          value={preferences.notify_streak_reminders}
          onValueChange={(val) => handleUpdatePreference({ notify_streak_reminders: val })}
        />

        {/* Feed & Confession Alerts */}
        <SettingToggleCard
          icon={MessageSquare}
          title="Feed & Confession Alerts"
          value={preferences.notify_confessions}
          onValueChange={(val) => handleUpdatePreference({ notify_confessions: val })}
        />

        {/* In-App Sounds */}
        <SettingToggleCard
          icon={Volume2}
          title="In-App Sounds"
          value={preferences.notify_sound_enabled}
          onValueChange={(val) => handleUpdatePreference({ notify_sound_enabled: val })}
        />

        {/* Quiet Hours (Do Not Disturb) */}
        <SettingToggleCard
          icon={Moon}
          title="Quiet Hours (Do Not Disturb)"
          value={preferences.quiet_hours_enabled}
          onValueChange={(val) => handleUpdatePreference({ quiet_hours_enabled: val })}
        />

        {/* Quiet Hours Time Configuration */}
        {preferences.quiet_hours_enabled && (
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              padding: 16,
              marginBottom: 10,
              borderWidth: 1,
              borderColor: "#F0F2F5",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.03,
              shadowRadius: 5,
              elevation: 1,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontFamily: "PlusJakartaSans-Bold",
                color: "#374151",
                marginBottom: 10,
              }}
            >
              Quiet Hours Schedule
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setActivePicker({
                    title: "Quiet Hours Start",
                    description: "Select when quiet hours start.",
                    options: [
                      { value: "20:00", label: "8:00 PM" },
                      { value: "21:00", label: "9:00 PM" },
                      { value: "22:00", label: "10:00 PM (Default)" },
                      { value: "23:00", label: "11:00 PM" },
                      { value: "00:00", label: "12:00 AM (Midnight)" },
                    ],
                    selectedValue: preferences.quiet_hours_start || "22:00",
                    onSelect: (val) => handleUpdatePreference({ quiet_hours_start: val }),
                  });
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#F9F8F6",
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#EAE7E1",
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans-Bold", color: "#6B7280" }}>
                  Starts at
                </Text>
                <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#1A6B3C", marginTop: 2 }}>
                  {preferences.quiet_hours_start || "22:00"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setActivePicker({
                    title: "Quiet Hours End",
                    description: "Select when quiet hours end.",
                    options: [
                      { value: "06:00", label: "6:00 AM" },
                      { value: "07:00", label: "7:00 AM (Default)" },
                      { value: "08:00", label: "8:00 AM" },
                      { value: "09:00", label: "9:00 AM" },
                    ],
                    selectedValue: preferences.quiet_hours_end || "07:00",
                    onSelect: (val) => handleUpdatePreference({ quiet_hours_end: val }),
                  });
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#F9F8F6",
                  borderRadius: 14,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#EAE7E1",
                }}
              >
                <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans-Bold", color: "#6B7280" }}>
                  Ends at
                </Text>
                <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#1A6B3C", marginTop: 2 }}>
                  {preferences.quiet_hours_end || "07:00"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── 4. SUPPORT ── */}
        <SectionTitle title="Support" />

        {/* Help & FAQ */}
        <SettingCard
          icon={CircleHelp}
          title="Help & FAQ"
          onPress={() => setShowHelpModal(true)}
        />

        {/* Activity Log */}
        <SettingCard
          icon={History}
          title="Activity Log"
          onPress={() => router.push("/pages/activity-log" as any)}
        />

        {/* Check for Updates */}
        <SettingCard
          icon={RotateCw}
          title={checkingUpdate ? "Checking for updates…" : "Check for Updates"}
          loading={checkingUpdate}
          onPress={handleManualCheckForUpdates}
        />

        {/* ── 5. DANGER ZONE ── */}
        <SectionTitle title="Danger Zone" />

        {/* Delete Account */}
        <SettingCard
          icon={Trash2}
          title="Delete Account Permanently"
          destructive
          onPress={() => setShowDeleteConfirm(true)}
        />

        {/* ── 6. SESSION / LOG OUT (CENTERED, NO BG PILL, RED LABEL ONLY) ── */}
        <View style={{ marginTop: 22, alignItems: "center", justifyContent: "center" }}>
          <TouchableOpacity
            onPress={() => setShowLogoutConfirm(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 20,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontFamily: "PlusJakartaSans-Bold",
                color: "#DC2626",
                textAlign: "center",
              }}
            >
              Log Out
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Footer Info */}
        <View style={{ marginTop: 20, alignItems: "center" }}>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "PlusJakartaSans",
              color: "#9CA3AF",
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            Ally-jis v{currentVersion} • CHMSU Alijis Campus{"\n"}© 2026 Ally-jis. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* Privacy Controls Modal */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setShowPrivacyModal(false)}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingHorizontal: 22,
              paddingTop: 24,
              paddingBottom: insets.bottom + 24,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ fontSize: 19, fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
                Privacy Controls
              </Text>
              <TouchableOpacity
                onPress={() => setShowPrivacyModal(false)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#6B7280" }}>
                  Done
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "PlusJakartaSans", color: "#6B7280", marginBottom: 20 }}>
              Manage how your profile and campus posts are visible to other students.
            </Text>

            {/* Profile Visibility Row */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setShowPrivacyModal(false);
                setTimeout(() => {
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
                  });
                }, 300);
              }}
              style={{
                backgroundColor: "#F9F8F6",
                borderRadius: 18,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#EAE7E1",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14.5, fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
                  Profile Visibility
                </Text>
                <Text style={{ fontSize: 12.5, fontFamily: "PlusJakartaSans", color: "#1A6B3C", marginTop: 2 }}>
                  {currentVisibilityText}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Default Feed Audience Row */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                setShowPrivacyModal(false);
                setTimeout(() => {
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
                  });
                }, 300);
              }}
              style={{
                backgroundColor: "#F9F8F6",
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: "#EAE7E1",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 14.5, fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
                  Default Feed Audience
                </Text>
                <Text style={{ fontSize: 12.5, fontFamily: "PlusJakartaSans", color: "#1A6B3C", marginTop: 2 }}>
                  {currentFeedAudienceText}
                </Text>
              </View>
              <ChevronRight size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Help & FAQ Modal */}
      <Modal
        visible={showHelpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHelpModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 20,
          }}
          activeOpacity={1}
          onPress={() => setShowHelpModal(false)}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 22,
              maxHeight: "80%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 10,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <CircleHelp size={22} color="#1A6B3C" />
              <Text style={{ fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
                Help & FAQ
              </Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <HelpItem
                question="How does student matching work?"
                answer="Ally-jis matches students using campus interests and study preferences. Chats begin anonymously and reveal progressively as you converse."
              />
              <HelpItem
                question="How do streaks work?"
                answer="Chat with your allies daily before midnight to maintain your streak flame! If inactive, your streak resets."
              />
              <HelpItem
                question="Is my identity protected?"
                answer="Yes! All confessions and initial chats keep your avatar and real name hidden until you choose to reveal yourself."
              />
              <HelpItem
                question="How do I report inappropriate behavior?"
                answer="Tap the three dots on any confession or chat header to block or report users immediately to campus moderation."
              />
            </ScrollView>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowHelpModal(false);
                  Linking.openURL("mailto:support@ally-jis.com?subject=Ally-jis%20Support%20Request");
                }}
                activeOpacity={0.7}
                style={{
                  backgroundColor: "#1A6B3C",
                  borderRadius: 14,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <ExternalLink size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#FFFFFF" }}>
                  Contact Campus Support
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowHelpModal(false)}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 10,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "PlusJakartaSans-Bold", color: "#6B7280" }}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            paddingHorizontal: 22,
          }}
          activeOpacity={1}
          onPress={() => setShowPasswordModal(false)}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 24,
              padding: 24,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.15,
              shadowRadius: 24,
              elevation: 12,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Lock size={20} color="#1A6B3C" />
              <Text style={{ fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
                Change Password
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, fontFamily: "PlusJakartaSans", color: "#6B7280", marginBottom: 18 }}>
              Ensure your account uses a strong password with at least 8 characters.
            </Text>

            <View style={{ gap: 14 }}>
              <View>
                <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans-Bold", color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
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
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 11,
                      paddingRight: 40,
                      fontSize: 14,
                      fontFamily: "PlusJakartaSans",
                      color: "#111827",
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassText(!showPassText)}
                    activeOpacity={0.7}
                    style={{ position: "absolute", right: 12, top: 12 }}
                  >
                    {showPassText ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
                  </TouchableOpacity>
                </View>
              </View>

              <View>
                <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans-Bold", color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
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
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    fontSize: 14,
                    fontFamily: "PlusJakartaSans",
                    color: "#111827",
                  }}
                />
                <PasswordStrengthMeter value={newPass} />
              </View>

              <View>
                <Text style={{ fontSize: 11, fontFamily: "PlusJakartaSans-Bold", color: "#4B5563", marginBottom: 6, textTransform: "uppercase" }}>
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
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    fontSize: 14,
                    fontFamily: "PlusJakartaSans",
                    color: "#111827",
                  }}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(false)}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                }}
              >
                <Text style={{ fontSize: 13, fontFamily: "PlusJakartaSans-Bold", color: "#4B5563" }}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleChangePasswordSubmit}
                disabled={savingPassword}
                activeOpacity={0.7}
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
                <Text style={{ fontSize: 13, fontFamily: "PlusJakartaSans-Bold", color: "#FFFFFF" }}>
                  {savingPassword ? "Updating…" : "Update Password"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Generic Selection Picker Modal */}
      {activePicker && (
        <Modal
          visible={Boolean(activePicker)}
          transparent
          animationType="fade"
          onRequestClose={() => setActivePicker(null)}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            activeOpacity={1}
            onPress={() => setActivePicker(null)}
          >
            <View
              style={{
                backgroundColor: "#FFFFFF",
                borderTopLeftRadius: 28,
                borderTopRightRadius: 28,
                paddingHorizontal: 22,
                paddingTop: 24,
                paddingBottom: insets.bottom + 24,
                maxHeight: "80%",
              }}
              onStartShouldSetResponder={() => true}
            >
              <Text style={{ fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: "#111827" }}>
                {activePicker.title}
              </Text>
              {activePicker.description ? (
                <Text style={{ fontSize: 13, fontFamily: "PlusJakartaSans", color: "#6B7280", marginTop: 4, marginBottom: 16 }}>
                  {activePicker.description}
                </Text>
              ) : (
                <View style={{ height: 16 }} />
              )}

              <ScrollView showsVerticalScrollIndicator={false}>
                {activePicker.options.map((opt) => {
                  const isSelected = activePicker.selectedValue === opt.value;
                  return (
                    <TouchableOpacity
                      key={String(opt.value)}
                      activeOpacity={0.7}
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
                        borderRadius: 16,
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
                            fontFamily: "PlusJakartaSans-Bold",
                            color: isSelected ? "#1A6B3C" : "#111827",
                          }}
                        >
                          {opt.label}
                        </Text>
                        {opt.sublabel && (
                          <Text style={{ fontSize: 12, fontFamily: "PlusJakartaSans", color: "#6B7280", marginTop: 2 }}>
                            {opt.sublabel}
                          </Text>
                        )}
                      </View>
                      {isSelected && <Check size={18} color="#1A6B3C" />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
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

/**
 * Section title (e.g. "Account", "Privacy & Security", "Appearance & Alerts")
 */
function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: 14.5,
        fontFamily: "PlusJakartaSans-Bold",
        color: "#1F2937",
        marginTop: 22,
        marginBottom: 10,
        marginLeft: 4,
      }}
    >
      {title}
    </Text>
  );
}

/**
 * Custom Slim Animated Switch
 * Slimmer pill shape with smooth sliding animation
 */
function SlimSwitch({
  value,
  onValueChange,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: value ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [value, animValue]);

  // Track is 44px wide, thumb is 20px wide
  // Range is from 2px (left) to 22px (right)
  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["#E2E4E8", "#1A6B3C"],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          backgroundColor,
          justifyContent: "center",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: "#FFFFFF",
            transform: [{ translateX }],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 1.5 },
            shadowOpacity: 0.18,
            shadowRadius: 2,
            elevation: 2,
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Action card without icon background pill and without description subtitle
 */
function SettingCard({
  icon: Icon,
  title,
  onPress,
  destructive = false,
  badgeText,
  badgeColor = "#1A6B3C",
  badgeBgColor = "rgba(26,107,60,0.1)",
  rightElement,
  loading = false,
}: {
  icon: any;
  title: string;
  onPress?: () => void;
  destructive?: boolean;
  badgeText?: string;
  badgeColor?: string;
  badgeBgColor?: string;
  rightElement?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingVertical: 15,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#F0F2F5",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
      }}
    >
      <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
        <Icon size={21} color={destructive ? "#DC2626" : "#374151"} strokeWidth={1.8} />
      </View>
      <Text
        style={{
          flex: 1,
          marginLeft: 14,
          fontSize: 15.5,
          fontFamily: "PlusJakartaSans-Bold",
          color: destructive ? "#DC2626" : "#111827",
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {loading ? (
        <ActivityIndicator size="small" color="#1A6B3C" />
      ) : rightElement ? (
        rightElement
      ) : badgeText ? (
        <View
          style={{
            backgroundColor: badgeBgColor,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
          }}
        >
          <Text style={{ fontSize: 11.5, fontFamily: "PlusJakartaSans-Bold", color: badgeColor }}>
            {badgeText}
          </Text>
        </View>
      ) : onPress ? (
        <ChevronRight size={19} color="#C4C8D0" strokeWidth={2.2} />
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * Toggle card with custom SlimSwitch, no icon background pill, and no description subtitle
 */
function SettingToggleCard({
  icon: Icon,
  title,
  value,
  onValueChange,
  disabled = false,
}: {
  icon: any;
  title: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        paddingVertical: 15,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 10,
        borderWidth: 1,
        borderColor: "#F0F2F5",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 5,
        elevation: 1,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View style={{ width: 24, alignItems: "center", justifyContent: "center" }}>
        <Icon size={21} color="#374151" strokeWidth={1.8} />
      </View>
      <Text
        style={{
          flex: 1,
          marginLeft: 14,
          fontSize: 15.5,
          fontFamily: "PlusJakartaSans-Bold",
          color: "#111827",
        }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <SlimSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </TouchableOpacity>
  );
}

/**
 * FAQ Collapsible Item
 */
function HelpItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setOpen(!open)}
      activeOpacity={0.7}
      style={{
        backgroundColor: "#F9F8F6",
        borderRadius: 14,
        padding: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#EAE7E1",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 13.5, fontFamily: "PlusJakartaSans-Bold", color: "#111827", flex: 1, paddingRight: 8 }}>
          {question}
        </Text>
        <ChevronRight
          size={16}
          color="#9CA3AF"
          style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}
        />
      </View>
      {open && (
        <Text style={{ fontSize: 12.5, fontFamily: "PlusJakartaSans", color: "#4B5563", marginTop: 8, lineHeight: 17 }}>
          {answer}
        </Text>
      )}
    </TouchableOpacity>
  );
}
