import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Animated,
  Easing,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { avatarColorFor } from "@/constants/matchOptions";
import { CrittersAvatar } from "@/components/CrittersAvatar";
import { resolveImageUri } from "@/components/UserAvatar";
import {
  computeRevealVisual,
  toNativeRevealBlurRadius,
} from "@/lib/avatarReveal";
import { synthesizeAvatarReveal } from "@/lib/avatarRevealCache";
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
  matchPoints?: number;
}

const RING_GAP = 3.5;
const REVEAL_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function RevealAvatar({
  reveal: propReveal,
  avatarKey,
  size = 96,
  showRing = true,
  showGainChip = true,
  fallbackInitials,
  style,
  onTierUp,
  matchPoints: propMatchPoints,
}: RevealAvatarProps) {
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const accent = avatarColorFor(avatarKey);

  // If propReveal is not provided, but propMatchPoints is, synthesize fallback reveal
  const reveal = useMemo(() => {
    if (propReveal && typeof propReveal.tier === "number") {
      return propReveal;
    }
    if (typeof propMatchPoints === "number") {
      return synthesizeAvatarReveal(propMatchPoints, { partnerAvatar: avatarKey || undefined });
    }
    return propReveal ?? null;
  }, [propReveal, propMatchPoints, avatarKey]);

  const tier = reveal?.tier ?? 0;
  const matchPoints = reveal?.matchPoints ?? propMatchPoints ?? 0;
  const target = reveal?.target ?? 250;
  const progress = reveal?.progress ?? Math.min(1, Math.max(0, matchPoints / target));
  const isRevealed = tier >= 5 || progress >= 1;

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

  const rawResolvedPreviewUrl = resolveImageUri(reveal?.previewUrl);
  const [photoError, setPhotoError] = useState(false);
  const [sourceWidth, setSourceWidth] = useState<number | null>(null);

  useEffect(() => {
    setPhotoError(false);
    setSourceWidth(null);
  }, [rawResolvedPreviewUrl]);

  const resolvedPreviewUrl =
    rawResolvedPreviewUrl && rawResolvedPreviewUrl !== "[removed]" && !photoError
      ? rawResolvedPreviewUrl
      : null;

  const effectivePetOpacity = resolvedPreviewUrl ? visual.petOpacity : isRevealed ? 0 : 1;
  const effectivePhotoOpacity = resolvedPreviewUrl || isRevealed ? visual.photoOpacity : 0;
  const targetAuraOpacity = resolvedPreviewUrl && effectivePhotoOpacity > 0 ? 0.8 : 0;

  // ── Smooth animated transitions for morphing (mirrors web easing & opacity) ──
  const progressAnim = useRef(new Animated.Value(progress)).current;
  const petFadeAnim = useRef(new Animated.Value(effectivePetOpacity)).current;
  const photoFadeAnim = useRef(new Animated.Value(effectivePhotoOpacity)).current;
  const auraFadeAnim = useRef(new Animated.Value(targetAuraOpacity)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 800,
        easing: REVEAL_EASE,
        useNativeDriver: false,
      }),
      Animated.timing(petFadeAnim, {
        toValue: effectivePetOpacity,
        duration: 850,
        easing: REVEAL_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(photoFadeAnim, {
        toValue: effectivePhotoOpacity,
        duration: 850,
        easing: REVEAL_EASE,
        useNativeDriver: true,
      }),
      Animated.timing(auraFadeAnim, {
        toValue: targetAuraOpacity,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    progress,
    effectivePetOpacity,
    effectivePhotoOpacity,
    targetAuraOpacity,
    progressAnim,
    petFadeAnim,
    photoFadeAnim,
    auraFadeAnim,
  ]);

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

  // ── Geometry & Dimensions ────────────────────────────────────────────────
  const outer = showRing ? size + RING_GAP * 2 + 6 : size;
  const stroke = Math.max(2.5, Math.round(size * 0.045));
  const radius = outer / 2 - stroke / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const aura = reveal?.dominantColor || accent;
  const thresholds = (reveal?.tierThresholds ?? [0, 50, 100, 150, 200, 250]).slice(1, -1);
  const petSize = size;
  const inset = (outer - size) / 2;
  const nativeBlurRadius = toNativeRevealBlurRadius(
    visual.blurPx,
    size,
    tier,
    isRevealed,
    sourceWidth
  );

  return (
    <View
      style={[
        {
          width: outer,
          height: outer,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {/* ── Progress Ring (SVG) ── */}
      {showRing && (
        <Svg
          width={outer}
          height={outer}
          style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}
        >
          <Defs>
            <LinearGradient id={`ringGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1A6B3C" />
              <Stop offset="60%" stopColor="#10B981" />
              <Stop offset="100%" stopColor="#2DD4BF" />
            </LinearGradient>
            <LinearGradient id={`ringDoneGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
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
            stroke={isRevealed ? `url(#ringDoneGrad-${gradId})` : `url(#ringGrad-${gradId})`}
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

      {/* ── Main Avatar Circle Frame (strokeless, full size without shrinking) ── */}
      <View
        style={{
          position: "absolute",
          left: inset,
          top: inset,
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Layer 1: Ambient Radial Aura Glow (mirrors web radial-gradient glow) */}
        {resolvedPreviewUrl && visual.photoOpacity > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { opacity: auraFadeAnim }]}
          >
            <Svg width={size} height={size}>
              <Defs>
                <RadialGradient id={`aura-${gradId}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={aura} stopOpacity={0.53} />
                  <Stop offset="55%" stopColor={aura} stopOpacity={0.2} />
                  <Stop offset="100%" stopColor={aura} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width={size}
                height={size}
                rx={size / 2}
                fill={`url(#aura-${gradId})`}
              />
            </Svg>
          </Animated.View>
        )}

        {/* Layer 2: Real Photo (Centered, emerging with web-mirrored blur & opacity) */}
        {resolvedPreviewUrl && visual.photoOpacity > 0 ? (
          <Animated.Image
            source={{ uri: resolvedPreviewUrl }}
            fadeDuration={0}
            onLoad={(e) => {
              const w = e?.nativeEvent?.source?.width;
              if (typeof w === "number" && w > 0) {
                setSourceWidth((prev) => (prev === w ? prev : w));
              }
            }}
            onError={() => setPhotoError(true)}
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: photoFadeAnim,
            }}
            resizeMode="cover"
            blurRadius={nativeBlurRadius}
          />
        ) : isRevealed && !resolvedPreviewUrl ? (
          <Animated.View
            style={{
              position: "absolute",
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: accent,
              alignItems: "center",
              justifyContent: "center",
              opacity: photoFadeAnim,
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
          </Animated.View>
        ) : null}

        {/* Layer 3: Anonymous Avatar Graphic (Full size, strokeless, dissolves in place without shrinking) */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
            opacity: petFadeAnim,
          }}
        >
          <View
            style={{
              width: petSize,
              height: petSize,
              borderRadius: petSize / 2,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CrittersAvatar
              avatarKey={avatarKey}
              size={petSize}
              customBg={accent}
            />
          </View>
        </Animated.View>
      </View>

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
          <Text
            style={{
              fontSize: 11,
              fontWeight: "900",
              color: "#451A03",
              fontFamily: "monospace",
            }}
          >
            +{gainAmount} pt
          </Text>
        </Animated.View>
      )}
    </View>
  );
}
