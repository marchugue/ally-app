import { View, Text, Pressable, StatusBar } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, ArrowRight } from "lucide-react-native";
import { Button } from "@/components/Button";

const GREEN = "#1A6B3C";

export default function PasswordResetSuccessScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#F7F4EF", paddingTop: insets.top + 24, paddingHorizontal: 24 }}>
      <StatusBar barStyle="dark-content" />
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: insets.bottom + 32,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: "#FFFFFF",
            borderRadius: 28,
            paddingVertical: 40,
            paddingHorizontal: 28,
            alignItems: "center",
            shadowColor: "#1A6B3C",
            shadowOpacity: 0.08,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 4,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: `${GREEN}18`,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            }}
          >
            <CheckCircle size={44} color={GREEN} strokeWidth={2} />
          </View>
          <Text
            style={{
              fontSize: 26,
              fontWeight: "800",
              color: "#111827",
              letterSpacing: -0.6,
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Password reset complete
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: "#6B7280",
              textAlign: "center",
              lineHeight: 22,
              marginBottom: 32,
            }}
          >
            Your password was updated in the browser. Sign in with your new credentials.
          </Text>
          <Button label="Go to sign in" onPress={() => router.replace("/pages/login")} />
          <Pressable
            onPress={() => router.replace("/pages/login")}
            style={{ marginTop: 16, flexDirection: "row", alignItems: "center", gap: 4 }}
          >
            <Text style={{ color: GREEN, fontWeight: "700", fontSize: 14 }}>Continue</Text>
            <ArrowRight size={16} color={GREEN} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
