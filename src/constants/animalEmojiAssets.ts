// src/constants/animalEmojiAssets.ts
// Local bundled 60fps infinite-loop animated Microsoft Fluent 3D animal emojis & Lottie animations

import {
  ANIMAL_FLUENT_ASSETS,
  ANIMAL_LOTTIE_ASSETS,
  getAnimalFluentAsset,
  getAnimalLottieAsset,
} from "./emojiAnimationAssets";

export {
  ANIMAL_FLUENT_ASSETS,
  ANIMAL_LOTTIE_ASSETS,
  getAnimalFluentAsset,
  getAnimalLottieAsset,
};

export const ANIMAL_EMOJI_ASSETS: Record<string, any> = ANIMAL_FLUENT_ASSETS;

export function getAnimalEmojiAsset(avatarKey?: string | null): any {
  return getAnimalFluentAsset(avatarKey);
}
