// src/constants/matchOptions.ts
//
// Matches backend anonymous animal pool (see backend: src/app/constants/anonymousIdentity.ts).
// Maps each animal key to its corresponding emoji and deterministic background color.

export const AVATAR_EMOJI: Record<string, string> = {
  fox: "🦊",
  wolf: "🐺",
  whale: "🐋",
  owl: "🦉",
  panda: "🐼",
  otter: "🦦",
  falcon: "🦅",
  koala: "🐨",
  lynx: "🐱",
  dolphin: "🐬",
  raven: "🐦‍⬛",
  badger: "🦡",
};

export const DEFAULT_AVATAR_EMOJI = "🎭";

export function getAvatarEmoji(avatarKey: string | null | undefined): string {
  if (!avatarKey) return DEFAULT_AVATAR_EMOJI;
  const normalized = avatarKey.toLowerCase().trim();
  return AVATAR_EMOJI[normalized] || avatarKey;
}

export const AVATAR_COLORS = [
  "#1A6B3C",
  "#3B8C7E",
  "#B8860B",
  "#6B5B95",
  "#C0654B",
  "#3B6E8C",
];

export function avatarColorFor(avatarKey: string | null | undefined): string {
  if (!avatarKey) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < avatarKey.length; i++) {
    hash = (hash * 31 + avatarKey.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
}

export const STAGE_NAMES = [
  "Stranger",
  "Anonymous Chat",
  "Play Games Together",
  "Media Sharing",
  "Campus Allies",
] as const;

/** Points required to unlock real profile / mutual identity. */
export const TOTAL_POINTS_FOR_PROFILE_UNLOCK = 500;

/** Backward-compat alias */
export const POINTS_PER_STAGE = 500;

/** Consecutive daily streak required to enter each stage: 0d (Stage 1), 3d (Stage 2), 7d (Stage 3), 10d (Stage 4). */
export const STAGE_THRESHOLDS = [0, 0, 3, 7, 10];

/** @deprecated Use points-based progression instead. */
export function stageForStreak(_days: number): number {
  return 1;
}

export function stageName(stage: number): string {
  return STAGE_NAMES[stage] ?? STAGE_NAMES[0];
}
