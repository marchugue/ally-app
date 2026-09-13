import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Lock, Camera } from "lucide-react-native";
import { IdUploadIllustration } from "@/components/OnboardingIllustrations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GREEN = "#1A6B3C";

function cleanUri(val: unknown): string {
  if (!val) return "";
  if (Array.isArray(val)) {
    for (let i = val.length - 1; i >= 0; i--) {
      if (typeof val[i] === "string" && val[i].trim().length > 0) {
        return val[i].trim();
      }
    }
    return "";
  }
  if (typeof val === "string") return val.trim();
  return String(val);
}

export default function IdUploadScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  // Keep frontUri tracked across navigation
  const parsedFrontUri = cleanUri(params.frontUri || params.studentIdFrontUri);
  const [frontUri, setFrontUri] = useState<string | null>(parsedFrontUri || null);

  // Step is "back" if params.step === "back" or frontUri was passed back from id-scan-front
  const isBackStep = Boolean(
    params.step === "back" || ((parsedFrontUri || frontUri) && params.step !== "front")
  );

  useEffect(() => {
    const cleaned = cleanUri(params.frontUri);
    if (cleaned) {
      setFrontUri(cleaned);
    }
    if (params.step === "front") {
      setFrontUri(null);
    }
  }, [params.frontUri, params.step]);

  const handleBack = () => {
    if (isBackStep) {
      // Return to Front ID step
      setFrontUri(null);
      router.replace({
        pathname: "/pages/id-upload" as any,
        params: {
          ...params,
          frontUri: "",
          step: "front",
        },
      });
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/pages/register" as any);
      }
    }
  };

  const handleScanFront = () => {
    router.push({
      pathname: "/pages/id-scan-front" as any,
      params: {
        ...params,
        returnTo: "id-upload",
      },
    });
  };

  const handleScanBack = () => {
    router.push({
      pathname: "/pages/id-scan-back" as any,
      params: {
        ...params,
        frontUri: frontUri || (params.frontUri as string) || "",
        returnTo: "id-upload",
      },
    });
  };

  const handleSkipBack = () => {
    router.replace({
      pathname: "/pages/id-upload-success" as any,
      params: {
        ...params,
        frontUri: frontUri || (params.frontUri as string) || "",
        backUri: "",
      },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Bar: Back Arrow (left), Title (center), Skip button (upper right for back side) */}
      <View style={styles.topBar}>
        <Pressable onPress={handleBack} hitSlop={14} style={styles.iconBtn} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={GREEN} />
        </Pressable>
        <Text style={styles.topBarTitle}>Student Verification</Text>
        {isBackStep ? (
          <Pressable
            onPress={handleSkipBack}
            hitSlop={14}
            style={styles.skipTopBtn}
            accessibilityLabel="Skip back side"
          >
            <Text style={styles.skipTopBtnText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Top Illustration */}
        <View style={styles.illustrationWrapper}>
          <IdUploadIllustration size={Math.min(SCREEN_WIDTH * 0.42, 160)} />
        </View>

        {/* Step Badge */}
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>
            {isBackStep ? "Step 2 of 2 • Back Side" : "Step 1 of 2 • Front Side"}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {isBackStep ? "Scan Back of ID" : "Scan Front ID or COR"}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          {isBackStep
            ? "Now capture the back side of your student ID, or skip if your card has no back."
            : "Please scan the front side of your CHMSU student ID or official Certificate of Registration."}
        </Text>

        {/* Instruction Bullets */}
        <View style={styles.bulletsContainer}>
          {isBackStep ? (
            <>
              <BulletRow text="Capture the back of your physical Student ID." />
              <BulletRow text="Ensure barcode, student signature, or validation stamps are clearly visible." />
              <BulletRow text="Optional — tap Skip in the top right if your ID only has one side." />
            </>
          ) : (
            <>
              <BulletRow text="Capture your physical Student ID or Certificate of Registration (COR)." />
              <BulletRow text="Ensure your full name, student ID number, and current school year are visible." />
              <BulletRow text="Avoid glare, blur, reflections, or cut-off corners." />
            </>
          )}
        </View>

        {/* Security Reminder Box */}
        <View style={styles.securityBox}>
          <Lock size={16} color="#6B7280" />
          <Text style={styles.securityText}>
            Your ID is securely encrypted and stored solely for campus enrollment verification. Never shared publicly.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom CTA: The button triggers capture for both front and back */}
      <View style={styles.ctaArea}>
        <Pressable
          style={styles.scanBtnCta}
          onPress={isBackStep ? handleScanBack : handleScanFront}
        >
          <Camera size={20} color="#FFFFFF" />
          <Text style={styles.scanBtnCtaText}>
            {isBackStep ? "Scan Back ID" : "Scan Front ID to Continue"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 48,
  },
  topBarTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  skipTopBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  skipTopBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    alignItems: "center",
  },
  illustrationWrapper: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  stepBadge: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    marginBottom: 10,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  title: {
    fontSize: 22, fontWeight: "800", color: "#111827",
    textAlign: "center", marginBottom: 8, letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  bulletsContainer: {
    width: "100%", backgroundColor: "#F9FAFB",
    borderRadius: 14, padding: 16, marginBottom: 16, gap: 10,
  },
  bulletDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: GREEN, marginTop: 6, marginRight: 10,
  },
  bulletText: { flex: 1, fontSize: 13, color: "#4B5563", lineHeight: 18 },
  securityBox: {
    width: "100%", flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(107,114,128,0.08)", borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(107,114,128,0.15)", gap: 10,
  },
  securityText: { flex: 1, fontSize: 12, color: "#4B5563", lineHeight: 16 },

  // Bottom CTA trigger button
  ctaArea: { width: "100%", paddingHorizontal: 22, paddingTop: 8 },
  scanBtnCta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: GREEN, borderRadius: 50, paddingVertical: 16,
    shadowColor: GREEN, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  scanBtnCtaText: { fontSize: 16, fontWeight: "700", color: "#FFFFFF" },
});
