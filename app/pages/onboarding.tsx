import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Image,
  StyleSheet,
  Linking,
  useWindowDimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { ArrowRight } from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";

const OFFICIAL_WEBSITE_URL = "https://ally-jis.com";
const BRAND_GREEN = "#1A6B3C";

async function markOnboardingDone() {
  try {
    await AsyncStorage.setItem("onboarding_done", "1");
  } catch (_) {}
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user, isLoading } = useAuth();
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  const handleGetStarted = async () => {
    if (navigating) return;
    setNavigating(true);
    await markOnboardingDone();
    router.replace("/pages/login" as any);
  };

  const handleLearnMore = async () => {
    try {
      await WebBrowser.openBrowserAsync(OFFICIAL_WEBSITE_URL);
    } catch {
      Linking.openURL(OFFICIAL_WEBSITE_URL).catch(() => {});
    }
  };

  const headlineSize = Math.min(Math.max(windowWidth * 0.095, 34), 44);
  const haloSize = Math.min(windowWidth * 0.88, 380);
  const isCompactHeight = windowHeight < 700;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Background Web-Matched Campus Gradient Canvas ── */}
      <LinearGradient
        colors={["#F4FAF6", "#FBF2DC", "#DDF1E4", "#1A6B3C"]}
        locations={[0, 0.28, 0.56, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient Web Radial Glows & Translucent Halo Ring Behind Subject */}
      <View pointerEvents="none" style={styles.ambientStage}>
        <View
          style={[
            styles.glowGold,
            {
              width: haloSize * 1.15,
              height: haloSize * 1.15,
              borderRadius: haloSize,
            },
          ]}
        />
        <View
          style={[
            styles.haloRing,
            {
              width: haloSize,
              height: haloSize,
              borderRadius: haloSize / 2,
              borderWidth: Math.round(haloSize * 0.085),
            },
          ]}
        />
      </View>

      {/* ── Full-Screen Web Hero Image Treated as Background ── */}
      <View pointerEvents="none" style={styles.heroImageContainer}>
        <Image
          source={require("../../assets/images/hero-lyca.png")}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* ── Smooth Deep-Emerald Bottom Scrim for High Text Readability ── */}
      <LinearGradient
        colors={[
          "rgba(11, 56, 31, 0)",
          "rgba(11, 56, 31, 0.38)",
          "rgba(10, 48, 27, 0.88)",
          "#072414",
        ]}
        locations={[0, 0.25, 0.56, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomScrim}
        pointerEvents="none"
      />

      {/* ── Foreground Editorial Copy & Full-Width Action Buttons (Single Page) ── */}
      <View
        style={[
          styles.contentOverlay,
          {
            paddingBottom: Math.max(insets.bottom + 18, 28),
            paddingHorizontal: 24,
          },
        ]}
      >
        <View style={styles.copyBlock}>
          <Text
            style={[
              styles.headline,
              {
                fontSize: headlineSize,
                lineHeight: headlineSize * 1.12,
              },
            ]}
          >
            Build connections{"\n"}
            <Text style={styles.headlineItalic}>that matter.</Text>
          </Text>

          <Text
            style={[
              styles.subtitle,
              isCompactHeight && { fontSize: 13.5, lineHeight: 19.5, marginTop: 8 },
            ]}
          >
            We help CHMSU students create genuine campus friendships with clarity and purpose.
            From first-year orientation to graduation, everything you need in one place.
          </Text>
        </View>

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleGetStarted}
            disabled={navigating}
            style={[styles.primaryBtn, navigating && styles.primaryBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleLearnMore}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Learn More"
          >
            <Text style={styles.secondaryBtnText}>Learn More</Text>
            <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.2} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#072414",
  },
  ambientStage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: "18%",
  },
  glowGold: {
    position: "absolute",
    top: "8%",
    backgroundColor: "rgba(232, 168, 56, 0.16)",
  },
  haloRing: {
    borderColor: "rgba(255, 255, 255, 0.52)",
    backgroundColor: "transparent",
  },
  heroImageContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  bottomScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "58%",
  },
  contentOverlay: {
    flex: 1,
    zIndex: 10,
    justifyContent: "flex-end",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  copyBlock: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  headline: {
    fontFamily: "Fraunces_700Bold",
    color: "#FFFFFF",
    textAlign: "left",
    letterSpacing: -0.6,
  },
  headlineItalic: {
    fontFamily: "Fraunces_400Regular_Italic",
    color: "#6EE7B7",
  },
  subtitle: {
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(255, 255, 255, 0.88)",
    textAlign: "left",
    marginTop: 12,
  },
  buttonGroup: {
    width: "100%",
  },
  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: BRAND_GREEN,
    borderWidth: 1,
    borderColor: "rgba(110, 231, 183, 0.35)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
  secondaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.45)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontSize: 15.5,
    color: "#FFFFFF",
    letterSpacing: 0.1,
  },
});
