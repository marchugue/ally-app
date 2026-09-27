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
  Zap,
  Star,
  MessageSquareText,
  Users,
  LogOut,
  CheckCircle2,
  Circle,
  Flame,
  Gamepad2,
  Image as ImageIcon,
} from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import {
  getMatchReveal,
  RevealData,
  DailyTaskStatus,
  endMatch as apiEndMatch,
} from "@/lib/api/matchmaking";
import { STAGE_NAMES, POINTS_PER_STAGE, stageName, avatarColorFor } from "@/constants/matchOptions";

interface MatchRevealSheetProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  stage?: number;
  stagePoints?: number;
  dayStreak?: number;
  partnerAlias?: string;
  partnerAvatar?: string;
  onSelectIcebreaker?: (text: string) => void;
  onMatchEnded?: () => void;
  ended?: boolean;
}

// Simple chip component
function Chip({ label }: { label: string }) {
  return (
    <View
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
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#F1F5F9",
      }}
    >
      <Text style={{ fontSize: 12, color: "#64748B" }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "700", color: "#0F172A" }}>
        {value}
      </Text>
    </View>
  );
}

// ── Tab types ────────────────────────────────────────────────────────────────
type TabId = "about" | "tasks" | "feed";

export function MatchRevealSheet({
  visible,
  onClose,
  matchId,
  stage: initialStage = 1,
  stagePoints: initialStagePoints = 0,
  dayStreak: initialStreak = 0,
  partnerAlias = "Anonymous Ally",
  partnerAvatar = "fox",
  onSelectIcebreaker,
  onMatchEnded,
  ended = false,
}: MatchRevealSheetProps) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("about");

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
  const dayStreak = revealData?.dayStreak ?? initialStreak;
  const partner = revealData?.partner;
  const stagePoints = revealData?.stagePoints ?? initialStagePoints;
  const matchPoints = revealData?.matchPoints ?? 0;
  const effectiveMultiplier = revealData?.effectiveMultiplier ?? 1;
  const isProfileUnlocked = Boolean(revealData?.isProfileUnlocked || matchPoints >= 500);
  const pointsProgress = Math.min(100, Math.round((matchPoints / 500) * 100));
  const pointsRemaining = Math.max(0, 500 - matchPoints);

  // Next streak milestone
  let nextStageDays = 3;
  if (stage === 2) nextStageDays = 7;
  else if (stage === 3) nextStageDays = 10;
  const daysToNextStage = Math.max(0, nextStageDays - dayStreak);

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
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: "90%",
            paddingBottom: 32,
          }}
        >
          {/* ── Drag Handle + Header ── */}
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
                  photoUrl={isProfileUnlocked ? partner?.avatarUrl : null}
                  isBlurred={false}
                />
                <View>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#0F172A" }}>
                    {isProfileUnlocked && partner?.fullName ? partner.fullName : partnerAlias}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#64748B", fontWeight: "600" }}>
                    Stage {stage}: {stageName(stage)} • {dayStreak}d streak
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

          {/* ── Tabs ── */}
          <View
            style={{
              flexDirection: "row",
              marginHorizontal: 20,
              marginTop: 12,
              marginBottom: 4,
              backgroundColor: "#F1F5F9",
              borderRadius: 12,
              padding: 3,
            }}
          >
            {(["about", "tasks", "feed"] as TabId[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: activeTab === tab ? "#FFFFFF" : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: activeTab === tab ? "#0F172A" : "#64748B",
                    textTransform: "capitalize",
                  }}
                >
                  {tab === "feed" ? "Feed" : tab === "tasks" ? "Tasks" : "About"}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 }}
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
                {/* ── ABOUT TAB ── */}
                {activeTab === "about" && (
                  <>
                    {/* ── 500-PT PROFILE UNLOCK CARD ── */}
                    <View
                      style={{
                        backgroundColor: "#F8FAFC",
                        borderRadius: 18,
                        padding: 16,
                        borderWidth: 1.5,
                        borderColor: isProfileUnlocked ? "#86EFAC" : "#E2E8F0",
                        marginBottom: 14,
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={{ fontSize: 16 }}>{isProfileUnlocked ? "🎉" : "🔓"}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "800", color: "#0F172A" }}>
                            {isProfileUnlocked ? "Real Identities Unlocked!" : "Profile Unlock Goal (500 pts)"}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: isProfileUnlocked ? "#16A34A" : "#D97706" }}>
                          {matchPoints} / 500 pts
                        </Text>
                      </View>

                      {/* 500-pt progress bar */}
                      <View
                        style={{
                          height: 8,
                          backgroundColor: "#E2E8F0",
                          borderRadius: 99,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            height: "100%",
                            width: `${Math.max(pointsProgress > 0 ? 3 : 0, pointsProgress)}%`,
                            backgroundColor: isProfileUnlocked ? "#16A34A" : "#1A6B3C",
                            borderRadius: 99,
                          }}
                        />
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 11, color: "#64748B" }}>
                          {isProfileUnlocked
                            ? "Mutual real profiles, names, and avatars unlocked."
                            : `${pointsRemaining} pts needed to unlock mutual profiles.`}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#1A6B3C" }}>
                          {pointsProgress}%
                        </Text>
                      </View>
                    </View>

                    {/* ── STREAK STAGES CARD (3d, 7d, 10d) ── */}
                    <View
                      style={{
                        backgroundColor: "#FFFBEB",
                        borderRadius: 16,
                        padding: 14,
                        borderWidth: 1,
                        borderColor: "#FDE68A",
                        marginBottom: 14,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 12,
                          backgroundColor: "#F59E0B",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Flame size={20} color="#FFFFFF" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: "800", color: "#92400E" }}>
                          {dayStreak}-Day Streak • Stage {stage} ({effectiveMultiplier}× Multiplier)
                        </Text>
                        <Text style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
                          {stage >= 4
                            ? "Max Stage 4 reached! Feed unlocked in Allies filter."
                            : `${daysToNextStage} more consecutive day${daysToNextStage === 1 ? "" : "s"} for Stage ${stage + 1} (${nextStageDays}d milestone)`}
                        </Text>
                      </View>
                    </View>

                    {/* ── REAL PROFILE DETAILS (when 500 pts reached) ── */}
                    {isProfileUnlocked && (
                      <View
                        style={{
                          backgroundColor: "#F0FDF4",
                          borderRadius: 18,
                          padding: 14,
                          borderWidth: 1.5,
                          borderColor: "#86EFAC",
                          marginBottom: 14,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#16A34A", marginBottom: 8, textTransform: "uppercase" }}>
                          👤 Real Profile Information
                        </Text>
                        <InfoRow label="Full Name" value={partner?.fullName} />
                        <InfoRow label="Username" value={partner?.username ? `@${partner.username}` : null} />
                        <InfoRow label="Department" value={partner?.department} />
                        <InfoRow label="Course" value={partner?.course} />
                        <InfoRow label="Bio" value={partner?.bio} />
                      </View>
                    )}

                    {/* Compatibility score */}
                    {stage >= 1 && revealData?.compatibilityScore != null && (
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
                          Ally Compatibility
                        </Text>
                      </View>
                    )}

                    {/* Shared interests */}
                    {stage >= 1 && revealData?.sharedInterests && revealData.sharedInterests.length > 0 && (
                      <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>
                          Shared Interests
                        </Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                          {revealData.sharedInterests.map((i) => (
                            <Chip key={i} label={`✨ ${i}`} />
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Partner details (stage 2+ non-identifying clues) */}
                    {stage >= 2 && !isProfileUnlocked && (
                      <View style={{ marginBottom: 14 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>
                          Stage 2 Clues
                        </Text>
                        <InfoRow label="Age range" value={partner?.ageRange} />
                        <InfoRow label="Zodiac" value={partner?.zodiacSign} />
                        <InfoRow label="Personality" value={partner?.personalityType} />
                        <InfoRow label="Studying" value={partner?.studyCategory} />
                      </View>
                    )}

                    {/* Hobbies (stage 3+) */}
                    {stage >= 3 && partner?.favoriteHobby && !isProfileUnlocked && (
                      <View style={{ marginBottom: 14 }}>
                        <InfoRow label="Favorite hobby" value={partner.favoriteHobby} />
                      </View>
                    )}

                    {/* Stage 4: feed unlock notice */}
                    {stage >= 4 && (
                      <View
                        style={{
                          backgroundColor: "rgba(26, 107, 60, 0.08)",
                          borderRadius: 18,
                          padding: 16,
                          borderWidth: 1.5,
                          borderColor: "#1A6B3C",
                          marginBottom: 16,
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <Users size={20} color="#1A6B3C" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "800", color: "#0F172A", marginBottom: 4 }}>
                            Campus Allies — Feed Unlocked!
                          </Text>
                          <Text style={{ fontSize: 12, color: "#64748B", lineHeight: 18 }}>
                            {partnerAlias}'s posts appear in your Allies filter (anonymous until 500 pts).
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Icebreakers */}
                    {revealData?.icebreakers && revealData.icebreakers.length > 0 && !ended && (
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#475569", marginBottom: 8, textTransform: "uppercase" }}>
                          Conversation Starters
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

                    {/* End match */}
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

                {/* ── TASKS TAB ── */}
                {activeTab === "tasks" && (
                  <>
                    {/* Multiplier info */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: "#FFF7ED",
                        borderWidth: 1,
                        borderColor: "#FED7AA",
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 14,
                      }}
                    >
                      <Flame size={16} color="#EA580C" />
                      <Text style={{ fontSize: 12, color: "#9A3412", flex: 1, lineHeight: 18 }}>
                        Stage {stage} multiplier: <Text style={{ fontWeight: "800" }}>{effectiveMultiplier}×</Text> ({dayStreak}d streak)
                        {"\n"}
                        <Text style={{ color: "#C2410C", fontSize: 11 }}>Resets at 12:00 AM PHT daily • 500 total points required to unlock real profiles!</Text>
                      </Text>
                    </View>

                    {(!revealData?.dailyTasks || revealData.dailyTasks.length === 0) ? (
                      <View style={{ alignItems: "center", paddingVertical: 32 }}>
                        <Lock size={28} color="#CBD5E1" />
                        <Text style={{ fontSize: 13, color: "#94A3B8", marginTop: 8 }}>
                          No tasks available at this stage.
                        </Text>
                      </View>
                    ) : (
                      <View style={{ gap: 10 }}>
                        {revealData.dailyTasks.map((task) => {
                          const bothDone = task.myCompleted && task.partnerCompleted;
                          return (
                            <View
                              key={task.taskId}
                              style={{
                                backgroundColor: bothDone ? "#F0FDF4" : "#F8FAFC",
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: bothDone ? "#86EFAC" : "#E2E8F0",
                                padding: 14,
                              }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                {bothDone ? (
                                  <CheckCircle2 size={20} color="#16A34A" />
                                ) : (
                                  <Circle size={20} color="#CBD5E1" />
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A" }}>
                                    {task.label}
                                  </Text>
                                  <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                    {task.description}
                                  </Text>
                                </View>
                                <View style={{ alignItems: "flex-end" }}>
                                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#1A6B3C" }}>
                                    +{Math.round(task.basePoints * effectiveMultiplier)}pt
                                  </Text>
                                  <Text style={{ fontSize: 10, color: "#94A3B8" }}>
                                    {task.basePoints}×{effectiveMultiplier}
                                  </Text>
                                </View>
                              </View>

                              {/* Me / Partner status */}
                              <View
                                style={{
                                  flexDirection: "row",
                                  gap: 16,
                                  marginTop: 10,
                                  paddingTop: 10,
                                  borderTopWidth: 1,
                                  borderTopColor: bothDone ? "#DCFCE7" : "#F1F5F9",
                                  paddingLeft: 30,
                                }}
                              >
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                  {task.myCompleted ? (
                                    <CheckCircle2 size={12} color="#16A34A" />
                                  ) : (
                                    <Circle size={12} color="#CBD5E1" />
                                  )}
                                  <Text style={{ fontSize: 11, color: task.myCompleted ? "#16A34A" : "#94A3B8" }}>
                                    You
                                  </Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                  {task.partnerCompleted ? (
                                    <CheckCircle2 size={12} color="#16A34A" />
                                  ) : (
                                    <Circle size={12} color="#CBD5E1" />
                                  )}
                                  <Text style={{ fontSize: 11, color: task.partnerCompleted ? "#16A34A" : "#94A3B8" }}>
                                    {partnerAlias}
                                  </Text>
                                </View>
                                {task.myPointsAwarded > 0 && (
                                  <Text style={{ fontSize: 10, color: "#F59E0B", marginLeft: "auto", fontWeight: "700" }}>
                                    +{task.myPointsAwarded} earned
                                  </Text>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}

                {/* ── FEED TAB ── */}
                {activeTab === "feed" && (
                  <View style={{ alignItems: "center", paddingVertical: 32 }}>
                    {stage >= 4 ? (
                      <>
                        <Users size={32} color="#1A6B3C" />
                        <Text style={{ fontSize: 14, fontWeight: "700", color: "#0F172A", marginTop: 10 }}>
                          Feed Unlocked!
                        </Text>
                        <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 18, maxWidth: 260 }}>
                          {partnerAlias}'s posts now appear in your Allies newsfeed filter — still anonymous until you both reveal.
                        </Text>
                      </>
                    ) : (
                      <>
                        <Lock size={28} color="#CBD5E1" />
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "#0F172A", marginTop: 10 }}>
                          Feed Locked
                        </Text>
                        <Text style={{ fontSize: 12, color: "#64748B", textAlign: "center", marginTop: 6, lineHeight: 18, maxWidth: 260 }}>
                          Reach Stage 4 to unlock {partnerAlias}'s posts in the Allies newsfeed filter.
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
