// src/lib/avatarReveal.ts
//
// Shared math for progressive real-avatar reveal in ally-app.
// Mirrors web's reveal curves while adapting blurRadius to React Native's
// native bitmap blur pipelines so visual clarity matches web per tier.

import { PixelRatio, Platform } from "react-native";

export const REVEAL_TIER_META = [
  { tier: 0, label: "Hidden", hint: "Only their aura is showing" },
  { tier: 1, label: "Colour fog", hint: "Colours are starting to show" },
  { tier: 2, label: "Silhouette", hint: "A shape is taking form" },
  { tier: 3, label: "Blurry face", hint: "You can almost tell the mood" },
  { tier: 4, label: "Almost clear", hint: "Just a little more…" },
  { tier: 5, label: "Revealed", hint: "Say hi to your ally!" },
] as const;

/** Blur radius as a fraction of avatar size at tier start and tier end. */
const TIER_BLUR: Record<number, [number, number]> = {
  0: [0.16, 0.16],
  1: [0.14, 0.1],
  2: [0.1, 0.065],
  3: [0.065, 0.035],
  4: [0.035, 0.012],
  5: [0, 0],
};

export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface RevealVisualInput {
  tier: number;
  matchPoints: number;
  tierStart: number;
  tierEnd: number;
  progress: number;
}

export interface RevealVisual {
  /** Blur radius in px for the photo layer. */
  blurPx: number;
  /** 0..1 how far inside the current tier we are. */
  inTier: number;
  /** Legacy dock parameter maintained as 0 for center alignment. */
  dock: number;
  /** Opacity of the photo layer (0 at tier 0, rises smoothly to 1.0). */
  photoOpacity: number;
  /** Opacity of the centered animal emoji (1.0 at 0 pts, dissolves to 0.0 at 100%). */
  petOpacity: number;
}

const TIER_THUMB_WIDTH: Record<number, number> = {
  1: 6,
  2: 12,
  3: 24,
  4: 48,
};

export function computeRevealVisual(input: RevealVisualInput, size: number): RevealVisual {
  const span = Math.max(1, input.tierEnd - input.tierStart);
  const inTier = input.tier >= 5 ? 1 : clamp01((input.matchPoints - input.tierStart) / span);
  const [b0, b1] = TIER_BLUR[input.tier] ?? TIER_BLUR[0];
  const blurPx = lerp(b0, b1, inTier) * size;

  const normalizedProgress = clamp01(input.progress);
  const isRevealed = input.tier >= 5 || normalizedProgress >= 1;
  const petOpacity = isRevealed ? 0 : Math.max(0, 1 - Math.pow(normalizedProgress, 0.72));

  // Mirror web's photo opacity curve: hidden in tier 0, then 0.3 -> 1.0 across tiers 1..5.
  const photoOpacity =
    input.tier === 0 ? 0 : Math.min(1, 0.3 + normalizedProgress * 0.75);

  const dock = 0; // Center aligned

  return { blurPx, inTier, dock, photoOpacity, petOpacity };
}

/**
 * Converts web CSS Gaussian blurPx into a React Native Image `blurRadius` prop
 * accounting for bitmap resolution (6/12/24/48px tier thumbnails vs full photos)
 * and native platform `/ 2` blur divisors in ReactImageView / RCTImageBlurUtils.
 */
export function toNativeRevealBlurRadius(
  blurPx: number,
  size: number,
  tier: number,
  isRevealed: boolean,
  sourceWidth?: number | null
): number {
  if (isRevealed || blurPx <= 0 || size <= 0) return 0;

  const blurRatio = clamp01(blurPx / size);
  const bitmapWidth =
    sourceWidth && sourceWidth > 0
      ? sourceWidth
      : TIER_THUMB_WIDTH[tier] ?? size;
  const targetSigmaPx = blurRatio * bitmapWidth;

  if (Platform.OS === "android") {
    const density = PixelRatio.get() || 1;
    const pixelBlurRadius = Math.max(1, Math.min(48, Math.round(targetSigmaPx / 0.816)));
    return (2 * pixelBlurRadius + 1) / density;
  }

  return Math.max(3, Math.min(60, Math.round((targetSigmaPx / 0.47) * 10) / 10));
}

export function revealSeenKey(matchId: string): string {
  return `ally:avatar-reveal-seen:${matchId}`;
}
