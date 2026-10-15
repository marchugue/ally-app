import React, { useMemo, useState } from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { getCrittersAvatarSvg, getCrittersHttpUrl } from '@/lib/dicebearCritters';

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
  const svgXml = useMemo(
    () => getCrittersAvatarSvg(avatarKey, customBg, size),
    [avatarKey, customBg, size]
  );

  const fallbackUri = useMemo(
    () => getCrittersHttpUrl(avatarKey, customBg, 'png'),
    [avatarKey, customBg]
  );

  const borderRadius = size / 2;

  if (svgXml && !svgError) {
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <SvgXml
          xml={svgXml}
          width={size}
          height={size}
          onError={() => setSvgError(true)}
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
        },
        style,
      ]}
    >
      <Image
        source={{ uri: fallbackUri }}
        style={{ width: size, height: size, borderRadius }}
        resizeMode="cover"
        blurRadius={blurRadius}
      />
    </View>
  );
}

export default CrittersAvatar;
