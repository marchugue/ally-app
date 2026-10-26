/**
 * googleOAuth.ts — Native Google Sign-In for Expo Dev Build
 *
 * Strategy:
 *  1. Use @react-native-google-signin/google-signin for the native account picker
 *     (Android native bottom-sheet, iOS account chooser — no in-app browser).
 *  2. Exchange the Google idToken for a Supabase session via Supabase's REST API.
 *  3. Pass the resulting Supabase accessToken to the existing backend endpoint
 *     POST /auth/oauth/google — no backend changes required.
 *
 * Web Client ID:
 *  - Must be the **Web Application** client ID registered in Google Cloud Console
 *    (the same one configured in Supabase Auth > Google Provider).
 *  - Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.
 */

import { Platform } from "react-native";
import type { AuthSession, AuthUser } from "@/types/auth";

const SUPABASE_URL = "https://bbktizewwzdgohkvvzxs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_9FF5V9zxRLCbQbbOzzf9Lw_-yxbjKEi";

export const GOOGLE_WEB_CLIENT_ID =
  (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string | undefined) ?? "";

/**
 * Configure and return the GoogleSignin module.
 * We lazy-require it to avoid module-not-found errors in environments
 * where the native module hasn't been compiled yet (e.g. Expo Go).
 */
export function getGoogleSignin() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@react-native-google-signin/google-signin");
    return mod as typeof import("@react-native-google-signin/google-signin");
  } catch {
    return null;
  }
}

export function isNativeGoogleSignInAvailable(): boolean {
  if (Platform.OS === "web") return false;
  return getGoogleSignin() != null;
}

/**
 * Configure the native Google Sign-In SDK.
 * Call this once at app startup (in _layout.tsx or AuthProvider).
 */
export function configureGoogleSignIn() {
  const mod = getGoogleSignin();
  if (!mod) return;

  mod.GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    offlineAccess: false, // We don't need a server auth code
  });
}

/**
 * Exchange a Google ID token for a Supabase access token + refresh token.
 * Calls Supabase's token endpoint directly (no Supabase JS client needed).
 */
export async function exchangeGoogleIdTokenForSupabaseSession(
  idToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=id_token`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      provider: "google",
      id_token: idToken,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err?.error_description ||
        err?.message ||
        `Supabase token exchange failed (${response.status})`
    );
  }

  const data = await response.json();

  if (!data?.access_token) {
    throw new Error("No access token returned from Supabase.");
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || "",
  };
}

/**
 * Full native Google Sign-In flow:
 *  - Forces native account selector bottom-sheet so user can pick their account
 *  - Exchanges the idToken for a Supabase access token
 *  - Returns { accessToken, refreshToken } ready to POST to /auth/oauth/google
 */
export async function nativeGoogleSignIn(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const mod = getGoogleSignin();
  if (!mod) {
    throw new Error(
      "Native Google Sign-In is not available in this environment. Please use a dev build."
    );
  }

  const { GoogleSignin, statusCodes } = mod;

  // Ensure the SDK is configured
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Signing out beforehand ensures that Google Play Services always displays
  // the native account picker / account selector bottom sheet, allowing the user
  // to choose between multiple Google accounts on the device.
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore sign-out errors if no user was signed in previously
  }

  let userInfo: any;
  try {
    userInfo = await GoogleSignin.signIn();
  } catch (err: any) {
    if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("cancelled");
    }
    if (err?.code === statusCodes.IN_PROGRESS) {
      throw new Error("Sign-In already in progress. Please wait.");
    }
    if (err?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error(
        "Google Play Services is not available or outdated. Please update it and try again."
      );
    }
    throw err;
  }

  // Handle CancelledResponse in v16+ (res.type === 'cancelled')
  if (userInfo?.type === "cancelled") {
    throw new Error("cancelled");
  }

  const idToken = userInfo?.data?.idToken || userInfo?.idToken;
  if (!idToken) {
    if (!GOOGLE_WEB_CLIENT_ID) {
      throw new Error(
        "Google Sign-In failed: No ID token returned. Make sure EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set in your .env file with the Web Client ID from Google Cloud Console."
      );
    }
    throw new Error("No ID token received from Google.");
  }

  return exchangeGoogleIdTokenForSupabaseSession(idToken);
}

/**
 * Optional browser fallback for Expo Go or environments without the native Google Sign-In SDK.
 */
export async function browserGoogleSignIn(): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  let webBrowser: typeof import("expo-web-browser") | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    webBrowser = require("expo-web-browser");
  } catch {
    webBrowser = null;
  }

  if (!webBrowser || typeof webBrowser.openAuthSessionAsync !== "function") {
    throw new Error(
      "Google Sign-In is unavailable. Please run on a mobile development build."
    );
  }

  const returnUrl = "https://ally-jis.com/confirm";
  const supabaseOAuthUrl = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(returnUrl)}`;

  const result = await webBrowser.openAuthSessionAsync(supabaseOAuthUrl, returnUrl);

  if (result.type !== "success" || !result.url) {
    throw new Error("cancelled");
  }

  const urlStr = result.url;
  const hash = urlStr.includes("#") ? urlStr.substring(urlStr.indexOf("#") + 1) : "";
  const query = urlStr.includes("?") ? urlStr.substring(urlStr.indexOf("?") + 1).split("#")[0] : "";
  const hashParams = new URLSearchParams(hash);
  const queryParams = new URLSearchParams(query);

  const errorDesc =
    hashParams.get("error_description") ||
    queryParams.get("error_description") ||
    hashParams.get("error") ||
    queryParams.get("error");

  if (errorDesc) {
    throw new Error(decodeURIComponent(errorDesc).replace(/\+/g, " "));
  }

  const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token") || "";

  if (!accessToken) {
    throw new Error("No authorization token received from Google.");
  }

  return { accessToken, refreshToken };
}

