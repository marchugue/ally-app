import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
} from "react-native";
import { Lock, Eye, EyeOff, Check, X } from "lucide-react-native";
import { PASSWORD_RULES, passwordStrength } from "@/lib/validator/password";

type PasswordInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string | null;
  placeholder?: string;
  /** Show the strength validator UI below the input (default true) */
  showStrength?: boolean;
};

export default function PasswordInput({
  value,
  onChangeText,
  onBlur,
  error,
  placeholder = "Enter your password",
  showStrength = true,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [error]);

  const strength = passwordStrength(value);
  const showValidator = showStrength && (focused || value.length > 0);

  // Strength bar color
  const barColor =
    strength <= 20 ? "#EF4444" :
    strength <= 40 ? "#F97316" :
    strength <= 60 ? "#EAB308" :
    strength <= 80 ? "#84CC16" :
    "#22C55E";

  const strengthLabel =
    strength <= 20 ? "Very weak" :
    strength <= 40 ? "Weak" :
    strength <= 60 ? "Fair" :
    strength <= 80 ? "Strong" :
    "Very strong";

  return (
    <View style={{ marginBottom: 8 }}>
      {/* Floating Error */}
      <Animated.View
        style={{
          position: "absolute",
          left: 18,
          backgroundColor: "#FDFCFB",
          paddingHorizontal: 6,
          zIndex: 1,
          transform: [
            {
              translateY: errorAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [22, -8],
              }),
            },
          ],
          opacity: errorAnim,
        }}
      >
        <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "600" }}>
          {error}
        </Text>
      </Animated.View>

      {/* Input */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
          borderWidth: error ? 1.5 : focused ? 1.5 : 0,
          borderColor: error ? "#DC2626" : focused ? "#1A6B3C" : "transparent",
          borderRadius: 20,
          paddingHorizontal: 18,
          paddingVertical: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <Lock size={17} color={error ? "#DC2626" : focused ? "#1A6B3C" : "#9CA3AF"} />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          style={{
            flex: 1,
            marginLeft: 10,
            color: "#111827",
            fontSize: 14,
          }}
        />

        <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={8}>
          {showPassword ? (
            <EyeOff size={18} color="#9CA3AF" />
          ) : (
            <Eye size={18} color="#9CA3AF" />
          )}
        </Pressable>
      </View>

      {/* ── Dynamic Password Strength Validator ─────────────────────────── */}
      {showValidator && (
        <View style={{ marginTop: 10, paddingHorizontal: 4 }}>
          {/* Strength bar */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <View
              style={{
                flex: 1,
                height: 4,
                borderRadius: 4,
                backgroundColor: "#E5E7EB",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${strength}%`,
                  height: "100%",
                  borderRadius: 4,
                  backgroundColor: barColor,
                }}
              />
            </View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: barColor, minWidth: 60 }}>
              {strengthLabel}
            </Text>
          </View>

          {/* Rules checklist */}
          <View style={{ gap: 5 }}>
            {PASSWORD_RULES.map((rule) => {
              const passed = rule.test(value);
              return (
                <View key={rule.key} style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: passed ? "#22C55E" : "#E5E7EB",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {passed ? (
                      <Check size={10} color="#FFFFFF" strokeWidth={3} />
                    ) : (
                      <X size={10} color="#9CA3AF" strokeWidth={3} />
                    )}
                  </View>
                  <Text
                    style={{
                      fontSize: 12,
                      color: passed ? "#16A34A" : "#6B7280",
                      fontWeight: passed ? "600" : "400",
                    }}
                  >
                    {rule.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}