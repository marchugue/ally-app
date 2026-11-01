import React, { useRef } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { RevealAvatar } from "@/components/RevealAvatar";
import { getEffectiveAvatarReveal } from "@/lib/avatarRevealCache";
import type { AvatarRevealView } from "@/lib/api/matchmaking";

export interface RoadmapProgressionBadgeProps {
  stage?: number;
  dayStreak?: number;
  matchPoints?: number;
  stagePoints?: number;
  pointsPerStage?: number;
  profileUnlockTarget?: number;
  progressPercent?: number;
  isProfileUnlocked?: boolean;
  isMaxStage?: boolean;
  effectiveMultiplier?: number;
  avatarKey?: string | null;
  onPress: () => void;
  emojiSize?: number;
  style?: StyleProp<ViewStyle>;
  avatarReveal?: AvatarRevealView | null;
}

export function RoadmapProgressionBadge({
  stage = 1,
  matchPoints = 0,
  stagePoints = 0,
  pointsPerStage,
  profileUnlockTarget,
  progressPercent: serverProgressPercent,
  isProfileUnlocked: serverIsProfileUnlocked,
  isMaxStage: serverIsMaxStage,
  avatarKey,
  onPress,
  emojiSize = 60,
  style,
  avatarReveal,
}: RoadmapProgressionBadgeProps) {
  const pressScaleAnim = useRef(new Animated.Value(1)).current;

  const currentStage = Math.max(1, Math.min(4, stage));
  const currentPoints = matchPoints > 0 ? matchPoints : stagePoints;
  const targetPoints = profileUnlockTarget ?? pointsPerStage ?? avatarReveal?.target ?? 0;
  const progressPercent =
    serverProgressPercent ??
    (targetPoints > 0
      ? Math.max(0, Math.min(100, Math.round((currentPoints / targetPoints) * 100)))
      : 0);
  const isProfileUnlocked =
    serverIsProfileUnlocked ?? Boolean(targetPoints > 0 && currentPoints >= targetPoints);
  const isMaxStage = serverIsMaxStage ?? currentStage >= 4;
  const stageLabel = `S${currentStage}`;

  const effectiveReveal = getEffectiveAvatarReveal(
    undefined,
    currentPoints,
    avatarReveal,
    { partnerAvatar: avatarKey || undefined, target: targetPoints || undefined }
  );

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
        {/* Reveal avatar: real avatar and emoji in center, smoothly transitioning based on points */}
        <RevealAvatar
          reveal={effectiveReveal}
          avatarKey={avatarKey}
          size={emojiSize}
          showRing={false}
          showGainChip={false}
          matchPoints={currentPoints}
        />

        {/* Level / Progression Bar Horizontally — width strictly matches emoji scale */}
        <View style={[styles.barContainer, { width: emojiSize }]}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(6, progressPercent)}%`,
                  backgroundColor: isMaxStage ? "#F59E0B" : "#1A6B3C",
                },
              ]}
            />
          </View>

          {/* Stage label + pts/percent */}
          <View style={styles.labelRow}>
            <Text style={styles.stageText}>{stageLabel}</Text>
            <Text style={styles.percentText}>
              {isProfileUnlocked ? "MAX" : `${currentPoints}pt`}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
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
