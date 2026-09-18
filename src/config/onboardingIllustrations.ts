/**
 * onboardingIllustrations.ts (Mobile)
 * Central plug-in configuration for mobile onboarding illustrations.
 *
 * HOW TO USE:
 * 1. Put your image in `assets/images/` or anywhere in the project.
 * 2. Assign `require('../../assets/images/my-art.png')` or a remote URL `{ uri: 'https://...' }` below.
 * 3. FALLBACK GUARANTEE: If any key is null, undefined, or if the image fails to load,
 *    the app will automatically fall back to the built-in crisp SVG vector illustration.
 */

import type { ImageSourcePropType } from "react-native";

export type IllustrationSource = ImageSourcePropType | string | null;

export interface OnboardingIllustrationAssets {
  /** Email type selection screen illustration */
  emailSelect: IllustrationSource;
  /** Step 1: Basic Info (username, email, password) */
  basicInfo: IllustrationSource;
  /** Step 2: Academic details (course, year, department, orgs) */
  academic: IllustrationSource;
  /** Step 3: Campus passions and interests */
  interests: IllustrationSource;
  /** Step 4: Avatar picker and student bio */
  avatar: IllustrationSource;
  /** External student ID or COR document upload */
  idUpload: IllustrationSource;
  /** OTP verification screen */
  otp: IllustrationSource;
}

export const ONBOARDING_ILLUSTRATION_ASSETS: OnboardingIllustrationAssets = {
  emailSelect: require("../../assets/images/illustrations/email-select.jpg"),
  basicInfo: require("../../assets/images/illustrations/step-1-basic-info.jpg"),
  academic: require("../../assets/images/illustrations/step-2-academic.jpg"),
  interests: require("../../assets/images/illustrations/step-3-interests.jpg"),
  avatar: null, // Fallback to SVG until custom avatar image is added
  idUpload: require("../../assets/images/illustrations/step-id-upload.jpg"),
  otp: require("../../assets/images/illustrations/step-otp.jpg"),
};

/**
 * Helper to update illustrations at runtime or dynamically.
 */
export function setOnboardingIllustrations(config: Partial<OnboardingIllustrationAssets>) {
  Object.assign(ONBOARDING_ILLUSTRATION_ASSETS, config);
}

export function setOnboardingIllustration(key: keyof OnboardingIllustrationAssets, source: IllustrationSource) {
  ONBOARDING_ILLUSTRATION_ASSETS[key] = source;
}
