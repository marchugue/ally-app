import { useState } from "react";
import { View, Text, Pressable, Image, StatusBar } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";

export default function LandingPage() {
  const insets = useSafeAreaInsets();
  const [pressed, setPressed] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: "#1A6B3C" }}>
      <StatusBar barStyle="light-content" />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 32,
          justifyContent: "space-between",
        }}
      >
        {/* Brand section unchanged */}
        <View style={{ alignItems: "center", marginTop: 48 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 20,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 6,
            }}
          >
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>

          <Text style={{ fontSize: 40, fontWeight: "800", color: "#FFFFFF", letterSpacing: -1.5 }}>
            lly<Text style={{ color: "#E8A838" }}>-jis</Text>
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.7)",
              marginTop: 10,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            The social space for{"\n"}CHMSU Alijis Campus
          </Text>
        </View>

        {/* CTA */}
        <View style={{ alignItems: "center", marginTop: "auto", marginBottom: -24 }}>
          <Pressable
            onPress={() => router.push("/pages/register" as any)}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            android_ripple={{ color: "rgba(0,0,0,0.08)" }}
            style={{
              backgroundColor: "#FFFFFF",
              opacity: pressed ? 0.85 : 1,
              borderRadius: 10,
              paddingVertical: 17,
              width: "100%",
              minHeight: 52,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              marginBottom: 18,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text style={{ color: "#1A6B3C", fontWeight: "700", fontSize: 15, letterSpacing: 0.1, }}>
              Get Started
            </Text>
            <ArrowRight size={18} color="#1A6B3C" />
          </Pressable>

          <Pressable onPress={() => router.push("/pages/login")} hitSlop={8}>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", }}>
              I already have an account{" "}
              <Text style={{ fontWeight: "700", color: "#FFFFFF" }}>Sign in</Text>
            </Text>
          </Pressable>

          <Text
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "rgba(255,255,255,0.5)",
              marginTop: 10,
              lineHeight: 16,
            }}
          >
            For CHMSU Alijis Campus students only
          </Text>
        </View>
      </View>
    </View>
  );
}