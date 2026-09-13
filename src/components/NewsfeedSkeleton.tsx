import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  View,
  StyleSheet,
  StyleProp,
  ViewStyle,
  DimensionValue,
  Dimensions,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface ShinyBoxProps {
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  translateX: Animated.AnimatedInterpolation<number>;
}

function ShinyBox({
  width,
  height,
  borderRadius = 8,
  style,
  translateX,
}: ShinyBoxProps) {
  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: "#E5E7EB",
          overflow: "hidden",
          position: "relative",
        },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -60,
          bottom: -60,
          width: 50,
          backgroundColor: "rgba(255, 255, 255, 0.65)",
          transform: [{ translateX }, { rotate: "35deg" }],
        }}
      />
    </View>
  );
}

function PostSkeletonCard({
  translateX,
  hasMedia = false,
  mediaHeight = 200,
}: {
  translateX: Animated.AnimatedInterpolation<number>;
  hasMedia?: boolean;
  mediaHeight?: number;
}) {
  return (
    <View style={styles.card}>
      {/* Author Header */}
      <View style={styles.authorRow}>
        <ShinyBox
          width={40}
          height={40}
          borderRadius={20}
          translateX={translateX}
        />
        <View style={styles.authorInfo}>
          <ShinyBox
            width={130}
            height={13}
            borderRadius={6}
            translateX={translateX}
          />
          <ShinyBox
            width={85}
            height={10}
            borderRadius={5}
            style={{ marginTop: 6 }}
            translateX={translateX}
          />
        </View>
        <ShinyBox
          width={65}
          height={26}
          borderRadius={13}
          translateX={translateX}
        />
      </View>

      {/* Post Text Content Lines */}
      <View style={styles.contentLines}>
        <ShinyBox
          width="100%"
          height={13}
          borderRadius={6}
          translateX={translateX}
        />
        <ShinyBox
          width="85%"
          height={13}
          borderRadius={6}
          style={{ marginTop: 8 }}
          translateX={translateX}
        />
        {hasMedia ? (
          <ShinyBox
            width="55%"
            height={13}
            borderRadius={6}
            style={{ marginTop: 8 }}
            translateX={translateX}
          />
        ) : null}
      </View>

      {/* Optional Media Image Block */}
      {hasMedia && (
        <View style={styles.mediaContainer}>
          <ShinyBox
            width="100%"
            height={mediaHeight}
            borderRadius={14}
            translateX={translateX}
          />
        </View>
      )}

      {/* Action Buttons Footer */}
      <View style={styles.actionRow}>
        <ShinyBox
          width={56}
          height={24}
          borderRadius={12}
          translateX={translateX}
        />
        <ShinyBox
          width={56}
          height={24}
          borderRadius={12}
          translateX={translateX}
        />
        <View style={{ flex: 1 }} />
        <ShinyBox
          width={28}
          height={24}
          borderRadius={12}
          translateX={translateX}
        />
      </View>
    </View>
  );
}

export function NewsfeedSkeleton() {
  const shineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shineAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shineAnim]);

  const translateX = shineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-70, Math.max(SCREEN_WIDTH, 380) + 70],
  });

  return (
    <View style={styles.container}>
      <PostSkeletonCard translateX={translateX} hasMedia mediaHeight={205} />
      <PostSkeletonCard translateX={translateX} hasMedia={false} />
      <PostSkeletonCard translateX={translateX} hasMedia mediaHeight={180} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    paddingVertical: 14,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
  },
  authorInfo: {
    flex: 1,
  },
  contentLines: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  mediaContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 14,
  },
});
