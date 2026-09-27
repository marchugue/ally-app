import React, { useRef } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { getAvatarEmoji } from "@/constants/matchOptions";
import { OfflineAnimatedEmoji } from "@/components/OfflineAnimatedEmoji";

export interface RoadmapProgressionBadgeProps {
  stage?: number;
  dayStreak?: number;
  matchPoints?: number;
  stagePoints?: number;
  pointsPerStage?: number;
  profileUnlockTarget?: number;
  effectiveMultiplier?: number;
  avatarKey?: string | null;
  onPress: () => void;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
}

export interface StageProgression {
  currentStage: number;
  targetStage: number;
  matchPoints: number;
  profileUnlockTarget: number;
  progressPercent: number;
  isMaxStage: boolean;
  isProfileUnlocked: boolean;
  stageLabel: string;
  targetLabel: string;
}

export function calculateStageProgression(
  stage: number = 1,
  matchPoints: number = 0,
  profileUnlockTarget: number = 500
): StageProgression {
  const currentStage = Math.max(1, Math.min(4, stage));
  const isProfileUnlocked = matchPoints >= profileUnlockTarget;
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((matchPoints / profileUnlockTarget) * 100))
  );
  return {
    currentStage,
    targetStage: currentStage >= 4 ? 4 : currentStage + 1,
    matchPoints,
    profileUnlockTarget,
    progressPercent,
    isMaxStage: currentStage >= 4,
    isProfileUnlocked,
    stageLabel: `S${currentStage}`,
    targetLabel: currentStage >= 4 ? "MAX" : `S${currentStage + 1}`,
  };
}

export function RoadmapProgressionBadge({
  stage = 1,
  dayStreak: _dayStreak = 0,
  matchPoints = 0,
  stagePoints = 0,
  pointsPerStage = 500,
  profileUnlockTarget = 500,
  avatarKey,
  onPress,
  emojiSize = 60,
  style,
}: RoadmapProgressionBadgeProps) {
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const currentPoints = matchPoints > 0 ? matchPoints : stagePoints;
  const targetPoints = profileUnlockTarget > 0 ? profileUnlockTarget : pointsPerStage;
  const progression = calculateStageProgression(stage, currentPoints, targetPoints);
  const fallbackEmoji = getAvatarEmoji(avatarKey);

  const handlePressIn = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: pressScaleAnim }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.container}
        accessibilityRole="button"
        accessibilityLabel="Open Ally Roadmap and progression"
      >
        {/* Microsoft Fluent 3D Animal Emoji */}
        <View
          style={{
            width: emojiSize,
            height: emojiSize,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <OfflineAnimatedEmoji
            avatarKey={avatarKey}
            emoji={fallbackEmoji}
            size={emojiSize}
            preferLottie={true}
            fallbackText={fallbackEmoji}
          />
        </View>

        {/* Level / Progression Bar Horizontally — width strictly matches emoji scale */}
        <View style={[styles.barContainer, { width: emojiSize }]}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(6, progression.progressPercent)}%`,
                  backgroundColor: progression.isMaxStage ? "#F59E0B" : "#1A6B3C",
                },
              ]}
            />
          </View>

          {/* Stage label + pts/percent */}
          <View style={styles.labelRow}>
            <Text style={styles.stageText}>{progression.stageLabel}</Text>
            <Text style={styles.percentText}>
              {progression.isProfileUnlocked
                ? "MAX"
                : `${progression.matchPoints}pt`}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    // White card container removed completely as requested
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  barContainer: {
    alignItems: "center",
    gap: 2,
  },
  track: {
    width: "100%",
    height: 6,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 9999,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 9999,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 1,
  },
  stageText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#1A6B3C",
    fontFamily: "monospace",
    lineHeight: 11,
  },
  percentText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4B5563",
    fontFamily: "monospace",
    lineHeight: 11,
  },
});
