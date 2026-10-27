import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useResponsive } from "@/lib/responsive";
import { useTheme } from "@/context/ThemeContext";

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  hideAccent?: boolean;
  hideDivider?: boolean;
}

export function ScreenHeader({ right, hideDivider = false }: ScreenHeaderProps) {
  const { insets, isSmallScreen, scaleClamped } = useResponsive();
  const { colors } = useTheme();

  const topPadding = Math.max(insets.top + 8, 16);
  const horizontalPadding = isSmallScreen ? 14 : 20;
  const brandFontSize = scaleClamped(22, 0.9, 1.15);

  return (
    <View
      style={{
        paddingTop: topPadding,
        paddingBottom: 12,
        paddingHorizontal: horizontalPadding,
        backgroundColor: colors.surface,
        borderBottomWidth: hideDivider ? 0 : 1,
        borderBottomColor: hideDivider ? "transparent" : colors.border,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Brand Name on Left */}
      <Pressable
        hitSlop={8}
        onPress={() => router.push("/(tabs)" as any)}
      >
        <Text
          style={{
            fontFamily: "Fraunces_700Bold",
            fontSize: brandFontSize,
            color: colors.primary,
            letterSpacing: -0.5,
          }}
        >
          Ally-jis
        </Text>
      </Pressable>

      {right ? <View>{right}</View> : null}
    </View>
  );
}