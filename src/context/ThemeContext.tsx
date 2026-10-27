import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { Appearance, ColorSchemeName } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeColors {
  // Main canvas / screens
  background: string;
  // Elevated surfaces (cards, panels, modal sheets)
  surface: string;
  // Inset wells, input backgrounds, muted pills
  surfaceMuted: string;
  // Elevated dialogs / popovers
  popover: string;
  // Borders and dividers
  border: string;
  borderSubtle: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Brand emerald & forest
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primarySoft: string;
  primaryBorder: string;

  // Warm gold / amber accent
  accent: string;
  accentSoft: string;

  // Status
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;

  // Tab bar specific
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
}

export const THEME_COLORS: Record<ResolvedTheme, ThemeColors> = {
  light: {
    background: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceMuted: "#F9FAFB",
    popover: "#FFFFFF",
    border: "#E5E7EB",
    borderSubtle: "#F3F4F6",

    textPrimary: "#111827",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",

    primary: "#1A6B3C",
    primaryDark: "#155a33",
    primaryLight: "#22894E",
    primarySoft: "rgba(26, 107, 60, 0.08)",
    primaryBorder: "rgba(26, 107, 60, 0.25)",

    accent: "#E8A838",
    accentSoft: "rgba(232, 168, 56, 0.15)",

    danger: "#EF4444",
    dangerSoft: "rgba(239, 68, 68, 0.1)",
    success: "#16A34A",
    successSoft: "rgba(22, 163, 74, 0.1)",

    tabBarBackground: "#FFFFFF",
    tabBarBorder: "#E5E7EB",
    tabBarActive: "#1A6B3C",
    tabBarInactive: "#6B7280",
  },
  dark: {
    // Level 0: Material Dark Base (#121212)
    background: "#121212",
    // Level 1: Cards & major content panels (#181818)
    surface: "#181818",
    // Level 2: Inset wells, inputs, secondary badges (#1F1F1F)
    surfaceMuted: "#1F1F1F",
    // Level 3: Floating modals & popovers (#242424)
    popover: "#242424",
    // Subtle borders (#262626 or rgba(255,255,255,0.1))
    border: "rgba(255, 255, 255, 0.1)",
    borderSubtle: "#262626",

    // Off-white prevents halation
    textPrimary: "#EDEDED",
    textSecondary: "#A1A1AA",
    textMuted: "#71717A",

    // Campus Emerald desaturated to prevent vibration on dark background
    primary: "#38C185",
    primaryDark: "#2DA872",
    primaryLight: "#4FD99D",
    primarySoft: "rgba(56, 193, 133, 0.15)",
    primaryBorder: "rgba(56, 193, 133, 0.35)",

    // Warm gold accent
    accent: "#F0B247",
    accentSoft: "rgba(240, 178, 71, 0.18)",

    danger: "#F87171",
    dangerSoft: "rgba(248, 113, 113, 0.15)",
    success: "#34D399",
    successSoft: "rgba(52, 211, 153, 0.15)",

    tabBarBackground: "#121212",
    tabBarBorder: "rgba(255, 255, 255, 0.1)",
    tabBarActive: "#38C185",
    tabBarInactive: "#71717A",
  },
};

const STORAGE_KEY_WEB = "ally-theme";
const STORAGE_KEY_MOBILE = "ally_dark_mode";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  const current = Appearance.getColorScheme();
  return current === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);
  const { setColorScheme: setNativeWindColorScheme } = useNativeWindColorScheme();

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;
  const isDark = resolvedTheme === "dark";

  // Load persisted theme on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const storedTheme = await AsyncStorage.getItem(STORAGE_KEY_WEB);
        if (
          storedTheme === "light" ||
          storedTheme === "dark" ||
          storedTheme === "system"
        ) {
          if (isMounted) setThemeState(storedTheme as Theme);
          return;
        }

        const legacyDarkMode = await AsyncStorage.getItem(STORAGE_KEY_MOBILE);
        if (legacyDarkMode !== null) {
          if (isMounted) setThemeState(legacyDarkMode === "true" ? "dark" : "light");
        }
      } catch (e) {
        // Ignore read errors
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync system appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(
      ({ colorScheme }: { colorScheme: ColorSchemeName }) => {
        setSystemTheme(colorScheme === "dark" ? "dark" : "light");
      }
    );
    return () => subscription.remove();
  }, []);

  // Synchronize NativeWind colorScheme whenever resolved theme changes
  useEffect(() => {
    setNativeWindColorScheme(resolvedTheme);
  }, [resolvedTheme, setNativeWindColorScheme]);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      const targetResolved: ResolvedTheme =
        newTheme === "system" ? getSystemTheme() : newTheme;

      try {
        AsyncStorage.setItem(STORAGE_KEY_WEB, newTheme);
        AsyncStorage.setItem(
          STORAGE_KEY_MOBILE,
          targetResolved === "dark" ? "true" : "false"
        );
      } catch (e) {
        // Ignore storage write error
      }
    },
    []
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  const colors = useMemo(() => THEME_COLORS[resolvedTheme], [resolvedTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark,
      colors,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, isDark, colors, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
