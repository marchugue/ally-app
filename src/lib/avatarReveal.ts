// src/lib/avatarReveal.ts
//
// Shared math for progressive real-avatar reveal in ally-app.
// The server caps image detail per tier (only sending low-res previews);
// these helpers drive the visual smoothing (blur, docking animal mask,
// progress curves) across react-native surfaces.

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
  /** Animal mask transform: 0 = full/centered, 1 = docked corner badge. */
  dock: number;
  /** Opacity of the photo layer (tier 0 shows only the colour glow). */
  photoOpacity: number;
}

export function computeRevealVisual(input: RevealVisualInput, size: number): RevealVisual {
  const span = Math.max(1, input.tierEnd - input.tierStart);
  const inTier = input.tier >= 5 ? 1 : clamp01((input.matchPoints - input.tierStart) / span);
  const [b0, b1] = TIER_BLUR[input.tier] ?? TIER_BLUR[0];
  const blurPx = Math.round(lerp(b0, b1, inTier) * size);

  // Animal starts docking once the photo begins to show (20%) and is fully docked at 90%
  const dock = clamp01((input.progress - 0.2) / 0.7);
  const photoOpacity = input.tier === 0 ? 0 : 1;

  return { blurPx, inTier, dock, photoOpacity };
}

export function revealSeenKey(matchId: string): string {
  return `ally:avatar-reveal-seen:${matchId}`;
}
