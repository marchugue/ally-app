import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  X,
  Lock,
  Sparkles,
  Flame,
  MessageSquareText,
  UserPlus,
  Shield,
  Heart,
  ChevronRight,
  LogOut,
  Compass,
  Gamepad2,
  Image as ImageIcon,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import {
  getMatchReveal,
  RevealData,
  endMatch as apiEndMatch,
} from "@/lib/api/matchmaking";
import { STAGE_NAMES, STAGE_THRESHOLDS, stageName, avatarColorFor } from "@/constants/matchOptions";

interface MatchRevealSheetProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  stage?: number;
  dayStreak?: number;
  partnerAlias?: string;
  partnerAvatar?: string;
  onSelectIcebreaker?: (text: string) => void;
  onMatchEnded?: () => void;
  ended?: boolean;
}

export function MatchRevealSheet({
  visible,
  onClose,
  matchId,
  stage: initialStage = 0,
  dayStreak: initialStreak = 0,
  partnerAlias = "Anonymous Ally",
  partnerAvatar = "fox",
  onSelectIcebreaker,
  onMatchEnded,
  ended = false,
}: MatchRevealSheetProps) {
  const { accessToken, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  const fetchReveal = useCallback(async () => {
    if (!matchId || !accessToken) return;
    setLoading(true);
    try {
      const data = await getMatchReveal(matchId, accessToken);
      setRevealData(data);
    } catch (err) {
      console.warn("Failed to load match reveal data:", err);
    } finally {
      setLoading(false);
    }
  }, [matchId, accessToken]);

  useEffect(() => {
    if (visible) {
      fetchReveal();
    }
  }, [visible, fetchReveal]);

  const stage = revealData?.stage ?? initialStage;
  const streak = revealData?.dayStreak ?? initialStreak;
  const partner = revealData?.partner;
  const matchColor = avatarColorFor(partnerAvatar);

  const handleEndMatch = () => {
    Alert.alert(
      "End Anonymous Chat?",
      "Ending this match will make the conversation read-only. Neither user will be able to send more messages.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Chat",
          style: "destructive",
          onPress: async () => {
            if (!accessToken) return;
            try {
              await apiEndMatch(matchId, accessToken);
              onMatchEnded?.();
              onClose();
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not end match.");
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.65)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: "88%",
            paddingBottom: 32,
          }}
        >
          {/* Header Drag Handle & Title */}
          <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 6 }}>
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 3,
                backgroundColor: "#E2E8F0",
                marginBottom: 12,
              }}
            />
            <View
              style={{
                width: "100%",
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <AnonymousAvatar
                  avatarKey={partnerAvatar}
                  size={42}
                  photoUrl={stage >= 4 ? partner?.avatarUrl : null}
                  isBlurred={false}
                />
                <View>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>
                    {stage >= 4 && partner?.fullName ? partner.fullName : partnerAlias}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#64748B", fontWeight: "600" }}>
                    Stage {stage}: {stageName(stage)} • {streak}d streak
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={onClose}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "#F1F5F9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color="#64748B" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: "center" }}>
                <ActivityIndicator size="large" color="#1A6B3C" />
                <Text style={{ fontSize: 13, color: "#64748B", marginTop: 10 }}>
                  Loading progression clues…
                </Text>
              </View>
            ) : (
              <>
                {/* ═══ ROADMAP PROGRESSION BAR ═══ */}
                <View
                  style={{
                    backgroundColor: "#F8FAFC",
                    borderRadius: 20,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "#E2E8F0",
                    marginBottom: 20,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Flame size={16} color="#EA580C" />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#0F172A" }}>
                        Connection Stage
                      </Text>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1A6B3C" }}>
                      {stageName(stage)}
                    </Text>
                  </View>

                  {/* 5-Segment Progress Bar */}
                  <View style={{ flexDirection: "row", gap: 4, marginBottom: 12 }}>
                    {[0, 1, 2, 3, 4].map((step) => {
                      const isReached = stage >= step;
                      return (
                        <View
                          key={step}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isReached ? "#1A6B3C" : "#E2E8F0",
                          }}
                        />
                      );
                    })}
                  </View>

                  <Text style={{ fontSize: 11, color: "#64748B", lineHeight: 16 }}>
                    Keep chatting daily to advance stages and unlock mutual clues, academic details, and full identity.
                  </Text>
                </View>

                {/* ═══ COMPATIBILITY & SHARED INTERESTS (Stage 1+) ═══ */}
                {stage >= 1 && (
                  <View style={{ marginBottom: 20 }}>
                    {revealData?.compatibilityScore !== null &&
                      revealData?.compatibilityScore !== undefined && (
                        <View
                          style={{
                            backgroundColor: "rgba(26, 107, 60, 0.08)",
                            borderRadius: 18,
                            padding: 14,
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: "rgba(26, 107, 60, 0.2)",
                            marginBottom: 14,
                          }}
                        >
                          <Text style={{ fontSize: 26, fontWeight: "900", color: "#1A6B3C" }}>
                            {revealData.compatibilityScore}%
                          </Text>
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#0A1F12" }}>
                            High Ally Compatibility
                          </Text>
                        </View>
                      )}

                    {revealData?.sharedInterests && revealData.sharedInterests.length > 0 && (
                      <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>
                          Shared Interests
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {revealData.sharedInterests.map((interest) => (
                            <View
                              key={interest}
                              style={{
                                backgroundColor: "#F1F5F9",
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: "#E2E8F0",
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: "600", color: "#334155" }}>
                                ✨ {interest}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* ═══ STAGE 2: PLAY GAMES TOGETHER ═══ */}
                <View
                  style={{
                    backgroundColor: stage >= 2 ? "#FFFFFF" : "#F8FAFC",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: stage >= 2 ? "#E2E8F0" : "#E2E8F0",
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Gamepad2 size={18} color={stage >= 2 ? "#1A6B3C" : "#94A3B8"} />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: stage >= 2 ? "#0F172A" : "#64748B" }}>
                        Stage 2: Play Games Together
                      </Text>
                    </View>
                    <View
                      style={{
                        backgroundColor: "#FEF3C7",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: "700", color: "#D97706" }}>
                        Coming Soon
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: "#64748B", lineHeight: 16 }}>
                    {stage >= 2
                      ? "You reached Stage 2! Interactive mini-games are currently in development."
                      : "Reach a 3-day streak to unlock interactive games and activities."}
                  </Text>
                  {stage >= 2 && partner?.studyCategory && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F1F5F9", flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, color: "#64748B" }}>Academic Program</Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#0F172A" }}>{partner.studyCategory}</Text>
                    </View>
                  )}
                </View>

                {/* ═══ STAGE 3: IMAGE & MEDIA SHARING ═══ */}
                <View
                  style={{
                    backgroundColor: stage >= 3 ? "#FFFFFF" : "#F8FAFC",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: stage >= 3 ? "#E2E8F0" : "#E2E8F0",
                    padding: 16,
                    marginBottom: 20,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ImageIcon size={18} color={stage >= 3 ? "#1A6B3C" : "#94A3B8"} />
                      <Text style={{ fontSize: 13, fontWeight: "800", color: stage >= 3 ? "#0F172A" : "#64748B" }}>
                        Stage 3: Image & Media Sharing
                      </Text>
                    </View>
                    {stage >= 3 ? (
                      <View
                        style={{
                          backgroundColor: "#E8F5EE",
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: "700", color: "#1A6B3C" }}>
                          Unlocked
                        </Text>
                      </View>
                    ) : (
                      <Lock size={14} color="#94A3B8" />
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: "#64748B", lineHeight: 16 }}>
                    {stage >= 3
                      ? "Photos and camera uploads are unlocked! Share campus moments and notes."
                      : "Reach a 7-day streak to unlock sending photos and camera uploads in chat."}
                  </Text>
                </View>

                {/* ═══ STAGE 4: ALLIES UNLOCKED ═══ */}
                {stage >= 4 ? (
                  <View
                    style={{
                      backgroundColor: "rgba(26, 107, 60, 0.08)",
                      borderRadius: 20,
                      padding: 18,
                      borderWidth: 1.5,
                      borderColor: "#1A6B3C",
                      marginBottom: 20,
                      alignItems: "center",
                    }}
                  >
                    <Sparkles size={24} color="#1A6B3C" />
                    <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A", marginTop: 6 }}>
                      Campus Allies Unlocked!
                    </Text>
                    <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 4 }}>
                      You completed the Ally Roadmap! You are now official campus allies with full profile access.
                    </Text>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                      padding: 16,
                      marginBottom: 20,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Shield size={18} color="#94A3B8" />
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#64748B" }}>
                          Stage 4: Campus Allies
                        </Text>
                      </View>
                      <Lock size={14} color="#94A3B8" />
                    </View>
                    <Text style={{ fontSize: 12, color: "#64748B", lineHeight: 16 }}>
                      Reach a 10-day streak to reveal real identities and become confirmed campus allies.
                    </Text>
                  </View>
                )}

                {/* ═══ ICEBREAKER CARDS ═══ */}
                {revealData?.icebreakers && revealData.icebreakers.length > 0 && !ended && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>
                      Suggested Conversation Starters
                    </Text>
                    <View style={{ gap: 8 }}>
                      {revealData.icebreakers.map((prompt, idx) => (
                        <Pressable
                          key={idx}
                          onPress={() => {
                            if (onSelectIcebreaker) {
                              onSelectIcebreaker(prompt);
                              onClose();
                            }
                          }}
                          style={({ pressed }) => ({
                            backgroundColor: pressed ? "#E2E8F0" : "#F8FAFC",
                            padding: 12,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: "#E2E8F0",
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          })}
                        >
                          <Text style={{ fontSize: 13, color: "#1E293B", flex: 1, marginRight: 8 }}>
                            "{prompt}"
                          </Text>
                          <MessageSquareText size={16} color="#1A6B3C" />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

                {/* ═══ END CHAT BUTTON ═══ */}
                {!ended && (
                  <Pressable
                    onPress={handleEndMatch}
                    style={{
                      paddingVertical: 14,
                      borderRadius: 16,
                      backgroundColor: "rgba(239, 68, 68, 0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(239, 68, 68, 0.2)",
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 8,
                    }}
                  >
                    <LogOut size={16} color="#EF4444" />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#EF4444" }}>
                      End Anonymous Chat
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
