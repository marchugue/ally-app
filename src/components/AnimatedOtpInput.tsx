import React, { useEffect, useRef, useState } from "react";
import {
  View,
  TextInput,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  ViewStyle,
  StyleProp,
} from "react-native";

const DEFAULT_LENGTH = 6;
const GREEN = "#1A6B3C";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DEFAULT_GAP = 8;
const DEFAULT_HORIZONTAL_PADDING = 48;
const DEFAULT_BOX_WIDTH = Math.min(
  Math.floor(
    (SCREEN_WIDTH - DEFAULT_HORIZONTAL_PADDING - DEFAULT_GAP * (DEFAULT_LENGTH - 1)) /
      DEFAULT_LENGTH
  ),
  48
);

export interface AnimatedOtpInputProps {
  digits: string[];
  onChange: (nextDigits: string[]) => void;
  onComplete?: (code: string) => void;
  onInputActivity?: () => void;
  length?: number;
  disabled?: boolean;
  hasError?: boolean;
  autoFocus?: boolean;
  focusFirstTrigger?: number;
  boxWidth?: number;
  boxHeight?: number;
  borderRadius?: number;
  fontSize?: number;
  filledBackgroundColor?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

function extractTypedDigit(prevDigit: string, cleaned: string): string {
  if (cleaned.length <= 1) return cleaned;
  if (prevDigit && cleaned.length === 2) {
    if (cleaned[0] === prevDigit) return cleaned[1];
    if (cleaned[1] === prevDigit) return cleaned[0];
  }
  return cleaned.slice(-1);
}

/**
 * 6-box OTP input with consecutive fade-in + slide-up box entrance
 * and fade-in + slide-up animation whenever digits are entered.
 */
export function AnimatedOtpInput({
  digits,
  onChange,
  onComplete,
  onInputActivity,
  length = DEFAULT_LENGTH,
  disabled = false,
  hasError = false,
  autoFocus = true,
  focusFirstTrigger = 0,
  boxWidth = DEFAULT_BOX_WIDTH,
  boxHeight = DEFAULT_BOX_WIDTH + 10,
  borderRadius = 16,
  fontSize = Math.round(DEFAULT_BOX_WIDTH * 0.45),
  filledBackgroundColor = "#FFFFFF",
  containerStyle,
}: AnimatedOtpInputProps) {
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);

  const boxAnims = useRef<Animated.Value[]>(
    Array.from({ length }, () => new Animated.Value(0))
  ).current;

  const digitAnims = useRef<Animated.Value[]>(
    Array.from({ length }, (_, idx) => new Animated.Value(digits[idx] ? 1 : 0))
  ).current;

  const prevDigitsRef = useRef<string[]>(Array.from({ length }, (_, idx) => digits[idx] ?? ""));

  // Consecutive fade-in + slide-up entrance for each box on mount
  useEffect(() => {
    boxAnims.forEach((anim) => anim.setValue(0));
    const entrance = Animated.stagger(
      55,
      boxAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    );
    entrance.start();
    return () => entrance.stop();
  }, [boxAnims]);

  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 320);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  useEffect(() => {
    if (focusFirstTrigger <= 0) return;
    const timer = setTimeout(() => {
      inputsRef.current[0]?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [focusFirstTrigger]);

  // Animate newly entered digits (single keystroke or consecutive multi-box paste)
  useEffect(() => {
    const prev = prevDigitsRef.current;
    const newlyFilled: number[] = [];

    for (let i = 0; i < length; i++) {
      const nextVal = digits[i] ?? "";
      const prevVal = prev[i] ?? "";
      if (nextVal && nextVal !== prevVal) {
        digitAnims[i].setValue(0);
        newlyFilled.push(i);
      } else if (!nextVal && prevVal) {
        digitAnims[i].setValue(0);
      }
    }

    prevDigitsRef.current = Array.from({ length }, (_, i) => digits[i] ?? "");

    if (newlyFilled.length === 1) {
      Animated.timing(digitAnims[newlyFilled[0]], {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (newlyFilled.length > 1) {
      Animated.stagger(
        45,
        newlyFilled.map((idx) =>
          Animated.timing(digitAnims[idx], {
            toValue: 1,
            duration: 210,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ).start();
    }
  }, [digits, digitAnims, length]);

  const handleDigitChange = (idx: number, rawValue: string) => {
    onInputActivity?.();
    const cleaned = rawValue.replace(/\D/g, "");

    if (cleaned.length >= length) {
      const code = cleaned.slice(0, length);
      const next = code.split("");
      onChange(next);
      inputsRef.current[length - 1]?.focus();
      onComplete?.(code);
      return;
    }

    const single = extractTypedDigit(digits[idx] ?? "", cleaned);
    const next = [...digits];
    next[idx] = single;
    onChange(next);

    if (single && idx < length - 1) {
      inputsRef.current[idx + 1]?.focus();
    }

    if (single && next.every(Boolean) && next.join("").length === length) {
      onComplete?.(next.join(""));
    }
  };

  const handleKeyPress = (idx: number, key: string) => {
    if (key === "Backspace") {
      onInputActivity?.();
      if (!digits[idx] && idx > 0) {
        const next = [...digits];
        next[idx - 1] = "";
        onChange(next);
        inputsRef.current[idx - 1]?.focus();
      }
    }
  };

  return (
    <View style={[styles.row, containerStyle]}>
      {Array.from({ length }).map((_, idx) => {
        const digit = digits[idx] ?? "";
        const isFocused = focusedIdx === idx;
        const boxAnim = boxAnims[idx];
        const digitAnim = digitAnims[idx];

        const borderColor = digit
          ? GREEN
          : hasError
            ? "#EF4444"
            : isFocused
              ? GREEN
              : "#E5E7EB";

        const bgColor = digit
          ? filledBackgroundColor
          : hasError
            ? "#FEF2F2"
            : "#FFFFFF";

        return (
          <Animated.View
            key={idx}
            style={[
              styles.box,
              {
                width: boxWidth,
                height: boxHeight,
                borderRadius,
                borderColor,
                backgroundColor: bgColor,
                opacity: boxAnim,
                transform: [
                  {
                    translateY: boxAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {digit ? (
              <Animated.Text
                pointerEvents="none"
                style={[
                  styles.digitText,
                  {
                    fontSize,
                    color: GREEN,
                    opacity: digitAnim,
                    transform: [
                      {
                        translateY: digitAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {digit}
              </Animated.Text>
            ) : null}

            <TextInput
              ref={(el) => {
                inputsRef.current[idx] = el;
              }}
              value={digit}
              onChangeText={(val) => handleDigitChange(idx, val)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(idx, nativeEvent.key)}
              onFocus={() => setFocusedIdx(idx)}
              onBlur={() => setFocusedIdx((cur) => (cur === idx ? null : cur))}
              keyboardType="number-pad"
              maxLength={length}
              textAlign="center"
              editable={!disabled}
              selectTextOnFocus
              caretHidden
              selectionColor="transparent"
              underlineColorAndroid="transparent"
              textContentType={idx === 0 ? "oneTimeCode" : "none"}
              accessibilityLabel={`Verification digit ${idx + 1}`}
              style={[StyleSheet.absoluteFill, styles.hiddenInput, { fontSize, borderRadius }]}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: DEFAULT_GAP,
  },
  box: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  digitText: {
    fontWeight: "700",
    textAlign: "center",
  },
  hiddenInput: {
    color: "transparent",
    backgroundColor: "transparent",
    textAlign: "center",
  },
});

