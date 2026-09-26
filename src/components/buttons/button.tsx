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
import { User } from "lucide-react-native";

export type InputProps = {
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
  onFocus?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  returnKeyType?: TextInputProps["returnKeyType"];
  onSubmitEditing?: () => void;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoCorrect?: boolean;
};

const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    value,
    onChangeText,
    onBlur,
    onFocus,
    error,
    placeholder = "Text",
    icon,
    containerStyle,
    returnKeyType,
    onSubmitEditing,
    keyboardType = "default",
    autoCapitalize = "none",
    autoCorrect = false,
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
        {icon || <User size={17} color={error ? "#DC2626" : "#9CA3AF"} />}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
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

export default Input;