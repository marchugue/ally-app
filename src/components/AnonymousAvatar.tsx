import React from "react";
import { View, Image, StyleSheet } from "react-native";
import { avatarColorFor, getAvatarEmoji } from "@/constants/matchOptions";
import { OfflineAnimatedEmoji } from "@/components/OfflineAnimatedEmoji";
import { getAnimalFluentAsset } from "@/constants/emojiAnimationAssets";

interface AnonymousAvatarProps {
  avatarKey?: string | null;
  size?: number;
  photoUrl?: string | null;
  isBlurred?: boolean;
  borderWidth?: number;
  /**
   * When true (default), renders a static flat-3D Microsoft Fluent PNG.
   * Set to false only where an animated Lottie avatar is explicitly desired
   * (e.g. the Roadmap screen — but RoadmapProgressionBadge uses OfflineAnimatedEmoji
   * directly so it never passes animated=false here).
   *
   * Rule: chat list, conversation header, feed posts, comments, notifications,
   *       media preview → static (default).
   *       Roadmap badge → uses its own OfflineAnimatedEmoji, not this component.
   */
  animated?: boolean;
}

export function AnonymousAvatar({
  avatarKey,
  size = 48,
  photoUrl,
  isBlurred = false,
  borderWidth = 2,
  animated = false, // default OFF — flat 3D only in all list/feed contexts
}: AnonymousAvatarProps) {
  const bg = avatarColorFor(avatarKey);
  const emoji = getAvatarEmoji(avatarKey);
  const borderRadius = size / 2;

  // ── Photo path (user has a real photo) ───────────────────────────────────
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

  const emojiSize = Math.max(18, Math.round(size * 0.72));

  // ── Static flat-3D Microsoft Fluent PNG (default for all list/feed contexts) ──
  if (!animated) {
    const fluentAsset = getAnimalFluentAsset(avatarKey);
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
          overflow: "hidden",
        }}
      >
        <Image
          source={fluentAsset}
          style={{ width: emojiSize, height: emojiSize }}
          resizeMode="contain"
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

  // ── Animated Lottie / Fluent path (animated=true, used only where requested) ──
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
        overflow: "hidden",
      }}
    >
      <View style={isBlurred ? { opacity: 0.3 } : undefined}>
        <OfflineAnimatedEmoji
          avatarKey={avatarKey}
          emoji={emoji}
          size={emojiSize}
          fallbackText={emoji}
          preferLottie={true}
        />
      </View>
      {isBlurred && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(255, 255, 255, 0.65)" },
          ]}
        />
      )}
    </View>
  );
}
