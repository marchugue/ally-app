import { useState, useEffect } from "react";
import { View, Text, Image, Platform } from "react-native";
import { API_BASE_URL } from "@/constants";
import { AnonymousAvatar } from "./AnonymousAvatar";
import { AVATAR_EMOJI } from "@/constants/matchOptions";

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

export const PRIMARY_CDN_DOMAIN = "https://image.ally-jis.com";
export const FALLBACK_CDN_DOMAIN = "https://pub-21734b6a6db44e4bbb01a1a37662f875.r2.dev";

let primaryCdnReachable: boolean | null = null;
let primaryProbePromise: Promise<boolean> | null = null;

export async function probeUrlReachable(
  url: string,
  timeoutMs = 2500,
  requireOkStatus = false
): Promise<boolean> {
  if (typeof fetch !== "function") return true;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller?.signal,
    });
    return requireOkStatus ? res.ok : true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function markPrimaryCdnUnreachable(): void {
  primaryCdnReachable = false;
}

export function probePrimaryCdn(): Promise<boolean> {
  if (primaryCdnReachable !== null) return Promise.resolve(primaryCdnReachable);
  if (!primaryProbePromise) {
    primaryProbePromise = probeUrlReachable(`${PRIMARY_CDN_DOMAIN}/`).then((ok) => {
      primaryCdnReachable = ok;
      return ok;
    });
  }
  return primaryProbePromise;
}

void probePrimaryCdn();

function rewriteCdnDomain(url: string, targetDomain: string): string {
  let out = url.replace(
    /^https?:\/\/[^/]+\.r2\.cloudflarestorage\.com\/(?:ally-jis\/)?/i,
    `${targetDomain}/`
  );
  out = out.replace(/^https?:\/\/[^/]+\.r2\.dev(?=\/|$)/i, targetDomain);
  out = out.replace(
    /^https?:\/\/(?:www\.)?(?:media|image)\.ally-jis\.com(?=\/|$)/i,
    targetDomain
  );
  return out;
}

export function getFallbackImageUri(uri: string | null | undefined): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  const rewritten = rewriteCdnDomain(trimmed, FALLBACK_CDN_DOMAIN);
  return rewritten !== trimmed ? rewritten : null;
}

export function resolveImageUri(input: any): string | null {
  if (!input) return null;
  let raw: string | null = null;
  if (typeof input === "string") {
    raw = input.trim();
  } else if (typeof input === "object") {
    if (typeof input.uri === "string" && input.uri.trim().length > 0) {
      raw = input.uri.trim();
    } else if (typeof input.url === "string" && input.url.trim().length > 0) {
      raw = input.url.trim();
    } else if (typeof input.path === "string" && input.path.trim().length > 0) {
      raw = input.path.trim();
    }
  }

  if (!raw || raw.length === 0) return null;

  // Prepend API_BASE_URL if it's a relative path
  if (raw.startsWith("/")) {
    return `${API_BASE_URL}${raw}`;
  }

  const activeDomain =
    primaryCdnReachable === false ? FALLBACK_CDN_DOMAIN : PRIMARY_CDN_DOMAIN;
  raw = rewriteCdnDomain(raw, activeDomain);

  // Rewrite localhost / 127.0.0.1 for mobile devices/emulators so they can reach the server
  if (Platform.OS !== "web") {
    if (/https?:\/\/(localhost|127\.0\.0\.1):(3001|5174)/.test(raw)) {
      return raw.replace(/https?:\/\/(localhost|127\.0\.0\.1):(3001|5174)/, API_BASE_URL);
    }
  }

  return raw;
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

  const [imgError, setImgError] = useState(false);
  const [fallbackUri, setFallbackUri] = useState<string | null>(null);

  useEffect(() => {
    setImgError(false);
    setFallbackUri(null);
  }, [avatar]);

  const imageUri = resolveImageUri(avatar);
  const resolvedUri = fallbackUri || imageUri;
  const isImage = isUrl(resolvedUri) && !imgError;
  const animalKey =
    typeof avatar === "string" && !isImage && AVATAR_EMOJI[avatar.toLowerCase().trim()]
      ? avatar.toLowerCase().trim()
      : null;

  const emojiDisplay =
    typeof avatar === "string" &&
    !isImage &&
    !animalKey &&
    !isUrl(imageUri) &&
    avatar.trim().length > 0 &&
    avatar.trim() !== "[removed]" &&
    !avatar.startsWith("blob:")
      ? avatar
      : fallback;

  return (
    <View style={{ width: container, height: container, position: "relative" }}>
      {animalKey ? (
        <AnonymousAvatar avatarKey={animalKey} size={container} />
      ) : isImage && resolvedUri ? (
        <Image
          source={{ uri: resolvedUri }}
          onError={() => {
            const candidate = getFallbackImageUri(resolvedUri);
            if (!fallbackUri && candidate && candidate !== resolvedUri) {
              markPrimaryCdnUnreachable();
              setFallbackUri(candidate);
              return;
            }
            setImgError(true);
          }}
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
