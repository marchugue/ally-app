import Constants from "expo-constants";
import { Platform } from "react-native";

export const COLORS = {
  // Backgrounds
  background: "#F7F4EF",       // warm cream — main app bg
  surface: "#FFFFFF",          // white cards / surfaces
  surfaceMuted: "#F0EDE8",     // slightly deeper cream for muted areas

  // Borders
  border: "#E2DED7",           // soft warm-gray border

  // Brand greens
  primary: "#1A6B3C",          // forest green — main CTA, active tabs
  primaryLight: "#22894E",     // lighter green for hover / pressed
  primaryDark: "#155a33",      // deep green for active states

  // Brand accent
  accent: "#E8A838",           // warm amber — highlights, tags, badges

  // Text
  textPrimary: "#111827",      // near-black for headings / body
  textSecondary: "#6B7280",    // muted gray for captions / metadata

  // Status
  danger: "#EF4444",
  success: "#16A34A",
} as const;

function getApiBaseUrl(): string {
  // 1. Remote production or staging URL (https://)
  if (process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.startsWith("https://")) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Auto-detect host IP address from Expo bundler connection (Expo Go / Dev Server)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).debuggerHost;
  if (hostUri && typeof hostUri === "string") {
    const hostIp = hostUri.split(":")[0];
    if (hostIp && hostIp !== "localhost" && hostIp !== "127.0.0.1") {
      return `http://${hostIp}:3001`;
    }
  }

  // 3. Explicit environment variable if specified (and not localhost)
  if (
    process.env.EXPO_PUBLIC_API_URL &&
    process.env.EXPO_PUBLIC_API_URL !== "http://localhost:3001"
  ) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 4. Android Emulator fallback
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001";
  }

  // 5. Default fallback to current local machine IP
  return "http://192.168.254.109:3001";
}

export const API_BASE_URL = getApiBaseUrl();