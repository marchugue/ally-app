import React from "react";
import { View, ScrollView, ViewStyle, StyleProp, RefreshControlProps } from "react-native";
import { useResponsive } from "@/lib/responsive";
import { useTheme } from "@/context/ThemeContext";

interface ResponsiveContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  maxContentWidth?: number;
  backgroundColor?: string;
  useSafeAreaTop?: boolean;
  useSafeAreaBottom?: boolean;
  scrollable?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

export function ResponsiveContainer({
  children,
  style,
  contentStyle,
  maxContentWidth = 500,
  backgroundColor,
  useSafeAreaTop = false,
  useSafeAreaBottom = false,
  scrollable = false,
  refreshControl,
}: ResponsiveContainerProps) {
  const { insets, isTablet } = useResponsive();
  const { colors, isDark } = useTheme();

  const isDefaultLightBg = !backgroundColor || ["#FFFFFF", "#F7F4EF", "#F9FAFB", "#F7F8FA", "#F0EDE8"].includes(backgroundColor);
  const resolvedBg = isDark && isDefaultLightBg ? colors.background : (backgroundColor ?? colors.background);

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor: resolvedBg,
    paddingTop: useSafeAreaTop ? insets.top : 0,
    paddingBottom: useSafeAreaBottom ? insets.bottom : 0,
  };

  const innerStyle: ViewStyle = {
    flex: scrollable ? undefined : 1,
    width: "100%",
    maxWidth: isTablet ? maxContentWidth : undefined,
    alignSelf: "center",
  };

  if (scrollable) {
    return (
      <View style={[containerStyle, style]}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            innerStyle,
            { flexGrow: 1 },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      <View style={[innerStyle, contentStyle]}>{children}</View>
    </View>
  );
}
