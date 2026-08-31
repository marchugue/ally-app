import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets, EdgeInsets } from "react-native-safe-area-context";

// Baseline dimensions based on standard phone sizes (e.g., iPhone 13 / 375x812)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Proportional scale based on screen width.
 */
export function scale(size: number, width: number): number {
  return (width / BASE_WIDTH) * size;
}

/**
 * Proportional scale based on screen height.
 */
export function verticalScale(size: number, height: number): number {
  return (height / BASE_HEIGHT) * size;
}

/**
 * Moderated scaling function. The factor parameter controls the scaling intensity.
 * Default factor is 0.5 (halfway between fixed size and fully proportional size).
 */
export function moderateScale(size: number, width: number, factor = 0.5): number {
  return size + (scale(size, width) - size) * factor;
}

/**
 * Scaled size clamped within a minimum and maximum multiplier bound.
 * Prevents elements from shrinking too much on tiny phones or becoming oversized on large tablets.
 */
export function scaleClamped(
  size: number,
  width: number,
  minRatio = 0.85,
  maxRatio = 1.25
): number {
  const scaled = scale(size, width);
  const min = size * minRatio;
  const max = size * maxRatio;
  return Math.min(Math.max(scaled, min), max);
}

export interface ResponsiveInfo {
  width: number;
  height: number;
  insets: EdgeInsets;
  isSmallScreen: boolean;   // Width < 375px (e.g. iPhone SE 1st gen, tight Androids)
  isStandardScreen: boolean;// 375px <= Width < 414px (Standard mobile width)
  isLargeScreen: boolean;   // 414px <= Width < 768px (iPhone Plus/Max, large Androids)
  isTablet: boolean;        // Width >= 768px (iPads, Android tablets, desktop web)
  isLandscape: boolean;
  scale: (size: number) => number;
  verticalScale: (size: number) => number;
  moderateScale: (size: number, factor?: number) => number;
  scaleClamped: (size: number, minRatio?: number, maxRatio?: number) => number;
}

/**
 * Custom React hook that reacts to orientation and window size changes,
 * providing real-time responsive metrics and scaling functions.
 */
export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isSmallScreen = width < 375;
  const isStandardScreen = width >= 375 && width < 414;
  const isLargeScreen = width >= 414 && width < 768;
  const isTablet = width >= 768;
  const isLandscape = width > height;

  return {
    width,
    height,
    insets,
    isSmallScreen,
    isStandardScreen,
    isLargeScreen,
    isTablet,
    isLandscape,
    scale: (size: number) => scale(size, width),
    verticalScale: (size: number) => verticalScale(size, height),
    moderateScale: (size: number, factor?: number) => moderateScale(size, width, factor),
    scaleClamped: (size: number, minRatio?: number, maxRatio?: number) =>
      scaleClamped(size, width, minRatio, maxRatio),
  };
}
