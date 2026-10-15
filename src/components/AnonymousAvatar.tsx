import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarColorFor } from "@/constants/matchOptions";
import { CrittersAvatar } from "@/components/CrittersAvatar";

interface AnonymousAvatarProps {
  avatarKey?: string | null;
  size?: number;
  photoUrl?: string | null;
  isBlurred?: boolean;
  borderWidth?: number;
  animated?: boolean;
}

export function AnonymousAvatar({
  avatarKey,
  size = 48,
  photoUrl,
  isBlurred = false,
  borderWidth = 2,
}: AnonymousAvatarProps) {
  const bg = avatarColorFor(avatarKey);
  const borderRadius = size / 2;

  // ── Photo path (user has an unlocked real photo) ───────────────────────────
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
        {isBlurred && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(255, 255, 255, 0.45)" },
            ]}
          />
        )}
      </View>
    );
  }

  // ── DiceBear Critters Theme (Default for all anonymous users & roadmap) ────
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        borderWidth,
        borderColor: bg,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <CrittersAvatar
        avatarKey={avatarKey}
        size={size - borderWidth * 2}
        customBg={bg}
        blurRadius={isBlurred ? 14 : 0}
      />
      {isBlurred && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(255, 255, 255, 0.55)" },
          ]}
        />
      )}
    </View>
  );
}

