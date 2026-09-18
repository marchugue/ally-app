import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, GraduationCap, FileCheck, CheckCircle2 } from "lucide-react-native";
import { Button } from "@/components/Button";
import { EmailSelectIllustration } from "@/components/OnboardingIllustrations";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GREEN = "#1A6B3C";

export default function SelectEmailScreen() {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<"chmsu" | "external">("chmsu");

  const handleBack = () => {
    // If user came from onboarding or login
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/pages/onboarding" as any);
    }
  };

  const handleContinue = () => {
    router.push({
      pathname: "/pages/register" as any,
      params: { emailType: selectedType },
    });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 20) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
        <Pressable
          onPress={handleBack}
          hitSlop={14}
          style={styles.iconBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={GREEN} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Top Illustration */}
        <View style={styles.illustrationWrapper}>
          <EmailSelectIllustration size={Math.min(SCREEN_WIDTH * 0.44, 175)} />
        </View>

        {/* Title & Subtitle */}
        <View style={styles.headerText}>
          <Text style={styles.title}>How would you like to sign up?</Text>
          <Text style={styles.subtitle}>
            Choose an email type to verify your CHMSU Alijis student identity.
          </Text>
        </View>

        {/* Selection Cards */}
        <View style={styles.cardsContainer}>
          {/* Option 1: CHMSU Email */}
          <Pressable
            onPress={() => setSelectedType("chmsu")}
            style={[
              styles.card,
              selectedType === "chmsu" ? styles.cardActive : styles.cardInactive,
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconCircle,
                  selectedType === "chmsu" ? styles.iconCircleActive : styles.iconCircleInactive,
                ]}
              >
                <GraduationCap size={22} color={selectedType === "chmsu" ? GREEN : "#4B5563"} />
              </View>

              <View style={styles.badgeInstant}>
                <Text style={styles.badgeInstantText}>Instant Access</Text>
              </View>

              {selectedType === "chmsu" && (
                <CheckCircle2 size={22} color={GREEN} style={styles.checkIcon} />
              )}
            </View>

            <Text style={styles.cardTitle}>CHMSU Student Email</Text>
            <Text style={styles.cardDomain}>@chmsu.edu.ph</Text>
            <Text style={styles.cardDesc}>
              Instant verification code sent directly to your institutional student inbox. No ID upload needed.
            </Text>
          </Pressable>

          {/* Option 2: Personal Email */}
          <Pressable
            onPress={() => setSelectedType("external")}
            style={[
              styles.card,
              selectedType === "external" ? styles.cardActive : styles.cardInactive,
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={[
                  styles.iconCircle,
                  selectedType === "external" ? styles.iconCircleActive : styles.iconCircleInactive,
                ]}
              >
                <FileCheck size={22} color={selectedType === "external" ? GREEN : "#4B5563"} />
              </View>

              <View style={styles.badgeId}>
                <Text style={styles.badgeIdText}>Student ID Required</Text>
              </View>

              {selectedType === "external" && (
                <CheckCircle2 size={22} color={GREEN} style={styles.checkIcon} />
              )}
            </View>

            <Text style={styles.cardTitle}>Personal Email</Text>
            <Text style={styles.cardDomain}>Gmail, Yahoo, Outlook, etc.</Text>
            <Text style={styles.cardDesc}>
              For students awaiting institutional account activation. Requires a quick photo scan of your Student ID or COR.
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Bottom Continue Button */}
      <View style={styles.ctaArea}>
        <Button
          label="Continue"
          variant="primary"
          pill
          size="lg"
          onPress={handleContinue}
          style={{ backgroundColor: GREEN, width: "100%" }}
          className="w-full"
        />
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    width: "100%",
    maxWidth: 580,
    alignSelf: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    height: 48,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: "center",
  },
  illustrationWrapper: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  headerText: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  cardsContainer: {
    width: "100%",
    gap: 14,
  },
  card: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    position: "relative",
  },
  cardActive: {
    borderColor: GREEN,
    backgroundColor: "#F0FDF4",
  },
  cardInactive: {
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleActive: {
    backgroundColor: "#DCFCE7",
  },
  iconCircleInactive: {
    backgroundColor: "#F3F4F6",
  },
  badgeInstant: {
    marginLeft: 10,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeInstantText: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "700",
  },
  badgeId: {
    marginLeft: 10,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeIdText: {
    color: "#B45309",
    fontSize: 11,
    fontWeight: "700",
  },
  checkIcon: {
    marginLeft: "auto",
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  cardDomain: {
    fontSize: 13,
    fontWeight: "600",
    color: GREEN,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  ctaArea: {
    width: "100%",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
