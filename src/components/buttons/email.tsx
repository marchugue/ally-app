import { useEffect, useRef, forwardRef } from "react";
import {
  View,
  Text,
  TextInput,
  Animated,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from "react-native";
import { Mail } from "lucide-react-native";

export type EmailInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  error?: string | null;
  placeholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
};

const EmailInput = forwardRef<TextInput, EmailInputProps>(function EmailInput(
  {
    value,
    onChangeText,
    onBlur,
    onFocus,
    error,
    placeholder = "your@chmsu.edu.ph",
    containerStyle,
    returnKeyType,
    onSubmitEditing,
  },
  ref
) {
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [error]);

  return (
    <View style={[{ position: "relative", marginBottom: 20 }, containerStyle]}>
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
          borderWidth: error ? 1.5 : 0,
          borderColor: error ? "#DC2626" : "transparent",
          borderRadius: 20,
          backgroundColor: "#FFF",
          paddingHorizontal: 18,
          paddingVertical: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.04,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <Mail size={17} color={error ? "#DC2626" : "#9CA3AF"} />

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
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
});

export default EmailInput;