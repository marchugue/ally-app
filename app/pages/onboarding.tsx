import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StatusBar,
  Image,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Modal,
  useWindowDimensions,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  FileText,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";

const BRAND_GREEN = "#1A6B3C";
const BRAND_GREEN_DARK = "#155a33";
const BRAND_GREEN_LIGHT = "#E8F5EE";
const BRAND_GREEN_BORDER = "#BBF7D0";

/**
 * 3-slide Get Started onboarding specification:
 * 1. Introduction: What is Ally-jis
 * 2. Terms & Policies: with "See terms and policy" label link
 * 3. Continue with Us: Invitation to join the campus community
 * Illustrations are sourced from the public illustrations collection.
 */
const SLIDES = [
  {
    key: "intro",
    image: require("../../assets/images/illustrations/email-select.jpg"),
    title: "What is Ally-jis?",
    paragraph:
      "Ally-jis is the exclusive campus social and peer-matching platform designed for CHMSU Alijis students. Connect with classmates, share campus life, and collaborate safely within our university community.",
  },
  {
    key: "terms",
    image: require("../../assets/images/illustrations/step-id-upload.jpg"),
    title: "Campus Guidelines & Terms",
    paragraph:
      "We are committed to maintaining a safe, authentic, and respectful space for every student. By joining, you agree to our campus standards and privacy policies.",
    hasTermsLink: true,
  },
  {
    key: "continue",
    image: require("../../assets/images/illustrations/step-3-interests.jpg"),
    title: "Continue with Us",
    paragraph:
      "Step into your campus network today. Discover shared passions, join student discussions, and make lifelong college connections. We're excited to have you onboard!",
  },
];

const TERMS_TEXT = `Welcome to Ally-jis!

By using this platform, you agree to comply with our community standards and terms of use:

1. Campus Exclusive: Ally-jis is built exclusively for CHMSU Alijis Campus students.
2. Authenticity: Provide true profile information (department, course, and year level). Impersonation of students or staff is strictly prohibited.
3. Respectful Conduct: Treat fellow students with kindness and respect. Harassment, bullying, hate speech, or inappropriate media uploads will result in immediate account suspension.
4. Privacy & Safety: Direct messaging requires mutual connection approval to prevent unwanted interactions.

Official Terms on Website: https://ally-jis.com/terms`;

const PRIVACY_TEXT = `Campus Privacy Policy for Ally-jis:

1. Data Collection: We collect essential profile details (username, institutional email, course, year level, avatar, and bio) and interest selections.
2. Purpose: Your data is used exclusively to calculate peer match scores and facilitate genuine campus connections.
3. Data Safety: We never sell or share your personal data with third-party advertisers. Your information remains strictly within the CHMSU community.
4. Student Rights: You can update your profile information or request complete account deletion at any time.

Official Policy on Website: https://ally-jis.com/privacy`;

