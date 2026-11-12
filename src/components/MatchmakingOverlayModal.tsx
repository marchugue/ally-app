import React, { memo, useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
  StyleSheet,
  Dimensions,
} from "react-native";
import {
  X,
  Sparkles,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type UseMatchmakingResult } from "@/hooks/useMatchmaking";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { ANIMAL_KEYS } from "@/constants/matchOptions";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Telemetry Status Messages ───────────────────────────────────────────────
const TELEMETRY_MESSAGES = [
  "Scanning active student souls on Alijis campus…",
  "Harmonizing mutual interests & curriculum year…",
  "Analyzing course compatibility & vibe synergy…",
  "Filtering campus vibes and shared passions…",
  "Locking onto an anonymous peer session…",
];

// ─── Shockwave Burst Rings on Match Detected ──────────────────────────────────
function ShockwaveRings() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(ring1, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ring1, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(ring2, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(ring2, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    loop1.start();
    loop2.start();
    return () => {
      loop1.stop();
      loop2.stop();
    };
  }, [ring1, ring2]);

  const scale1 = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const opacity1 = ring1.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.85, 0.35, 0] });

  const scale2 = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const opacity2 = ring2.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.75, 0.25, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.shockwaveRing,
          { borderColor: "#34D399", transform: [{ scale: scale1 }], opacity: opacity1 },
        ]}
      />
      <Animated.View
        style={[
          styles.shockwaveRing,
          { borderColor: "#FCD34D", transform: [{ scale: scale2 }], opacity: opacity2 },
        ]}
      />
    </View>
  );
}

// ─── Native-Driven Acoustic Frequency Equalizer Waveform ─────────────────────
const EqualizerWaveform = memo(function EqualizerWaveform({ paused }: { paused?: boolean }) {
  const barAnims = useRef(
    [0, 1, 2, 3, 4, 5, 6].map(() => new Animated.Value(0.35))
  ).current;

  useEffect(() => {
    if (paused) return;
    const anims = barAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 0.85 + (i % 3) * 0.1,
            duration: 320 + i * 35,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.25 + (i % 2) * 0.12,
            duration: 320 + i * 35,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );

    const parallel = Animated.parallel(anims);
    parallel.start();
    return () => parallel.stop();
  }, [paused, barAnims]);

  return (
    <View style={styles.equalizerRow}>
      {barAnims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.equalizerBar,
            {
              backgroundColor: i % 2 === 0 ? "#38C185" : "#E8A838",
              transform: [{ scaleY: anim }],
            },
          ]}
        />
      ))}
    </View>
  );
});

// ─── Carousel Slot Item with Native Spring Motion ─────────────────────────────
interface CarouselSlotProps {
  avatarKey: string;
  targetX: number;
  targetScale: number;
  targetOpacity: number;
  isCenter: boolean;
  showShockwave: boolean;
}

