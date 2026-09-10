// src/components/AnonymousAvatar.tsx
import React from "react";
import { View, Text, Image } from "react-native";
import { avatarColorFor, getAvatarEmoji } from "@/constants/matchOptions";

interface AnonymousAvatarProps {
  avatarKey?: string | null;
  size?: number;
  photoUrl?: string | null;
  isBlurred?: boolean;
  borderWidth?: number;
}

export function AnonymousAvatar({
  avatarKey,
  size = 48,
  photoUrl,
  isBlurred = false,
  borderWidth = 2,
}: AnonymousAvatarProps) {
  const bg = avatarColorFor(avatarKey);
  const emoji = getAvatarEmoji(avatarKey);
  const borderRadius = size / 2;

  if (photoUrl) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          borderWidth,
          borderColor: bg,
          overflow: "hidden",
          backgroundColor: "#E5E7EB",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={{ uri: photoUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          blurRadius={isBlurred ? 18 : 0}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        borderWidth,
        borderColor: bg,
        backgroundColor: `${bg}18`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: size * 0.48, lineHeight: size * 0.56, textAlign: "center" }}>
        {emoji}
      </Text>
    </View>
  );
}
