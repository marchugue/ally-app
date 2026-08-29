import { useEffect, useRef } from "react";
import { View, Text, TextInput, Animated } from "react-native";
import { Mail } from "lucide-react-native";

type InputProps = {
  variant?: "text" | "dropdown" | "chips" | "checkboxes";

  value?: string;
  values?: string[];

  placeholder?: string;
  label?: string;

  options?: string[];

  icon?: React.ReactNode;

  error?: string | null;

  onChangeText?: (text: string) => void;
  onPress?: () => void;
  onSelect?: (value: string) => void;
  onToggle?: (value: string) => void;

  onBlur?: () => void;
};

export default function Input({
  value,
  onChangeText,
  onBlur,
  error,
  placeholder = "Text",
}: InputProps) {
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
          borderWidth: 1.5,
          borderColor: error ? "#DC2626" : "#E2DED7",
          borderRadius: 20,
          backgroundColor: "#FFF",
          paddingHorizontal: 18,
          paddingVertical: 10,
        }}
      >
        <Mail size={17} color={error ? "#DC2626" : "#9CA3AF"} />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={{
            flex: 1,
            marginLeft: 10,
            color: "#111827",
            fontSize: 14,
          }}
        />
      </View>
    </View>
  );
}