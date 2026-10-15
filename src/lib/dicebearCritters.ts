import { Style, Avatar } from '@dicebear/core';
import critters from '@dicebear/styles/critters.json';
import { avatarColorFor } from '../constants/matchOptions';

const crittersStyle = new Style(critters);

const svgCache = new Map<string, string>();
const dataUriCache = new Map<string, string>();

/**
 * Normalizes the seed string from an avatar key or name.
 */
export function normalizeCrittersSeed(seed?: string | null): string {
  if (!seed || typeof seed !== 'string') return 'ally';
  const clean = seed.trim().toLowerCase();
  return clean || 'ally';
}

/**
 * Normalizes background color to hex without '#' for DiceBear options.
 */
export function normalizeCrittersBg(seed?: string | null, customBg?: string | null): string {
  const color = customBg || avatarColorFor(seed);
  return color.replace(/^#/, '');
}

/**
 * Generates the raw SVG string for the DiceBear Critters avatar.
 */
export function getCrittersAvatarSvg(
  seed?: string | null,
  customBg?: string | null,
  size?: number
): string {
  const safeSeed = normalizeCrittersSeed(seed);
  const bgHex = normalizeCrittersBg(seed, customBg);
  const cacheKey = `${safeSeed}:${bgHex}:${size || 'auto'}`;

  const cached = svgCache.get(cacheKey);
  if (cached) return cached;

  try {
    const avatar = new Avatar(crittersStyle, {
      seed: safeSeed,
      backgroundColor: [bgHex],
      borderRadius: 50,
      ...(size ? { size } : {}),
    });
    const svg = avatar.toString();
    svgCache.set(cacheKey, svg);
    return svg;
  } catch (err) {
    console.warn('[DiceBear Mobile] Failed to generate critters SVG:', err);
    return '';
  }
}

/**
 * Generates the SVG Data URI for the DiceBear Critters avatar.
 */
export function getCrittersAvatarDataUri(
  seed?: string | null,
  customBg?: string | null,
  size?: number
): string {
  const safeSeed = normalizeCrittersSeed(seed);
  const bgHex = normalizeCrittersBg(seed, customBg);
  const cacheKey = `${safeSeed}:${bgHex}:${size || 'auto'}`;

  const cached = dataUriCache.get(cacheKey);
  if (cached) return cached;

  try {
    const avatar = new Avatar(crittersStyle, {
      seed: safeSeed,
      backgroundColor: [bgHex],
      borderRadius: 50,
      ...(size ? { size } : {}),
    });
    const uri = avatar.toDataUri();
    dataUriCache.set(cacheKey, uri);
    return uri;
  } catch (err) {
    console.warn('[DiceBear Mobile] Failed to generate critters Data URI:', err);
    return getCrittersHttpUrl(seed, customBg);
  }
}

/**
 * Returns HTTP API URL fallback for the Critters style.
 */
export function getCrittersHttpUrl(
  seed?: string | null,
  customBg?: string | null,
  format: 'png' | 'svg' = 'png'
): string {
  const safeSeed = normalizeCrittersSeed(seed);
  const bgHex = normalizeCrittersBg(seed, customBg);
  return `https://api.dicebear.com/10.x/critters/${format}?seed=${encodeURIComponent(
    safeSeed
  )}&backgroundColor=${bgHex}&radius=50`;
}
