import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StatusBar,
  TextInput,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, ApiError } from "@/lib/auth/AuthContext";
import { validateEmail } from "@/lib/validator/email";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import LoadingOverlay from "@/components/LoadingOverlay";
import { Button } from "@/components/Button";
import GoogleButton, { OrDivider } from "@/components/GoogleButton";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { completeOAuthPostLogin, navigateAfterOAuth } from "@/lib/auth/oauthPostLogin";

const BRAND_GREEN = "#166534";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { user, accessToken, signIn, signInWithGoogle, completeLogin } = useAuth();

  useEffect(() => {
    if (user || accessToken) {
      router.replace("/(tabs)");
    }
  }, [user, accessToken]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // If session is true, automatically show loading state while routing to newsfeed (tabs)
  if (user || accessToken) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={BRAND_GREEN} />
      </View>
    );
  }

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
        new Promise((resolve) => setTimeout(resolve, 800)),
      ]);

      const isBanned = Boolean(
        session.user?.user_metadata?.is_banned === true ||
        session.user?.user_metadata?.status === "banned" ||
        session.user?.user_metadata?.is_suspended === true ||
        session.user?.user_metadata?.status === "suspended" ||
        (session.user as any)?.is_banned === true ||
        (session.user as any)?.status === "banned" ||
        (session.user as any)?.is_suspended === true ||
        (session.user as any)?.status === "suspended"
      );

      if (isBanned) {
        router.replace("/pages/banned" as any);
        return;
      }

      const emailType = session.user?.user_metadata?.email_type;
      const isChmsu =
        emailType === "chmsu" ||
        Boolean(session.user?.email && session.user.email.toLowerCase().endsWith("@chmsu.edu.ph"));
      const isApproved = Boolean(
        session.user?.user_metadata?.is_approved ||
        session.user?.user_metadata?.admin_verified ||
        session.user?.user_metadata?.student_verification_status === "approved" ||
        session.user?.user_metadata?.chmsu_auto_verified ||
        isChmsu
      );
      const isPending = !isApproved && (emailType === "external" || !isChmsu);

      router.replace(
        isPending ? ("/pages/pending-approval" as any) : "/(tabs)"
      );
    } catch (error: any) {
      if (
        (error?.status === 403 || error?.status === 400) &&
        (error?.isBanned || error?.message?.toLowerCase().includes("banned") || error?.message?.toLowerCase().includes("suspended"))
      ) {
        router.replace("/pages/banned" as any);
        return;
      }
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
      const { session: refreshed, target } = await completeOAuthPostLogin(session);
      if (refreshed.accessToken && refreshed.user) {
        await completeLogin(refreshed);
      }
      navigateAfterOAuth(router, target);
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
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <AlertMessage message={errorMessage} type="error" />
      <LoadingOverlay visible={isSubmitting} />

      {/* ── TOP SECTION: Organic Green Drawing Header (Non-scrolling, Compact) ── */}
      <View style={[styles.headerContainer, { height: 180 + insets.top }]}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 375 220"
          preserveAspectRatio="none"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            <LinearGradient id="mobileBaseGreen" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#197143" />
              <Stop offset="100%" stopColor="#146437" />
            </LinearGradient>
            <LinearGradient id="mobileDarkCircle" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#155F34" />
              <Stop offset="100%" stopColor="#0F4826" />
            </LinearGradient>
          </Defs>

          {/* Base Organic Wave */}
          <Path
            d="M 0,0 L 250,0 C 290,12 338,40 375,85 L 375,220 C 285,225 170,210 90,165 C 40,135 10,115 0,100 Z"
            fill="url(#mobileBaseGreen)"
          />

          {/* Concentric Dark Green Circle */}
          <Circle cx="195" cy="90" r="105" fill="url(#mobileDarkCircle)" />
        </Svg>

        {/* Centered White Circle Badge with ally-jis.png */}
        <View style={[styles.emblemWrapper, { marginTop: insets.top + 2 }]}>
          <View style={styles.logoBadge}>
            <Image
              source={require("../../assets/images/ally-jis.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>ally-jis</Text>
        </View>
      </View>

      {/* ── FORM WORKSPACE: Non-Scrolling, Contained in KeyboardHugView ── */}
      <KeyboardHugView style={styles.hugView}>
        <View style={[styles.bodyContainer, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
          {/* Header text */}
          <View style={styles.titleWrap}>
            <Text style={styles.screenTitle}>welcome</Text>
            <Text style={styles.screenSubtitle}>Login in to your account to continue</Text>
          </View>

          {/* Form Inputs (Pure White Background) */}
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
              containerStyle={{ marginBottom: 12 }}
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
              containerStyle={{ marginBottom: 4 }}
            />

            {/* Forgot Password Link */}
            <View style={styles.forgotPassRow}>
              <Pressable
                onPress={() => router.push("/pages/forgot-password" as any)}
                hitSlop={8}
              >
                <Text style={styles.forgotPassText}>Forgot your password?</Text>
              </Pressable>
            </View>

            {/* Primary Action Button (LOG IN) */}
            <View style={styles.submitBtnWrapper}>
              <Button
                label={isSubmitting ? "LOGGING IN…" : "LOG IN"}
                variant="primary"
                pill
                size="lg"
                loading={isSubmitting}
                disabled={!isValid || isSubmitting}
                onPress={handleLogin}
                className="w-full"
              />
            </View>

            {/* Footer: Sign up link */}
            <View style={styles.footerRow}>
              <Text style={styles.footerPrompt}>Don't have an account? </Text>
              <Pressable
                onPress={() => router.push("/pages/register" as any)}
                hitSlop={8}
              >
                <Text style={styles.footerLink}>sign up</Text>
              </Pressable>
            </View>

            {/* Google OAuth with Horizontal Divider */}
            <OrDivider text="or" />

            <GoogleButton
              onPress={handleGoogleLogin}
              loading={googleLoading}
              disabled={isSubmitting || googleLoading}
            />
          </View>
        </View>
      </KeyboardHugView>

      {/* ── BOTTOM-LEFT DRAWING ACCENT ── */}
      <View pointerEvents="none" style={styles.bottomAccentContainer}>
        <Svg width={100} height={100} viewBox="0 0 140 140" fill="none">
          <Defs>
            <LinearGradient id="botWaveGradMobile" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#1E825A" />
              <Stop offset="100%" stopColor="#146437" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 0,35 C 20,55 50,85 75,110 C 95,125 115,135 140,140 L 0,140 Z"
            fill="url(#botWaveGradMobile)"
          />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  headerContainer: {
    width: "100%",
    position: "relative",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  emblemWrapper: {
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  logoImage: {
    width: 46,
    height: 46,
  },
  brandTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginTop: 4,
  },
  hugView: {
    flex: 1,
  },
  bodyContainer: {
    flex: 1,
    paddingHorizontal: 26,
    justifyContent: "space-between",
    zIndex: 10,
  },
  titleWrap: {
    alignItems: "center",
    paddingTop: 8,
    marginBottom: 6,
  },
  screenTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 28,
    color: BRAND_GREEN,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 2,
  },
  formContainer: {
    width: "100%",
  },
  forgotPassRow: {
    alignItems: "flex-end",
    marginTop: -4,
    marginBottom: 12,
  },
  forgotPassText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  submitBtnWrapper: {
    width: "100%",
    alignItems: "center",
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  footerPrompt: {
    fontSize: 13,
    color: "#6B7280",
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0FA06C",
  },
  bottomAccentContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 100,
    height: 100,
    zIndex: 0,
  },
});
