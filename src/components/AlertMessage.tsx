import { useEffect, useRef } from "react";
import {
  View,
  Text,
  Animated,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  Info,
} from "lucide-react-native";

type AlertType = "error" | "success" | "warning" | "info";

type AlertMessageProps = {
  message?: string | null;
  type?: AlertType;
  onHide?: () => void;
};

const styles = {
  error: {
    background: "#FEF2F2",
    border: "#FECACA",
    text: "#DC2626",
    Icon: CircleAlert,
  },
  success: {
    background: "#ECFDF5",
    border: "#A7F3D0",
    text: "#059669",
    Icon: CircleCheck,
  },
  warning: {
    background: "#FFFBEB",
    border: "#FDE68A",
    text: "#D97706",
    Icon: TriangleAlert,
  },
  info: {
    background: "#EFF6FF",
    border: "#BFDBFE",
    text: "#2563EB",
    Icon: Info,
  },
};

export default function AlertMessage({
  message,
  type = "error",
  onHide,
}: AlertMessageProps) {
  const insets = useSafeAreaInsets();

  const slideAnim = useRef(new Animated.Value(-120)).current;

  const hide = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onHide?.();
    });
  };

  useEffect(() => {
    if (!message) return;

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(hide, 5000);

    return () => clearTimeout(timer);
  }, [message]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy < -10,

      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -40) {
          hide();
        }
      },
    })
  ).current;

  if (!message) return null;

  const style = styles[type];
  const Icon = style.Icon;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        top: insets.top + 12,
        left: 20,
        right: 20,
        zIndex: 9999,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: style.background,
          borderColor: style.border,
          borderWidth: 1,
          borderRadius: 18,
          paddingHorizontal: 16,
          paddingVertical: 14,
          elevation: 6,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Icon size={20} color={style.text} />

        <Text
          style={{
            flex: 1,
            marginLeft: 12,
            color: style.text,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}