// ── OAuth routing helpers (unchanged from original) ──────────────────────────

export function userNeedsOnboarding(user: AuthUser): boolean {
  const hasAcademicMetadata = Boolean(
    (user.user_metadata?.course || user.user_metadata?.department) &&
      user.user_metadata?.year_level
  );
  return !(
    user.user_metadata?.onboarding_complete === true ||
    user.user_metadata?.onboarding_complete === "true" ||
    hasAcademicMetadata
  );
}

export type OAuthNavigationTarget =
  | { kind: "tabs" }
  | { kind: "pending-approval" }
  | { kind: "id-upload" }
  | {
      kind: "register-step-2";
      studentIdFrontUri?: string;
      studentIdBackUri?: string;
    };

/** Post-OAuth routing rules aligned with web ConfirmPage. */
export function resolveOAuthNavigationTarget(
  session: AuthSession,
  opts: {
    hasStudentId: boolean;
    hasCachedId: boolean;
    cachedFrontUri?: string | null;
    cachedBackUri?: string | null;
  }
): OAuthNavigationTarget {
  const emailType = session.user?.user_metadata?.email_type;
  const isChmsu = emailType === "chmsu";
  const isApproved = Boolean(session.user?.user_metadata?.is_approved);
  const needsOnboard = session.user ? userNeedsOnboarding(session.user) : false;
  const { hasStudentId, hasCachedId, cachedFrontUri, cachedBackUri } = opts;

  if (isChmsu) {
    return needsOnboard
      ? {
          kind: "register-step-2",
          studentIdFrontUri: cachedFrontUri || undefined,
          studentIdBackUri: cachedBackUri || undefined,
        }
      : { kind: "tabs" };
  }

  if (!hasStudentId && !hasCachedId && !isApproved) {
    return { kind: "id-upload" };
  }
  if (needsOnboard) {
    return {
      kind: "register-step-2",
      studentIdFrontUri: cachedFrontUri || undefined,
      studentIdBackUri: cachedBackUri || undefined,
    };
  }
  if (!isApproved) {
    return { kind: "pending-approval" };
  }
  return { kind: "tabs" };
}
