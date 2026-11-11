import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarColorFor } from "@/constants/matchOptions";
import { CrittersAvatar } from "@/components/CrittersAvatar";
import { resolveImageUri } from "@/components/UserAvatar";

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
  borderWidth: _ignoredBorderWidth = 0,
}: AnonymousAvatarProps) {
  const bg = avatarColorFor(avatarKey);
  const borderRadius = size / 2;
  const resolvedPhotoUrl = resolveImageUri(photoUrl);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    setPhotoError(false);
  }, [resolvedPhotoUrl]);

  // ── Photo path (user has an unlocked real photo) ───────────────────────────
  if (resolvedPhotoUrl && resolvedPhotoUrl !== "[removed]" && !photoError) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius,
          overflow: "hidden",
          backgroundColor: "#E5E7EB",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={{ uri: resolvedPhotoUrl }}
          onError={() => setPhotoError(true)}
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

  // ── DiceBear Critters Theme (Always strokeless for anonymous users) ────────
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <CrittersAvatar
        avatarKey={avatarKey}
        size={size}
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

