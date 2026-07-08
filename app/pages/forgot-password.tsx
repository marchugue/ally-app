import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  StatusBar,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Mail, Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { apiRequest } from "@/lib/api/client";

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string; type?: string }>();

  // If a recovery token arrives via deep-link query params, enter reset mode
  const [recoveryToken] = useState<string | null>(
    params.token && params.type === "recovery" ? params.token : null
  );

  // ── Request email form ───────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [requestSent, setRequestSent] = useState(false);

  // ── Set new password form ────────────────────────────────────────────────
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // ── Shared ───────────────────────────────────────────────────────────────
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const mode: "request" | "reset" = recoveryToken ? "reset" : "request";

  async function handleRequestReset() {
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
        noContent: true,
      });
      setRequestSent(true);
    } catch (err: any) {
      // Intentionally generic to avoid leaking registered emails
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword() {
    if (!password || !confirmPassword) {
      setError("Please fill in both fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!recoveryToken) {
      setError("Reset link is invalid or has expired. Please request a new one.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: { token: recoveryToken, password },
        noContent: true,
      });
      setResetSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Reset link is invalid or has expired. Please request a new one.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 16,
          paddingHorizontal: 24,
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingVertical: 8,
            opacity: pressed ? 0.6 : 1,
            marginBottom: 32,
          })}
        >
          <ArrowLeft size={18} color="#1A6B3C" />
          <Text style={{ color: "#1A6B3C", fontSize: 14, fontWeight: "500" }}>Back</Text>
        </Pressable>

        {/* Brand mark */}
        <View className="flex-row items-center gap-2 mb-8">
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: "#1A6B3C",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>A</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#1A6B3C", letterSpacing: -0.5 }}>
            lly<Text style={{ color: "#E8A838" }}>-jis</Text>
          </Text>
        </View>

        {/* ── REQUEST MODE: enter email ──────────────────────────────────── */}
        {mode === "request" && !requestSent && (
          <>
            <Text
              style={{ fontSize: 26, fontWeight: "800", color: "#111827", letterSpacing: -0.8, marginBottom: 4 }}
            >
              Forgot your password?
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
              No worries — we'll send you a reset link.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-danger text-sm">{error}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
              Email
            </Text>
            <View
              className="flex-row items-center bg-surface border border-border rounded-xl px-3.5"
              style={{ paddingVertical: 14, marginBottom: 20 }}
            >
              <Mail size={17} color="#9CA3AF" />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@chmsu.edu.ph"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                className="flex-1 ml-2.5 text-textPrimary text-sm"
              />
            </View>

            <Button label="Send reset link" onPress={handleRequestReset} loading={loading} />
          </>
        )}

        {/* ── REQUEST MODE: sent confirmation ───────────────────────────── */}
        {mode === "request" && requestSent && (
          <View className="flex-1 items-center justify-center pb-16">
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#1A6B3C12",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <CheckCircle size={36} color="#1A6B3C" />
            </View>
            <Text
              style={{ fontSize: 22, fontWeight: "800", color: "#111827", letterSpacing: -0.5, marginBottom: 8, textAlign: "center" }}
            >
              Check your email
            </Text>
            <Text
              style={{ color: "#6B7280", fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 8 }}
            >
              If an account exists for{" "}
              <Text style={{ fontWeight: "600", color: "#374151" }}>{email}</Text>, we've sent a
              link to reset your password.
            </Text>

            <Pressable
              onPress={() => router.replace("/pages/login")}
              style={{ marginTop: 32 }}
            >
              <Text style={{ color: "#1A6B3C", fontWeight: "700", fontSize: 14 }}>
                Back to sign in
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── RESET MODE: set new password ──────────────────────────────── */}
        {mode === "reset" && !resetSuccess && (
          <>
            <Text
              style={{ fontSize: 26, fontWeight: "800", color: "#111827", letterSpacing: -0.8, marginBottom: 4 }}
            >
              Set a new password
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
              Choose a new password for your account.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-danger text-sm">{error}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
              New password
            </Text>
            <View
              className="flex-row items-center bg-surface border border-border rounded-xl px-3.5"
              style={{ paddingVertical: 14, marginBottom: 14 }}
            >
              <Lock size={17} color="#9CA3AF" />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                className="flex-1 ml-2.5 text-textPrimary text-sm"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
              </Pressable>
            </View>

            <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
              Confirm new password
            </Text>
            <View
              className="flex-row items-center bg-surface border border-border rounded-xl px-3.5"
              style={{ paddingVertical: 14, marginBottom: 20 }}
            >
              <Lock size={17} color="#9CA3AF" />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your new password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                className="flex-1 ml-2.5 text-textPrimary text-sm"
              />
            </View>

            <Button label="Reset password" onPress={handleSetNewPassword} loading={loading} />
          </>
        )}

        {/* ── RESET MODE: success ───────────────────────────────────────── */}
        {mode === "reset" && resetSuccess && (
          <View className="flex-1 items-center justify-center pb-16">
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#1A6B3C12",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
              }}
            >
              <CheckCircle size={36} color="#1A6B3C" />
            </View>
            <Text
              style={{ fontSize: 22, fontWeight: "800", color: "#111827", letterSpacing: -0.5, marginBottom: 8, textAlign: "center" }}
            >
              Password updated
            </Text>
            <Text
              style={{ color: "#6B7280", fontSize: 14, textAlign: "center", lineHeight: 20, paddingHorizontal: 8, marginBottom: 32 }}
            >
              Your password has been reset. Sign in with your new password.
            </Text>

            <Button
              label="Go to sign in"
              onPress={() => router.replace("/pages/login")}
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}