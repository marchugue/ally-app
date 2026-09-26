// src/constants/emojiAnimationAssets.ts
// Offline bundled 60fps Lottie animations & Microsoft Fluent 3D animated assets
// Provides zero-latency, offline-capable animated emoji playback.

/**
 * Offline Lottie JSON animations for quick reactions.
 * Lightweight 60fps vector animations (8KB - 60KB).
 */
export const REACTION_LOTTIE_ASSETS: Record<string, any> = {
  "❤️": require("../../assets/emojis/lottie/reactions/heart.json"),
  "😂": require("../../assets/emojis/lottie/reactions/joy.json"),
  "😮": require("../../assets/emojis/lottie/reactions/wow.json"),
  "😢": require("../../assets/emojis/lottie/reactions/cry.json"),
  "😡": require("../../assets/emojis/lottie/reactions/angry.json"),
  "👍": require("../../assets/emojis/lottie/reactions/thumbsup.json"),
  "👎": require("../../assets/emojis/lottie/reactions/thumbsdown.json"),
  "🔥": require("../../assets/emojis/lottie/reactions/fire.json"),
  "🎉": require("../../assets/emojis/lottie/reactions/party.json"),
  "🙏": require("../../assets/emojis/lottie/reactions/pray.json"),
  "👏": require("../../assets/emojis/lottie/reactions/clap.json"),

  // Key aliases
  heart: require("../../assets/emojis/lottie/reactions/heart.json"),
  joy: require("../../assets/emojis/lottie/reactions/joy.json"),
  wow: require("../../assets/emojis/lottie/reactions/wow.json"),
  cry: require("../../assets/emojis/lottie/reactions/cry.json"),
  angry: require("../../assets/emojis/lottie/reactions/angry.json"),
  thumbsup: require("../../assets/emojis/lottie/reactions/thumbsup.json"),
  thumbsdown: require("../../assets/emojis/lottie/reactions/thumbsdown.json"),
  fire: require("../../assets/emojis/lottie/reactions/fire.json"),
  party: require("../../assets/emojis/lottie/reactions/party.json"),
  pray: require("../../assets/emojis/lottie/reactions/pray.json"),
  clap: require("../../assets/emojis/lottie/reactions/clap.json"),
};

/**
 * Offline Microsoft Fluent 3D animated APNGs for quick reactions.
 * High-fidelity 3D renders stored locally for offline fallback.
 */
export const REACTION_FLUENT_ASSETS: Record<string, any> = {
  "❤️": require("../../assets/emojis/reactions/heart.png"),
  "😂": require("../../assets/emojis/reactions/joy.png"),
  "😮": require("../../assets/emojis/reactions/wow.png"),
  "😢": require("../../assets/emojis/reactions/cry.png"),
  "😡": require("../../assets/emojis/reactions/angry.png"),
  "👍": require("../../assets/emojis/reactions/thumbsup.png"),
  "👎": require("../../assets/emojis/reactions/thumbsdown.png"),
  "🔥": require("../../assets/emojis/reactions/fire.png"),
  "🎉": require("../../assets/emojis/reactions/party.png"),
  "🙏": require("../../assets/emojis/reactions/pray.png"),
  "👏": require("../../assets/emojis/reactions/clap.png"),

  // Key aliases
  heart: require("../../assets/emojis/reactions/heart.png"),
  joy: require("../../assets/emojis/reactions/joy.png"),
  wow: require("../../assets/emojis/reactions/wow.png"),
  cry: require("../../assets/emojis/reactions/cry.png"),
  angry: require("../../assets/emojis/reactions/angry.png"),
  thumbsup: require("../../assets/emojis/reactions/thumbsup.png"),
  thumbsdown: require("../../assets/emojis/reactions/thumbsdown.png"),
  fire: require("../../assets/emojis/reactions/fire.png"),
  party: require("../../assets/emojis/reactions/party.png"),
  pray: require("../../assets/emojis/reactions/pray.png"),
  clap: require("../../assets/emojis/reactions/clap.png"),
};

