import { View, Text, Pressable } from "react-native";
import { Menu } from "lucide-react-native";
import { router } from "expo-router";
import { useResponsive } from "@/lib/responsive";

interface ScreenHeaderProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  hideAccent?: boolean;
}

export function ScreenHeader({ right }: ScreenHeaderProps) {
  const { insets, isSmallScreen, scaleClamped } = useResponsive();

  const topPadding = Math.max(insets.top + 8, 16);
  const horizontalPadding = isSmallScreen ? 14 : 20;
  const brandFontSize = scaleClamped(22, 0.9, 1.15);

  return (
    <View
      style={{
        paddingTop: topPadding,
        paddingBottom: 12,
        paddingHorizontal: horizontalPadding,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#F0EDE8",
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
            color: "#1A6B3C",
            letterSpacing: -0.5,
          }}
        >
          Ally-jis
        </Text>
      </Pressable>

      {/* Hamburger Icon on Right */}
      {right ?? (
        <Pressable
          hitSlop={12}
          onPress={() => router.push("/pages/settings" as any)}
        >
          <Menu size={isSmallScreen ? 22 : 24} color="#111827" />
        </Pressable>
      )}
    </View>
  );
}