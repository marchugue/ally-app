import React, { useEffect, useMemo, useState } from 'react';
import { View, Image, Text, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getCrittersAvatarSvg, getCrittersHttpUrl } from '@/lib/dicebearCritters';
import { AVATAR_EMOJI, DEFAULT_AVATAR_EMOJI } from '@/constants/matchOptions';

export interface CrittersAvatarProps {
  avatarKey?: string | null;
  size?: number;
  customBg?: string | null;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  blurRadius?: number;
}

/**
 * Cross-platform component rendering the DiceBear Critters theme
 * with native SvgXml support and resilient fallback to PNG/SVG image.
 */
export function CrittersAvatar({
  avatarKey,
  size = 48,
  customBg,
  style,
  blurRadius = 0,
}: CrittersAvatarProps) {
  const [svgError, setSvgError] = useState(false);
  const [pngError, setPngError] = useState(false);

  useEffect(() => {
    setSvgError(false);
    setPngError(false);
  }, [avatarKey, customBg, size]);

  const svgXml = useMemo(
    () => getCrittersAvatarSvg(avatarKey, customBg, size),
    [avatarKey, customBg, size]
  );

  const fallbackUri = useMemo(
    () => getCrittersHttpUrl(avatarKey, customBg, 'png'),
    [avatarKey, customBg]
  );

  const borderRadius = size / 2;
  const fallbackEmoji =
    (typeof avatarKey === 'string' && AVATAR_EMOJI[avatarKey.toLowerCase().trim()]) ||
    DEFAULT_AVATAR_EMOJI;

  if (svgXml && !svgError) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: customBg || 'transparent',
          },
          style,
        ]}
      >
        <SvgXml
          xml={svgXml}
          width={size}
          height={size}
          onError={() => {
            // SvgXml calls onError inside render's catch block; defer state update cleanly
            queueMicrotask(() => setSvgError(true));
          }}
        />
        {blurRadius > 0 && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: 'rgba(255, 255, 255, 0.45)' },
            ]}
          />
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: customBg || '#1A6B3C',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {!pngError ? (
        <Image
          source={{ uri: fallbackUri }}
          style={{ width: size, height: size, borderRadius }}
          resizeMode="cover"
          blurRadius={blurRadius}
          onError={() => setPngError(true)}
        />
      ) : (
        <Text style={{ fontSize: Math.max(12, Math.round(size * 0.48)) }}>
          {fallbackEmoji}
        </Text>
      )}
    </View>
  );
}

export default CrittersAvatar;
