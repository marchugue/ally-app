import React from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolateColor,
  useSharedValue,
  withTiming,
  useDerivedValue,
} from "react-native-reanimated";

type TabIconProps = {
  Icon: React.ComponentType<any>;
  color: string;
  size: number;
  focused?: boolean;
  indicatorColor?: string;
};

export default function TabIcon({
  Icon,
  color,
  size,
  focused,
  indicatorColor = "#1A6B3C",
}: TabIconProps) {
  // Smooth spring animation for the top indicator width
  const indicatorScale = useDerivedValue(() =>
    withSpring(focused ? 1 : 0, {
      damping: 16,
      stiffness: 200,
      mass: 0.6,
    })
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: indicatorScale.value }],
    opacity: indicatorScale.value,
  }));

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        paddingTop: 4,
      }}
    >
      {/* Top highlight rectangle — smoothly scales in/out */}
      <Animated.View
        style={[
          {
            position: "absolute",
            top: -10,
            width: 40,
            height: 3,
            borderRadius: 999,
            backgroundColor: indicatorColor,
          },
          indicatorStyle,
        ]}
      />

      <Icon color={color} size={size - 1} />
    </View>
  );
}