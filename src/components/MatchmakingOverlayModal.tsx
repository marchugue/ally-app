import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  StyleSheet,
} from "react-native";
import {
  ArrowLeft,
  X,
  Sparkles,
  RotateCw,
  Check,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMatchmaking, UseMatchmakingResult } from "@/hooks/useMatchmaking";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { avatarColorFor } from "@/constants/matchOptions";

// ─── Anonymous Mascot Pool with Solid Background Colors ──────────────────────
const AVATAR_POOL = [
  { key: "fox", emoji: "🦊", bgColor: "#E05A47" },    // Vibrant Terracotta
  { key: "wolf", emoji: "🐺", bgColor: "#7C3AED" },   // Rich Violet
  { key: "panda", emoji: "🐼", bgColor: "#D97706" },  // Warm Amber
  { key: "owl", emoji: "🦉", bgColor: "#059669" },    // Emerald Green
  { key: "otter", emoji: "🦦", bgColor: "#0891B2" },  // Deep Cyan
  { key: "falcon", emoji: "🦅", bgColor: "#DB2777" }, // Hot Magenta
];

const NUM_AVATARS = AVATAR_POOL.length;
const TRAVEL_MIN = -170; // Left boundary (offscreen / fade-in)
const TRAVEL_MAX = 170;  // Right boundary (offscreen / fade-out)
const TOTAL_SPAN = TRAVEL_MAX - TRAVEL_MIN; // 340px
const CYCLE_DURATION = 9000; // 9 seconds to glide smoothly across

// ─── Telemetry Status Messages (Random Text While Searching) ─────────────────
const TELEMETRY_MESSAGES = [
  "Calibrating CHMSU campus frequency locator…",
  "Scanning active student allies on Alijis campus…",
  "Analyzing course compatibility & curriculum year…",
  "Harmonizing mutual interests and tech stack…",
  "Locking onto an anonymous peer session…",
  "Matching communication styles & availability…",
  "Seeking campus allies nearby…",
];

// ─── Twinkling Starfield (Animotion B06 & CR28 Celestial Stars) ──────────────
const STAR_COORDS = [
  { id: 1, top: 0.08, left: 0.12, size: 2.5, color: "#FCD34D" },
  { id: 2, top: 0.16, left: 0.84, size: 2, color: "#6EE7B7" },
  { id: 3, top: 0.23, left: 0.26, size: 3, color: "#FFFFFF" },
  { id: 4, top: 0.29, left: 0.74, size: 2, color: "#FDE68A" },
  { id: 5, top: 0.38, left: 0.09, size: 2.5, color: "#FFFFFF" },
  { id: 6, top: 0.44, left: 0.92, size: 2, color: "#A7F3D0" },
  { id: 7, top: 0.62, left: 0.15, size: 3, color: "#FCD34D" },
  { id: 8, top: 0.71, left: 0.85, size: 2.5, color: "#FFFFFF" },
  { id: 9, top: 0.81, left: 0.22, size: 2, color: "#6EE7B7" },
  { id: 10, top: 0.88, left: 0.76, size: 2.5, color: "#FDE68A" },
  { id: 11, top: 0.52, left: 0.87, size: 2, color: "#FFFFFF" },
  { id: 12, top: 0.76, left: 0.38, size: 2, color: "#FCD34D" },
];

const CONSTELLATIONS = [
  { id: "c1", top: 0.12, left: 0.22, size: 13, color: "#FCD34D" },
  { id: "c2", top: 0.19, left: 0.78, size: 14, color: "#6EE7B7" },
  { id: "c3", top: 0.69, left: 0.1, size: 12, color: "#A7F3D0" },
  { id: "c4", top: 0.8, left: 0.88, size: 14, color: "#FDE68A" },
];

