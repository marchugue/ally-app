import { useState } from "react";
import { View, Text, Pressable, Image, StatusBar, Modal, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight, Sparkles, X, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react-native";

export default function LandingPage() {
  const insets = useSafeAreaInsets();
  const [pressed, setPressed] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A6B3C" }}>
      <StatusBar barStyle="light-content" />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 32,
          justifyContent: "space-between",
        }}
      >
            {/* Release Notes Chip at Top */}
            <View style={{ alignItems: "center" }}>
              <Pressable
                onPress={() => setShowReleaseNotes(true)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: "rgba(232, 168, 56, 0.2)",
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(232, 168, 56, 0.4)",
                }}
              >
                <Sparkles size={14} color="#E8A838" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
                  Alpha Test 1.0 • Testers & Developers Only
                </Text>
              </Pressable>
            </View>

        {/* Brand section */}
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>

          <Text style={{ fontSize: 40, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1.5 }}>
            lly<Text style={{ color: "#E8A838" }}>-jis</Text>
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              marginTop: 10,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            The social space for{"\n"}CHMSU Alijis Campus
          </Text>
        </View>

        {/* CTA */}
        <View style={{ alignItems: "center", marginTop: "auto", marginBottom: -12 }}>
          <Pressable
            onPress={() => router.push("/pages/register" as any)}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            android_ripple={{ color: "rgba(0,0,0,0.08)" }}
            style={{
              backgroundColor: "#FFFFFF",
              opacity: pressed ? 0.85 : 1,
              borderRadius: 12,
              paddingVertical: 17,
              width: "100%",
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              marginBottom: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text style={{ color: "#1A6B3C", fontWeight: "700", fontSize: 15, letterSpacing: 0.1 }}>
              Get Started
            </Text>
            <ArrowRight size={18} color="#1A6B3C" />
          </Pressable>

          <Pressable onPress={() => router.push("/pages/login")} hitSlop={8} style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)" }}>
              I already have an account{" "}
              <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>Sign in</Text>
            </Text>
          </Pressable>

          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              lineHeight: 16,
            }}
          >
            For CHMSU Alijis Campus students only
          </Text>
        </View>
      </View>

      {/* ── Scrollable Release Notes Modal ── */}
      <Modal
        visible={showReleaseNotes}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReleaseNotes(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "85%",
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom + 16, 24),
            }}
          >
            {/* Header */}
            <View style={{ paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F0EDE8", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#1A6B3C15", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={20} color="#1A6B3C" />
                </View>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#1A6B3C" }}>
                    Alpha Test 1.0
                  </Text>
                  <Text style={{ fontSize: 12, color: "#E8A838", fontWeight: "700" }}>
                    Selected Testers & Developers Only
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setShowReleaseNotes(false)} hitSlop={10}>
                <X size={22} color="#6B7280" />
              </Pressable>
            </View>

            {/* Scrollable Content */}
            <ScrollView style={{ paddingHorizontal: 24, paddingTop: 16 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Highlight Banner */}
              <View style={{ backgroundColor: "#FFFBEB", borderRadius: 16, padding: 14, marginBottom: 20, borderWidth: 1.5, borderColor: "#FCD34D" }}>
                <Text style={{ fontSize: 13, color: "#B45309", fontWeight: "800", marginBottom: 4 }}>
                  ⚠️ Alpha Test 1.0 — Internal Preview
                </Text>
                <Text style={{ fontSize: 13, color: "#78350F", lineHeight: 19 }}>
                  This build is strictly intended for selected student testers and developer feedback only. Features, match algorithms, and storage schemas are actively being evaluated and refined.
                </Text>
              </View>

              {/* What's New & Included */}
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#1A6B3C", letterSpacing: 0.5, marginBottom: 12, textTransform: "uppercase" }}>
                ✨ Features in Version 1.0.0
              </Text>

              {[
                { title: "Smart Peer Matching", desc: "Calculates match percentage based on 3+ shared interest tags & organization affiliations." },
                { title: "Intentional Connections", desc: "Send connection requests before unlocking direct chat to ensure safe campus interactions." },
                { title: "Campus Feed & Media", desc: "Share posts, images, comments, and like student activities across departments." },
                { title: "Direct APK Website Hosting", desc: "Self-hosted directly on official website ally-jis.xyz with instant update notifications." },
              ].map((item, i) => (
                <View key={i} className="flex-row" style={{ flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                  <CheckCircle2 size={18} color="#1A6B3C" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{item.title}</Text>
                    <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 18, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              {/* Known Limitations / Work in Progress */}
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#E8A838", letterSpacing: 0.5, marginTop: 12, marginBottom: 12, textTransform: "uppercase" }}>
                ⚠️ Current System Notes & Limitations
              </Text>

              {[
                { title: "Bypassed App Store Distribution", desc: "App is distributed via direct APK host (ally-jis.xyz) instead of Google Play Store." },
                { title: "Offline & Connection Shield", desc: "Requires active internet. Prompts Reconnect / Exit screen if connection drops." },
                { title: "CHMSU Alijis Verification", desc: "Account creation is restricted to verified student credentials." },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" }}>
                  <AlertTriangle size={18} color="#E8A838" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>{item.title}</Text>
                    <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 18, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F0EDE8" }}>
                <ShieldCheck size={16} color="#1A6B3C" />
                <Text style={{ fontSize: 12, color: "#6B7280", textAlign: "center" }}>
                  Official Ally-jis Mobile Release • ally-jis.xyz
                </Text>
              </View>
            </ScrollView>

            {/* Bottom Button */}
            <View style={{ paddingHorizontal: 24, paddingTop: 12 }}>
              <Pressable
                onPress={() => setShowReleaseNotes(false)}
                style={{
                  backgroundColor: "#1A6B3C",
                  borderRadius: 16,
                  paddingVertical: 14,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>Got it!</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}