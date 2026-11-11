import { View, Text, Pressable, StatusBar, Image, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { CheckCircle, ArrowRight } from "lucide-react-native";
import { Button } from "@/components/Button";

const GREEN = "#1A6B3C";

export default function PasswordResetSuccessScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom + 24, 32) }]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Decorative Edge Waves */}
      <View pointerEvents="none" style={styles.edgeTopRight}>
        <Svg viewBox="0 0 200 200" width={140} height={140} preserveAspectRatio="none">
          <Path
            d="M 200 0 L 70 0 C 95 45, 125 95, 155 125 C 180 150, 192 175, 200 200 Z"
            fill={GREEN}
          />
        </Svg>
      </View>

      <View pointerEvents="none" style={styles.edgeBottomLeft}>
        <Svg viewBox="0 0 300 300" width={155} height={155} preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="fpSuccessBotWave" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#105430" />
              <Stop offset="50%" stopColor="#1A6B3C" />
              <Stop offset="100%" stopColor="#24884F" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 0 300 L 0 90 C 60 120, 130 160, 180 200 C 230 240, 260 270, 290 300 Z"
            fill="url(#fpSuccessBotWave)"
            opacity={0.9}
          />
        </Svg>
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <View style={styles.logoBadge}>
            <Image
              source={require("../../assets/images/ally-jis.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.iconWrap}>
            <CheckCircle size={38} color={GREEN} strokeWidth={2} />
          </View>

          <Text style={styles.title}>password updated</Text>
          <Text style={styles.subtitle}>
            Your password has been updated securely. Sign in now with your new credentials.
          </Text>

          <View style={{ width: "100%" }}>
            <Button
              label="GO TO SIGN IN"
              variant="primary"
              pill
              size="lg"
              onPress={() => router.replace("/pages/login" as any)}
              className="w-full"
            />
          </View>

          <Pressable
            onPress={() => router.replace("/pages/login" as any)}
            style={styles.continueRow}
          >
            <Text style={styles.continueText}>Continue to Login</Text>
            <ArrowRight size={15} color={GREEN} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    overflow: "hidden",
  },
  edgeTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 140,
    height: 140,
    zIndex: 0,
  },
  edgeBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 155,
    height: 155,
    zIndex: 0,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    paddingVertical: 36,
    paddingHorizontal: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#1A6B3C",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  logoImage: {
    width: 36,
    height: 36,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(26, 107, 60, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 28,
    color: "#166534",
    letterSpacing: -0.5,
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  continueRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  continueText: {
    color: GREEN,
    fontWeight: "700",
    fontSize: 13,
  },
});
