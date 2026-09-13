/**
 * OnboardingIllustrations.tsx
 * SVG inline illustrations for registration steps and OTP verification.
 * Uses react-native-svg for crisp, scalable, no-API vector art.
 */
import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Circle,
  Ellipse,
  Rect,
  Path,
  G,
  Line,
  Polyline,
  Polygon,
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  ClipPath,
} from "react-native-svg";

// ── Shared blob container ───────────────────────────────────────────

interface BlobProps {
  size?: number;
  color?: string;
  children: React.ReactNode;
}

export function IllustrationBlob({ size = 220, color = "#E8F5EE", children }: BlobProps) {
  return (
    <View
      style={[
        styles.blob,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    >
      {children}
    </View>
  );
}

// ── Step 1: Basic Info — Profile card with user/email/lock ──────────

export function BasicInfoIllustration({ size = 200 }: { size?: number }) {
  const s = size / 200;
  return (
    <IllustrationBlob size={size} color="#E8F5EE">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Profile card */}
        <Rect x="20" y="30" width="110" height="95" rx="14" fill="#FFFFFF" opacity="0.95" />
        <Rect x="20" y="30" width="110" height="95" rx="14" fill="none" stroke="#BBF7D0" strokeWidth="1.5" />

        {/* Avatar circle */}
        <Circle cx="75" cy="62" r="18" fill="#6EE7B7" />
        <Circle cx="75" cy="57" r="8" fill="#1A6B3C" />
        <Path d="M57 78 Q75 70 93 78" fill="#1A6B3C" />

        {/* Name line */}
        <Rect x="52" y="87" width="46" height="6" rx="3" fill="#1A6B3C" opacity="0.7" />

        {/* Field rows */}
        <Rect x="32" y="101" width="86" height="8" rx="4" fill="#F3F4F6" />
        <Circle cx="40" cy="105" r="4" fill="#34D399" />
        <Rect x="48" y="103" width="60" height="4" rx="2" fill="#D1D5DB" />

        <Rect x="32" y="114" width="86" height="8" rx="4" fill="#F3F4F6" />
        <Circle cx="40" cy="118" r="4" fill="#6EE7B7" />
        <Rect x="48" y="116" width="50" height="4" rx="2" fill="#D1D5DB" />

        {/* Floating star */}
        <Path d="M140 25 L142 30 L148 30 L143 34 L145 40 L140 36 L135 40 L137 34 L132 30 L138 30 Z" fill="#FBBF24" />

        {/* Floating key icon */}
        <Circle cx="22" cy="135" r="8" fill="#1A6B3C" opacity="0.85" />
        <Rect x="29" y="134" width="12" height="3" rx="1.5" fill="#1A6B3C" />
        <Rect x="37" y="134" width="3" height="5" rx="1" fill="#1A6B3C" />

        {/* Floating mail icon */}
        <Rect x="118" y="118" width="24" height="16" rx="4" fill="#1A6B3C" opacity="0.9" />
        <Path d="M118 122 L130 130 L142 122" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
      </Svg>
    </IllustrationBlob>
  );
}

// ── Step 2: Academic — Graduation cap + campus building ──────────────

export function AcademicIllustration({ size = 200 }: { size?: number }) {
  return (
    <IllustrationBlob size={size} color="#D1FAE5">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Building */}
        <Rect x="30" y="65" width="90" height="70" rx="4" fill="#FFFFFF" opacity="0.9" />
        <Rect x="30" y="65" width="90" height="70" rx="4" fill="none" stroke="#6EE7B7" strokeWidth="1.5" />

        {/* Windows */}
        <Rect x="42" y="78" width="16" height="16" rx="3" fill="#A7F3D0" />
        <Rect x="67" y="78" width="16" height="16" rx="3" fill="#A7F3D0" />
        <Rect x="92" y="78" width="16" height="16" rx="3" fill="#A7F3D0" />

        <Rect x="42" y="100" width="16" height="14" rx="3" fill="#A7F3D0" />
        <Rect x="92" y="100" width="16" height="14" rx="3" fill="#A7F3D0" />

        {/* Door */}
        <Rect x="64" y="100" width="22" height="35" rx="4" fill="#1A6B3C" opacity="0.8" />
        <Circle cx="82" cy="119" r="2" fill="#FFFFFF" />

        {/* Pillars */}
        <Rect x="55" y="60" width="6" height="10" rx="2" fill="#1A6B3C" />
        <Rect x="89" y="60" width="6" height="10" rx="2" fill="#1A6B3C" />

        {/* Graduation cap */}
        <Path d="M75 20 L110 32 L75 44 L40 32 Z" fill="#1A6B3C" />
        <Rect x="103" y="32" width="4" height="18" rx="2" fill="#1A6B3C" />
        <Circle cx="105" cy="52" r="5" fill="#FBBF24" />
        {/* Cap top */}
        <Path d="M57 36 L57 50 Q75 57 93 50 L93 36" fill="#1A6B3C" opacity="0.7" />

        {/* Floating star */}
        <Path d="M138 55 L140 60 L145 60 L141 63 L143 68 L138 65 L133 68 L135 63 L131 60 L136 60 Z" fill="#FBBF24" />
        {/* Small dots */}
        <Circle cx="20" cy="80" r="5" fill="#6EE7B7" opacity="0.7" />
        <Circle cx="25" cy="68" r="3" fill="#A7F3D0" />
      </Svg>
    </IllustrationBlob>
  );
}

