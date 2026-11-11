import React from "react";
import { Pressable, Text } from "react-native";
import { useTheme } from "@/context/ThemeContext";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

/**
 * Pill filter chip that adapts its inactive surface, border, and label contrast
 * to light and dark themes via `useTheme()`.
 */
export function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: active
          ? "#1A6B3C"
          : isDark
          ? colors.surfaceMuted
          : "#F3F4F6",
        borderWidth: 1,
        borderColor: active
          ? "#1A6B3C"
          : isDark
          ? colors.border
          : "transparent",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: active ? "600" : "500",
          color: active ? "#FFFFFF" : colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
