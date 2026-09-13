import { useState, useEffect, useRef } from "react";
import {
  Keyboard,
  Platform,
  KeyboardEvent,
  Dimensions,
} from "react-native";

/** Extra lift so inputs sit slightly above the IME on Android (all build types). */
export const ANDROID_KEYBOARD_EXTRA_LIFT_PX = 30;

/** Extra bottom inset when adjustResize did not fully clear the IME. */
function measureAndroidKeyboardInset(
  e: KeyboardEvent,
  windowHeightBaseline: number,
): number {
  const keyboardHeight = e.endCoordinates.height;
  const windowH = Dimensions.get("window").height;
  const resizedBy = Math.max(0, windowHeightBaseline - windowH);
  let inset = Math.max(0, keyboardHeight - resizedBy);

  // Edge-to-edge / dev-client: window metrics sometimes stay unchanged while the IME covers the bottom.
  if (inset < 1 && keyboardHeight > 0 && resizedBy < keyboardHeight * 0.5) {
    const screenH = Dimensions.get("screen").height;
    const keyboardTop = e.endCoordinates.screenY;
    const imeFromScreenBottom = Math.max(0, screenH - keyboardTop);
    inset = Math.max(inset, Math.max(0, imeFromScreenBottom - resizedBy));
  }

  return Math.max(inset + ANDROID_KEYBOARD_EXTRA_LIFT_PX, ANDROID_KEYBOARD_EXTRA_LIFT_PX);
}

export function useKeyboard() {
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);

  const windowHeightBaseline = useRef(Dimensions.get("window").height);
  const keyboardVisibleRef = useRef(false);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const scheduleAndroidInset = (e: KeyboardEvent) => {
      const apply = () => {
        setAndroidKeyboardInset(
          measureAndroidKeyboardInset(e, windowHeightBaseline.current),
        );
      };
      // Resize (when present) can finish after keyboardDidShow on Android.
      requestAnimationFrame(() => requestAnimationFrame(apply));
    };

    const onShow = (e: KeyboardEvent) => {
      keyboardVisibleRef.current = true;
      setKeyboardVisible(true);
      const kbHeight = e.endCoordinates.height;
      setKeyboardHeight(kbHeight);
      if (Platform.OS === "android") {
        scheduleAndroidInset(e);
      }
    };

    const onHide = () => {
      keyboardVisibleRef.current = false;
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      setAndroidKeyboardInset(0);
      requestAnimationFrame(() => {
        windowHeightBaseline.current = Dimensions.get("window").height;
      });
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    const dimSub = Dimensions.addEventListener("change", ({ window }) => {
      if (Platform.OS === "android" && !keyboardVisibleRef.current) {
        windowHeightBaseline.current = window.height;
      }
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      dimSub.remove();
    };
  }, []);

  return {
    isKeyboardVisible,
    keyboardHeight,
    /** Use on Android to lift content flush with the IME (all build types). */
    androidKeyboardInset,
  };
}
