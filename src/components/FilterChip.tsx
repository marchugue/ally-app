import React from "react";
import { Pressable, Text } from "react-native";

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: active ? "#1A6B3C" : "#F3F4F6",
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: active ? "600" : "500",
          color: active ? "#FFFFFF" : "#6B7280",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
