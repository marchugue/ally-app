import { View, Text, Pressable, ScrollView, Linking, Alert } from "react-native";
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
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useNetwork } from "@/context/NetworkContext";
import { deleteMyProfile } from "@/lib/api/profiles";
import { ConfirmModal } from "@/components/ConfirmModal";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { deleteAccount, signOut } = useAuth();
  const { currentVersion, checkForUpdates } = useNetwork();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

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
      setDeleting(false);
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
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Section */}
        <SectionHeader label="Profile" />
        <SettingsRow
          icon={Pencil}
          label="Edit Profile"
          onPress={() => router.push("/pages/edit-profile" as any)}
        />

        {/* Privacy Section */}
        <SectionHeader label="Privacy & Safety" />
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

        {/* System & Updates */}
        <SectionHeader label="App & Updates" />
        <SettingsRow
          icon={RotateCw}
          label={checkingUpdate ? "Checking for updates…" : "Check for Updates"}
          onPress={handleManualCheckForUpdates}
        />

        {/* Account Section */}
        <SectionHeader label="Account" />
        <SettingsRow
          icon={Lock}
          label="Change Password"
          onPress={() => router.push("/pages/forgot-password" as any)}
        />
        <SettingsRow
          icon={LogOut}
          label="Log Out"
          onPress={() => setShowLogoutConfirm(true)}
        />
        <SettingsRow
          icon={Trash2}
          label="Delete Account"
          onPress={() => setShowDeleteConfirm(true)}
          destructive
        />

        {/* About */}
        <SectionHeader label="About" />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 20,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
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

      {/* Confirm modals */}
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
        description="This action is permanent. All your data, posts, and connections will be deleted and cannot be recovered."
        confirmLabel="Delete Account"
        destructive
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: "#9CA3AF",
          letterSpacing: 1,
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
          fontSize: 15,
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
