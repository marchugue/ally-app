import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { getFallbackImageUri, markPrimaryCdnUnreachable } from "@/components/UserAvatar";
import { resolveCachedMediaUri } from "@/lib/mediaCache";

interface ProgressiveMediaImageProps {
  uri: string;
  isSending?: boolean;
  uploadProgress?: number;
  showSendingLabel?: boolean;
  sendingLabel?: string;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressiveMediaImage({
  uri,
  isSending = false,
  uploadProgress = 0,
  showSendingLabel = true,
  sendingLabel = "Sending…",
  width = "100%",
  height = "100%",
  borderRadius = 0,
  style,
}: ProgressiveMediaImageProps) {
  const [fallbackUri, setFallbackUri] = useState<string | null>(null);
  const [layoutHeight, setLayoutHeight] = useState<number>(typeof height === "number" ? height : 180);

  useEffect(() => {
    setFallbackUri(null);
  }, [uri]);

  const resolvedUri = fallbackUri || resolveCachedMediaUri(uri) || uri;

  // Normalized progress in [0, 1]
  const clampedFraction = isSending
    ? Math.max(0.05, Math.min(1, (uploadProgress || 0) / 100))
    : 1;

  const progressAnim = useRef(new Animated.Value(clampedFraction)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: clampedFraction,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [clampedFraction, progressAnim]);

  // Overall low-quality blur overlay fades down as progress rises
  const blurLayerOpacity = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.95, 0.52, 0.08],
    extrapolate: "clamp",
  });

  // Top-anchored unrevealed mask shrinks smoothly from 100% -> 0% height as upload progresses
  const maskHeight = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [layoutHeight, 0],
    extrapolate: "clamp",
  });

  const handleImageError = () => {
    const candidate = getFallbackImageUri(resolvedUri);
    if (!fallbackUri && candidate && candidate !== resolvedUri) {
      markPrimaryCdnUnreachable();
      setFallbackUri(candidate);
    }
  };

  return (
    <View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - layoutHeight) > 1) {
          setLayoutHeight(h);
        }
      }}
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#111827",
        },
        style,
      ]}
    >
      {/* 1. Full-quality cached image base layer */}
      <ExpoImage
        source={{ uri: resolvedUri }}
        cachePolicy="memory-disk"
        contentFit="cover"
        onError={handleImageError}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Sending state: progressive quality reveal + dimmed mask + centered label */}
      {isSending && (
        <>
          {/* Progressive whole-image quality blur (fades out cleanly as upload progresses) */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: blurLayerOpacity }]}
          >
            <ExpoImage
              source={{ uri: resolvedUri }}
              cachePolicy="memory-disk"
              contentFit="cover"
              blurRadius={18}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Subtle whole-frame dim so even revealed pixels remain dimmed while sending */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: "rgba(0, 0, 0, 0.30)" },
            ]}
          />

          {/* Top-anchored unrevealed frosted mask peeling away smoothly with upload progress */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: maskHeight,
              overflow: "hidden",
            }}
          >
            <ExpoImage
              source={{ uri: resolvedUri }}
              cachePolicy="memory-disk"
              contentFit="cover"
              blurRadius={24}
              style={{
                width: "100%",
                height: layoutHeight,
              }}
            />
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: "rgba(0, 0, 0, 0.34)" },
              ]}
            />
            {/* Soft feathered transition edge at the bottom of the mask */}
            <LinearGradient
              colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.0)"]}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 22,
              }}
            />
          </Animated.View>

          {/* Centered Sending label only (no progress bar or spinner) */}
          {showSendingLabel && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 12,
                },
              ]}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 13,
                  fontWeight: "700",
                  letterSpacing: 0.3,
                  textAlign: "center",
                  textShadowColor: "rgba(0, 0, 0, 0.65)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 5,
                }}
              >
                {sendingLabel}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

