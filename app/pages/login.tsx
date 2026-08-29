import { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  StatusBar,
  Image,
  Animated
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, ApiError } from "@/lib/auth/AuthContext";
import { DiagonalStripes } from "@/components/DiagonalStripes";
import { SlideIn } from "@/components/SlideIn";
import { Button } from "@/components/Button";
import { validateEmail } from "@/lib/validator/email";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import LoadingOverlay from "@/components/LoadingOverlay";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [Touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);

  const emailError =
  Touched && email.trim().length > 0
    ? validateEmail(email)
    : null;
  const isValid = validateEmail(email) === null && password.length > 0;
  const passError = password.length < 6 && password.length > 0  ? "Password must be at least 6 characters. " : null;

  async function handleLogin() {
    if (!isValid || isSubmitting) return;

    const emailError = validateEmail(email);

    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    if (password.trim().length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    
    try {
      await Promise.all([
        signIn(email.trim().toLowerCase(), password),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);

      router.replace("/(tabs)");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Something went wrong. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }
  

  return (
    <View style={{ flex: 1, backgroundColor: "#1A6B3C" }}>
      <StatusBar barStyle="light-content" />
      
      <AlertMessage
              message={errorMessage}
              type="error"
            />
      <LoadingOverlay visible={isSubmitting} />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 24, paddingBottom: 90, overflow: "hidden" }}>
        <DiagonalStripes />

        <Pressable
          onPress={() => router.back()}
          disabled={isSubmitting}
          style={{ 
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            alignSelf: "flex-start",
            paddingVertical: 8,
            opacity: isSubmitting ? 0.6 : 1,
            marginBottom: 24,
          }}
        >
          <ArrowLeft size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "500" }}>Back</Text>
        </Pressable>

        <SlideIn delay={0} style={{ alignItems: "center" }}>
          <View style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#FFFFFF", letterSpacing: -0.5 }}>
            Ally<Text style={{ color: "#E8A838" }}>-jis</Text>
          </Text>
        </SlideIn>
      </View>

      <KeyboardAvoidingView style={{ flex: 1, marginTop: -60,  }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <SlideIn delay={120} distance={30} style={{ flex: 1 }}>
          <ScrollView
            scrollEnabled={false}
            contentContainerStyle={{
              flexGrow: 1,
              backgroundColor: "#FDFCFB",
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 28,
              paddingTop: 32,
              paddingBottom: insets.bottom + 32,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ fontSize: 26, fontWeight: "800", color: "#1A6B3C", letterSpacing: -0.5, marginBottom: 4 }}>
              Welcome back
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 14, marginBottom: 28 }}>
              Sign in to your Ally-jis account
            </Text>

            <EmailInput
              value={email}
              onChangeText={setEmail}
              onBlur={() => setTouched(true)}
              error={emailError}
            />

            <PasswordInput
              value={password}
              onChangeText={setPassword}
              onBlur={() => setTouched(true)}
              error={passError}
            />

            <Pressable onPress={() => router.push("/pages/forgot-password" as any)} style={{ alignSelf: "flex-end", marginBottom: 24 }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#1A6B3C" }}>Forgot password?</Text>
            </Pressable>

            <Button
              label={isSubmitting ? "Signing in…" : "Sign in"}
              variant="primary"
              pill
              size="lg"
              loading={isSubmitting}
              disabled={!isValid}
              icon={!isSubmitting && <ArrowRight size={18} color="#FFFFFF" />}
              onPress={handleLogin}
              className="w-full"
            />

              <View style={{ marginTop: "auto", marginBottom: -24 }}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#6B7280" }}>
                    Don't have an account?
                  </Text>

                  <Pressable onPress={() => router.push("/pages/register" as any)}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: "700",
                        color: "#1A6B3C",
                      }}
                    >
                      Sign up
                    </Text>
                  </Pressable>
                </View>

                <Text
                  style={{
                    textAlign: "center",
                    fontSize: 11,
                    color: "#9CA3AF",
                    marginTop: 10,
                    lineHeight: 16,
                  }}
                >
                  For CHMSU Alijis Campus students only
                </Text>
              </View>
          </ScrollView>
        </SlideIn>
      </KeyboardAvoidingView>
    </View>
  );
}