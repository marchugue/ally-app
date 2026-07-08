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

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.254.109:3001";