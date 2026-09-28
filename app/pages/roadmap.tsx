import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, CheckCircle2, Circle, Lock } from "lucide-react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  getMatchReveal,
  RevealData,
  DailyTaskStatus,
} from "@/lib/api/matchmaking";
import { stageName } from "@/constants/matchOptions";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Stage config ─────────────────────────────────────────────────────────────
const STAGES = [1, 2, 3, 4] as const;
const STAGE_STREAK_REQS = [0, 0, 3, 7, 10]; // days needed to unlock each stage

interface RoadmapTaskDef {
  taskId: string;
  label: string;
  description: string;
  basePoints: number;
  unlockedAtStage: number;
}

const MASTER_DAILY_TASKS: RoadmapTaskDef[] = [
  {
    taskId: "send_message",
    label: "Send a message",
    description: "Both of you send at least 1 message today",
    basePoints: 1,
    unlockedAtStage: 1,
  },
  {
    taskId: "play_game",
    label: "Play a game together",
    description: "Play a campus mini-game together (5+ min)",
    basePoints: 2,
    unlockedAtStage: 2,
  },
  {
    taskId: "send_photo",
    label: "Share a photo",
    description: "Each of you share at least 1 photo in chat",
    basePoints: 3,
    unlockedAtStage: 3,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 📏 ROAD & CARD LAYOUT CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const ROAD_SCALE = Math.max(SCREEN_W / 1024, SCREEN_H / 512);
const ROAD_IMG_WIDTH = Math.round(1024 * ROAD_SCALE);
const ROAD_IMG_HEIGHT = Math.round(512 * ROAD_SCALE);
const ROAD_IMG_LEFT = (SCREEN_W - ROAD_IMG_WIDTH) / 2; // centers the path horizontally
const CARD_PEEK_VISIBLE_BASE = 112; // reveals progress bar (~34px) + card header (~78px) on load


// ─────────────────────────────────────────────────────────────────────────────
// 🎮  PLATFORM LAYOUT — unified across desktop web, mobile web & mobile app
//
//  top   → 0.0 (image top) … 1.0 (image bottom)  — vertical placement
//  left  → 0.0 (image left) … 1.0 (image right) — horizontal placement
//  scale → platform image scale multiplier (1.0 = default size)
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_BASE_SIZE = 104; // base width/height in px before scaling

export const PLATFORM_CONFIG: { top: number; left: number; scale: number }[] = [
  { top: 0.80, left: 0.58, scale: 0.70 }, // Stage 1 (foreground path)
  { top: 0.67, left: 0.50, scale: 0.60 }, // Stage 2 (mid-lower curve)
  { top: 0.58, left: 0.44, scale: 0.53 }, // Stage 3 (mid-upper curve)
  { top: 0.48, left: 0.64, scale: 0.45 }, // Stage 4 (crest of the hill)
];

// ── Main page ────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const insets = useSafeAreaInsets();
  const cardPeekTop = SCREEN_H - (insets.bottom + CARD_PEEK_VISIBLE_BASE);
  const { accessToken } = useAuth();
  const params = useLocalSearchParams<{
    matchId: string;
    stage?: string;
    stagePoints?: string;
    dayStreak?: string;
    partnerAlias?: string;
    partnerAvatar?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [revealData, setRevealData] = useState<RevealData | null>(null);

  const matchId = params.matchId;
  const initialStage = parseInt(params.stage ?? "1", 10);
  const initialStreak = parseInt(params.dayStreak ?? "0", 10);

  const stage = revealData?.stage ?? initialStage;
  const dayStreak = revealData?.dayStreak ?? initialStreak;
  const effectiveMultiplier = revealData?.effectiveMultiplier ?? 1;
  const dailyTasks: DailyTaskStatus[] = revealData?.dailyTasks ?? [];
  const matchPoints =
    revealData?.matchPoints ??
    (params.stagePoints ? parseInt(params.stagePoints, 10) : 0);
  const goalPoints = revealData?.profileUnlockTarget ?? 500;
  const progressPercent = Math.min(
    100,
    Math.max(0, (matchPoints / goalPoints) * 100)
  );

  const tasksToDisplay = MASTER_DAILY_TASKS.map((def) => {
    const serverTask = dailyTasks.find((t) => t.taskId === def.taskId);
    const isAvailable = stage >= def.unlockedAtStage;
    const isDone =
      isAvailable &&
      (serverTask ? serverTask.myCompleted && serverTask.partnerCompleted : false);
    const basePoints = serverTask?.basePoints ?? def.basePoints;
    return {
      ...def,
      basePoints,
      isAvailable,
      isDone,
    };
  });

  const fetchReveal = useCallback(async () => {
    if (!matchId || !accessToken) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await getMatchReveal(matchId, accessToken);
      setRevealData(data);
    } catch (err) {
      console.warn("Roadmap: failed to load reveal data", err);
    } finally {
      setLoading(false);
    }
  }, [matchId, accessToken]);

  useEffect(() => { fetchReveal(); }, [fetchReveal]);

  return (
    <View style={styles.root}>
      {/* ── SECTION 1: Full-Bleed Road Background (Covers entire screen, never moves) ── */}
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
        {/* Centered 2:1 Landscape Image and Platform Anchor, bottom-anchored */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: ROAD_IMG_LEFT,
            width: ROAD_IMG_WIDTH,
            height: ROAD_IMG_HEIGHT,
          }}
        >
          {/* Road background */}
          <Image
            source={require("../../assets/images/roadmap-bg.png")}
            style={{ width: ROAD_IMG_WIDTH, height: ROAD_IMG_HEIGHT }}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* ── SECTION 2: Scrollable Layer (Limited scroll, reveals bottom info) ─ */}
      <ScrollView
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{
          paddingTop: cardPeekTop,
          paddingBottom: 0,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        {/* ── Points progression bar on top of card ──────────────── */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
              ]}
            />
            <Text style={styles.progressBarText}>
              {matchPoints}/{goalPoints}
            </Text>
          </View>
        </View>

        {/* The entire white card */}
        <View
          style={[
            styles.card,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
          ]}
        >
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#1A6B3C" />
              <Text style={styles.loadingText}>Loading your progression…</Text>
            </View>
          ) : (
            <>
              {/* ── Daily Tasks (Vertically aligned list, horizontal rows) ─ */}
              <Text style={styles.sectionLabel}>Daily Tasks</Text>

              <View>
                {tasksToDisplay.map((task, idx) => {
                  return (
                    <React.Fragment key={task.taskId}>
                      <View
                        style={[
                          styles.taskRow,
                          !task.isAvailable && styles.taskRowLocked,
                        ]}
                      >
                        {/* Icon on left */}
                        <View style={styles.iconWrap}>
                          {!task.isAvailable ? (
                            <Lock size={18} color="#94A3B8" strokeWidth={2} />
                          ) : task.isDone ? (
                            <CheckCircle2
                              size={22}
                              color="#16A34A"
                              strokeWidth={2.2}
                            />
                          ) : (
                            <Circle size={22} color="#CBD5E1" strokeWidth={2} />
                          )}
                        </View>

                        {/* Info on right */}
                        <View style={styles.taskInfo}>
                          <Text
                            style={[
                              styles.taskLabel,
                              task.isDone && { color: "#16A34A" },
                              !task.isAvailable && { color: "#94A3B8" },
                            ]}
                          >
                            {task.label}
                          </Text>
                          <Text
                            style={[
                              styles.taskDesc,
                              !task.isAvailable && { color: "#CBD5E1" },
                            ]}
                          >
                            {!task.isAvailable
                              ? `Unlocks at Stage ${task.unlockedAtStage} · ${stageName(task.unlockedAtStage)}`
                              : task.description}
                          </Text>
                        </View>

                        {/* Points */}
                        <View style={styles.taskPoints}>
                          <Text
                            style={[
                              styles.taskPtsValue,
                              task.isDone && { color: "#16A34A" },
                              !task.isAvailable && { color: "#CBD5E1" },
                            ]}
                          >
                            +{Math.round(task.basePoints * effectiveMultiplier)}
                          </Text>
                          <Text
                            style={[
                              styles.taskPtsSub,
                              !task.isAvailable && { color: "#CBD5E1" },
                            ]}
                          >
                            pts
                          </Text>
                        </View>
                      </View>
                      {idx < tasksToDisplay.length - 1 && (
                        <View style={styles.rowDivider} />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              {/* ── Streak Milestones (Horizontally aligned with gaps) ──── */}
              <View style={styles.milestoneHeader}>
                <Text style={styles.sectionLabel}>Streak Milestones</Text>
              </View>

              <View style={styles.streakTrackContainer}>
                {STAGES.map((s, idx) => {
                  const reqDays = STAGE_STREAK_REQS[s];
                  const unlocked = dayStreak >= reqDays;
                  const nextReqDays = STAGE_STREAK_REQS[s + 1] ?? 999;
                  const isConnectorActive =
                    idx < STAGES.length - 1 && dayStreak >= nextReqDays;

                  return (
                    <React.Fragment key={s}>
                      {/* Milestone Node: top streak icon, bottom days */}
                      <View style={styles.milestoneNode}>
                        {/* Top: Streak icon */}
                        <View
                          style={[
                            styles.milestoneIconWrap,
                            unlocked
                              ? styles.milestoneIconUnlocked
                              : styles.milestoneIconLocked,
                          ]}
                        >
                          {unlocked ? (
                            <Text style={styles.milestoneEmoji}>🔥</Text>
                          ) : (
                            <View style={styles.milestoneLockedInner}>
                              <Text style={styles.milestoneEmojiLocked}>🔥</Text>
                              <View style={styles.milestoneLockBadge}>
                                <Lock
                                  size={9}
                                  color="#64748B"
                                  strokeWidth={2.5}
                                />
                              </View>
                            </View>
                          )}
                        </View>

                        {/* Bottom: Days e.g. 0d, 3d, 7d, 10d */}
                        <Text
                          style={[
                            styles.milestoneDays,
                            unlocked
                              ? styles.milestoneDaysUnlocked
                              : styles.milestoneDaysLocked,
                          ]}
                        >
                          {reqDays}d
                        </Text>

                      </View>

                      {/* Horizontal connector line with gaps */}
                      {idx < STAGES.length - 1 && (
                        <View
                          style={[
                            styles.milestoneConnector,
                            isConnectorActive && styles.milestoneConnectorActive,
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </>
          )}

          {/* White extension below card to guarantee no green shows below under any condition */}
          <View
            style={{
              position: "absolute",
              bottom: -SCREEN_H,
              left: 0,
              right: 0,
              height: SCREEN_H,
              backgroundColor: "#FFFFFF",
            }}
          />
        </View>
      </ScrollView>

      {/* ── Floating Controls (Always on top, clickable) ──────────────── */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 12 }]}
        hitSlop={12}
      >
        <ChevronLeft size={22} color="#1A6B3C" strokeWidth={2.5} />
      </Pressable>

      <View style={[styles.stageTitleBadge, { top: insets.top + 10 }]}>
        <Text style={styles.stageTitleText}>
          Stage {stage} · {stageName(stage)}
        </Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#5BD147",
  },

  // ── Floating UI over road ─────────────────────────────────────────────────
  backBtn: {
    position: "absolute",
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    zIndex: 100,
  },

  stageTitleBadge: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    zIndex: 100,
  },
  stageTitleText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A6B3C",
  },

  // ── Platform labels ───────────────────────────────────────────────────────
  platformLabelWrap: {
    position: "absolute",
    top: 10,
    alignItems: "center",
    gap: 1,
    width: "100%",
    paddingHorizontal: 8,
  },
  platformCheckText: {
    fontSize: 15,
    color: "#16A34A",
    fontWeight: "900",
    lineHeight: 18,
  },
  platformActiveText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#92400E",
    lineHeight: 18,
  },
  platformStageName: {
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    maxWidth: 88,
  },



  // ── Points progression bar on top of card ───────────────────────────────
  progressBarWrapper: {
    marginHorizontal: 24,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  progressBarTrack: {
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    borderWidth: 2.5,
    borderColor: "#FFFFFF",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  progressBarFill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#22C55E",
    borderRadius: 9,
  },
  progressBarText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ── Road container (fixed background) ────────────────────────────────────
  roadFixedContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: SCREEN_W,
    overflow: "hidden",
  },

  // ── White card (the entire bottom section) ────────────────────────────────
  card: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
  },

  // ── Section label ─────────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // ── Loading / empty ───────────────────────────────────────────────────────
  loadingBox: {
    paddingVertical: 52,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  emptyBox: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: "#94A3B8",
  },

  // ── Task row ──────────────────────────────────────────────────────────────
  taskRowLocked: {
    opacity: 0.55,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  taskInfo: {
    flex: 1,
    gap: 2,
  },
  taskLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  taskDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },
  taskPoints: {
    alignItems: "flex-end",
    flexShrink: 0,
  },
  taskPtsValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1A6B3C",
  },
  taskPtsSub: {
    fontSize: 10,
    color: "#94A3B8",
  },

  // ── Streak milestones (horizontal track) ──────────────────────────────────
  milestoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 4,
  },
  streakSubText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EA580C",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  streakTrackContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  milestoneNode: {
    alignItems: "center",
    width: 60,
  },
  milestoneIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 6,
  },
  milestoneIconUnlocked: {
    backgroundColor: "#FEF3C7",
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  milestoneIconLocked: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  milestoneEmoji: {
    fontSize: 21,
  },
  milestoneLockedInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  milestoneEmojiLocked: {
    fontSize: 19,
    opacity: 0.22,
  },
  milestoneLockBadge: {
    position: "absolute",
    bottom: -3,
    right: -7,
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    padding: 2,
  },
  milestoneDays: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  milestoneDaysUnlocked: {
    color: "#0F172A",
  },
  milestoneDaysLocked: {
    color: "#94A3B8",
  },
  milestoneStage: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  milestoneStageUnlocked: {
    color: "#16A34A",
  },
  milestoneStageLocked: {
    color: "#CBD5E1",
  },
  milestoneConnector: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 6,
    alignSelf: "flex-start",
    marginTop: 21,
  },
  milestoneConnectorActive: {
    backgroundColor: "#16A34A",
  },

  // ── Shared ────────────────────────────────────────────────────────────────
  rowDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 40,
  },
});
