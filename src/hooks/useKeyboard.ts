import { useKeyboardState } from "react-native-keyboard-controller";

/**
 * Thin JS-thread wrapper for keyboard visibility state.
 * Powered by react-native-keyboard-controller's useKeyboardState —
 * reads from the native keyboard state machine instead of Keyboard.addListener.
 *
 * Use this only for conditional rendering logic.
 * For animated layout — use KeyboardHugView or useKeyboardHandler directly.
 */
export function useKeyboard() {
  const isKeyboardVisible = useKeyboardState((s) => s.isVisible);
  const keyboardHeight = useKeyboardState((s) => s.height);

  return {
    isKeyboardVisible,
    keyboardHeight,
    /** Kept 0 for backwards compatibility with legacy callers */
    androidKeyboardInset: 0,
  };
}
