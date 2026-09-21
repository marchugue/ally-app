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
import { getAnimalEmojiAsset } from "@/constants/animalEmojiAssets";
import { getAvatarEmoji } from "@/constants/matchOptions";

export interface RoadmapProgressionBadgeProps {
  stage?: number;
  dayStreak?: number;
  avatarKey?: string | null;
  onPress: () => void;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
}

export interface StageProgression {
  currentStage: number;
  targetStage: number;
  currentStreak: number;
  targetStreak: number;
  stageStartStreak: number;
  progressPercent: number;
  isMaxStage: boolean;
  stageLabel: string;
  targetLabel: string;
}

export function calculateStageProgression(
  stage: number = 1,
  dayStreak: number = 0
): StageProgression {
  const streakCalculatedStage =
    dayStreak >= 10 ? 4 : dayStreak >= 7 ? 3 : dayStreak >= 3 ? 2 : 1;
  const currentStage = Math.max(1, Math.min(4, Math.max(stage, streakCalculatedStage)));

  if (currentStage === 1) {
    const targetStreak = 3;
    const progressPercent = Math.max(
      0,
      Math.min(100, Math.round((dayStreak / targetStreak) * 100))
    );
    return {
      currentStage: 1,
      targetStage: 2,
      currentStreak: dayStreak,
      targetStreak,
      stageStartStreak: 0,
      progressPercent,
      isMaxStage: false,
      stageLabel: "Lv.1",
      targetLabel: "Lv.2",
    };
  }

  if (currentStage === 2) {
    const stageStartStreak = 3;
    const targetStreak = 7;
    const range = targetStreak - stageStartStreak; // 4
    const progressPercent = Math.max(
      0,
      Math.min(100, Math.round(((dayStreak - stageStartStreak) / range) * 100))
    );
    return {
      currentStage: 2,
      targetStage: 3,
      currentStreak: dayStreak,
      targetStreak,
      stageStartStreak,
      progressPercent,
      isMaxStage: false,
      stageLabel: "Lv.2",
      targetLabel: "Lv.3",
    };
  }

  if (currentStage === 3) {
    const stageStartStreak = 7;
    const targetStreak = 10;
    const range = targetStreak - stageStartStreak; // 3
    const progressPercent = Math.max(
      0,
      Math.min(100, Math.round(((dayStreak - stageStartStreak) / range) * 100))
    );
    return {
      currentStage: 3,
      targetStage: 4,
      currentStreak: dayStreak,
      targetStreak,
      stageStartStreak,
      progressPercent,
      isMaxStage: false,
      stageLabel: "Lv.3",
      targetLabel: "Lv.4",
    };
  }

  return {
    currentStage: 4,
    targetStage: 4,
    currentStreak: dayStreak,
    targetStreak: 10,
    stageStartStreak: 10,
    progressPercent: 100,
    isMaxStage: true,
    stageLabel: "Lv.4",
    targetLabel: "MAX",
  };
}

export function RoadmapProgressionBadge({
  stage = 1,
  dayStreak = 0,
  avatarKey,
  onPress,
  emojiSize = 60, // 1.5x scaled up (from 40px)
  style,
}: RoadmapProgressionBadgeProps) {
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const progression = calculateStageProgression(stage, dayStreak);
  const localAsset = getAnimalEmojiAsset(avatarKey);
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
          {localAsset ? (
            <Image
              source={localAsset}
              style={{ width: emojiSize, height: emojiSize }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontSize: emojiSize * 0.68, lineHeight: emojiSize * 0.8 }}>
              {fallbackEmoji}
            </Text>
          )}
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

          {/* Level text */}
          <View style={styles.labelRow}>
            <Text style={styles.stageText}>{progression.stageLabel}</Text>
            <Text style={styles.percentText}>
              {progression.isMaxStage ? "MAX" : `${progression.progressPercent}%`}
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