async function markOnboardingDone() {
  try {
    await AsyncStorage.setItem("onboarding_done", "1");
  } catch (_) {}
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [modalTab, setModalTab] = useState<"terms" | "privacy">("terms");

  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Animation for smooth in-place fade of text content below dots
  const textFadeAnim = useRef(new Animated.Value(1)).current;
  const textSlideAnim = useRef(new Animated.Value(0)).current;

  // Trigger smooth cross-fade when slide changes
  useEffect(() => {
    textFadeAnim.setValue(0);
    textSlideAnim.setValue(6);

    Animated.parallel([
      Animated.timing(textFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(textSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex]);

  const isLast = activeIndex === SLIDES.length - 1;

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= SLIDES.length) return;
      setActiveIndex(index);
      scrollRef.current?.scrollTo({
        x: index * windowWidth,
        animated: true,
      });
    },
    [windowWidth]
  );

  const handleBack = () => {
    if (activeIndex > 0) {
      goToSlide(activeIndex - 1);
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/pages/landing" as any);
      }
    }
  };

  const handleSkip = async () => {
    await markOnboardingDone();
    router.replace("/pages/login" as any);
  };

  const handleCta = async () => {
    if (!isLast) {
      goToSlide(activeIndex + 1);
    } else {
      await markOnboardingDone();
      router.replace("/pages/register" as any);
    }
  };

  // Responsive sizing for illustration
  const blobSize = Math.min(windowWidth * 0.72, windowHeight * 0.32, 260);

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Top Bar: Back Arrow (left) & Skip (right) ── */}
      <View style={styles.topBar}>
        {activeIndex > 0 ? (
          <Pressable
            onPress={handleBack}
            hitSlop={14}
            style={styles.iconBtn}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color={BRAND_GREEN} />
          </Pressable>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}

        <View style={styles.topCenterLogo}>
          <Text style={styles.topBrandText}>
            ally<Text style={{ color: BRAND_GREEN }}>-jis</Text>
          </Text>
        </View>

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

      {/* ── 1. Upper Section: ONLY the image slides ── */}
      <View style={[styles.illustrationSection, { height: blobSize + 24 }]}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / windowWidth);
            if (newIndex >= 0 && newIndex < SLIDES.length && newIndex !== activeIndex) {
              setActiveIndex(newIndex);
            }
          }}
          style={{ width: windowWidth }}
        >
          {SLIDES.map((slide, index) => (
            <View
              key={slide.key}
              style={[styles.imageSlideColumn, { width: windowWidth }]}
            >
              <View
                style={[
                  styles.illustrationBlob,
                  {
                    width: blobSize,
                    height: blobSize,
                    borderRadius: blobSize / 2,
                  },
                ]}
              >
                <Image
                  source={slide.image}
                  style={styles.illustrationImage}
                  resizeMode="contain"
                />
              </View>
            </View>
          ))}
        </Animated.ScrollView>
      </View>

      {/* ── 2. Indication 3 dots directly on bottom of illustration ── */}
      <View style={styles.dotsRow}>
        {SLIDES.map((_, i) => {
          const dotWidth = scrollX.interpolate({
            inputRange: [
              (i - 1) * windowWidth,
              i * windowWidth,
              (i + 1) * windowWidth,
            ],
            outputRange: [8, 28, 8],
            extrapolate: "clamp",
          });

          const dotColor = scrollX.interpolate({
            inputRange: [
              (i - 1) * windowWidth,
              i * windowWidth,
              (i + 1) * windowWidth,
            ],
            outputRange: ["#E5E7EB", BRAND_GREEN, "#E5E7EB"],
            extrapolate: "clamp",
          });

          const dotOpacity = scrollX.interpolate({
            inputRange: [
              (i - 1) * windowWidth,
              i * windowWidth,
              (i + 1) * windowWidth,
            ],
            outputRange: [0.6, 1, 0.6],
            extrapolate: "clamp",
          });

          return (
            <Pressable
              key={i}
              onPress={() => goToSlide(i)}
              hitSlop={12}
              accessibilityLabel={`Go to slide ${i + 1}`}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    backgroundColor: dotColor,
                    opacity: dotOpacity,
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      {/* ── 3. Paragraph on the bottom of the dots (Stable in-place) ── */}
      <View style={styles.contentSection}>
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textFadeAnim,
              transform: [{ translateY: textSlideAnim }],
            },
          ]}
        >
          <Text style={styles.slideTitle}>{SLIDES[activeIndex].title}</Text>
          <Text style={styles.slideParagraph}>
            {SLIDES[activeIndex].paragraph}
          </Text>

          {/* Slide 2: "See terms and policy" label link */}
          {SLIDES[activeIndex].hasTermsLink && (
            <Pressable
              onPress={() => setShowTermsModal(true)}
              style={({ pressed }) => [
                styles.termsLinkBadge,
                pressed && styles.termsLinkBadgePressed,
              ]}
              hitSlop={8}
              accessibilityRole="link"
              accessibilityLabel="See terms and policy"
            >
              <ShieldCheck size={16} color={BRAND_GREEN} style={{ marginRight: 6 }} />
              <Text style={styles.termsLinkText}>See terms and policy</Text>
              <ArrowRight size={13} color={BRAND_GREEN} style={{ marginLeft: 5 }} />
            </Pressable>
          )}
        </Animated.View>
      </View>

      {/* ── 4. Bottom CTA: One rounded button ── */}
      <View style={styles.bottomCtaSection}>
        <Pressable
          onPress={handleCta}
          style={({ pressed }) => [
            styles.roundedCtaButton,
            pressed && styles.roundedCtaButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Next"
        >
          <Text style={styles.roundedCtaButtonText}>Next</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await markOnboardingDone();
            router.replace("/pages/login" as any);
          }}
          hitSlop={8}
          style={styles.signInRow}
        >
          <Text style={styles.signInPrompt}>
            Already have an account?{" "}
            <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </Pressable>
      </View>

      {/* ── Legal / Terms & Policy Sheet Modal ── */}
      <Modal
        visible={showTermsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom + 16, 24) },
            ]}
          >
            {/* Sheet Handle */}
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <ShieldCheck size={20} color={BRAND_GREEN} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Campus Terms & Policy</Text>
                  <Text style={styles.modalSubtitle}>CHMSU Alijis Campus Standards</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowTermsModal(false)}
                hitSlop={12}
                style={styles.modalCloseBtn}
              >
                <X size={20} color="#6B7280" />
              </Pressable>
            </View>

            {/* Segmented Tab Switcher */}
            <View style={styles.tabSwitcher}>
              <Pressable
                onPress={() => setModalTab("terms")}
                style={[
                  styles.tabButton,
                  modalTab === "terms" && styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    modalTab === "terms" && styles.tabButtonTextActive,
                  ]}
                >
                  Terms & Conditions
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setModalTab("privacy")}
                style={[
                  styles.tabButton,
                  modalTab === "privacy" && styles.tabButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    modalTab === "privacy" && styles.tabButtonTextActive,
                  ]}
                >
                  Privacy Policy
                </Text>
              </Pressable>
            </View>

            {/* Scrollable Legal Content */}
            <ScrollView
              style={styles.modalScrollView}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
            >
              <View style={styles.legalCallout}>
                <CheckCircle2 size={16} color={BRAND_GREEN} style={{ marginTop: 2 }} />
                <Text style={styles.legalCalloutText}>
                  Ally-jis is exclusive to verified students of CHMSU Alijis Campus.
                  Authentic participation ensures safety and trust for everyone.
                </Text>
              </View>

              <Text style={styles.legalBodyText}>
                {modalTab === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
              </Text>
            </ScrollView>

            {/* Modal Bottom Button */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={() => setShowTermsModal(false)}
                style={({ pressed }) => [
                  styles.modalDoneButton,
                  pressed && { opacity: 0.9, backgroundColor: BRAND_GREEN_DARK },
                ]}
              >
                <Text style={styles.modalDoneButtonText}>I Understand</Text>
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
    justifyContent: "space-between",
  },

  // Top Bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
    paddingHorizontal: 20,
    height: 52,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
  topCenterLogo: {
    alignItems: "center",
    justifyContent: "center",
  },
  topBrandText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
  },
  skipBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
  },

  // 1. Illustration Section: Only image slides horizontally
  illustrationSection: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imageSlideColumn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  illustrationBlob: {
    backgroundColor: BRAND_GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#F0FDF4",
    ...Platform.select({
      ios: {
        shadowColor: BRAND_GREEN,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  illustrationImage: {
    width: "100%",
    height: "100%",
  },

  // 2. Indication 3 dots directly on bottom of illustration
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // 3. Paragraph on bottom of dots
  contentSection: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 150,
  },
  textContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  slideParagraph: {
    fontSize: 15,
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
  },

  // "See terms and policy" label link
  termsLinkBadge: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND_GREEN_LIGHT,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BRAND_GREEN_BORDER,
  },
  termsLinkBadgePressed: {
    backgroundColor: "#DCFCE7",
    transform: [{ scale: 0.98 }],
  },
  termsLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_GREEN,
    letterSpacing: -0.2,
  },

  // 4. Bottom CTA: One rounded button
  bottomCtaSection: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 12,
    alignItems: "center",
  },
  roundedCtaButton: {
    width: "100%",
    height: 54,
    borderRadius: 9999, // fully rounded pill
    backgroundColor: BRAND_GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: BRAND_GREEN,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  roundedCtaButtonPressed: {
    backgroundColor: BRAND_GREEN_DARK,
    transform: [{ scale: 0.985 }],
  },
  roundedCtaButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },

  signInRow: {
    marginTop: 14,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  signInPrompt: {
    fontSize: 14,
    color: "#6B7280",
  },
  signInLink: {
    color: BRAND_GREEN,
    fontWeight: "700",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    maxHeight: "86%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BRAND_GREEN_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  tabSwitcher: {
    flexDirection: "row",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonActive: {
    backgroundColor: BRAND_GREEN,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  modalScrollView: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  legalCallout: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: BRAND_GREEN_LIGHT,
    borderWidth: 1,
    borderColor: BRAND_GREEN_BORDER,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  legalCalloutText: {
    flex: 1,
    fontSize: 12,
    color: BRAND_GREEN_DARK,
    lineHeight: 18,
    fontWeight: "500",
  },
  legalBodyText: {
    fontSize: 13.5,
    color: "#374151",
    lineHeight: 22,
  },

  modalFooter: {
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  modalDoneButton: {
    width: "100%",
    height: 50,
    borderRadius: 9999,
    backgroundColor: BRAND_GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDoneButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
