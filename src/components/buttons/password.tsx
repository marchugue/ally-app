import { useEffect, useRef, useState, forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from "react-native";
import { Lock, Eye, EyeOff, Check, Info } from "lucide-react-native";
import {
  PASSWORD_RULES,
  passwordStrength,
  passwordStrengthScore,
  getNextPasswordRequirement,
  passwordStrengthLabel,
  passwordStrengthColor,
} from "@/lib/validator/password";

export type PasswordInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  error?: string | null;
  placeholder?: string;
  /** Show the strength validator UI below the input (default true) */
  showStrength?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
};

/** Standalone 5-bar password strength meter matching Dropbox reference */
export function PasswordStrengthMeter({
  value,
  style,
}: {
  value: string;
  style?: StyleProp<ViewStyle>;
}) {
  if (!value || value.length === 0) return null;
  const score = passwordStrengthScore(value);
  const barColor = passwordStrengthColor(score);
  const strengthLabel = passwordStrengthLabel(score);
  const nextReq = getNextPasswordRequirement(value);
  const allPassed = score === PASSWORD_RULES.length;

  return (
    <View style={[{ marginTop: 8, paddingHorizontal: 4 }, style]}>
      {/* 5 Segmented Horizontal Bars (Dropbox style) */}
      <View style={{ flexDirection: "row", gap: 5, width: "100%", height: 4 }}>
        {[0, 1, 2, 3, 4].map((idx) => {
          const isFilled = idx < score;
          return (
            <View
              key={idx}
              style={{
                flex: 1,
                height: "100%",
                borderRadius: 2,
                backgroundColor: isFilled ? barColor : "#E5E7EB",
              }}
            />
          );
        })}
      </View>

      {/* Single Dynamic Status Line */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
          paddingHorizontal: 2,
        }}
      >
        {/* Left: Dynamic missing requirement */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            flex: 1,
            marginRight: 8,
          }}
        >
          {allPassed ? (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "#DCFCE7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={9} color="#16A34A" strokeWidth={3} />
            </View>
          ) : (
            <View
              style={{
                width: 5,
                height: 5,
                borderRadius: 2.5,
                backgroundColor: barColor,
              }}
            />
          )}
          <Text
            numberOfLines={1}
            style={{
              fontSize: 11,
              color: allPassed ? "#16A34A" : "#6B7280",
              fontWeight: allPassed ? "600" : "500",
              flexShrink: 1,
            }}
          >
            {allPassed ? "Password requirements met" : (nextReq?.hint || "Need at least 8 characters")}
          </Text>
        </View>

        {/* Right: Strength Label + Info Icon */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: barColor,
            }}
          >
            {strengthLabel}
          </Text>
          <Info size={11} color="#9CA3AF" />
        </View>
      </View>
    </View>
  );
}

const PasswordInput = forwardRef<TextInput, PasswordInputProps>(function PasswordInput(
  {
    value,
    onChangeText,
    onBlur,
    onFocus,
    error,
    placeholder = "Enter your password",
    showStrength = false,
    containerStyle,
    returnKeyType,
    onSubmitEditing,
  },
  ref
) {
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

  const score = passwordStrengthScore(value);
  const showValidator = showStrength && (focused || value.length > 0);
  const barColor = passwordStrengthColor(score);
  const strengthLabel = passwordStrengthLabel(score);
  const nextReq = getNextPasswordRequirement(value);
  const allPassed = score === PASSWORD_RULES.length;

  const borderColor = error ? "#DC2626" : focused ? "#1A6B3C" : "#E5E7EB";

  return (
    <View style={[{ position: "relative", marginBottom: 20 }, containerStyle]}>
      {/* Input Box with clean stroke border, NO shadow */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
          borderWidth: 1.5,
          borderColor: borderColor,
          borderRadius: 35,
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        <Lock size={17} color={error ? "#DC2626" : focused ? "#1A6B3C" : "#9CA3AF"} />

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          onFocus={() => { setFocused(true); onFocus?.(); }}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
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

      {/* Floating Error cutting top stroke */}
      {error ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 14,
            top: -9,
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 6,
            zIndex: 10,
            opacity: errorAnim,
          }}
        >
          <Text
            style={{
              color: "#DC2626",
              fontSize: 11,
              fontWeight: "700",
            }}
          >
            {error}
          </Text>
        </Animated.View>
      ) : null}

      {/* ── Dynamic Password Strength Validator (5 Segmented Bars + 1 Dynamic Line) ── */}
      {showValidator && (
        <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
          {/* 5 Segmented Horizontal Bars */}
          <View style={{ flexDirection: "row", gap: 5, width: "100%", height: 4 }}>
            {[0, 1, 2, 3, 4].map((idx) => {
              const isFilled = idx < score;
              return (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: isFilled ? barColor : "#E5E7EB",
                  }}
                />
              );
            })}
          </View>

          {/* Single Dynamic Status Line */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 6,
              paddingHorizontal: 2,
            }}
          >
            {/* Left: Dynamic missing requirement */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flex: 1,
                marginRight: 8,
              }}
            >
              {allPassed ? (
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: "#DCFCE7",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={9} color="#16A34A" strokeWidth={3} />
                </View>
              ) : (
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 35,
                    backgroundColor: barColor,
                  }}
                />
              )}
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 11,
                  color: allPassed ? "#16A34A" : "#6B7280",
                  fontWeight: allPassed ? "600" : "500",
                  flexShrink: 1,
                }}
              >
                {allPassed ? "Password requirements met" : (nextReq?.hint || "Need at least 8 characters")}
              </Text>
            </View>

            {/* Right: Strength Label + Info Icon */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: barColor,
                }}
              >
                {strengthLabel}
              </Text>
              <Info size={11} color="#9CA3AF" />
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

export default PasswordInput;