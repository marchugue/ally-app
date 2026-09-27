import React from "react";
import { View, Text, Pressable, type StyleProp, type ViewStyle } from "react-native";

export interface ChatStreakBadgeProps {
  /** Consecutive day streak count. Badge is visible when dayStreak > 0. */
  dayStreak: number;
  /** True when both participants have chatted today (or streak confirmed today). */
  isStreakActiveToday?: boolean;
  /** Size variant: 'sm' (chat list, 11px font) or 'md' (header, 12px font). */
  size?: "sm" | "md";
  /** Whether to append 'd' to the number. Default false. */
  showDaysSuffix?: boolean;
  /** Extra container style. */
  style?: StyleProp<ViewStyle>;
  /** Optional press handler. */
  onPress?: () => void;
}

/**
 * ChatStreakBadge mirrors the web implementation:
 * - Minimalist: only the emoji and text, no background capsule pill.
 * - Active today: vibrant fire emoji & orange text (#eb5600).
 * - Inactive today: grayscale desaturated fire emoji (filter: grayscale(1), opacity: 0.5) & gray text (#9CA3AF).
 */
export const ChatStreakBadge: React.FC<ChatStreakBadgeProps> = ({
  dayStreak,
  isStreakActiveToday = false,
  size = "sm",
  showDaysSuffix = false,
  style,
  onPress,
}) => {
  if (!dayStreak || dayStreak <= 0) return null;

  const isSm = size === "sm";
  const emojiSize = isSm ? 12 : 13;
  const textSize = isSm ? 11 : 12;

  const content = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
        },
        style,
      ]}
    >
      <View
        className={!isStreakActiveToday ? "grayscale opacity-50" : ""}
        style={
          !isStreakActiveToday
            ? ({
                filter: [{ grayscale: 1 }, { opacity: 0.5 }],
                opacity: 0.5,
              } as any)
            : undefined
        }
      >
        <Text style={{ fontSize: emojiSize, lineHeight: emojiSize + 2 }}>🔥</Text>
      </View>
      <Text
        style={{
          fontSize: textSize,
          fontWeight: "700",
          color: isStreakActiveToday ? "#eb5600" : "#9CA3AF",
        }}
      >
        {dayStreak}
        {showDaysSuffix ? "d" : ""}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={6}>
        {content}
      </Pressable>
    );
  }

  return content;
};
