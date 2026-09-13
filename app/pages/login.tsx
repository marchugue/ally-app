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
import { ArrowRight } from "lucide-react-native";
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
      const [session] = await Promise.all([
        signIn(email.trim().toLowerCase(), password),
        new Promise(resolve => setTimeout(resolve, 2000)),
      ]);

      // Non-CHMSU students with pending student ID review go to waiting room.
      // CHMSU / approved users go straight to the main app.
      const isPending =
        session.user?.user_metadata?.pending_student_verification === true &&
        session.user?.user_metadata?.student_verification_status !== 'approved';

      router.replace(isPending ? ('/pages/pending-approval' as any) : '/(tabs)');
    } catch (error: any) {
      // OTP not yet verified — redirect to verify screen
      if (error?.requiresOtp && error?.userId) {
        router.replace(
          `/pages/verify-otp?userId=${encodeURIComponent(error.userId)}&email=${encodeURIComponent(error.email ?? email)}` as any
        );
        return;
      }
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

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <SlideIn delay={120} distance={30} style={{ flex: 1, marginTop: -60 }}>
          <ScrollView
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
            automaticallyAdjustKeyboardInsets={true}
            keyboardDismissMode="on-drag"
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

                  <Pressable onPress={() => router.push("/pages/select-email" as any)}>
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