// ── Step 3: Interests — Floating colored interest tags ───────────────

export function InterestsIllustration({ size = 200 }: { size?: number }) {
  return (
    <IllustrationBlob size={size} color="#FEF3C7">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Center person */}
        <Circle cx="75" cy="85" r="18" fill="#FBBF24" opacity="0.3" />
        <Circle cx="75" cy="79" r="11" fill="#D97706" />
        <Path d="M57 98 Q75 90 93 98 L93 112 Q75 108 57 112 Z" fill="#D97706" />

        {/* Tag: 🎵 Music */}
        <Rect x="8" y="18" width="38" height="18" rx="9" fill="#1A6B3C" />
        <SvgText x="27" y="31" fontSize="11" fill="#FFFFFF" textAnchor="middle">🎵</SvgText>

        {/* Tag: 🏀 Sports */}
        <Rect x="104" y="18" width="40" height="18" rx="9" fill="#1A6B3C" />
        <SvgText x="124" y="31" fontSize="11" fill="#FFFFFF" textAnchor="middle">🏀</SvgText>

        {/* Tag: 💻 Tech */}
        <Rect x="8" y="58" width="36" height="18" rx="9" fill="#2563EB" />
        <SvgText x="26" y="71" fontSize="11" fill="#FFFFFF" textAnchor="middle">💻</SvgText>

        {/* Tag: 📷 Photo */}
        <Rect x="106" y="58" width="38" height="18" rx="9" fill="#DB2777" />
        <SvgText x="125" y="71" fontSize="11" fill="#FFFFFF" textAnchor="middle">📷</SvgText>

        {/* Tag: 📚 Reading */}
        <Rect x="18" y="110" width="40" height="18" rx="9" fill="#0891B2" />
        <SvgText x="38" y="123" fontSize="11" fill="#FFFFFF" textAnchor="middle">📚</SvgText>

        {/* Tag: 🎨 Arts */}
        <Rect x="94" y="110" width="38" height="18" rx="9" fill="#EA580C" />
        <SvgText x="113" y="123" fontSize="11" fill="#FFFFFF" textAnchor="middle">🎨</SvgText>

        {/* Connecting lines */}
        <Line x1="46" y1="27" x2="60" y2="78" stroke="#BBF7D0" strokeWidth="1.5" strokeDasharray="3,2" />
        <Line x1="104" y1="27" x2="90" y2="78" stroke="#D1FAE5" strokeWidth="1.5" strokeDasharray="3,2" />
        <Line x1="44" y1="67" x2="60" y2="82" stroke="#DBEAFE" strokeWidth="1.5" strokeDasharray="3,2" />
        <Line x1="106" y1="67" x2="90" y2="82" stroke="#FCE7F3" strokeWidth="1.5" strokeDasharray="3,2" />
        <Line x1="58" y1="110" x2="68" y2="98" stroke="#CFFAFE" strokeWidth="1.5" strokeDasharray="3,2" />
        <Line x1="94" y1="110" x2="82" y2="98" stroke="#FFEDD5" strokeWidth="1.5" strokeDasharray="3,2" />
      </Svg>
    </IllustrationBlob>
  );
}

// ── Step 4: Avatar & Bio — Emoji floating palette ────────────────────

