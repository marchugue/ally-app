export const TAB_THEMES = {
  light: {
    activeColor: "#1A6B3C",
    inactiveColor: "#6B7280",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8E6E1",
    indicatorColor: "#1A6B3C",
  },
  dark: {
    activeColor: "#38C185",
    inactiveColor: "#71717A",
    backgroundColor: "#121212",
    borderColor: "rgba(255, 255, 255, 0.1)",
    indicatorColor: "#38C185",
  },
} as const;

export function getTabBarTheme(isDark: boolean) {
  return isDark ? TAB_THEMES.dark : TAB_THEMES.light;
}

export const TAB_THEME = {
  ...TAB_THEMES.light,
  baseHeight: 57,
  extraBottomSpace: 8,
  labelFontSize: 9,
  indicatorHeight: 3,
  indicatorWidth: 40,
} as const;