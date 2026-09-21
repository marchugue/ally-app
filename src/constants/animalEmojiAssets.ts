// src/constants/animalEmojiAssets.ts
// Local bundled 60fps infinite-loop animated Microsoft Fluent 3D animal emojis

export const ANIMAL_EMOJI_ASSETS: Record<string, any> = {
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
};

export function getAnimalEmojiAsset(avatarKey?: string | null): any {
  if (!avatarKey) return ANIMAL_EMOJI_ASSETS.default;
  const key = avatarKey.toLowerCase().trim();
  return ANIMAL_EMOJI_ASSETS[key] || ANIMAL_EMOJI_ASSETS.default;
}