export function AvatarIllustration({ size = 200 }: { size?: number }) {
  return (
    <IllustrationBlob size={size} color="#FCE7F3">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Large center phone */}
        <Rect x="48" y="25" width="54" height="96" rx="12" fill="#FFFFFF" opacity="0.95" />
        <Rect x="48" y="25" width="54" height="96" rx="12" fill="none" stroke="#FBCFE8" strokeWidth="1.5" />
        {/* Phone camera notch */}
        <Rect x="68" y="29" width="14" height="4" rx="2" fill="#F9A8D4" />
        {/* Avatar on phone */}
        <Circle cx="75" cy="65" r="22" fill="#FDF2F8" />
        <Circle cx="75" cy="65" r="22" fill="none" stroke="#F9A8D4" strokeWidth="1.5" />
        <SvgText x="75" y="75" fontSize="26" textAnchor="middle">😊</SvgText>
        {/* Bio lines */}
        <Rect x="58" y="94" width="34" height="5" rx="2.5" fill="#F9A8D4" />
        <Rect x="62" y="103" width="26" height="4" rx="2" fill="#FBCFE8" />

        {/* Floating emoji circles */}
        <Circle cx="22" cy="40" r="16" fill="#FFF7ED" />
        <SvgText x="22" y="48" fontSize="18" textAnchor="middle">😎</SvgText>

        <Circle cx="128" cy="35" r="14" fill="#ECFDF5" />
        <SvgText x="128" y="43" fontSize="16" textAnchor="middle">🤓</SvgText>

        <Circle cx="20" cy="100" r="14" fill="#EEF2FF" />
        <SvgText x="20" y="108" fontSize="16" textAnchor="middle">🦊</SvgText>

        <Circle cx="130" cy="95" r="16" fill="#FEF3C7" />
        <SvgText x="130" y="103" fontSize="18" textAnchor="middle">🤖</SvgText>

        <Circle cx="25" cy="135" r="12" fill="#F0FDF4" />
        <SvgText x="25" y="143" fontSize="14" textAnchor="middle">🐱</SvgText>

        <Circle cx="125" cy="132" r="12" fill="#FFF0F6" />
        <SvgText x="125" y="140" fontSize="14" textAnchor="middle">🦄</SvgText>

        {/* Sparkle */}
        <Path d="M112 18 L113.5 22 L118 22 L114.5 24.5 L116 28.5 L112 26 L108 28.5 L109.5 24.5 L106 22 L110.5 22 Z" fill="#FBBF24" />
      </Svg>
    </IllustrationBlob>
  );
}

// ── OTP Verification: Phone + Floating digits ────────────────────────

export function OtpIllustration({ size = 200 }: { size?: number }) {
  return (
    <IllustrationBlob size={size} color="#E8F5EE">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Phone */}
        <Rect x="42" y="20" width="66" height="108" rx="14" fill="#FFFFFF" opacity="0.95" />
        <Rect x="42" y="20" width="66" height="108" rx="14" fill="none" stroke="#BBF7D0" strokeWidth="2" />
        <Rect x="62" y="25" width="26" height="5" rx="2.5" fill="#6EE7B7" />
        <Circle cx="75" cy="122" r="4" fill="#BBF7D0" />

        {/* Screen content */}
        <Rect x="52" y="40" width="46" height="28" rx="6" fill="#F0FDF4" />
        {/* Envelope icon on screen */}
        <Rect x="60" y="46" width="30" height="20" rx="4" fill="#1A6B3C" opacity="0.85" />
        <Path d="M60 50 L75 58 L90 50" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />

        {/* OTP digit boxes */}
        <Rect x="50" y="78" width="13" height="16" rx="4" fill="#E8F5EE" stroke="#1A6B3C" strokeWidth="1.5" />
        <Rect x="66" y="78" width="13" height="16" rx="4" fill="#E8F5EE" stroke="#1A6B3C" strokeWidth="1.5" />
        <Rect x="82" y="78" width="13" height="16" rx="4" fill="#E8F5EE" stroke="#1A6B3C" strokeWidth="1.5" />
        <SvgText x="56" y="91" fontSize="10" fontWeight="bold" fill="#1A6B3C" textAnchor="middle">4</SvgText>
        <SvgText x="72" y="91" fontSize="10" fontWeight="bold" fill="#1A6B3C" textAnchor="middle">8</SvgText>
        <SvgText x="88" y="91" fontSize="10" fontWeight="bold" fill="#1A6B3C" textAnchor="middle">3</SvgText>

        {/* Floating digit bubbles */}
        <Circle cx="16" cy="50" r="14" fill="#1A6B3C" opacity="0.9" />
        <SvgText x="16" y="56" fontSize="14" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">2</SvgText>

        <Circle cx="134" cy="42" r="12" fill="#1A6B3C" opacity="0.9" />
        <SvgText x="134" y="48" fontSize="12" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">7</SvgText>

        <Circle cx="20" cy="105" r="12" fill="#34D399" />
        <SvgText x="20" y="111" fontSize="12" fontWeight="bold" fill="#FFFFFF" textAnchor="middle">5</SvgText>

        <Circle cx="132" cy="100" r="14" fill="#FBBF24" />
        <SvgText x="132" y="106" fontSize="14" fontWeight="bold" fill="#1A6B3C" textAnchor="middle">9</SvgText>

        {/* Sparkle */}
        <Path d="M115 18 L116.5 22 L121 22 L117.5 24.5 L119 28.5 L115 26 L111 28.5 L112.5 24.5 L109 22 L113.5 22 Z" fill="#FBBF24" />

        {/* Check mark circle (sent indicator) */}
        <Circle cx="130" cy="68" r="12" fill="#1A6B3C" />
        <Path d="M124 68 L128 72 L136 64" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </IllustrationBlob>
  );
}