const CarouselSlotItem = memo(function CarouselSlotItem({
  avatarKey,
  targetX,
  targetScale,
  targetOpacity,
  isCenter,
  showShockwave,
}: CarouselSlotProps) {
  const animX = useRef(new Animated.Value(targetX)).current;
  const animScale = useRef(new Animated.Value(targetScale)).current;
  const animOpacity = useRef(new Animated.Value(targetOpacity)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(animX, {
        toValue: targetX,
        stiffness: 220,
        damping: 24,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.spring(animScale, {
        toValue: targetScale,
        stiffness: 220,
        damping: 24,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(animOpacity, {
        toValue: targetOpacity,
        duration: 240,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [targetX, targetScale, targetOpacity, animX, animScale, animOpacity]);

  return (
    <Animated.View
      style={[
        styles.slotContainer,
        {
          transform: [{ translateX: animX }, { scale: animScale }],
          opacity: animOpacity,
          zIndex: isCenter ? 20 : 10,
        },
      ]}
      pointerEvents={isCenter ? "auto" : "none"}
    >
      <View style={styles.avatarGlowCircle}>
        {showShockwave && isCenter && <ShockwaveRings />}
        <AnonymousAvatar
          avatarKey={avatarKey}
          size={72}
          borderWidth={0}
        />
      </View>
    </Animated.View>
  );
});

// ─── Component Props ─────────────────────────────────────────────────────────
interface MatchmakingOverlayModalProps {
  visible: boolean;
  onClose: () => void;
  onMatchAccepted?: (alias: string) => void;
  matchmaking: UseMatchmakingResult;
}

export function MatchmakingOverlayModal({
  visible,
  onClose,
  onMatchAccepted,
  matchmaking: mm,
}: MatchmakingOverlayModalProps) {
  const insets = useSafeAreaInsets();

  // Visual stage choreography (Litmatch style matching web):
  // 'searching' → 3-slot horizontal carousel cycling Left -> Center -> Right!
  // 'detected'  → Cycling locks onto matched avatar in the CENTER with shockwave!
  // 'revealed'  → Confirmation card animates in.
  const [stage, setStage] = useState<"searching" | "detected" | "revealed">(
    mm.phase === "pending" ? "revealed" : "searching"
  );
  const animatedMatchIdRef = useRef<string | null>(
    mm.phase === "pending" ? mm.pendingMatch?.id || "initial-pending" : null
  );

  const partnerAlias =
    mm.identity?.partnerAlias ||
    mm.pendingMatch?.partnerAlias ||
    "Campus Ally";
  const partnerAvatar =
    mm.identity?.partnerAvatar ||
    mm.pendingMatch?.partnerAvatar ||
    "wolf";
  const score = mm.compatibilityScore || 96;

  // Transition from searching -> detected -> revealed when pending match arrives
  useEffect(() => {
    if (!visible) return;
    if (mm.phase === "pending") {
      const matchId = mm.pendingMatch?.id || "pending-match";
      // If this match was already animated to revealed, keep it revealed!
      if (animatedMatchIdRef.current === matchId) {
        setStage("revealed");
        return;
      }
      animatedMatchIdRef.current = matchId;
      setStage("detected");
      const timer = setTimeout(() => {
        setStage("revealed");
      }, 1100);
      return () => clearTimeout(timer);
    } else if (mm.phase === "searching") {
      animatedMatchIdRef.current = null;
      setStage("searching");
    }
  }, [visible, mm.phase, mm.pendingMatch?.id]);

  // Consecutive Horizontal Avatar Cycling (720ms cadence matching web)
  const [cycleStep, setCycleStep] = useState(0);

  useEffect(() => {
    if (!visible || stage !== "searching") return;
    const interval = setInterval(() => {
      setCycleStep((prev) => prev + 1);
    }, 720);
    return () => clearInterval(interval);
  }, [visible, stage]);

  // Cycling Telemetry Status (2600ms cadence matching web)
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const telemetryFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || stage !== "searching") return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(telemetryFade, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(telemetryFade, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
      setTelemetryIndex((prev) => (prev + 1) % TELEMETRY_MESSAGES.length);
    }, 2600);
    return () => clearInterval(interval);
  }, [visible, stage, telemetryFade]);

  // Card entrance animation when entering 'revealed' stage
  const cardScaleAnim = useRef(new Animated.Value(1)).current;
  const cardOpacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || stage !== "revealed") return;
    cardScaleAnim.setValue(0.94);
    cardOpacityAnim.setValue(0.2);
    Animated.parallel([
      Animated.timing(cardScaleAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacityAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, stage, cardScaleAnim, cardOpacityAnim]);

  // Handle Cancel / Dismiss with confirmation
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

  // Offsets window: [-3, -2, -1, 0, 1, 2, 3]
  // pos = -1 (Left: -116px, 0.78 scale, 0.45 opacity)
  // pos =  0 (Center: 0px, 1.25 scale, 1.0 opacity)
  // pos = +1 (Right: 116px, 0.78 scale, 0.45 opacity)
  const slotOffsetPx = 116;

  // Reset cycle step cleanly when becoming visible in searching mode
  useEffect(() => {
    if (visible && mm.phase === "searching") {
      setCycleStep(0);
    }
  }, [visible, mm.phase]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlayRoot}>
        {/* ── Top Header: Updated Ally-jis Emblem & Close ── */}
        <View style={[styles.topHeader, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <Image
            source={require("../../assets/images/ally-jis.png")}
            style={styles.brandLogoImage}
            resizeMode="contain"
          />

          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            style={styles.closeBtn}
            accessibilityLabel="Cancel search"
          >
            <X size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* ── Central Main Arena ── */}
        <View style={styles.contentArea}>
          {stage !== "revealed" ? (
            /* ═══════════════════════════════════════════════════════════
               STAGE 1 & 2: CLEAN HORIZONTAL CAROUSEL ON PLAIN BACKGROUND
               ═══════════════════════════════════════════════════════════ */
            <View style={styles.carouselArena}>
              {/* Header Title */}
              <View style={styles.carouselHeaderWrapper}>
                <Text style={styles.carouselMainTitle}>
                  Finding Your Campus Ally
                </Text>
              </View>

              {/* Avatar Conveyor Track */}
              <View style={styles.conveyorTrack}>
                <LinearGradient
                  colors={[
                    "#06110A",
                    "rgba(6, 17, 10, 0.92)",
                    "rgba(6, 17, 10, 0)",
                  ]}
                  locations={[0, 0.35, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.edgeFadeLeft}
                  pointerEvents="none"
                />

                {[-2, -1, 0, 1, 2].map((offset) => {
                  const i = cycleStep - offset;
                  const pos = offset;
                  const slotAvatarKey =
                    stage === "detected" && pos === 0
                      ? partnerAvatar
                      : ANIMAL_KEYS[((i % ANIMAL_KEYS.length) + ANIMAL_KEYS.length) % ANIMAL_KEYS.length];

                  let targetX = pos * slotOffsetPx;
                  let targetScale = pos === 0 ? 1.25 : Math.abs(pos) === 1 ? 0.78 : 0.5;
                  let targetOpacity = pos === 0 ? 1.0 : Math.abs(pos) === 1 ? 0.45 : 0;

                  if (stage === "detected") {
                    if (pos === 0) {
                      targetX = 0;
                      targetScale = 1.35;
                      targetOpacity = 1.0;
                    } else {
                      targetX = pos < 0 ? -240 : 240;
                      targetScale = 0.4;
                      targetOpacity = 0;
                    }
                  }

                  return (
                    <CarouselSlotItem
                      key={i}
                      avatarKey={slotAvatarKey}
                      targetX={targetX}
                      targetScale={targetScale}
                      targetOpacity={targetOpacity}
                      isCenter={pos === 0}
                      showShockwave={stage === "detected"}
                    />
                  );
                })}

                <LinearGradient
                  colors={[
                    "rgba(6, 17, 10, 0)",
                    "rgba(6, 17, 10, 0.92)",
                    "#06110A",
                  ]}
                  locations={[0, 0.65, 1]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.edgeFadeRight}
                  pointerEvents="none"
                />
              </View>

              {/* Status Ticker & Equalizer */}
              <View style={styles.tickerSection}>
                {stage === "detected" ? (
                  <View style={styles.detectedBadgeRow}>
                    <View style={styles.detectedBadgeGradient}>
                      <Sparkles size={13} color="#030805" />
                      <Text style={styles.detectedBadgeText}>Match Found!</Text>
                      <Sparkles size={13} color="#030805" />
                    </View>
                  </View>
                ) : (
                  <Animated.View style={{ opacity: telemetryFade, minHeight: 22, justifyContent: "center" }}>
                    <Text style={styles.telemetryText}>
                      {TELEMETRY_MESSAGES[telemetryIndex]}
                    </Text>
                  </Animated.View>
                )}

                {/* Affinity Score on Detected */}
                {stage === "detected" && (
                  <Text style={styles.affinityDetectedText}>
                    ★ {score}% Soul Affinity with {partnerAlias}
                  </Text>
                )}

                {/* Frequency Equalizer Waveform */}
                <EqualizerWaveform paused={stage === "detected"} />
              </View>
            </View>
          ) : (
            /* ═══════════════════════════════════════════════════════════
               STAGE 3: CLEAN CONFIRMATION CARD
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

                {/* Card Top Row: Avatar on Left + 'X' Dismiss on Upper Right */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardAvatarWrapper}>
                    <View style={styles.cardAvatarRing}>
                      <AnonymousAvatar avatarKey={partnerAvatar} size={78} borderWidth={0} />
                    </View>
                    <View style={styles.cardOnlineDot} />
                  </View>

                  <TouchableOpacity
                    onPress={mm.decline}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

                {/* Interest Pills (Uniform Dark Glass matching web) */}
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

                {/* Primary CTA Button (Clean White Pill) */}
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
                      <Sparkles size={16} color="#F59E0B" />
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

        {/* ── Footer: Clean Cancel Action ── */}
        <View style={[styles.bottomFooter, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
          {stage === "searching" ? (
            <TouchableOpacity
              onPress={handleClose}
              activeOpacity={0.8}
              style={styles.cancelFooterBtn}
            >
              <Text style={styles.cancelFooterBtnText}>Cancel search</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ height: 36 }} />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Stylesheet ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
    backgroundColor: "#06110A",
  },

  // Top Header (Exact web brand alignment)
  topHeader: {
    width: "100%",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 30,
  },
  brandLogoImage: {
    width: 34,
    height: 34,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Central Arena
  contentArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },

  // Carousel Stage
  carouselArena: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -20 }],
  },
  carouselHeaderWrapper: {
    marginBottom: 20,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  carouselMainTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    letterSpacing: 0.4,
    fontFamily: "Fraunces_700Bold",
    textAlign: "center",
  },
  conveyorTrack: {
    width: SCREEN_WIDTH,
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  edgeFadeLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 25,
  },
  edgeFadeRight: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 25,
  },
  slotContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarGlowCircle: {
    position: "relative",
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  shockwaveRing: {
    position: "absolute",
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 999,
    borderWidth: 2,
  },

  // Status Ticker & Equalizer
  tickerSection: {
    marginTop: 20,
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 320,
  },
  detectedBadgeRow: {
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  detectedBadgeGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#10B981",
  },
  detectedBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#030805",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  telemetryText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(110, 231, 183, 0.9)",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  affinityDetectedText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FCD34D",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  equalizerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 26,
    paddingTop: 4,
  },
  equalizerBar: {
    width: 3.5,
    height: 22,
    borderRadius: 2,
    overflow: "hidden",
  },

  // Confirmation Card (Stage 3)
  cardWrapper: {
    width: "100%",
    maxWidth: 380,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  confirmationCard: {
    width: "100%",
    borderRadius: 36,
    padding: 24,
    backgroundColor: "#0D3820",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.25)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardAvatarWrapper: {
    position: "relative",
  },
  cardAvatarRing: {
    borderRadius: 44,
    padding: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  cardOnlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    borderWidth: 2.5,
    borderColor: "#071F12",
  },
  cardDismissBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardIdentitySection: {
    marginTop: 12,
    gap: 2,
  },
  cardPartnerAlias: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  cardPartnerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.8)",
  },
  cardInterestRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  cardInterestPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  cardInterestText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  cardInterestMorePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  cardInterestMoreText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
  },
  cardStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.15)",
  },
  cardStatCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  cardStatValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatAmberIcon: {
    fontSize: 14,
    color: "#FCD34D",
  },
  cardStatEmeraldIcon: {
    fontSize: 14,
    color: "#6EE7B7",
  },
  cardStatClockIcon: {
    fontSize: 13,
    color: "#FDE68A",
  },
  cardStatValueText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.65)",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardCtaSection: {
    marginTop: 16,
    width: "100%",
  },
  cardWaitingBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  cardWaitingBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardConnectBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  cardConnectBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: 0.2,
  },

  // Bottom Footer
  bottomFooter: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  cancelFooterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  cancelFooterBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
});
