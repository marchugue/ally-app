import React, { useEffect, useState, useRef } from "react";
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
} from "lucide-react-native";

interface MatchmakingOverlayModalProps {
  visible: boolean;
  onClose: () => void;
  onMatchAccepted?: (alias: string) => void;
}

const MOCK_ALIASES = [
  { name: "Sly Fox", emoji: "🦊", color: "#E05A47", dept: "Computer Studies", matchScore: 96 },
  { name: "Wise Owl", emoji: "🦉", color: "#3B8C7E", dept: "Engineering", matchScore: 92 },
  { name: "Chill Panda", emoji: "🐼", color: "#4B5563", dept: "Industrial Technology", matchScore: 89 },
  { name: "Brave Lion", emoji: "🦁", color: "#D97706", dept: "Business & Mgt", matchScore: 94 },
  { name: "Swift Otter", emoji: "🦦", color: "#2563EB", dept: "Education", matchScore: 91 },
];

export function MatchmakingOverlayModal({
  visible,
  onClose,
  onMatchAccepted,
}: MatchmakingOverlayModalProps) {
  const [phase, setPhase] = useState<"searching" | "pending" | "accepted">("searching");
  const [partner, setPartner] = useState(MOCK_ALIASES[0]);
  const [countdown, setCountdown] = useState(30);

  // Pulse & Radar Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) {
      setPhase("searching");
      setCountdown(30);
      return;
    }

    const randomPartner = MOCK_ALIASES[Math.floor(Math.random() * MOCK_ALIASES.length)];
    setPartner(randomPartner);
    setPhase("searching");

    // Radar Loop
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.25,
            duration: 1000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();

    // Mock search transition -> Match found after 3.2s
    const timer = setTimeout(() => {
      setPhase("pending");
      setCountdown(30);
    }, 3200);

    return () => clearTimeout(timer);
  }, [visible]);

  // 30s Countdown timer
  useEffect(() => {
    if (phase !== "pending") return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase("searching");
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const handleAccept = () => {
    setPhase("accepted");
    setTimeout(() => {
      onClose();
      if (onMatchAccepted) {
        onMatchAccepted(partner.name);
      } else {
        Alert.alert("Match Connected! 🎉", `Anonymous chat with ${partner.name} has been initiated.`);
      }
    }, 1200);
  };

  const handleDecline = () => {
    setPhase("searching");
    const nextPartner = MOCK_ALIASES[Math.floor(Math.random() * MOCK_ALIASES.length)];
    setPartner(nextPartner);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#0A1F12",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        {/* Top Close Button */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={{
            position: "absolute",
            top: 48,
            right: 24,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: "rgba(255,255,255,0.1)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <X size={18} color="rgba(255,255,255,0.8)" />
        </Pressable>

        <View style={{ width: "100%", maxWidth: 360, alignItems: "center" }}>
          {/* Header Tagline */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 24 }}>
            <Drama size={18} color="#1A6B3C" />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "700",
                color: "#1A6B3C",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Anonymous Matchmaker
            </Text>
          </View>

          {/* ═══ Searching Phase ═══ */}
          {phase === "searching" && (
            <View style={{ alignItems: "center", width: "100%", paddingVertical: 10 }}>
              {/* Radar Rings */}
              <View style={{ width: 140, height: 140, alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
                <Animated.View
                  style={{
                    position: "absolute",
                    width: 140,
                    height: 140,
                    borderRadius: 70,
                    backgroundColor: "rgba(26, 107, 60, 0.25)",
                    transform: [{ scale: scaleAnim }],
                    opacity: pulseAnim,
                  }}
                />
                <View
                  style={{
                    width: 84,
                    height: 84,
                    borderRadius: 42,
                    backgroundColor: "#1A6B3C",
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#1A6B3C",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                    elevation: 8,
                  }}
                >
                  <Text style={{ fontSize: 40 }}>🎭</Text>
                </View>
              </View>

              <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF", textAlign: "center", marginBottom: 8 }}>
                Searching CHMSU Campus…
              </Text>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 28, paddingHorizontal: 10 }}>
                Matching you with a student sharing your interests
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 }}>
                <ActivityIndicator color="#1A6B3C" size="small" />
                <Text style={{ fontSize: 13, color: "#1A6B3C", fontWeight: "600" }}>Connecting to live queue...</Text>
              </View>

              <Pressable
                onPress={onClose}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 16,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                }}
              >
                <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontWeight: "600" }}>
                  Cancel Queue
                </Text>
              </Pressable>
            </View>
          )}

          {/* ═══ Match Found Confirmation Phase ═══ */}
          {phase === "pending" && (
            <View style={{ alignItems: "center", width: "100%", paddingVertical: 6 }}>
              {/* Partner Avatar */}
              <View style={{ position: "relative", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <View
                  style={{
                    width: 104,
                    height: 104,
                    borderRadius: 52,
                    backgroundColor: partner.color + "20",
                    borderWidth: 3.5,
                    borderColor: partner.color,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: partner.color,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 10,
                    elevation: 8,
                  }}
                >
                  <Text style={{ fontSize: 50 }}>{partner.emoji}</Text>
                </View>
                <View
                  style={{
                    position: "absolute",
                    bottom: -4,
                    backgroundColor: "#16A34A",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: "#0A1F12",
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#FFFFFF" }}>Online</Text>
                </View>
              </View>

              {/* Alias & Department */}
              <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", textAlign: "center", marginBottom: 4 }}>
                {partner.name}
              </Text>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", textAlign: "center", marginBottom: 14 }}>
                {partner.dept} · CHMSU
              </Text>

              {/* Match Score Badge */}
              <View
                style={{
                  backgroundColor: "rgba(26,107,60,0.25)",
                  borderWidth: 1,
                  borderColor: "#1A6B3C",
                  paddingHorizontal: 14,
                  paddingVertical: 5,
                  borderRadius: 14,
                  marginBottom: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Zap size={15} color="#86EFAC" />
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#86EFAC" }}>
                  {partner.matchScore}% Compatibility
                </Text>
              </View>

              {/* Progress Bar & Timer */}
              <View style={{ width: "100%", marginBottom: 28 }}>
                <View style={{ height: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                  <View
                    style={{
                      height: "100%",
                      width: `${(countdown / 30) * 100}%`,
                      backgroundColor: countdown < 8 ? "#EF4444" : partner.color,
                    }}
                  />
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Clock size={13} color="rgba(255,255,255,0.5)" />
                  <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: "600" }}>
                    {countdown}s to respond
                  </Text>
                </View>
              </View>

              {/* Action Buttons: Skip vs Start Chat */}
              <View style={{ flexDirection: "row", gap: 14, width: "100%" }}>
                <Pressable
                  onPress={handleDecline}
                  style={{
                    flex: 1,
                    paddingVertical: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                  }}
                >
                  <X size={18} color="rgba(255,255,255,0.8)" />
                  <Text style={{ fontSize: 15, fontWeight: "600", color: "#FFFFFF" }}>Skip</Text>
                </Pressable>

                <Pressable
                  onPress={handleAccept}
                  style={{
                    flex: 1.4,
                    paddingVertical: 14,
                    borderRadius: 16,
                    backgroundColor: partner.color,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 6,
                    shadowColor: partner.color,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 6,
                  }}
                >
                  <MessageCircle size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>Start Chat!</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ═══ Accepted Success State ═══ */}
          {phase === "accepted" && (
            <View style={{ alignItems: "center", paddingVertical: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 14 }}>🎉</Text>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#FFFFFF", marginBottom: 8 }}>
                Match Connected!
              </Text>
              <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", textAlign: "center" }}>
                Connecting to anonymous chat with {partner.name}…
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
