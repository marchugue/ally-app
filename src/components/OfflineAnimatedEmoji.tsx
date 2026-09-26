import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
  type ImageResizeMode,
} from "react-native";
import LottieView from "lottie-react-native";
import {
  resolveOfflineEmojiAnimation,
  getAnimalFluentAsset,
  getReactionFluentAsset,
} from "@/constants/emojiAnimationAssets";
import { getFluentEmojiUrl } from "@/lib/fluentEmoji";

export interface OfflineAnimatedEmojiProps {
  emoji?: string | null;
  avatarKey?: string | null;
  size?: number;
  autoPlay?: boolean;
  loop?: boolean;
  preferLottie?: boolean;
  fallbackText?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  resizeMode?: ImageResizeMode;
}

export function OfflineAnimatedEmoji({
  emoji,
  avatarKey,
  size = 32,
  autoPlay = true,
  loop = true,
  preferLottie = true,
  fallbackText,
  style,
  textStyle,
  resizeMode = "contain",
}: OfflineAnimatedEmojiProps) {
  const [lottieFailed, setLottieFailed] = useState(false);
  const lottieRef = useRef<LottieView>(null);

  const resolved = resolveOfflineEmojiAnimation({
    emoji,
    avatarKey,
    preferLottie: preferLottie && !lottieFailed,
  });

  useEffect(() => {
    if (autoPlay && resolved.type === "lottie") {
      lottieRef.current?.play();
    }
  }, [autoPlay, resolved.source, resolved.type]);

  // 1. High-Performance Lottie Animation (vector, 60fps, offline)
  if (resolved.type === "lottie" && resolved.source) {
    if (Platform.OS === "web") {
      const fallbackFluent =
        (avatarKey ? getAnimalFluentAsset(avatarKey) : null) ||
        (emoji ? getReactionFluentAsset(emoji) : null);
      if (fallbackFluent) {
        return (
          <View style={[styles.container, { width: size, height: size }, style]}>
            <Image
              source={fallbackFluent}
              style={{ width: size, height: size }}
              resizeMode={resizeMode}
            />
          </View>
        );
      }
    }

    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <LottieView
          ref={lottieRef}
          source={resolved.source}
          autoPlay={autoPlay}
          loop={loop}
          renderMode="AUTOMATIC"
          style={{ width: size, height: size }}
          onAnimationFailure={() => {
            // Gracefully switch to offline Microsoft Fluent animated 3D image
            setLottieFailed(true);
          }}
        />
      </View>
    );
  }

  // 2. Offline Microsoft Fluent 3D Animated Asset (local bundled asset, zero network latency)
  if (resolved.type === "fluent" && resolved.source) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image
          source={resolved.source}
          style={{ width: size, height: size }}
          resizeMode={resizeMode}
        />
      </View>
    );
  }

  // Fallback check: if Lottie failed, try offline fluent directly
  if (lottieFailed) {
    const fallbackFluent =
      (avatarKey ? getAnimalFluentAsset(avatarKey) : null) ||
      (emoji ? getReactionFluentAsset(emoji) : null);
    if (fallbackFluent) {
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <Image
            source={fallbackFluent}
            style={{ width: size, height: size }}
            resizeMode={resizeMode}
          />
        </View>
      );
    }
  }

  // 3. Remote Fluent 3D Emoji fallback (for generic non-quick reactions from catalog)
  if (emoji) {
    const remoteUrl = getFluentEmojiUrl(emoji, { animated: true });
    if (remoteUrl) {
      return (
        <View style={[styles.container, { width: size, height: size }, style]}>
          <Image
            source={{ uri: remoteUrl }}
            style={{ width: size, height: size }}
            resizeMode={resizeMode}
          />
        </View>
      );
    }
  }

  // 4. Unicode / Text Emoji Fallback
  const displayEmoji = fallbackText || emoji || "✨";
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Text
        style={[
          {
            fontSize: size * 0.72,
            lineHeight: size * 0.88,
            textAlign: "center",
          },
          textStyle,
        ]}
      >
        {displayEmoji}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
