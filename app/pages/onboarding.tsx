import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Dimensions,
  StatusBar,
  Image,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ArrowLeft } from "lucide-react-native";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth/AuthContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const BLOB_SIZE = Math.min(SCREEN_WIDTH * 0.65, SCREEN_HEIGHT * 0.28, 230);

const SLIDES = [
  {
    image: require("../../assets/images/onboarding-1.jpeg"),
    title: "Connect with Peers",
    subtitle:
      "Meet fellow CHMSU Alijis students who share your vibe. Make real campus connections — not just followers.",
  },
  {
    image: require("../../assets/images/onboarding-2.jpeg"),
    title: "Match Your Interests",
    subtitle:
      "Tell us what you love — sports, tech, arts, and more. Ally-jis uses your interests to find your perfect match.",
  },
  {
    image: require("../../assets/images/onboarding-3.jpeg"),
    title: "Join Campus Life",
    subtitle:
      "Stay in the loop with the campus feed. Share moments, react to posts, and explore events happening around you.",
  },
];

const GREEN = "#1A6B3C";

async function markOnboardingDone() {
  try {
    await AsyncStorage.setItem("onboarding_done", "1");
  } catch (_) { }
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  const [activeIndex, setActiveIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const activeAnim = useRef(new Animated.Value(0)).current;

  const isLast = activeIndex === SLIDES.length - 1;

  const goToSlide = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= SLIDES.length) return;

    setActiveIndex(nextIndex);

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: nextIndex,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(activeAnim, {
        toValue: nextIndex,
        friction: 7,
        tension: 50,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleBack = () => {
    if (activeIndex > 0) {
      goToSlide(activeIndex - 1);
    } else {
      router.replace("/pages/login" as any);
    }
  };

  const handleSkip = async () => {
    await markOnboardingDone();
    router.replace("/pages/login" as any);
  };

  const handleContinue = () => {
    goToSlide(activeIndex + 1);
  };

  const handleGetStarted = async () => {
    await markOnboardingDone();
    router.replace("/pages/select-email" as any);
  };

  // Translation: Slide 0 is at 0, Slide 1 is at -SCREEN_WIDTH, Slide 2 is at -SCREEN_WIDTH * 2
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -SCREEN_WIDTH, -SCREEN_WIDTH * 2],
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Bar: Back Arrow (upper left) & Skip (upper right) */}
      <View style={styles.topBar}>
        {activeIndex > 0 ? (
          <Pressable
            onPress={handleBack}
            hitSlop={14}
            style={styles.iconBtn}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={24} color={GREEN} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        {!isLast ? (
          <Pressable
            onPress={handleSkip}
            hitSlop={14}
            style={styles.skipBtn}
            accessibilityLabel="Skip onboarding"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>

      {/* Upper Section: Illustrations (anchored at x=0, slides horizontally) */}
      <View style={styles.illustrationSection}>
        <Animated.View
          style={[
            styles.slidingRow,
            {
              width: SCREEN_WIDTH * SLIDES.length,
              transform: [{ translateX }],
            },
          ]}
        >
          {SLIDES.map((slide, index) => (
            <View key={index} style={[styles.slideColumn, { width: SCREEN_WIDTH }]}>
              <View style={styles.blob}>
                <Image
                  source={slide.image}
                  style={styles.illustration}
                  resizeMode="contain"
                />
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Center: 3 Dots with Fluid Movement Animation (Fixed in center) */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const dotWidth = activeAnim.interpolate({
            inputRange: [i - 1, i, i + 1],
            outputRange: [8, 24, 8],
            extrapolate: "clamp",
          });

          const dotColor = activeAnim.interpolate({
            inputRange: [i - 1, i, i + 1],
            outputRange: ["#BBF7D0", GREEN, "#BBF7D0"],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  backgroundColor: dotColor,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Middle Section: Title & Subtitle (anchored at x=0, slides in sync) */}
      <View style={styles.textSection}>
        <Animated.View
          style={[
            styles.slidingRow,
            {
              width: SCREEN_WIDTH * SLIDES.length,
              transform: [{ translateX }],
            },
          ]}
        >
          {SLIDES.map((slide, index) => (
            <View key={index} style={[styles.slideColumn, { width: SCREEN_WIDTH }]}>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.subtitle}>{slide.subtitle}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Bottom CTA Area: Full-width green filled rounded button */}
      <View style={[styles.ctaArea, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <Button
          label={!isLast ? "Continue" : "Get Started"}
          variant="primary"
          pill
          size="lg"
          onPress={!isLast ? handleContinue : handleGetStarted}
          style={{ backgroundColor: GREEN, width: "100%" }}
          className="w-full"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between",
  },

  // Top Bar (Back arrow on left, Skip on right)
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
    height: 48,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
    color: GREEN,
  },

  // Illustration section: anchored at left x=0 so slide 0, 1, 2 are in exact positions
  illustrationSection: {
    width: SCREEN_WIDTH,
    height: BLOB_SIZE + 16,
    overflow: "hidden",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  slidingRow: {
    flexDirection: "row",
    alignItems: "center",
    left: 0,
  },
  slideColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  blob: {
    width: BLOB_SIZE,
    height: BLOB_SIZE,
    borderRadius: BLOB_SIZE / 2,
    backgroundColor: "#E8F5EE",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  illustration: {
    width: "100%",
    height: "100%",
  },

  // 3 Animated Dots (Centered)
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // Text section: anchored at left x=0
  textSection: {
    width: SCREEN_WIDTH,
    height: 105,
    overflow: "hidden",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },

  // Bottom CTA container
  ctaArea: {
    width: "100%",
    paddingHorizontal: 32,
    paddingTop: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
