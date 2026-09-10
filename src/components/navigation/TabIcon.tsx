import React from "react";
import { View, ColorValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
  useDerivedValue,
} from "react-native-reanimated";

type TabIconProps = {
  Icon: React.ComponentType<any>;
  label: string;
  color: ColorValue | string;
  size: number;
  focused?: boolean;
};

export default function TabIcon({
  Icon,
  label,
  color,
  size,
  focused,
}: TabIconProps) {
  // Icon position shift when focused (shifts up slightly -3px when focused, stays centered when inactive)
  const iconTranslateY = useDerivedValue(() =>
    withSpring(focused ? -3 : 0, {
      damping: 14,
      stiffness: 200,
      mass: 0.5,
    })
  );

  // Icon scale bounce when focused
  const iconScale = useDerivedValue(() =>
    withSpring(focused ? 1.05 : 0.95, {
      damping: 12,
      stiffness: 220,
      mass: 0.5,
    })
  );

  // Icon opacity
  const iconOpacity = useDerivedValue(() =>
    withTiming(focused ? 1 : 0.55, { duration: 180 })
  );

  // Label text translateY (slides in right under icon)
  const labelTranslateY = useDerivedValue(() =>
    withSpring(focused ? 0 : 4, {
      damping: 14,
      stiffness: 200,
      mass: 0.5,
    })
  );

  // Label text opacity (fade in 0 -> 1)
  const labelOpacity = useDerivedValue(() =>
    withTiming(focused ? 1 : 0, { duration: 180 })
  );

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: iconTranslateY.value },
      { scale: iconScale.value },
    ],
    opacity: iconOpacity.value,
  }));

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: labelTranslateY.value }],
    opacity: labelOpacity.value,
  }));

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        height: 46,
        width: 60,
      }}
    >
      {/* Main Animated Icon */}
      <Animated.View
        style={[
          iconAnimatedStyle,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <Icon color={color} size={size} />
      </Animated.View>

      {/* Activated Label Text directly under icon */}
      <Animated.View
        style={[
          labelAnimatedStyle,
          {
            position: "absolute",
            bottom: 1,
            left: -12,
            right: -12,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Animated.Text
          style={{
            fontSize: 10,
            fontWeight: "700",
            color: "#1A6B3C",
            letterSpacing: -0.2,
            textAlign: "center",
          }}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}