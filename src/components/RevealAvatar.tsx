import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Line, Defs, LinearGradient, Stop } from "react-native-svg";
import { avatarColorFor, getAvatarEmoji } from "@/constants/matchOptions";
import { getAnimalFluentAsset } from "@/constants/emojiAnimationAssets";
import { computeRevealVisual } from "@/lib/avatarReveal";
import type { AvatarRevealView } from "@/lib/api/matchmaking";

export interface RevealAvatarProps {
  reveal?: AvatarRevealView | null;
  avatarKey?: string | null;
  size?: number;
  showRing?: boolean;
  showGainChip?: boolean;
  fallbackInitials?: string | null;
  style?: StyleProp<ViewStyle>;
  onTierUp?: (tier: number) => void;
}

const RING_GAP = 4;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function RevealAvatar({
  reveal,
  avatarKey,
  size = 96,
  showRing = true,
  showGainChip = true,
  fallbackInitials,
  style,
  onTierUp,
}: RevealAvatarProps) {
  const accent = avatarColorFor(avatarKey);
  const emoji = getAvatarEmoji(avatarKey);
  const fluentAsset = getAnimalFluentAsset(avatarKey);

  const tier = reveal?.tier ?? 0;
  const matchPoints = reveal?.matchPoints ?? 0;
  const target = reveal?.target ?? 250;
  const progress = reveal?.progress ?? 0;
  const isRevealed = tier >= 5;

  const visual = useMemo(
    () =>
      computeRevealVisual(
        {
          tier,
          matchPoints,
          tierStart: reveal?.tierStart ?? 0,
          tierEnd: reveal?.tierEnd ?? target,
          progress,
        },
        size
      ),
    [tier, matchPoints, reveal?.tierStart, reveal?.tierEnd, target, progress, size]
  );

  // ── Animated transitions for seamless morphing ───────────────────────────
  const progressAnim = useRef(new Animated.Value(progress)).current;
  const dockAnim = useRef(new Animated.Value(visual.dock)).current;
  const photoFadeAnim = useRef(new Animated.Value(visual.photoOpacity)).current;
  const auraPulse = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 650,
        useNativeDriver: false,
      }),
      Animated.timing(dockAnim, {
        toValue: visual.dock,
        duration: 650,
        useNativeDriver: false,
      }),
      Animated.timing(photoFadeAnim, {
        toValue: visual.photoOpacity,
        duration: 650,
        useNativeDriver: false,
      }),
    ]).start();
  }, [progress, visual.dock, visual.photoOpacity, progressAnim, dockAnim, photoFadeAnim]);

  useEffect(() => {
    if (tier === 0) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(auraPulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
          Animated.timing(auraPulse, { toValue: 0.65, duration: 1600, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      auraPulse.setValue(0.85);
    }
  }, [tier, auraPulse]);

  // ── Gain chip and tier up state ──────────────────────────────────────────
  const prevPoints = useRef<number | null>(null);
  const prevTier = useRef<number | null>(null);
  const [gainAmount, setGainAmount] = useState<number | null>(null);
  const gainAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (prevPoints.current !== null && matchPoints > prevPoints.current) {
      const diff = matchPoints - prevPoints.current;
      setGainAmount(diff);
      gainAnim.setValue(0);
      Animated.sequence([
        Animated.timing(gainAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(gainAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => setGainAmount(null));
    }
    prevPoints.current = matchPoints;
  }, [matchPoints, gainAnim]);

  useEffect(() => {
    if (prevTier.current !== null && tier > prevTier.current) {
      onTierUp?.(tier);
    }
    prevTier.current = tier;
  }, [tier, onTierUp]);

  // ── Ring dimensions ──────────────────────────────────────────────────────
  const outer = showRing ? size + RING_GAP * 2 + 6 : size;
  const stroke = Math.max(3, Math.round(size * 0.045));
  const radius = outer / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const aura = reveal?.dominantColor || accent;
  const thresholds = (reveal?.tierThresholds ?? [0, 50, 100, 150, 200, 250]).slice(1, -1);

  // ── Animal Mask Position / Scaling ──────────────────────────────────────
  const animalFull = size * 0.72;
  const badgeSize = Math.max(20, size * 0.36);
  const dock = visual.dock;

  const centerPos = (size - animalFull) / 2;
  const dockedX = size - badgeSize + 2;
  const dockedY = size - badgeSize + 2;

  const animalSize = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [animalFull, badgeSize],
  });
  const currentX = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [centerPos, dockedX],
  });
  const currentY = dockAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [centerPos, dockedY],
  });
  const veilOpacity = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
    extrapolate: 'clamp',
  });

  const inset = (outer - size) / 2;

  return (
    <View style={[{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }, style]}>
      {/* ── Progress Ring (SVG) ── */}
      {showRing && (
        <Svg
          width={outer}
          height={outer}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
        >
          <Defs>
            <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1A6B3C" />
              <Stop offset="60%" stopColor="#10B981" />
              <Stop offset="100%" stopColor="#2DD4BF" />
            </LinearGradient>
            <LinearGradient id="ringDoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#F59E0B" />
              <Stop offset="100%" stopColor="#10B981" />
            </LinearGradient>
          </Defs>

          {/* Background track */}
          <Circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke="rgba(0, 0, 0, 0.08)"
            strokeWidth={stroke}
            fill="none"
          />

          {/* Filled progress */}
          <AnimatedCircle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke={isRevealed ? "url(#ringDoneGrad)" : "url(#ringGrad)"}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset as any}
            strokeLinecap="round"
          />

          {/* Tier milestone ticks */}
          {thresholds.map((pts) => {
            const angle = (pts / target) * Math.PI * 2;
            const r1 = radius - stroke * 0.9;
            const r2 = radius + stroke * 0.9;
            const reached = matchPoints >= pts;
            return (
              <Line
                key={pts}
                x1={outer / 2 + Math.cos(angle) * r1}
                y1={outer / 2 + Math.sin(angle) * r1}
                x2={outer / 2 + Math.cos(angle) * r2}
                y2={outer / 2 + Math.sin(angle) * r2}
                stroke={reached ? "#FFFFFF" : "rgba(0, 0, 0, 0.25)"}
                strokeWidth={Math.max(1.5, stroke * 0.4)}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      )}

      {/* ── Photo Container (Base Aura + Photo Thumbnail + Frosted Veil) ── */}
      <View
        style={{
          position: "absolute",
          left: inset,
          top: inset,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: `${aura}26`,
          borderWidth: 2,
          borderColor: accent,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Ambient aura glow with breathing pulse */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: size / 2,
              backgroundColor: `${aura}40`,
              opacity: auraPulse,
            },
          ]}
        />

        {/* Real photo / Tier preview thumbnail */}
        {reveal?.previewUrl && visual.photoOpacity > 0 ? (
          <Animated.Image
            source={{ uri: reveal.previewUrl }}
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: photoFadeAnim,
            }}
            resizeMode="cover"
            blurRadius={visual.blurPx}
          />
        ) : isRevealed && !reveal?.previewUrl ? (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontSize: size * 0.36,
                fontWeight: "900",
                color: "#FFFFFF",
                fontFamily: "System",
              }}
            >
              {(fallbackInitials || "?").slice(0, 2).toUpperCase()}
            </Text>
          </View>
        ) : null}

        {/* Frosted veil overlay (fades smoothly as points increase) */}
        {!isRevealed && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: "rgba(255, 255, 255, 0.4)",
                opacity: veilOpacity,
              },
            ]}
          />
        )}
      </View>

      {/* ── Animal Mask (Centers then docks smoothly to bottom-right corner) ── */}
      <Animated.View
        style={{
          position: "absolute",
          left: inset,
          top: inset,
          transform: [
            { translateX: currentX },
            { translateY: currentY },
          ],
          width: animalSize,
          height: animalSize,
          borderRadius: size,
          backgroundColor: dock > 0.5 ? "#FFFFFF" : "transparent",
          elevation: dock > 0.5 ? 4 : 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: dock > 0.5 ? 0.2 : 0,
          shadowRadius: 4,
          alignItems: "center",
          justifyContent: "center",
          padding: dock > 0.5 ? 2 : 0,
        }}
      >
        {fluentAsset ? (
          <Image
            source={fluentAsset}
            style={{
              width: dock > 0.5 ? "80%" : "95%",
              height: dock > 0.5 ? "80%" : "95%",
            }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: badgeSize * 0.6 }}>{emoji}</Text>
        )}
      </Animated.View>

      {/* ── Gain Chip (+N pt float) ── */}
      {showGainChip && gainAmount !== null && (
        <Animated.View
          style={{
            position: "absolute",
            top: -10,
            opacity: gainAnim,
            transform: [
              {
                translateY: gainAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [6, -14],
                }),
              },
            ],
            backgroundColor: "#F59E0B",
            borderRadius: 99,
            paddingHorizontal: 8,
            paddingVertical: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 3,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "900", color: "#451A03", fontFamily: "monospace" }}>
            +{gainAmount} pt
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
