import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Animated,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, ApiError } from "@/lib/auth/AuthContext";
import { validateEmail } from "@/lib/validator/email";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import LoadingOverlay from "@/components/LoadingOverlay";
import { Button } from "@/components/Button";
import GoogleButton, { OrDivider } from "@/components/GoogleButton";

const BRAND_GREEN = "#1A6B3C";
const BRAND_GREEN_DARK = "#155a33";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Validation
  const emailError =
    touchedEmail && email.trim().length > 0 ? validateEmail(email) : null;
  const passError =
    touchedPassword && password.length > 0 && password.length < 6
      ? "Password must be at least 6 characters."
      : null;
  const isValid =
    validateEmail(email) === null &&
    email.trim().length > 0 &&
    password.length >= 6;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/pages/landing" as any);
    }
  };

  async function handleLogin() {
    setTouchedEmail(true);
    setTouchedPassword(true);

    const emailErr = validateEmail(email);
    if (emailErr) {
      setErrorMessage(emailErr);
      return;
    }

    if (password.trim().length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (isSubmitting) return;

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const [session] = await Promise.all([
        signIn(email.trim().toLowerCase(), password),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);

      // Non-CHMSU students with pending student ID review go to waiting room.
      // CHMSU / approved users go straight to the main app.
      const isPending =
        session.user?.user_metadata?.pending_student_verification === true &&
        session.user?.user_metadata?.student_verification_status !== "approved";

      router.replace(
        isPending ? ("/pages/pending-approval" as any) : "/(tabs)"
      );
    } catch (error: any) {
      // OTP not yet verified — redirect to verify screen
      if (error?.requiresOtp && error?.userId) {
        router.replace(
          `/pages/verify-otp?userId=${encodeURIComponent(
            error.userId
          )}&email=${encodeURIComponent(error.email ?? email)}` as any
        );
        return;
      }
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Invalid credentials. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    if (googleLoading || isSubmitting) return;
    setErrorMessage(null);
    setGoogleLoading(true);

    try {
      const session = await signInWithGoogle();
      const emailType = session.user?.user_metadata?.email_type;
      const isChmsu = emailType === "chmsu";
      const isApproved = session.user?.user_metadata?.is_approved;
      const needsOnboard = !session.user?.user_metadata?.onboarding_complete;
      const hasStudentId = Boolean(
        session.user?.user_metadata?.student_id_url ||
        (session.user as any)?.student_id_url
      );

      if (isChmsu) {
        if (needsOnboard) {
          router.replace({ pathname: "/pages/register" as any, params: { startStep: "2" } });
        } else {
          router.replace("/(tabs)");
        }
      } else {
        // External email
        if (!hasStudentId && !isApproved) {
          router.replace("/pages/id-upload" as any);
        } else if (needsOnboard) {
          router.replace({ pathname: "/pages/register" as any, params: { startStep: "2" } });
        } else if (!isApproved) {
          router.replace("/pages/pending-approval" as any);
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Google authentication failed. Please try again.";
      if (!msg.toLowerCase().includes("cancelled")) {
        setErrorMessage(msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <AlertMessage message={errorMessage} type="error" />
      <LoadingOverlay visible={isSubmitting} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 10,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar: Back Action ── */}
        <View style={styles.topBar}>
          <Pressable
            onPress={handleBack}
            hitSlop={12}
            style={styles.backBtn}
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={22} color="#111827" strokeWidth={2.2} />
          </Pressable>
        </View>

        {/* ── Centered ALLY-JIS Branding (No Icon, Fraunces Font) ── */}
        <View style={styles.brandContainer}>
          <Text style={styles.brandTitle}>ALLY-JIS</Text>
        </View>

        {/* ── Screen Title: Left-Aligned ── */}
        <Text style={styles.screenTitle}>Login to your Account</Text>

        {/* ── Inputs: Same as Register (EmailInput & PasswordInput) ── */}
        <View style={styles.formContainer}>
          <EmailInput
            ref={emailRef}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errorMessage) setErrorMessage(null);
            }}
            onBlur={() => setTouchedEmail(true)}
            error={touchedEmail ? emailError : null}
            placeholder="Email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <PasswordInput
            ref={passwordRef}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errorMessage) setErrorMessage(null);
            }}
            onBlur={() => setTouchedPassword(true)}
            error={touchedPassword ? passError : null}
            placeholder="Password"
            showStrength={false}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {/* Forgot Password Link */}
          <View style={styles.forgotPassRow}>
            <Pressable
              onPress={() => router.push("/pages/forgot-password" as any)}
              hitSlop={8}
            >
              <Text style={styles.forgotPassText}>Forgot password?</Text>
            </Pressable>
          </View>

          {/* Primary Action Button */}
          <View style={styles.submitBtnWrapper}>
            <Button
              label={isSubmitting ? "Signing in…" : "Sign in"}
              variant="primary"
              pill
              size="lg"
              loading={isSubmitting}
              disabled={!isValid || isSubmitting}
              onPress={handleLogin}
              className="w-full"
            />
          </View>

          {/* ── Google OAuth with Horizontal Divider ── */}
          <OrDivider text="or" />

          <GoogleButton
            onPress={handleGoogleLogin}
            loading={googleLoading}
            disabled={isSubmitting || googleLoading}
          />
        </View>

        {/* ── Footer: Centered Sign Up Link ── */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerPrompt}>Don't have an account? </Text>
          <Pressable
            onPress={() => router.push("/pages/register" as any)}
            hitSlop={8}
          >
            <Text style={styles.footerLink}>Sign up</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: {
    padding: 6,
    marginLeft: -6,
    alignSelf: "flex-start",
  },
  brandContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    paddingBottom: 36,
  },
  brandTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 34,
    color: BRAND_GREEN,
    letterSpacing: -0.5,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 26,
    letterSpacing: -0.3,
  },
  formContainer: {
    width: "100%",
  },
  forgotPassRow: {
    alignItems: "flex-end",
    marginTop: -8,
    marginBottom: 24,
  },
  forgotPassText: {
    fontSize: 13,
    fontWeight: "600",
    color: BRAND_GREEN,
  },
  submitBtnWrapper: {
    width: "100%",
    marginBottom: 16,
  },
  footerContainer: {
    marginTop: "auto",
    paddingTop: 32,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrompt: {
    fontSize: 14,
    color: "#6B7280",
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND_GREEN,
  },
});