/**
 * Offline Lottie JSON animations for anonymous match animal avatars.
 */
export const ANIMAL_LOTTIE_ASSETS: Record<string, any> = {
  fox: require("../../assets/emojis/lottie/animals/fox.json"),
  wolf: require("../../assets/emojis/lottie/animals/wolf.json"),
  whale: require("../../assets/emojis/lottie/animals/whale.json"),
  owl: require("../../assets/emojis/lottie/animals/owl.json"),
  panda: require("../../assets/emojis/lottie/animals/panda.json"),
  otter: require("../../assets/emojis/lottie/animals/otter.json"),
  falcon: require("../../assets/emojis/lottie/animals/falcon.json"),
  lynx: require("../../assets/emojis/lottie/animals/lynx.json"),
  dolphin: require("../../assets/emojis/lottie/animals/dolphin.json"),
  raven: require("../../assets/emojis/lottie/animals/raven.json"),
  default: require("../../assets/emojis/lottie/animals/default.json"),

  // Unicode emoji aliases
  "🦊": require("../../assets/emojis/lottie/animals/fox.json"),
  "🐺": require("../../assets/emojis/lottie/animals/wolf.json"),
  "🐋": require("../../assets/emojis/lottie/animals/whale.json"),
  "🐳": require("../../assets/emojis/lottie/animals/whale.json"),
  "🦉": require("../../assets/emojis/lottie/animals/owl.json"),
  "🐼": require("../../assets/emojis/lottie/animals/panda.json"),
  "🦦": require("../../assets/emojis/lottie/animals/otter.json"),
  "🦅": require("../../assets/emojis/lottie/animals/falcon.json"),
  "🐱": require("../../assets/emojis/lottie/animals/lynx.json"),
  "🐬": require("../../assets/emojis/lottie/animals/dolphin.json"),
  "🐦‍⬛": require("../../assets/emojis/lottie/animals/raven.json"),
  "🐦": require("../../assets/emojis/lottie/animals/raven.json"),
  "🎭": require("../../assets/emojis/lottie/animals/default.json"),
};

/**
 * Offline Microsoft Fluent 3D animated animal emoji assets (APNG).
 * Complete offline coverage for all 12 animals + default mask.
 */
export const ANIMAL_FLUENT_ASSETS: Record<string, any> = {
  fox: require("../../assets/emojis/animals/fox.png"),
  wolf: require("../../assets/emojis/animals/wolf.png"),
  whale: require("../../assets/emojis/animals/whale.png"),
  owl: require("../../assets/emojis/animals/owl.png"),
  panda: require("../../assets/emojis/animals/panda.png"),
  otter: require("../../assets/emojis/animals/otter.png"),
  falcon: require("../../assets/emojis/animals/falcon.png"),
  koala: require("../../assets/emojis/animals/koala.png"),
  lynx: require("../../assets/emojis/animals/lynx.png"),
  dolphin: require("../../assets/emojis/animals/dolphin.png"),
  raven: require("../../assets/emojis/animals/raven.png"),
  badger: require("../../assets/emojis/animals/badger.png"),
  default: require("../../assets/emojis/animals/default.png"),

  // Unicode emoji aliases
  "🦊": require("../../assets/emojis/animals/fox.png"),
  "🐺": require("../../assets/emojis/animals/wolf.png"),
  "🐋": require("../../assets/emojis/animals/whale.png"),
  "🐳": require("../../assets/emojis/animals/whale.png"),
  "🦉": require("../../assets/emojis/animals/owl.png"),
  "🐼": require("../../assets/emojis/animals/panda.png"),
  "🦦": require("../../assets/emojis/animals/otter.png"),
  "🦅": require("../../assets/emojis/animals/falcon.png"),
  "🐨": require("../../assets/emojis/animals/koala.png"),
  "🐱": require("../../assets/emojis/animals/lynx.png"),
  "🐬": require("../../assets/emojis/animals/dolphin.png"),
  "🐦‍⬛": require("../../assets/emojis/animals/raven.png"),
  "🐦": require("../../assets/emojis/animals/raven.png"),
  "🦡": require("../../assets/emojis/animals/badger.png"),
  "🎭": require("../../assets/emojis/animals/default.png"),
};

