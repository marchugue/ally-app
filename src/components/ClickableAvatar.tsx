import React from "react";
import { Pressable, StyleProp, ViewStyle } from "react-native";
import { router } from "expo-router";
import { UserAvatar } from "./UserAvatar";
import { AnonymousAvatar } from "./AnonymousAvatar";
import { getDeterministicAnonymousAvatar } from "@/constants/matchOptions";

interface ClickableAvatarProps {
  /** Profile to open on press. When absent the avatar is not interactive. */
  userId?: string | null;
  /** Real avatar URL — only rendered when `revealed` is true. */
  avatarUrl?: string | null;
  /** Anonymous avatar key (animal) used when the identity is not revealed. */
  avatarKey?: string | null;
  /** True for allies / own profile: show the real avatar instead of the anonymous one. */
  revealed?: boolean;
  size?: number;
  /** Optional override of the default navigation to /pages/user-profile. */
  onPress?: (userId: string) => void;
  style?: StyleProp<ViewStyle>;
}

function userAvatarSize(size: number): "sm" | "md" | "lg" {
  if (size <= 34) return "sm";
  if (size <= 48) return "md";
  return "lg";
}

/**
 * Single source of truth for tappable avatars. Anonymous or revealed, tapping
 * always navigates to the user's profile page — the profile screen itself
 * decides how much identity/posts to show (anonymous unless allied, posts
 * hidden for private accounts).
 */
export function ClickableAvatar({
  userId,
  avatarUrl,
  avatarKey,
  revealed = false,
  size = 40,
  onPress,
  style,
}: ClickableAvatarProps) {
  const effectiveAvatarKey = avatarKey || getDeterministicAnonymousAvatar(userId);
  const avatar =
    revealed && avatarUrl ? (
      <UserAvatar avatar={avatarUrl} size={userAvatarSize(size)} />
    ) : (
      <AnonymousAvatar avatarKey={effectiveAvatarKey} size={size} />
    );

  if (!userId) return avatar;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="View profile"
      hitSlop={6}
      onPress={() => {
        if (onPress) onPress(userId);
        else
          router.push({
            pathname: "/pages/user-profile",
            params: {
              userId,
              avatarKey: effectiveAvatarKey,
              avatarUrl: avatarUrl || "",
            },
          } as any);
      }}
      style={style}
    >
      {avatar}
    </Pressable>
  );
}

export default ClickableAvatar;
