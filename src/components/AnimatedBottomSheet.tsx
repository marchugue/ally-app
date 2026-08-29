// components/AnimatedBottomSheet.tsx
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Modal, View, Pressable, Animated } from "react-native";

export default function AnimatedBottomSheet({
  visible,
  onClose,
  children,
  maxHeightPct = "70%",
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightPct?: string;
}) {
  // Keeps the native Modal mounted during the exit animation, then
  // unmounts it once the fade/slide-out actually finishes.
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0.4,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 400,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000",
            opacity: backdropOpacity,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            maxHeight: maxHeightPct as `${number}%`,
            overflow: "hidden",
            transform: [{ translateY }],
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}