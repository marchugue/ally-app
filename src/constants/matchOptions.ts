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
  "Comfortable",
  "Trust Building",
  "Familiar",
  "Close Connection",
] as const;

export const STAGE_THRESHOLDS = [0, 3, 5, 7, 10];

export function stageForStreak(days: number): number {
  let stage = 0;
  for (let i = STAGE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (days >= STAGE_THRESHOLDS[i]) {
      stage = i;
      break;
    }
  }
  return stage;
}

export function stageName(stage: number): string {
  return STAGE_NAMES[stage] ?? STAGE_NAMES[0];
}
