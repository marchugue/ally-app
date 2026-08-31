import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Animated,
} from "react-native";
import { Lock, Eye, EyeOff } from "lucide-react-native";

type PasswordInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string | null;
  placeholder?: string;
};

export default function PasswordInput({
  value,
  onChangeText,
  onBlur,
  error,
  placeholder = "Enter your password",
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [error]);

  return (
    <View style={{ position: "relative", marginBottom: 20 }}>
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
        <Text
          style={{
            color: "#DC2626",
            fontSize: 12,
            fontWeight: "600",
          }}
        >
          {error}
        </Text>
      </Animated.View>

      {/* Input */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#FFFFFF",
          borderWidth: error ? 1.5 : 0,
          borderColor: error ? "#DC2626" : "transparent",
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
        <Lock size={17} color={error ? "#DC2626" : "#9CA3AF"} />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
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

        <Pressable
          onPress={() => setShowPassword((prev) => !prev)}
          hitSlop={8}
        >
          {showPassword ? (
            <EyeOff size={18} color="#9CA3AF" />
          ) : (
            <Eye size={18} color="#9CA3AF" />
          )}
        </Pressable>
      </View>
    </View>
  );
}