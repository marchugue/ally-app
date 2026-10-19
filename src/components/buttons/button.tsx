import { useEffect, useRef, useState, forwardRef } from "react";
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
  const [focused, setFocused] = useState(false);
  const errorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: error ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [error]);

  const borderColor = error ? "#DC2626" : focused ? "#1A6B3C" : "#E5E7EB";

  return (
    <View style={[{ position: "relative", marginBottom: 20 }, containerStyle]}>
      {/* Input Box with clean stroke border, NO shadow */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          borderWidth: 1.5,
          borderColor: borderColor,
          borderRadius: 35,
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 16,
          paddingVertical: 10,
        }}
      >
        {icon || <User size={17} color={error ? "#DC2626" : focused ? "#1A6B3C" : "#9CA3AF"} />}

        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
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
    </View>
  );
});

export default Input;