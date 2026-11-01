// src/constants/matchOptions.ts
//
// Pure visual anonymous animal avatar helpers (matches backend anonymousIdentity.ts).
// All progression rules, daily tasks, multiplied rewards, stage names,
// unlock targets, and streak milestones live exclusively on the backend API.

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

export const ANIMAL_KEYS = [
  "fox",
  "wolf",
  "whale",
  "owl",
  "panda",
  "otter",
  "falcon",
  "koala",
  "lynx",
  "dolphin",
  "raven",
  "badger",
];

export function getDeterministicAnonymousAvatar(userId?: string | null): string {
  if (!userId) return "fox";
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return ANIMAL_KEYS[hash % ANIMAL_KEYS.length];
}

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
