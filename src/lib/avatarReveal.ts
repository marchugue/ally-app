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
  /** Legacy dock parameter maintained as 0 for center alignment. */
  dock: number;
  /** Opacity of the photo layer (0 at tier 0, rises smoothly to 1.0). */
  photoOpacity: number;
  /** Opacity of the centered animal emoji (1.0 at 0 pts, dissolves to 0.0 at 100%). */
  petOpacity: number;
}

export function computeRevealVisual(input: RevealVisualInput, size: number): RevealVisual {
  const span = Math.max(1, input.tierEnd - input.tierStart);
  const inTier = input.tier >= 5 ? 1 : clamp01((input.matchPoints - input.tierStart) / span);
  const [b0, b1] = TIER_BLUR[input.tier] ?? TIER_BLUR[0];
  const blurPx = Math.round(lerp(b0, b1, inTier) * size);

  // Both real avatar and avatar emoji are strictly in the center:
  // Pet opacity starts at 1.0 (100% visible) at 0 points,
  // and smoothly dissolves to 0.0 as points/progress reach 100% (250 pts / tier 5).
  const isRevealed = input.tier >= 5 || input.progress >= 1;
  const petOpacity = isRevealed ? 0 : Math.max(0, 1 - Math.pow(clamp01(input.progress), 0.72));

  // Photo opacity starts at 0 at tier 0 (only ambient aura glow showing),
  // then smoothly emerges from 0.35 up to 1.0 as points increase.
  const photoOpacity = input.tier === 0
    ? (input.matchPoints > 10 ? Math.min(0.25, (input.matchPoints / 50) * 0.25) : 0)
    : Math.min(1, 0.35 + clamp01(input.progress) * 0.65);

  const dock = 0; // Center aligned

  return { blurPx, inTier, dock, photoOpacity, petOpacity };
}

export function revealSeenKey(matchId: string): string {
  return `ally:avatar-reveal-seen:${matchId}`;
}
