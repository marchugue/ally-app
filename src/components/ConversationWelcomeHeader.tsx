import React from "react";
import {
  View,
  Text,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { UserAvatar } from "@/components/UserAvatar";
import { AnonymousAvatar } from "@/components/AnonymousAvatar";
import { RevealAvatar } from "@/components/RevealAvatar";
import type { AvatarRevealView } from "@/lib/api/matchmaking";

export interface ConversationWelcomeHeaderProps {
  participantName: string;
  participantAvatar?: string | null;
  participantCourse?: string | null;
  participantDepartment?: string | null;
  sharedInterests?: string[];
  partnerAvatar?: string | null;
  isAnonymous?: boolean;
  avatarReveal?: AvatarRevealView | null;
  style?: StyleProp<ViewStyle>;
}

export const ConversationWelcomeHeader: React.FC<ConversationWelcomeHeaderProps> = ({
  participantName,
  participantAvatar,
  participantCourse,
  participantDepartment,
  sharedInterests = [],
  partnerAvatar,
  isAnonymous = false,
  avatarReveal,
  style,
}) => {
  const courseAndProgram = [participantCourse, participantDepartment]
    .filter(Boolean)
    .join(" • ");

  return (
    <View style={[styles.container, style]}>
      {isAnonymous ? (
        <>
          <View style={styles.avatarWrapper}>
            {avatarReveal ? (
              <RevealAvatar
                reveal={avatarReveal}
                avatarKey={partnerAvatar || participantAvatar || "fox"}
                size={76}
                showRing={false}
                showGainChip={false}
                fallbackInitials={participantName}
              />
            ) : (
              <AnonymousAvatar
                avatarKey={partnerAvatar || participantAvatar || "fox"}
                size={76}
              />
            )}
          </View>
          <Text style={styles.name}>{participantName}</Text>
          {sharedInterests.length > 0 && (
            <View style={styles.interestsContainer}>
              {sharedInterests.map((interest) => (
                <View key={interest} style={styles.interestBadge}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <View style={styles.regularAvatarWrapper}>
            <UserAvatar
              avatar={participantAvatar}
              size="xl"
              fallback={
                participantName
                  ? participantName.slice(0, 2).toUpperCase()
                  : "👤"
              }
            />
          </View>
          <Text style={styles.name}>{participantName}</Text>
          {courseAndProgram ? (
            <Text style={styles.subtitle}>{courseAndProgram}</Text>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  regularAvatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
    marginTop: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
    textAlign: "center",
    maxWidth: 280,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    maxWidth: 300,
  },
  interestBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 9999,
    backgroundColor: "rgba(26, 107, 60, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(26, 107, 60, 0.2)",
  },
  interestText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A6B3C",
  },
});
