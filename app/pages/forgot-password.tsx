import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Mail, CheckCircle, ArrowLeft, KeyRound, Shield } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import * as authApi from "@/lib/api/auth";
import { usePasswordResetWatch } from "@/hooks/usePasswordResetWatch";
import { KeyboardHugView } from "@/components/KeyboardHugView";

const GREEN = "#1A6B3C";
const GOLD = "#E8A838";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { completed } = usePasswordResetWatch(trackingToken);

  useEffect(() => {
    if (completed) {
      router.replace("/pages/password-reset-success" as any);
    }
  }, [completed]);

  async function handleRequestReset() {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { trackingToken: token } = await authApi.forgotPassword(email.trim().toLowerCase());
      setEmailSent(true);
      setTrackingToken(token);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const waiting = emailSent;
  const canWatchCompletion = Boolean(trackingToken);

  return (
    <KeyboardHugView style={{ flex: 1, backgroundColor: "#F7F4EF" }}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 12,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingVertical: 8,
            opacity: pressed ? 0.6 : 1,
            marginBottom: 28,
          })}
        >
          <ArrowLeft size={18} color={GREEN} />
          <Text style={{ color: GREEN, fontSize: 14, fontWeight: "600" }}>Back</Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: GREEN,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 22 }}>A</Text>
          </View>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: GREEN, letterSpacing: -0.5 }}>
              lly<Text style={{ color: GOLD }}>-jis</Text>
            </Text>
            <Text style={{ fontSize: 11, color: "#6B7280", letterSpacing: 1, textTransform: "uppercase" }}>
              Account recovery
            </Text>
          </View>
        </View>

        {!waiting ? (
          <>
            <Text style={{ fontSize: 32, fontWeight: "800", color: "#111827", letterSpacing: -1, marginBottom: 8 }}>
              Forgot password?
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 15, lineHeight: 22, marginBottom: 24 }}>
              We&apos;ll email you a secure link. Open it in your browser to set a new password — the app will update
              automatically when you&apos;re done.
            </Text>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 28 }}>
              <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" }}>
                <Shield size={18} color={GOLD} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151" }}>Secure link</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Single-use token via Resend</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E5E7EB" }}>
                <KeyRound size={18} color={GOLD} style={{ marginBottom: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151" }}>Reset on web</Text>
                <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Same rules as registration</Text>
              </View>
            </View>

            {error ? (
              <View style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 16 }}>
                <Text style={{ color: "#B91C1C", fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Email
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderWidth: 1.5,
                borderColor: "#E5E7EB",
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 16,
                marginBottom: 24,
              }}
            >
              <Mail size={18} color="#9CA3AF" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@chmsu.edu.ph"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                style={{ flex: 1, marginLeft: 10, fontSize: 15, color: "#111827" }}
              />
            </View>

            <Button label="Send reset link" onPress={handleRequestReset} loading={loading} />
          </>
        ) : (
          <View style={{ flex: 1, alignItems: "center", paddingTop: 24 }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: `${GREEN}14`,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <CheckCircle size={44} color={GREEN} />
            </View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#111827", textAlign: "center", marginBottom: 10 }}>
              Check your email
            </Text>
            <Text style={{ fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 8 }}>
              If an account exists for{" "}
              <Text style={{ fontWeight: "700", color: "#374151" }}>{email}</Text>, tap the link in your inbox.
            </Text>
            <Text style={{ fontSize: 14, color: "#6B7280", textAlign: "center", lineHeight: 21, marginBottom: 28 }}>
              {canWatchCompletion
                ? "Complete the reset in your browser. This screen will move to success when your new password is saved."
                : "Complete the reset in your browser, then return here and sign in with your new password."}
            </Text>
            {canWatchCompletion ? (
              <>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={{ marginTop: 12, fontSize: 12, color: "#9CA3AF" }}>Listening for completion…</Text>
              </>
            ) : null}
            <Pressable onPress={() => router.replace("/pages/login")} style={{ marginTop: 36 }}>
              <Text style={{ color: GREEN, fontWeight: "700", fontSize: 14 }}>Back to sign in</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardHugView>
  );
}
