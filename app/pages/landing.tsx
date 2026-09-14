import { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  StatusBar,
  Modal,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Sparkles, X, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";

export default function LandingPage() {
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  const [pressed, setPressed] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Release Notes Chip */}
      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setShowReleaseNotes(true)}
          style={styles.chip}
        >
          <Sparkles size={13} color="#1A6B3C" />
          <Text style={styles.chipText}>Official Release v1.0 • CHMSU Alijis Campus</Text>
        </Pressable>
      </View>

      {/* Center Brand + Illustration area */}
      <View style={styles.centerContent}>
        {/* Logo blob */}
        <View style={styles.logoBlob}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.brandName}>
          ally<Text style={styles.brandAccent}>-jis</Text>
        </Text>
        <Text style={styles.tagline}>The social space for{"\n"}CHMSU Alijis Campus</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🎓 Campus Exclusive</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>🔒 Verified Students</Text>
          </View>
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <Pressable
          onPress={() => router.push("/pages/select-email" as any)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={[styles.getStartedBtn, pressed && styles.getStartedBtnPressed]}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
          <ArrowRight size={18} color="#FFFFFF" />
        </Pressable>

        <Pressable onPress={() => router.push("/pages/login")} hitSlop={8} style={styles.signInRow}>
          <Text style={styles.signInText}>
            Already have an account?{" "}
            <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </Pressable>

        <Text style={styles.disclaimer}>For CHMSU Alijis Campus students only</Text>
      </View>

      {/* ── Scrollable Release Notes Modal ── */}
      <Modal
        visible={showReleaseNotes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReleaseNotes(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom + 16, 24) },
            ]}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <Sparkles size={20} color="#1A6B3C" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Official Release v1.0</Text>
                  <Text style={styles.modalSubtitle}>CHMSU Alijis Campus</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowReleaseNotes(false)} hitSlop={10}>
                <X size={22} color="#6B7280" />
              </Pressable>
            </View>

            {/* Scrollable Content */}
            <ScrollView
              style={{ paddingHorizontal: 24, paddingTop: 16 }}
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {/* Highlight Banner */}
              <View style={styles.releaseBanner}>
                <Text style={styles.releaseTitle}>🚀 Official Release v1.0 — Now Live!</Text>
                <Text style={styles.releaseBody}>
                  Welcome to the official full release of Ally-jis for all CHMSU Alijis students.
                  Connect, share, chat, and find study peers across campus safely and seamlessly.
                </Text>
              </View>

              <Text style={styles.sectionLabel}>✨ Features in Version 1.0.0</Text>

              {[
                { title: "Smart Peer Matching", desc: "Calculates match percentage based on 3+ shared interest tags & organization affiliations." },
                { title: "Intentional Connections", desc: "Send connection requests before unlocking direct chat to ensure safe campus interactions." },
                { title: "Campus Feed & Media", desc: "Share posts, images, comments, and like student activities across departments." },
                { title: "Direct APK Website Hosting", desc: "Self-hosted directly on official website ally-jis.xyz with instant update notifications." },
              ].map((item, i) => (
                <View key={i} style={styles.featureRow}>
                  <CheckCircle2 size={18} color="#1A6B3C" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <Text style={styles.featureDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              <Text style={[styles.sectionLabel, { color: "#D97706", marginTop: 12 }]}>
                ⚠️ Current System Notes & Limitations
              </Text>

              {[
                { title: "Bypassed App Store Distribution", desc: "App is distributed via direct APK host (ally-jis.xyz) instead of Google Play Store." },
                { title: "Offline & Connection Shield", desc: "Requires active internet. Prompts Reconnect / Exit screen if connection drops." },
                { title: "CHMSU Alijis Verification", desc: "Account creation is restricted to verified student credentials." },
              ].map((item, i) => (
                <View key={i} style={styles.featureRow}>
                  <AlertTriangle size={18} color="#D97706" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.featureTitle}>{item.title}</Text>
                    <Text style={styles.featureDesc}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.footerRow}>
                <ShieldCheck size={16} color="#1A6B3C" />
                <Text style={styles.footerText}>Official Ally-jis Mobile Release • ally-jis.xyz</Text>
              </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setShowReleaseNotes(false)}
                style={({ pressed }) => [
                  styles.modalCloseBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.modalCloseBtnText}>Got it!</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  chipRow: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1A6B3C",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  logoBlob: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#BBF7D0",
    overflow: "hidden",
    shadowColor: "#1A6B3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  brandName: {
    fontSize: 42,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -1.5,
    marginTop: 4,
  },
  brandAccent: {
    color: "#1A6B3C",
  },
  tagline: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  badge: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeText: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "600",
  },
  ctaSection: {
    paddingHorizontal: 32,
    paddingBottom: 12,
    alignItems: "center",
    gap: 12,
  },
  getStartedBtn: {
    backgroundColor: "#1A6B3C",
    borderRadius: 16,
    paddingVertical: 17,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1A6B3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  getStartedBtnPressed: {
    opacity: 0.88,
  },
  getStartedText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.2,
  },
  signInRow: {
    paddingVertical: 4,
  },
  signInText: {
    fontSize: 13,
    color: "#6B7280",
  },
  signInLink: {
    color: "#1A6B3C",
    fontWeight: "700",
  },
  disclaimer: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
    paddingTop: 20,
  },
  modalHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A6B3C",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#1A6B3C",
    fontWeight: "700",
  },
  releaseBanner: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
  },
  releaseTitle: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "800",
    marginBottom: 4,
  },
  releaseBody: {
    fontSize: 13,
    color: "#14532D",
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1A6B3C",
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  featureDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  footerText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  modalFooter: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  modalCloseBtn: {
    backgroundColor: "#1A6B3C",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});