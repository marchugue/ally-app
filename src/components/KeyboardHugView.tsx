import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { useKeyboard } from "@/hooks/useKeyboard";

type KeyboardHugViewProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** iOS only — offset when a fixed header sits above this view. */
  keyboardVerticalOffset?: number;
};

/**
 * Keeps bottom-aligned inputs flush with the IME.
 * iOS: KeyboardAvoidingView padding. Android: bottom inset from keyboard events,
 * compensating only when adjustResize did not shrink the window (common on SDK 35+ / edge-to-edge).
 */
export function KeyboardHugView({
  children,
  style,
  keyboardVerticalOffset = 0,
}: KeyboardHugViewProps) {
  const { androidKeyboardInset } = useKeyboard();

  if (Platform.OS === "android") {
    return (
      <View
        style={[
          { flex: 1 },
          style,
          androidKeyboardInset > 0
            ? { paddingBottom: androidKeyboardInset }
            : null,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, style]}
      behavior="padding"
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
