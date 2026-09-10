import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Animated,
  Easing,
  Alert,
} from "react-native";
import {
  Drama,
  X,
  Check,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  MessageCircle,
  RotateCw,
} from "lucide-react-native";
import { router } from "expo-router";
import { useMatchmaking, UseMatchmakingResult } from "@/hooks/useMatchmaking";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { avatarColorFor, getAvatarEmoji } from "@/constants/matchOptions";

interface MatchmakingOverlayModalProps {
  visible: boolean;
  onClose: () => void;
  onMatchAccepted?: (alias: string) => void;
  matchmaking?: UseMatchmakingResult;
}

const TELEMETRY_MESSAGES = [
  "Calibrating CHMSU campus frequency locator…",
  "Scanning active student allies on Alijis campus…",
  "Analyzing course compatibility & curriculum year…",
  "Harmonizing mutual interests and tech stack…",
  "Locking onto an anonymous peer session…",
];

const ORBIT_MASCOTS = [
  { key: "fox", emoji: "🦊", label: "Fox", angle: 0 },
  { key: "wolf", emoji: "🐺", label: "Wolf", angle: 120 },
  { key: "panda", emoji: "🐼", label: "Panda", angle: 240 },
];

export function MatchmakingOverlayModal({
  visible,
  onClose,
  onMatchAccepted,
  matchmaking: externalMM,
}: MatchmakingOverlayModalProps) {
  // Use external hook instance if supplied (e.g. from discover.tsx), otherwise instantiate one
  const internalMM = useMatchmaking();
  const mm = externalMM || internalMM;

  const [telemetryIndex, setTelemetryIndex] = useState(0);

  // Animated values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  const ring2Anim = useRef(new Animated.Value(0.6)).current;
  const ring3Anim = useRef(new Animated.Value(0.3)).current;
  const orbitAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Telemetry message cycler
  useEffect(() => {
    if (!visible || mm.phase !== "searching") return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      setTelemetryIndex((prev) => (prev + 1) % TELEMETRY_MESSAGES.length);
    }, 2800);

    return () => clearInterval(interval);
  }, [visible, mm.phase, fadeAnim]);

  // Start continuous radar and orbit animations
  useEffect(() => {
    if (!visible) return;

    // Pulse loops
    const pulseLoop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.28,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(ring2Anim, {
            toValue: 1.5,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring2Anim, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(ring3Anim, {
            toValue: 1.8,
            duration: 2200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring3Anim, {
            toValue: 0.3,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.loop(
          Animated.timing(orbitAnim, {
            toValue: 1,
            duration: 8000,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ),
      ])
    );

    pulseLoop.start();

    return () => {
      pulseLoop.stop();
    };
  }, [visible, scaleAnim, pulseAnim, ring2Anim, ring3Anim, orbitAnim]);

  // Navigate when room is ready
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
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [mm.roomReady, onMatchAccepted, onClose, mm]);

  // Handle Cancel / Close button
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
    "fox";
  const score = mm.compatibilityScore || 92;
  const matchColor = avatarColorFor(partnerAvatar);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(10, 31, 18, 0.97)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        {/* Top Header Controls */}
        <View
          style={{
            position: "absolute",
            top: 54,
            left: 20,
            right: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 30,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: "rgba(255,255,255,0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Drama size={18} color="#4ADE80" />
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.2 }}>
              Anonymous Matchmaking
            </Text>
          </View>

          <Pressable
            onPress={handleClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(255,255,255,0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* ═══ PHASE 1: SEARCHING RADAR ═══ */}
        {mm.phase === "searching" && (
          <View style={{ alignItems: "center", width: "100%", maxWidth: 360 }}>
            {/* Radar Animation Stage */}
            <View
              style={{
                width: 280,
                height: 280,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 32,
                position: "relative",
              }}
            >
              {/* Outer Ripple 3 */}
              <Animated.View
                style={{
                  position: "absolute",
                  width: 260,
                  height: 260,
                  borderRadius: 130,
                  borderWidth: 1.5,
                  borderColor: "rgba(74, 222, 128, 0.25)",
                  transform: [{ scale: ring3Anim }],
                }}
              />

              {/* Outer Ripple 2 */}
              <Animated.View
                style={{
                  position: "absolute",
                  width: 200,
                  height: 200,
                  borderRadius: 100,
                  borderWidth: 1.5,
                  borderColor: "rgba(74, 222, 128, 0.4)",
                  transform: [{ scale: ring2Anim }],
                }}
              />

              {/* Core Pulse Ring */}
              <Animated.View
                style={{
                  position: "absolute",
                  width: 140,
                  height: 140,
                  borderRadius: 70,
                  backgroundColor: "rgba(26, 107, 60, 0.35)",
                  borderWidth: 2,
                  borderColor: "#4ADE80",
                  transform: [{ scale: scaleAnim }],
                  opacity: pulseAnim,
                }}
              />

              {/* Center Holographic Radar Core */}
              <View
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 45,
                  backgroundColor: "#1A6B3C",
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: "#4ADE80",
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 18,
                  elevation: 10,
                  borderWidth: 2,
                  borderColor: "rgba(255,255,255,0.3)",
                }}
              >
                <Drama size={42} color="#FFFFFF" />
              </View>

              {/* Orbiting Mascots */}
              {ORBIT_MASCOTS.map((m, i) => {
                const radius = 95;
                const rad = ((m.angle + i * 15) * Math.PI) / 180;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;

                return (
                  <View
                    key={m.key}
                    style={{
                      position: "absolute",
                      transform: [{ translateX: x }, { translateY: y }],
                      width: 38,
                      height: 38,
                      borderRadius: 19,
                      backgroundColor: "rgba(255,255,255,0.14)",
                      borderWidth: 1.5,
                      borderColor: "rgba(255,255,255,0.3)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 18 }}>{m.emoji}</Text>
                  </View>
                );
              })}
            </View>

            {/* Ticker / Status Text */}
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: "#FFFFFF",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Seeking an Ally…
            </Text>

            <Animated.View style={{ opacity: fadeAnim, minHeight: 44, paddingHorizontal: 16 }}>
              <Text
                style={{
                  fontSize: 13,
                  color: "#A7F3D0",
                  textAlign: "center",
                  lineHeight: 18,
                  fontWeight: "500",
                }}
              >
                {TELEMETRY_MESSAGES[telemetryIndex]}
              </Text>
            </Animated.View>

            {/* Daily Counter */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 16,
                marginTop: 18,
                marginBottom: 32,
              }}
            >
              <Zap size={14} color="#FBBF24" />
              <Text style={{ fontSize: 12, color: "#E2E8F0", fontWeight: "600" }}>
                {Math.max(0, mm.dailyLimit - mm.dailyMatchCount)} of {mm.dailyLimit} matches left today
              </Text>
            </View>

            {/* Cancel Button */}
            <Pressable
              onPress={handleClose}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 28,
                borderRadius: 24,
                backgroundColor: "rgba(255,255,255,0.12)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                Cancel Search
              </Text>
            </Pressable>
          </View>
        )}

        {/* ═══ PHASE 2: MATCH FOUND (PENDING ACCEPTANCE) ═══ */}
        {mm.phase === "pending" && (
          <View
            style={{
              width: "100%",
              maxWidth: 340,
              backgroundColor: "rgba(255, 255, 255, 0.07)",
              borderRadius: 28,
              padding: 24,
              alignItems: "center",
              borderWidth: 1.5,
              borderColor: "rgba(74, 222, 128, 0.4)",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.4,
              shadowRadius: 20,
            }}
          >
            {/* Header Badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(74, 222, 128, 0.15)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 14,
                marginBottom: 20,
              }}
            >
              <Sparkles size={14} color="#4ADE80" />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#4ADE80", textTransform: "uppercase" }}>
                Match Detected!
              </Text>
            </View>

            {/* Partner Avatar Presentation */}
            <View
              style={{
                position: "relative",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  backgroundColor: `${matchColor}25`,
                  borderWidth: 3,
                  borderColor: matchColor,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AnonymousAvatar avatarKey={partnerAvatar} size={88} borderWidth={0} />
              </View>

              {/* Compatibility score pill */}
              <View
                style={{
                  position: "absolute",
                  bottom: -6,
                  backgroundColor: "#1A6B3C",
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: "#4ADE80",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>
                  {score}% Compatible
                </Text>
              </View>
            </View>

            {/* Partner Alias */}
            <Text
              style={{
                fontSize: 22,
                fontWeight: "900",
                color: "#FFFFFF",
                marginTop: 8,
                marginBottom: 4,
              }}
            >
              {partnerAlias}
            </Text>

            <Text
              style={{
                fontSize: 12,
                color: "#94A3B8",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              Anonymous peer ally • Identities reveal gradually
            </Text>

            {/* Countdown Progress Bar */}
            <View style={{ width: "100%", marginBottom: 22 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Clock size={13} color="#FBBF24" />
                  <Text style={{ fontSize: 12, color: "#E2E8F0", fontWeight: "600" }}>
                    Acceptance Window
                  </Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#FBBF24" }}>
                  {mm.acceptCountdown}s
                </Text>
              </View>

              <View
                style={{
                  width: "100%",
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${Math.max(0, Math.min(100, (mm.acceptCountdown / 30) * 100))}%`,
                    backgroundColor: mm.acceptCountdown < 8 ? "#EF4444" : "#4ADE80",
                    borderRadius: 3,
                  }}
                />
              </View>
            </View>

            {/* Actions: Accept or Decline */}
            {mm.waitingForPartner ? (
              <View
                style={{
                  width: "100%",
                  paddingVertical: 14,
                  backgroundColor: "rgba(26, 107, 60, 0.5)",
                  borderRadius: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor: "#4ADE80",
                }}
              >
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>
                  Waiting for {partnerAlias}…
                </Text>
              </View>
            ) : (
              <View style={{ width: "100%", gap: 10 }}>
                <Pressable
                  onPress={mm.accept}
                  disabled={mm.loading}
                  style={{
                    width: "100%",
                    height: 48,
                    borderRadius: 16,
                    backgroundColor: "#1A6B3C",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                    shadowColor: "#1A6B3C",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                  }}
                >
                  <Check size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
                    Accept Match
                  </Text>
                </Pressable>

                <Pressable
                  onPress={mm.decline}
                  disabled={mm.loading}
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 16,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <X size={16} color="#94A3B8" />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#94A3B8" }}>
                    Decline
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* ═══ PHASE 3: ROOM READY / MATCH ACCEPTED ═══ */}
        {mm.phase === "accepted" && (
          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderRadius: 28,
              padding: 32,
              borderWidth: 1.5,
              borderColor: "#4ADE80",
              width: "100%",
              maxWidth: 320,
            }}
          >
            <View
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                backgroundColor: "#1A6B3C",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
                borderWidth: 2,
                borderColor: "#4ADE80",
              }}
            >
              <Check size={40} color="#FFFFFF" />
            </View>

            <Text style={{ fontSize: 22, fontWeight: "900", color: "#FFFFFF", marginBottom: 6 }}>
              It's a Match!
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#A7F3D0",
                textAlign: "center",
                marginBottom: 18,
                lineHeight: 18,
              }}
            >
              You and {partnerAlias} both accepted. Entering confidential chat room…
            </Text>

            <ActivityIndicator color="#4ADE80" size="large" />
          </View>
        )}

        {/* ═══ PHASE 4: ENDED / TIMED OUT / DECLINED ═══ */}
        {mm.phase === "ended" && (
          <View
            style={{
              width: "100%",
              maxWidth: 320,
              backgroundColor: "rgba(255, 255, 255, 0.07)",
              borderRadius: 24,
              padding: 24,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.15)",
            }}
          >
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: "rgba(239, 68, 68, 0.18)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <X size={30} color="#EF4444" />
            </View>

            <Text style={{ fontSize: 18, fontWeight: "800", color: "#FFFFFF", marginBottom: 6 }}>
              Match Expired
            </Text>

            <Text
              style={{
                fontSize: 13,
                color: "#94A3B8",
                textAlign: "center",
                marginBottom: 20,
                lineHeight: 18,
              }}
            >
              {mm.endedReason || "The match was declined or expired before both accepted."}
            </Text>

            <View style={{ width: "100%", gap: 10 }}>
              <Pressable
                onPress={() => mm.joinQueue()}
                style={{
                  width: "100%",
                  height: 46,
                  borderRadius: 16,
                  backgroundColor: "#1A6B3C",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                }}
              >
                <RotateCw size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>
                  Find Another Match
                </Text>
              </Pressable>

              <Pressable
                onPress={handleClose}
                style={{
                  width: "100%",
                  height: 42,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#94A3B8" }}>
                  Close
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
