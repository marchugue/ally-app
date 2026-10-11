import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  Animated,
  Vibration,
  StyleSheet,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { avatarColorFor, getAvatarEmoji } from "@/constants/matchOptions";
import { getAnimalFluentAsset } from "@/constants/emojiAnimationAssets";
import { revealSeenKey } from "@/lib/avatarReveal";

export interface AvatarRevealCeremonyProps {
  matchId?: string | null;
  isRevealed: boolean;
  avatarUrl?: string | null;
  avatarKey?: string | null;
  fullName?: string | null;
  partnerAlias?: string | null;
  onSayHi?: () => void;
  onClose?: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CONFETTI_COLORS = ["#10B981", "#F59E0B", "#2DD4BF", "#F472B6", "#60A5FA", "#FDE047"];

export function AvatarRevealCeremony({
  matchId,
  isRevealed,
  avatarUrl,
  avatarKey,
  fullName,
  partnerAlias,
  onSayHi,
  onClose,
}: AvatarRevealCeremonyProps) {
  const [visible, setVisible] = useState(false);
  const accent = avatarColorFor(avatarKey);
  const emoji = getAvatarEmoji(avatarKey);
  const fluentAsset = getAnimalFluentAsset(avatarKey);

  const cardScaleAnim = useRef(new Animated.Value(0.85)).current;
  const cardOpacityAnim = useRef(new Animated.Value(0)).current;
  const maskSplitAnim = useRef(new Animated.Value(0)).current;
  const photoBlurAnim = useRef(new Animated.Value(1)).current;
  const badgeSpringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!matchId || !isRevealed) return;

    let isMounted = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(revealSeenKey(matchId));
        if (seen) return;
      } catch {
        // ignore
      }
      if (!isMounted) return;
      setVisible(true);
      Vibration.vibrate([0, 60, 80, 100]);

      Animated.parallel([
        Animated.timing(cardOpacityAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.spring(cardScaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Mask crack / peel away
      setTimeout(() => {
        Animated.timing(maskSplitAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();

        Animated.timing(photoBlurAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }).start();
      }, 500);

      // Keepsake badge pops in
      setTimeout(() => {
        Animated.spring(badgeSpringAnim, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }).start();
      }, 1300);
    })();

    return () => {
      isMounted = false;
    };
  }, [matchId, isRevealed, cardOpacityAnim, cardScaleAnim, maskSplitAnim, photoBlurAnim, badgeSpringAnim]);

  const handleDismiss = async () => {
    if (matchId) {
      try {
        await AsyncStorage.setItem(revealSeenKey(matchId), new Date().toISOString());
      } catch {
        // ignore
      }
    }
    setVisible(false);
    onClose?.();
  };

  const name = fullName || partnerAlias || "Your Ally";
  const firstName = name.split(" ")[0];

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.backdrop}>
        {/* Animated Celebration Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacityAnim,
              transform: [{ scale: cardScaleAnim }],
            },
          ]}
        >
          {/* Tag */}
          <View style={styles.tagBadge}>
            <Text style={styles.tagText}>250 POINTS REACHED</Text>
          </View>

          {/* Hero Avatar Reveal Stage */}
          <View style={styles.avatarStage}>
            {/* Real photo */}
            <View
              style={[
                styles.photoCircle,
                { borderColor: accent, backgroundColor: `${accent}30` },
              ]}
            >
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.realPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={[
                    styles.realPhoto,
                    {
                      backgroundColor: accent,
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  <Text style={styles.monogramText}>
                    {name.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            {/* Cracking Animal Mask (Splits outward) */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.maskHalfLeft,
                {
                  opacity: maskSplitAnim.interpolate({
                    inputRange: [0, 0.9, 1],
                    outputRange: [1, 0.2, 0],
                  }),
                  transform: [
                    {
                      translateX: maskSplitAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -80],
                      }),
                    },
                    {
                      rotate: maskSplitAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "-25deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.maskContent, { backgroundColor: accent }]}>
                {fluentAsset ? (
                  <Image source={fluentAsset} style={styles.maskImage} resizeMode="contain" />
                ) : (
                  <Text style={{ fontSize: 50 }}>{emoji}</Text>
                )}
              </View>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.maskHalfRight,
                {
                  opacity: maskSplitAnim.interpolate({
                    inputRange: [0, 0.9, 1],
                    outputRange: [1, 0.2, 0],
                  }),
                  transform: [
                    {
                      translateX: maskSplitAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 80],
                      }),
                    },
                    {
                      rotate: maskSplitAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "25deg"],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.maskContent, { backgroundColor: accent }]}>
                {fluentAsset ? (
                  <Image source={fluentAsset} style={styles.maskImage} resizeMode="contain" />
                ) : (
                  <Text style={{ fontSize: 50 }}>{emoji}</Text>
                )}
              </View>
            </Animated.View>

            {/* Keepsake corner badge */}
            <Animated.View
              style={[
                styles.keepsakeBadge,
                {
                  transform: [{ scale: badgeSpringAnim }],
                },
              ]}
            >
              {fluentAsset ? (
                <Image source={fluentAsset} style={{ width: 28, height: 28 }} resizeMode="contain" />
              ) : (
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
              )}
            </Animated.View>
          </View>

          {/* Name & Title */}
          <Text style={styles.titleText}>{name}</Text>
          <Text style={styles.subtitleText}>
            {partnerAlias && fullName
              ? `was ${partnerAlias} all along.`
              : "Mutual real identities unlocked!"}
          </Text>

          {/* Action Button */}
          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              void handleDismiss();
              onSayHi?.();
            }}
          >
            <Text style={styles.primaryButtonText}>Say hi, {firstName} 👋</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleDismiss}>
            <Text style={styles.secondaryButtonText}>Close</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 17, 10, 0.82)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  tagBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 16,
  },
  tagText: {
    color: "#15803D",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  avatarStage: {
    width: 144,
    height: 144,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  photoCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  realPhoto: {
    width: 136,
    height: 136,
    borderRadius: 68,
  },
  monogramText: {
    fontSize: 44,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  maskHalfLeft: {
    position: "absolute",
    width: 136,
    height: 136,
    borderRadius: 68,
    overflow: "hidden",
  },
  maskHalfRight: {
    position: "absolute",
    width: 136,
    height: 136,
    borderRadius: 68,
    overflow: "hidden",
  },
  maskContent: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  maskImage: {
    width: 90,
    height: 90,
  },
  keepsakeBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 2.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  titleText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#0F172A",
    textAlign: "center",
  },
  subtitleText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    backgroundColor: "#1A6B3C",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 22,
    elevation: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    paddingVertical: 10,
    marginTop: 4,
  },
  secondaryButtonText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
});