function CelestialStarfield() {
  const twinkleAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkleAnim, {
          toValue: 0.95,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(twinkleAnim, {
          toValue: 0.35,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [twinkleAnim]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {STAR_COORDS.map((star) => (
        <Animated.View
          key={star.id}
          style={{
            position: "absolute",
            top: `${star.top * 100}%`,
            left: `${star.left * 100}%`,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: star.color,
            opacity: twinkleAnim,
            shadowColor: star.color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.9,
            shadowRadius: 4,
          }}
        />
      ))}

      {CONSTELLATIONS.map((c) => (
        <Animated.Text
          key={c.id}
          style={{
            position: "absolute",
            top: `${c.top * 100}%`,
            left: `${c.left * 100}%`,
            fontSize: c.size,
            color: c.color,
            opacity: twinkleAnim,
          }}
        >
          ✦
        </Animated.Text>
      ))}
    </View>
  );
}

// ─── Fisheye Left-to-Right Conveyor Component ────────────────────────────────
// Each avatar flows in ONE direction from left to right.
// Center avatar is large (fisheye scale 1.4x).
// Sides shrink down (0.7x).
// Items disappear at the right edge and appear at the left edge seamlessly.
function FisheyeConveyor() {
  // Array of independent Animated.Value coordinates for each avatar
  const posAnims = useRef(
    AVATAR_POOL.map((_, i) => {
      const initialX = TRAVEL_MIN + (i / NUM_AVATARS) * TOTAL_SPAN;
      return new Animated.Value(initialX);
    })
  ).current;

  useEffect(() => {
    const runningAnimations: Animated.CompositeAnimation[] = [];

    AVATAR_POOL.forEach((_, i) => {
      const animVal = posAnims[i];
      const initialX = TRAVEL_MIN + (i / NUM_AVATARS) * TOTAL_SPAN;
      const remainingDistance = TRAVEL_MAX - initialX;
      const firstLegDuration = CYCLE_DURATION * (remainingDistance / TOTAL_SPAN);

      // First leg: travel from initial position to right boundary
      const firstLeg = Animated.timing(animVal, {
        toValue: TRAVEL_MAX,
        duration: Math.max(100, firstLegDuration),
        easing: Easing.linear,
        useNativeDriver: true,
      });

      // Subsequent continuous loop: reset to TRAVEL_MIN and glide to TRAVEL_MAX
      const loopLeg = Animated.loop(
        Animated.sequence([
          Animated.timing(animVal, {
            toValue: TRAVEL_MIN,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(animVal, {
            toValue: TRAVEL_MAX,
            duration: CYCLE_DURATION,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      );

      const sequence = Animated.sequence([firstLeg, loopLeg]);
      sequence.start();
      runningAnimations.push(sequence);
    });

    return () => {
      runningAnimations.forEach((anim) => anim.stop());
    };
  }, [posAnims]);

  return (
    <View style={styles.conveyorStage}>
      {AVATAR_POOL.map((item, index) => {
        const xAnim = posAnims[index];

        // Fisheye scale: Center (x=0) expands to 1.42x, edges shrink to 0.72x
        const scale = xAnim.interpolate({
          inputRange: [-160, -80, 0, 80, 160],
          outputRange: [0.72, 1.05, 1.42, 1.05, 0.72],
          extrapolate: "clamp",
        });

        // Opacity: Invisible at outer boundaries (-170 and +170), full in center
        const opacity = xAnim.interpolate({
          inputRange: [-170, -135, -40, 0, 40, 135, 170],
          outputRange: [0, 0.65, 0.98, 1, 0.98, 0.65, 0],
          extrapolate: "clamp",
        });

        // Subtle 3D vertical depth arc
        const translateY = xAnim.interpolate({
          inputRange: [-160, 0, 160],
          outputRange: [4, -4, 4],
          extrapolate: "clamp",
        });

        return (
          <Animated.View
            key={item.key}
            style={[
              styles.avatarNode,
              {
                opacity,
                transform: [{ translateX: xAnim }, { translateY }, { scale }],
              },
            ]}
          >
            {/* Solid, colorful circle avatar (no green border) */}
            <View
              style={[
                styles.solidAvatarCircle,
                {
                  backgroundColor: item.bgColor,
                },
              ]}
            >
              <Text style={styles.avatarEmoji}>{item.emoji}</Text>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

// ─── Matching Title with Animated Dots ───────────────────────────────────────
function MatchingTitle() {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 450);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text style={styles.matchingTitleText}>
      Matching<Text style={styles.matchingDots}>{dots}</Text>
    </Text>
  );
}

// ─── Component Props ─────────────────────────────────────────────────────────
interface MatchmakingOverlayModalProps {
  visible: boolean;
  onClose: () => void;
  onMatchAccepted?: (alias: string) => void;
  matchmaking?: UseMatchmakingResult;
}

export function MatchmakingOverlayModal({
  visible,
  onClose,
  onMatchAccepted,
  matchmaking: externalMM,
}: MatchmakingOverlayModalProps) {
  const insets = useSafeAreaInsets();
  const internalMM = useMatchmaking();
  const mm = externalMM || internalMM;

  // Visual stage: 'searching' -> 'revealed' (confirmation card)
  const [stage, setStage] = useState<"searching" | "revealed">(
    mm.phase === "pending" ? "revealed" : "searching"
  );

  useEffect(() => {
    if (mm.phase === "pending") {
      setStage("revealed");
    } else {
      setStage("searching");
    }
  }, [mm.phase]);

  // Telemetry status cycling (random text while searching)
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const telemetryFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || mm.phase !== "searching") return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(telemetryFade, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(telemetryFade, {
          toValue: 1,
          duration: 320,
          useNativeDriver: true,
        }),
      ]).start();
      setTelemetryIndex((prev) => (prev + 1) % TELEMETRY_MESSAGES.length);
    }, 2800);

    return () => clearInterval(interval);
  }, [visible, mm.phase, telemetryFade]);

  // Card entrance animation
  const cardScaleAnim = useRef(new Animated.Value(0.92)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (stage === "revealed") {
      cardScaleAnim.setValue(0.92);
      cardOpacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(cardScaleAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }),
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [stage, cardScaleAnim, cardOpacityAnim]);

  // Auto-navigate when chat room is ready
  useEffect(() => {
    if (mm.roomReady && mm.roomReady.conversationId) {
      const room = mm.roomReady;
      const partnerAlias = room.identity?.partnerAlias || "Anonymous Ally";
      const partnerAvatar = room.identity?.partnerAvatar || "fox";

      if (onMatchAccepted) {
        onMatchAccepted(partnerAlias);
      }

      const timer = setTimeout(() => {
        mm.clearRoomReady();
        onClose();
        router.push({
          pathname: "/pages/conversation" as any,
          params: {
            conversationId: room.conversationId,
            prefillName: partnerAlias,
            prefillAvatar: partnerAvatar,
            isAnonymous: "true",
          },
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [mm.roomReady, onMatchAccepted, onClose, mm]);

  // Handle Cancel / Dismiss
  const handleClose = useCallback(() => {
    if (mm.phase === "searching") {
      mm.leaveQueue();
      onClose();
    } else if (mm.phase === "pending") {
      Alert.alert(
        "Decline Match?",
        "Are you sure you want to pass on this match?",
        [
          { text: "Keep Match", style: "cancel" },
          {
            text: "Decline & Exit",
            style: "destructive",
            onPress: () => {
              mm.decline();
              onClose();
            },
          },
        ]
      );
    } else {
      mm.resetPhase();
      onClose();
    }
  }, [mm, onClose]);

  if (!visible) return null;

  const partnerAlias =
    mm.identity?.partnerAlias ||
    mm.pendingMatch?.partnerAlias ||
    "Anonymous Ally";
  const partnerAvatar =
    mm.identity?.partnerAvatar ||
    mm.pendingMatch?.partnerAvatar ||
    "wolf";
  const score = mm.compatibilityScore || 96;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlayRoot}>
        {/* ── Background: Deep Forest Emerald Gradient (System Palette) ── */}
        <LinearGradient
          colors={["#0C301D", "#071F13", "#030E08"]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* ── Twinkling Stars & Sparkles (Animotion B06 / CR28) ── */}
        <CelestialStarfield />

        {/* ── Ambient Soft Nebula Glow ── */}
        <View style={styles.ambientNebula} pointerEvents="none" />

        {/* ── Top Bar: ArrowLeft, Centered Title (Leave button removed) ── */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            style={styles.backBtn}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>Anonymous Match</Text>

          {/* Balanced spacer so title stays centered without Leave button */}
          <View style={styles.topBarSpacer} />
        </View>

        {/* ── Main Content Area ── */}
        <View style={styles.contentArea}>
          {/* ═══ STATE: ROOM ACCEPTED CELEBRATION ═══ */}
          {mm.phase === "accepted" ? (
            <View style={styles.matchAcceptedCard}>
              <View style={styles.matchAcceptedBadge}>
                <Check size={38} color="#FFFFFF" />
              </View>
              <Text style={styles.matchAcceptedTitle}>It's a Match!</Text>
              <Text style={styles.matchAcceptedSubtitle}>
                You and {partnerAlias} both accepted. Entering confidential chat room…
              </Text>
              <ActivityIndicator color="#34D399" size="large" style={{ marginTop: 16 }} />
            </View>
          ) : mm.phase === "ended" ? (
            /* ═══ STATE: MATCH EXPIRED OR DECLINED ═══ */
            <View style={styles.matchEndedCard}>
              <View style={styles.matchEndedBadge}>
                <X size={28} color="#EF4444" />
              </View>
              <Text style={styles.matchEndedTitle}>Match Expired</Text>
              <Text style={styles.matchEndedSubtitle}>
                {mm.endedReason || "The match was declined or expired before both accepted."}
              </Text>
              <View style={{ width: "100%", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => mm.joinQueue()}
                  activeOpacity={0.8}
                  style={styles.retrySearchBtn}
                >
                  <RotateCw size={16} color="#FFFFFF" />
                  <Text style={styles.retrySearchBtnText}>Find Another Match</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleClose}
                  activeOpacity={0.8}
                  style={styles.closeEndedBtn}
                >
                  <Text style={styles.closeEndedBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : stage !== "revealed" ? (
            /* ═══════════════════════════════════════════════════════════
               SEARCHING STAGE (LEFT-TO-RIGHT FISHEYE FLOW & CLEAN PILL)
               ═══════════════════════════════════════════════════════════ */
            <View style={styles.searchBody}>
              {/* 1. Left-to-Right Fisheye Conveyor (Disappearing on Right, Appearing on Left) */}
              <View style={styles.conveyorContainer}>
                <FisheyeConveyor />
              </View>

              {/* 2. "Matching..." Title & Random Telemetry Text */}
              <View style={styles.matchingTextSection}>
                <MatchingTitle />

                <Animated.View
                  style={[
                    styles.telemetryTextWrapper,
                    { opacity: telemetryFade },
                  ]}
                >
                  <Text style={styles.telemetrySubText}>
                    {TELEMETRY_MESSAGES[telemetryIndex]}
                  </Text>
                </Animated.View>
              </View>

              {/* 3. Action Section: Single Clean Cancel Search Pill Button */}
              <View style={styles.bottomActionSection}>
                <TouchableOpacity
                  onPress={handleClose}
                  activeOpacity={0.85}
                  style={styles.cancelSearchPill}
                >
                  <Text style={styles.cancelSearchPillText}>Cancel Search</Text>
                </TouchableOpacity>

                <Text style={styles.matchesLeftFooterText}>
                  Today you have {Math.max(0, mm.dailyLimit - mm.dailyMatchCount)} matches left
                </Text>
              </View>
            </View>
          ) : (
            /* ═══════════════════════════════════════════════════════════
               MATCH FOUND: CONFIRMATION UI (EXACT SPEC FROM WEB)
               ═══════════════════════════════════════════════════════════ */
            <Animated.View
              style={[
                styles.cardWrapper,
                {
                  transform: [{ scale: cardScaleAnim }],
                  opacity: cardOpacityAnim,
                },
              ]}
            >
              <View style={styles.confirmationCard}>
                {/* Deep Emerald Multi-Stop Background Gradient */}
                <LinearGradient
                  colors={["#1A6B3C", "#155731", "#0D3820", "#071F12"]}
                  locations={[0, 0.28, 0.65, 1]}
                  start={{ x: 0.1, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />

                {/* Warm Amber Glow in Upper-Right Corner */}
                <View style={styles.cardAmberGlow} />

                {/* Diagonal Angled Sheen Overlay for Depth */}
                <LinearGradient
                  colors={["rgba(255,255,255,0.18)", "transparent", "rgba(0,0,0,0.35)"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />

                {/* Top Row: Avatar on Left + 'X' Dismiss Button on Upper Right */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardAvatarWrapper}>
                    <View style={styles.cardAvatarRing}>
                      <AnonymousAvatar avatarKey={partnerAvatar} size={76} borderWidth={0} />
                    </View>
                    <View style={styles.cardOnlineDot} />
                  </View>

                  <TouchableOpacity
                    onPress={mm.decline}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                    style={styles.cardDismissBtn}
                    accessibilityLabel="Pass match"
                  >
                    <X size={16} color="rgba(255,255,255,0.85)" />
                  </TouchableOpacity>
                </View>

                {/* Identity: Name & Subtitle */}
                <View style={styles.cardIdentitySection}>
                  <Text style={styles.cardPartnerAlias} numberOfLines={1}>
                    {partnerAlias}
                  </Text>
                  <Text style={styles.cardPartnerSubtitle}>
                    Information Technology Student
                  </Text>
                </View>

                {/* Interest Pills */}
                <View style={styles.cardInterestRow}>
                  {["Tech & Code", "Web Design", "Figma", "Study"].map((interest, idx) => (
                    <View key={idx} style={styles.cardInterestPill}>
                      <Text style={styles.cardInterestText}>{interest}</Text>
                    </View>
                  ))}
                  <View style={styles.cardInterestMorePill}>
                    <Text style={styles.cardInterestMoreText}>+3</Text>
                  </View>
                </View>

                {/* Stats Row (3 Columns: Affinity, Campus, Timer) */}
                <View style={styles.cardStatsRow}>
                  <View style={styles.cardStatCol}>
                    <View style={styles.cardStatValueRow}>
                      <Text style={styles.cardStatAmberIcon}>★</Text>
                      <Text style={styles.cardStatValueText}>{score}%</Text>
                    </View>
                    <Text style={styles.cardStatLabel}>Affinity</Text>
                  </View>

                  <View style={styles.cardStatCol}>
                    <View style={styles.cardStatValueRow}>
                      <Text style={styles.cardStatEmeraldIcon}>🎓</Text>
                      <Text style={styles.cardStatValueText}>Alijis</Text>
                    </View>
                    <Text style={styles.cardStatLabel}>Campus</Text>
                  </View>

                  <View style={styles.cardStatCol}>
                    <View style={styles.cardStatValueRow}>
                      <Text style={styles.cardStatClockIcon}>⏳</Text>
                      <Text style={styles.cardStatValueText}>{mm.acceptCountdown}s</Text>
                    </View>
                    <Text style={styles.cardStatLabel}>Response</Text>
                  </View>
                </View>

                {/* Primary CTA Button */}
                <View style={styles.cardCtaSection}>
                  {mm.waitingForPartner ? (
                    <View style={styles.cardWaitingBtn}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.cardWaitingBtnText}>
                        Waiting for peer…
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={mm.accept}
                      disabled={mm.loading}
                      activeOpacity={0.85}
                      style={styles.cardConnectBtn}
                    >
                      <Sparkles size={17} color="#F59E0B" />
                      <Text style={styles.cardConnectBtnText}>
                        Connect & Chat
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: "#030E08",
  },
  ambientNebula: {
    position: "absolute",
    top: "22%",
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#1A6B3C",
    opacity: 0.18,
    transform: [{ scale: 1.5 }],
  },

  // Top Bar (No Leave Button)
  topBar: {
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontFamily: "PlusJakartaSans",
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  topBarSpacer: {
    width: 38,
    height: 38,
  },

  // Content Area
  contentArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  // Searching Body
  searchBody: {
    width: "100%",
    flex: 1,
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 18,
  },

  // 1. Fisheye Conveyor Stage
  conveyorContainer: {
    width: "100%",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  conveyorStage: {
    width: 340,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarNode: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  solidAvatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarEmoji: {
    fontSize: 29,
  },

  // 2. "Matching..." and Telemetry Text Section
  matchingTextSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  matchingTitleText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  matchingDots: {
    color: "#34D399",
  },
  telemetryTextWrapper: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  telemetrySubText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 14,
    color: "rgba(167, 243, 208, 0.85)",
    textAlign: "center",
    lineHeight: 20,
    fontWeight: "500",
    maxWidth: 320,
  },

  // 3. Action Section: Single Clean Cancel Search Pill Button
  bottomActionSection: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  cancelSearchPill: {
    backgroundColor: "#1A6B3C",
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 44,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.35)",
  },
  cancelSearchPillText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  matchesLeftFooterText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.52)",
    fontWeight: "500",
    textAlign: "center",
  },

  // ── Confirmation Card (Matching Web Spec) ──
  cardWrapper: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
  },
  confirmationCard: {
    width: "100%",
    borderRadius: 36,
    padding: 22,
    borderWidth: 1.5,
    borderColor: "rgba(74, 222, 128, 0.35)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 12,
  },
  cardAmberGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#E8A838",
    opacity: 0.18,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardAvatarWrapper: {
    position: "relative",
  },
  cardAvatarRing: {
    borderRadius: 44,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1.2,
    borderColor: "rgba(255,255,255,0.35)",
  },
  cardOnlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#071F12",
  },
  cardDismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.38)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIdentitySection: {
    marginBottom: 12,
  },
  cardPartnerAlias: {
    fontFamily: "PlusJakartaSans",
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  cardPartnerSubtitle: {
    fontFamily: "PlusJakartaSans",
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  cardInterestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 16,
  },
  cardInterestPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.42)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  cardInterestText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cardInterestMorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  cardInterestMoreText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
  },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 16,
  },
  cardStatCol: {
    flex: 1,
    alignItems: "center",
  },
  cardStatValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 2,
  },
  cardStatAmberIcon: {
    color: "#FCD34D",
    fontSize: 13,
  },
  cardStatEmeraldIcon: {
    fontSize: 13,
  },
  cardStatClockIcon: {
    fontSize: 12,
  },
  cardStatValueText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.65)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  cardCtaSection: {
    width: "100%",
  },
  cardConnectBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  cardConnectBtnText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  cardWaitingBtn: {
    width: "100%",
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  cardWaitingBtnText: {
    fontFamily: "PlusJakartaSans",
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Match Accepted Card
  matchAcceptedCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 28,
    padding: 30,
    borderWidth: 1.5,
    borderColor: "#34D399",
    width: "100%",
    maxWidth: 320,
  },
  matchAcceptedBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1A6B3C",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#34D399",
  },
  matchAcceptedTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  matchAcceptedSubtitle: {
    fontSize: 13,
    color: "#A7F3D0",
    textAlign: "center",
    lineHeight: 18,
  },

  // Match Ended Card
  matchEndedCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  matchEndedBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  matchEndedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  matchEndedSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  retrySearchBtn: {
    width: "100%",
    height: 46,
    borderRadius: 16,
    backgroundColor: "#1A6B3C",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  retrySearchBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  closeEndedBtn: {
    width: "100%",
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeEndedBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94A3B8",
  },
});
