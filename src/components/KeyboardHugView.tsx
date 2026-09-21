import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useKeyboardHandler } from "react-native-keyboard-controller";

type KeyboardHugViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Offset (in px) subtracted from the raw keyboard height.
   * Use this when a fixed element (e.g. bottom tab bar) already accounts for
   * part of the keyboard height so you don't double-compensate.
   */
  keyboardVerticalOffset?: number;
  /**
   * Extra gap (in px) added when the keyboard is active.
   * Defaults to 6px.
   */
  activeKeyboardGap?: number;
};

/**
 * Zero-delay keyboard-hugging container.
 *
 * Uses useKeyboardHandler → onMove (runs on the UI thread, in sync with the
 * native WindowInsets animation) to write directly into a Reanimated
 * SharedValue. The resulting paddingBottom is applied via useAnimatedStyle —
 * no JS bridge round-trips, no frame lag, works with iOS interactive
 * swipe-to-dismiss out of the box.
 *
 * DO NOT nest another KeyboardAvoidingView inside this tree.
 */
export function KeyboardHugView({
  children,
  style,
  keyboardVerticalOffset = 0,
  activeKeyboardGap = 10,
}: KeyboardHugViewProps) {
  const height = useSharedValue(0);

  // onMove fires on every animation frame on the UI thread — pure worklet,
  // zero JS-thread involvement.
  useKeyboardHandler(
    {
      onMove: (e) => {
        "worklet";
        const raw = e.height - keyboardVerticalOffset;
        if (raw <= 0) {
          height.value = 0;
        } else {
          const progress = Math.min(1, raw / 20);
          height.value = raw + activeKeyboardGap * progress;
        }
      },
      onEnd: (e) => {
        "worklet";
        const raw = e.height - keyboardVerticalOffset;
        if (raw <= 0) {
          height.value = 0;
        } else {
          height.value = raw + activeKeyboardGap;
        }
      },
    },
    [keyboardVerticalOffset, activeKeyboardGap]
  );

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    return { paddingBottom: height.value };
  });

  return (
    <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
