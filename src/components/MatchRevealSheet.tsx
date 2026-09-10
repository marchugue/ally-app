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
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import {
  getMatchReveal,
  RevealData,
  endMatch as apiEndMatch,
} from "@/lib/api/matchmaking";
import { requestConnection } from "@/lib/api/interaction";
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

  const handleSendFriendRequest = async () => {
    if (!partner?.userId || !accessToken || sendingRequest || friendRequestSent) return;
    setSendingRequest(true);
    try {
      await requestConnection(partner.userId, accessToken);
      setFriendRequestSent(true);
      Alert.alert("Request Sent", `Connection request sent to ${partner.fullName || partnerAlias}!`);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to send connection request.");
    } finally {
      setSendingRequest(false);
    }
  };

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
                  photoUrl={stage >= 2 ? partner?.blurredAvatarUrl || partner?.avatarUrl : null}
                  isBlurred={stage < 4}
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

                {/* ═══ UNLOCKED CLUES (Stage 2+) ═══ */}
                {stage >= 2 ? (
                  <View
                    style={{
                      backgroundColor: "#FFFFFF",
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                      padding: 16,
                      marginBottom: 20,
                      gap: 10,
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 4 }}>
                      Unlocked Ally Clues
                    </Text>

                    {partner?.studyCategory && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#64748B" }}>Academic Program</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                          {partner.studyCategory}
                        </Text>
                      </View>
                    )}

                    {partner?.personalityType && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#64748B" }}>Personality</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                          {partner.personalityType}
                        </Text>
                      </View>
                    )}

                    {partner?.zodiacSign && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#64748B" }}>Zodiac Sign</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                          {partner.zodiacSign}
                        </Text>
                      </View>
                    )}

                    {partner?.ageRange && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#64748B" }}>Age Range</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                          {partner.ageRange}
                        </Text>
                      </View>
                    )}

                    {stage >= 3 && partner?.firstNameLetter && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#64748B" }}>Name Starts With</Text>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#1A6B3C" }}>
                          Letter "{partner.firstNameLetter}"
                        </Text>
                      </View>
                    )}

                    {stage >= 3 && partner?.favoriteHobby && (
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: "#64748B" }}>Top Hobby</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                          {partner.favoriteHobby}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: "#F8FAFC",
                      borderRadius: 18,
                      padding: 20,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#E2E8F0",
                      marginBottom: 20,
                    }}
                  >
                    <Lock size={26} color="#94A3B8" />
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#334155", marginTop: 8 }}>
                      Stage 2 Clues Locked
                    </Text>
                    <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 4 }}>
                      Reach a 3-day streak to unlock personality, zodiac, and study department clues.
                    </Text>
                  </View>
                )}

                {/* ═══ STAGE 4: FULL REVEAL & ADD ALLY ═══ */}
                {stage >= 4 && partner?.userId && (
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
                      Identity Revealed!
                    </Text>
                    <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 4, marginBottom: 14 }}>
                      You have built a Close Connection. Connect officially to become permanent Allies.
                    </Text>

                    <Pressable
                      onPress={handleSendFriendRequest}
                      disabled={sendingRequest || friendRequestSent}
                      style={{
                        backgroundColor: friendRequestSent ? "#059669" : "#1A6B3C",
                        paddingVertical: 12,
                        paddingHorizontal: 24,
                        borderRadius: 16,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {sendingRequest ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <UserPlus size={16} color="#FFFFFF" />
                      )}
                      <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>
                        {friendRequestSent ? "Ally Request Sent" : "Connect as Ally"}
                      </Text>
                    </Pressable>
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
