import { View, Text, Image } from "react-native";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<AvatarSize, { container: number; fontSize: number; statusDot: number }> = {
  xs: { container: 24, fontSize: 12, statusDot: 8 },
  sm: { container: 32, fontSize: 16, statusDot: 10 },
  md: { container: 40, fontSize: 20, statusDot: 12 },
  lg: { container: 56, fontSize: 28, statusDot: 15 },
  xl: { container: 80, fontSize: 40, statusDot: 20 },
};

interface UserAvatarProps {
  /** Emoji string or image URL */
  avatar?: string | null;
  size?: AvatarSize;
  /** Show a green online indicator dot */
  online?: boolean;
  /** Fallback emoji when no avatar is provided */
  fallback?: string;
}

export function resolveImageUri(input: any): string | null {
  if (!input) return null;
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof input === "object") {
    if (typeof input.uri === "string" && input.uri.trim().length > 0) {
      return input.uri.trim();
    }
    if (typeof input.url === "string" && input.url.trim().length > 0) {
      return input.url.trim();
    }
    if (typeof input.path === "string" && input.path.trim().length > 0) {
      return input.path.trim();
    }
  }
  return null;
}

export function isUrl(input: any): boolean {
  const uri = resolveImageUri(input);
  if (!uri) return false;
  return (
    uri.startsWith("http://") ||
    uri.startsWith("https://") ||
    uri.startsWith("file://") ||
    uri.startsWith("data:") ||
    uri.startsWith("content://")
  );
}

export function UserAvatar({
  avatar,
  size = "md",
  online = false,
  fallback = "👤",
}: UserAvatarProps) {
  const { container, fontSize, statusDot } = SIZE_MAP[size];
  const borderRadius = container * 0.5;

  const imageUri = resolveImageUri(avatar);
  const isImage = isUrl(imageUri);
  const emojiDisplay =
    typeof avatar === "string" && !isImage && avatar.trim().length > 0
      ? avatar
      : fallback;

  return (
    <View style={{ width: container, height: container, position: "relative" }}>
      {isImage && imageUri ? (
        <Image
          source={{ uri: imageUri }}
          style={{
            width: container,
            height: container,
            borderRadius,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={{
            width: container,
            height: container,
            borderRadius,
            backgroundColor: "#1A6B3C14",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize }}>{emojiDisplay}</Text>
        </View>
      )}

      {online ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: statusDot,
            height: statusDot,
            borderRadius: statusDot / 2,
            backgroundColor: "#22C55E",
            borderWidth: 2,
            borderColor: "#FFFFFF",
            zIndex: 10,
          }}
        />
      ) : null}
    </View>
  );
}
