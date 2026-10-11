import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { REVEAL_TIER_META } from "@/lib/avatarReveal";
import { RevealAvatar } from "./RevealAvatar";
import type { AvatarRevealView } from "@/lib/api/matchmaking";

export interface AvatarRevealCardProps {
  reveal?: AvatarRevealView | null;
  avatarKey?: string | null;
  partnerAlias?: string | null;
  partnerName?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function AvatarRevealCard({
  reveal,
  avatarKey,
  partnerAlias,
  partnerName,
  size = 80,
  style,
}: AvatarRevealCardProps) {
  const tier = reveal?.tier ?? 0;
  const meta = REVEAL_TIER_META[tier] ?? REVEAL_TIER_META[0];
  const target = reveal?.target ?? 250;
  const points = reveal?.matchPoints ?? 0;
  const percent = Math.round((reveal?.progress ?? 0) * 100);
  const isRevealed = tier >= 5;
  const toNext = Math.max(0, (reveal?.tierEnd ?? target) - points);
  const who = partnerAlias || "Your ally";

  return (
    <View style={[styles.card, style]}>
      <RevealAvatar
        reveal={reveal}
        avatarKey={avatarKey}
        size={size}
        fallbackInitials={partnerName || partnerAlias}
      />

      <View style={styles.infoCol}>
        <Text style={styles.tagText}>
          AVATAR REVEAL • {meta.label.toUpperCase()}
        </Text>

        <Text style={styles.titleText} numberOfLines={1}>
          {isRevealed ? partnerName || "Revealed!" : `${percent}% revealed`}
        </Text>

        <Text style={styles.hintText} numberOfLines={2}>
          {isRevealed
            ? "You both unlocked each other's real profiles."
            : reveal && !reveal.hasPhoto
            ? `${who} hasn't added a photo yet. Initials will unlock at ${target} pts.`
            : `${meta.hint} • next in ${toNext} pt${toNext === 1 ? "" : "s"}`}
        </Text>

        {/* Tier dots indicator */}
        {!isRevealed && (
          <View style={styles.dotsRow}>
            {[1, 2, 3, 4, 5].map((step) => (
              <View
                key={step}
                style={[
                  styles.dot,
                  {
                    backgroundColor: step <= tier ? "#10B981" : "#E2E8F0",
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  tagText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#0F172A",
    marginTop: 2,
  },
  hintText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    lineHeight: 15,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});