// ── Email Selection: University & Personal email illustration ────────
export function EmailSelectIllustration({ size = 180 }: { size?: number }) {
  return (
    <IllustrationBlob size={size} color="#E8F5EE">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Background card */}
        <Rect x="20" y="32" width="110" height="86" rx="14" fill="#FFFFFF" opacity="0.95" />
        <Rect x="20" y="32" width="110" height="86" rx="14" fill="none" stroke="#BBF7D0" strokeWidth="1.5" />

        {/* Envelope base */}
        <Rect x="35" y="48" width="80" height="52" rx="8" fill="#1A6B3C" />
        <Path d="M35 52 L75 78 L115 52" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* University Graduation Cap badge */}
        <Circle cx="75" cy="40" r="18" fill="#6EE7B7" />
        <Path d="M63 40 L75 34 L87 40 L75 46 Z" fill="#1A6B3C" />
        <Path d="M68 43 L68 48 Q75 51 82 48 L82 43" fill="none" stroke="#1A6B3C" strokeWidth="1.5" />
        <Line x1="85" y1="41" x2="88" y2="47" stroke="#1A6B3C" strokeWidth="1.2" />

        {/* Verification Check Badge */}
        <Circle cx="120" cy="94" r="14" fill="#FBBF24" />
        <Path d="M115 94 L118 97 L125 90" stroke="#1A6B3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />

        {/* Sparkles */}
        <Circle cx="28" cy="44" r="4" fill="#34D399" />
        <Circle cx="126" cy="40" r="3" fill="#6EE7B7" />
      </Svg>
    </IllustrationBlob>
  );
}

// ── Student ID Upload: ID Card scanner with camera viewfinder ────────
export function IdUploadIllustration({ size = 180 }: { size?: number }) {
  return (
    <IllustrationBlob size={size} color="#E8F5EE">
      <Svg width={size * 0.75} height={size * 0.75} viewBox="0 0 150 150">
        {/* Scanner Viewfinder corners */}
        <Path d="M18 35 L18 22 L31 22" stroke="#1A6B3C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <Path d="M132 35 L132 22 L119 22" stroke="#1A6B3C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <Path d="M18 115 L18 128 L31 128" stroke="#1A6B3C" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <Path d="M132 115 L132 128 L119 128" stroke="#1A6B3C" strokeWidth="2.5" strokeLinecap="round" fill="none" />

        {/* ID Card */}
        <Rect x="28" y="32" width="94" height="86" rx="10" fill="#FFFFFF" />
        <Rect x="28" y="32" width="94" height="86" rx="10" fill="none" stroke="#BBF7D0" strokeWidth="1.5" />

        {/* Card Header Stripe */}
        <Rect x="28" y="32" width="94" height="18" rx="10" fill="#1A6B3C" />
        <Rect x="28" y="44" width="94" height="6" fill="#1A6B3C" />

        {/* Photo Box */}
        <Rect x="36" y="58" width="28" height="34" rx="5" fill="#E8F5EE" stroke="#A7F3D0" strokeWidth="1" />
        <Circle cx="50" cy="70" r="6" fill="#1A6B3C" />
        <Path d="M41 87 Q50 78 59 87" fill="#1A6B3C" />

        {/* Info Lines */}
        <Rect x="70" y="60" width="44" height="5" rx="2.5" fill="#1A6B3C" opacity="0.8" />
        <Rect x="70" y="70" width="36" height="4" rx="2" fill="#9CA3AF" />
        <Rect x="70" y="78" width="40" height="4" rx="2" fill="#9CA3AF" />
        <Rect x="70" y="86" width="24" height="4" rx="2" fill="#9CA3AF" />

        {/* Barcode line on bottom of card */}
        <Line x1="36" y1="104" x2="114" y2="104" stroke="#D1D5DB" strokeWidth="2" strokeDasharray="3,2" />

        {/* Scan line effect */}
        <Line x1="22" y1="75" x2="128" y2="75" stroke="#34D399" strokeWidth="2" strokeDasharray="4,2" opacity="0.8" />

        {/* Security Shield badge */}
        <Circle cx="120" cy="40" r="14" fill="#FBBF24" />
        <Path d="M116 38 L120 35 L124 38 L124 43 Q120 47 116 43 Z" fill="#1A6B3C" />
      </Svg>
    </IllustrationBlob>
  );
}

const styles = StyleSheet.create({
  blob: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