/**
 * Strips variation selectors like \uFE0E / \uFE0F for resilient emoji matching.
 */
function normalizeEmojiKey(key: string): string {
  return key.trim().replace(/[\uFE0E\uFE0F]/g, "").toLowerCase();
}

/**
 * Returns the offline Lottie JSON source for a reaction emoji or key.
 */
export function getReactionLottieAsset(emojiOrKey?: string | null): any | null {
  if (!emojiOrKey) return null;
  if (REACTION_LOTTIE_ASSETS[emojiOrKey]) return REACTION_LOTTIE_ASSETS[emojiOrKey];
  const normalized = normalizeEmojiKey(emojiOrKey);
  return REACTION_LOTTIE_ASSETS[normalized] || null;
}

/**
 * Returns the offline Microsoft Fluent animated 3D APNG for a reaction emoji or key.
 */
export function getReactionFluentAsset(emojiOrKey?: string | null): any | null {
  if (!emojiOrKey) return null;
  if (REACTION_FLUENT_ASSETS[emojiOrKey]) return REACTION_FLUENT_ASSETS[emojiOrKey];
  const normalized = normalizeEmojiKey(emojiOrKey);
  return REACTION_FLUENT_ASSETS[normalized] || null;
}

/**
 * Returns the offline Lottie JSON source for an anonymous animal avatar.
 */
export function getAnimalLottieAsset(avatarKey?: string | null): any | null {
  if (!avatarKey) return ANIMAL_LOTTIE_ASSETS.default;
  const key = avatarKey.toLowerCase().trim();
  if (ANIMAL_LOTTIE_ASSETS[key]) return ANIMAL_LOTTIE_ASSETS[key];
  const normalized = normalizeEmojiKey(avatarKey);
  return ANIMAL_LOTTIE_ASSETS[normalized] || null;
}

/**
 * Returns the offline Microsoft Fluent animated 3D APNG for an animal avatar.
 */
export function getAnimalFluentAsset(avatarKey?: string | null): any {
  if (!avatarKey) return ANIMAL_FLUENT_ASSETS.default;
  const key = avatarKey.toLowerCase().trim();
  if (ANIMAL_FLUENT_ASSETS[key]) return ANIMAL_FLUENT_ASSETS[key];
  const normalized = normalizeEmojiKey(avatarKey);
  return ANIMAL_FLUENT_ASSETS[normalized] || ANIMAL_FLUENT_ASSETS.default;
}

export type EmojiAnimationAssetResult =
  | { type: "lottie"; source: any }
  | { type: "fluent"; source: any }
  | { type: "none"; source: null };

/**
 * High-performance resolver that prioritizes Lottie animations when available,
 * falling back gracefully to local offline Microsoft Fluent 3D animated assets.
 */
export function resolveOfflineEmojiAnimation(options: {
  emoji?: string | null;
  avatarKey?: string | null;
  preferLottie?: boolean;
}): EmojiAnimationAssetResult {
  const { emoji, avatarKey, preferLottie = true } = options;

  if (avatarKey) {
    if (preferLottie) {
      const lottie = getAnimalLottieAsset(avatarKey);
      if (lottie) return { type: "lottie", source: lottie };
    }
    const fluent = getAnimalFluentAsset(avatarKey);
    if (fluent) return { type: "fluent", source: fluent };
  }

  if (emoji) {
    if (preferLottie) {
      const lottie = getReactionLottieAsset(emoji) || getAnimalLottieAsset(emoji);
      if (lottie) return { type: "lottie", source: lottie };
    }
    const fluent = getReactionFluentAsset(emoji) || getAnimalFluentAsset(emoji);
    if (fluent) return { type: "fluent", source: fluent };
  }

  return { type: "none", source: null };
}
