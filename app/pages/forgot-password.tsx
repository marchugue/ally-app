import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Image,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
} from "lucide-react-native";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import { ErrorAlertModal } from "@/components/ErrorAlertModal";
import { AnimatedOtpInput } from "@/components/AnimatedOtpInput";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { useKeyboard } from "@/hooks/useKeyboard";
import { validateEmail } from "@/lib/validator";
import { validatePass } from "@/lib/validator/password";
import * as authApi from "@/lib/api/auth";

type ResetStep = "email" | "otp" | "new_password";
const OTP_LENGTH = 6;
const BRAND_GREEN = "#166534";
const GREEN = "#1A6B3C";

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();

  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [alertError, setAlertError] = useState<{ title: string; message: string } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpFocusTrigger, setOtpFocusTrigger] = useState(0);

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const [focusedField, setFocusedField] = useState<"password" | "confirmPassword" | null>(null);

  useEffect(() => {
    if (!isKeyboardVisible && step === "new_password") {
      setFocusedField(null);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [isKeyboardVisible, step]);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  function startResendCooldown(seconds = 60) {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setResendCooldown(seconds);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Verify email exists in DB before sending reset OTP
  async function ensureRegisteredEmail(cleaned: string): Promise<boolean> {
    const emailCheck = await authApi.checkEmailAvailable(cleaned);
    if (emailCheck?.available !== false) {
      setAlertError({
        title: "Account not found",
        message: "No account found with this email address.",
      });
      return false;
    }
    return true;
  }

  // ── Step 1: Request OTP Code ───────────────────────────────────────────────
  async function handleSendCode() {
    const cleaned = email.trim().toLowerCase();
    const validationErr = validateEmail(cleaned, "any");
    if (validationErr) {
      setAlertError({
        title: "Invalid email",
        message: validationErr,
      });
      return;
    }

    setLoading(true);
    setAlertError(null);
    try {
      const exists = await ensureRegisteredEmail(cleaned);
      if (!exists) return;

      await authApi.forgotPassword(cleaned);
      setEmail(cleaned);
      setStep("otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setOtpFocusTrigger((n) => n + 1);
      startResendCooldown(60);
    } catch (err: any) {
      setAlertError({
        title: "Could not send code",
        message: err?.message || "No account found with this email address.",
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Resend Code ────────────────────────────────────────────────────────────
  async function handleResend() {
    if (loading || resendCooldown > 0 || !email.trim()) return;
    const cleaned = email.trim().toLowerCase();
    setLoading(true);
    setAlertError(null);
    try {
      const exists = await ensureRegisteredEmail(cleaned);
      if (!exists) return;

      await authApi.forgotPassword(cleaned);
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setOtpFocusTrigger((n) => n + 1);
      startResendCooldown(60);
    } catch (err: any) {
      setAlertError({
        title: "Resend failed",
        message: err?.message || "Could not resend code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2: Verify OTP Code ────────────────────────────────────────────────
  async function handleVerifyOtp(codeToVerify: string) {
    if (loading) return;
    const code = codeToVerify.trim();
    if (code.length !== OTP_LENGTH) {
      setAlertError({
        title: "Incomplete code",
        message: "Please enter the full 6-digit code.",
      });
      return;
    }

    setLoading(true);
    setAlertError(null);
    try {
      await authApi.verifyPasswordResetOtp(email.trim().toLowerCase(), code);
      setStep("new_password");
    } catch (err: any) {
      setAlertError({
        title: "Verification failed",
        message: err?.message || "Incorrect verification code. Please check and try again.",
      });
      setOtpDigits(Array(OTP_LENGTH).fill(""));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Complete Reset ─────────────────────────────────────────────────
  async function handleCompleteReset() {
    const pwErr = validatePass(newPassword);
    if (pwErr) {
      setAlertError({
        title: "Invalid password",
        message: pwErr,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setAlertError({
        title: "Password mismatch",
        message: "Passwords do not match. Please re-enter.",
      });
      return;
    }

    setLoading(true);
    setAlertError(null);
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        code: otpDigits.join(""),
        password: newPassword,
      });

      router.replace("/pages/password-reset-success" as any);
    } catch (err: any) {
      setAlertError({
        title: "Reset failed",
        message: err?.message || "Failed to update password. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setAlertError(null);
    setFocusedField(null);
    if (step === "new_password") {
      setStep("otp");
      return;
    }
    if (step === "otp") {
      setStep("email");
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/pages/login" as any);
    }
  }

  const currentStepIndex = step === "email" ? 1 : step === "otp" ? 2 : 3;

  return (
    <View style={styles.root}>
      <StatusBar
        barStyle={step === "email" ? "light-content" : "dark-content"}
        translucent
        backgroundColor="transparent"
      />

      <ErrorAlertModal
        visible={Boolean(alertError)}
        title={alertError?.title}
        message={alertError?.message}
        onClose={() => {
          setAlertError(null);
          if (step === "otp") {
            setOtpFocusTrigger((n) => n + 1);
          }
        }}
      />

      {step === "email" ? (
        <>
          {/* ── TOP SECTION: Organic Green Drawing Header (Matches login.tsx, non-scrollable) ── */}
          <View style={[styles.headerContainer, { height: 175 + insets.top }]}>
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 375 220"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <LinearGradient id="fpMobileBaseGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#197143" />
                  <Stop offset="100%" stopColor="#146437" />
                </LinearGradient>
                <LinearGradient id="fpMobileDarkCircle" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#155F34" />
                  <Stop offset="100%" stopColor="#0F4826" />
                </LinearGradient>
              </Defs>
              <Path
                d="M 0,0 L 250,0 C 290,12 338,40 375,85 L 375,220 C 285,225 170,210 90,165 C 40,135 10,115 0,100 Z"
                fill="url(#fpMobileBaseGreen)"
              />
              <Circle cx="195" cy="90" r="105" fill="url(#fpMobileDarkCircle)" />
            </Svg>

            {/* Transparent circular floating Back Button */}
            <Pressable
              onPress={handleBack}
              hitSlop={14}
              style={[styles.backBtn, { top: insets.top + 6 }]}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={20} color="#FFFFFF" strokeWidth={2.4} />
            </Pressable>

            {/* Emblem Badge with ally-jis.png */}
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

          {/* ── STEP 1 FORM WORKSPACE: Centered inside KeyboardHugView ── */}
          <KeyboardHugView style={styles.hugView}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.stepOneScrollBody,
                { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 14, 20) },
              ]}
            >
              <View style={styles.titleWrap}>
                <Text style={styles.screenTitle}>reset password</Text>
                <Text style={styles.screenSubtitle}>
                  Enter your email to receive a reset code
                </Text>
              </View>

              <View style={styles.formContainer}>
                <EmailInput
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    if (alertError) setAlertError(null);
                  }}
                  placeholder="Email"
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                  containerStyle={{ marginBottom: 14 }}
                />

                <Button
                  label={loading ? "SENDING CODE…" : "SEND RESET CODE"}
                  variant="primary"
                  pill
                  size="lg"
                  loading={loading}
                  disabled={loading || !email.trim()}
                  icon={<ArrowRight size={16} color="#FFFFFF" />}
                  onPress={handleSendCode}
                  className="w-full"
                />

                {!isKeyboardVisible && (
                  <View style={styles.footerRow}>
                    <Text style={styles.footerPrompt}>Remember your password? </Text>
                    <Pressable onPress={() => router.replace("/pages/login" as any)} hitSlop={8}>
                      <Text style={styles.footerLink}>sign in</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardHugView>

          {/* Bottom-left green corner wave (matches login.tsx) */}
          <View pointerEvents="none" style={styles.bottomAccentContainer}>
            <Svg width={100} height={100} viewBox="0 0 140 140" fill="none">
              <Defs>
                <LinearGradient id="fpBotWaveGradMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#1E825A" />
                  <Stop offset="100%" stopColor="#146437" />
                </LinearGradient>
              </Defs>
              <Path
                d="M 0,35 C 20,55 50,85 75,110 C 95,125 115,135 140,140 L 0,140 Z"
                fill="url(#fpBotWaveGradMobile)"
              />
            </Svg>
          </View>
        </>
      ) : (
        <View style={{ flex: 1, paddingTop: insets.top }}>
          {/* ── Edge Graphics for Steps 2 & 3 (Matches register.tsx) ── */}
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
                <LinearGradient id="fpEdgeBottomWave" x1="0%" y1="100%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#105430" />
                  <Stop offset="50%" stopColor="#1A6B3C" />
                  <Stop offset="100%" stopColor="#24884F" />
                </LinearGradient>
              </Defs>
              <Path
                d="M 0 300 L 0 90 C 60 120, 130 160, 180 200 C 230 240, 260 270, 290 300 Z"
                fill="url(#fpEdgeBottomWave)"
                opacity={0.9}
              />
              <Path
                d="M 0 300 L 0 160 C 45 180, 90 210, 130 240 C 170 270, 190 285, 210 300 Z"
                fill="#24884F"
                opacity={0.5}
              />
            </Svg>
          </View>

          <View pointerEvents="none" style={styles.edgeTopLeft}>
            <Svg viewBox="0 0 200 200" width={90} height={90} preserveAspectRatio="none">
              <Path
                d="M 0 0 L 110 0 C 85 25, 55 55, 30 90 C 10 120, 0 150, 0 170 Z"
                fill="rgba(26, 107, 60, 0.08)"
              />
            </Svg>
          </View>

          {/* Transparent Top Bar (no solid block covering graphics) */}
          <View style={styles.topBar} pointerEvents="box-none">
            <Pressable
              onPress={handleBack}
              hitSlop={14}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={24} color={GREEN} />
            </Pressable>

            <View style={styles.progressRow}>
              {[1, 2, 3].map((num) => (
                <View
                  key={num}
                  style={[
                    styles.progressPill,
                    num === currentStepIndex
                      ? styles.progressPillActive
                      : num < currentStepIndex
                        ? styles.progressPillDone
                        : styles.progressPillInactive,
                  ]}
                />
              ))}
            </View>

            <View style={{ width: 44 }} />
          </View>

          <KeyboardHugView style={styles.hugView}>
            {step === "otp" ? (
              /* Centered Step 2: OTP */
              <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                  styles.centeredStepBody,
                  { paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom + 18, 24) },
                ]}
              >
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>verify code</Text>
                  <Text style={styles.stepSubtitle}>Enter the 6-digit code sent to</Text>
                  <Text style={styles.emailPlainText} numberOfLines={1}>
                    {email}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setStep("email");
                      setAlertError(null);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Change email"
                    style={styles.changeEmailLinkBtn}
                  >
                    <Text style={styles.changeEmailLinkText}>Change email</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.otpCenterBlock}>
                  <AnimatedOtpInput
                    digits={otpDigits}
                    onChange={setOtpDigits}
                    onComplete={handleVerifyOtp}
                    onInputActivity={() => {
                      if (alertError) setAlertError(null);
                    }}
                    disabled={loading}
                    focusFirstTrigger={otpFocusTrigger}
                    containerStyle={{ marginVertical: 18 }}
                  />
                </View>

                <View style={styles.bottomActions}>
                  <Button
                    label={loading ? "VERIFYING…" : "VERIFY CODE"}
                    variant="primary"
                    pill
                    size="lg"
                    loading={loading}
                    disabled={loading || !otpDigits.every(Boolean)}
                    onPress={() => handleVerifyOtp(otpDigits.join(""))}
                    className="w-full"
                  />

                  <View style={styles.resendWrapper}>
                    <Text style={styles.resendPrompt}>Didn&apos;t receive the code? </Text>
                    <TouchableOpacity
                      onPress={handleResend}
                      disabled={loading || resendCooldown > 0}
                      hitSlop={8}
                    >
                      <Text
                        style={[
                          styles.resendBtnText,
                          (resendCooldown > 0 || loading) && { color: "#9CA3AF" },
                        ]}
                      >
                        {resendCooldown > 0 ? `Resend (${formatTimer(resendCooldown)})` : "Resend"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            ) : (
              /* Step 3: New Password */
              <ScrollView
                ref={scrollViewRef}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                contentContainerStyle={[
                  styles.centeredStepBody,
                  { paddingBottom: isKeyboardVisible ? 12 : Math.max(insets.bottom + 18, 24) },
                ]}
              >
                <View style={styles.stepHeader}>
                  <Text style={styles.stepTitle}>new password</Text>
                </View>

                <View style={{ width: "100%", marginTop: 18 }}>
                  <PasswordInput
                    ref={passwordInputRef}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      if (alertError) setAlertError(null);
                    }}
                    onFocus={() => setFocusedField("password")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="New password"
                    showStrength={true}
                    containerStyle={{ marginBottom: 14 }}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  />

                  <PasswordInput
                    ref={confirmPasswordInputRef}
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      if (alertError) setAlertError(null);
                    }}
                    onFocus={() => setFocusedField("confirmPassword")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Confirm new password"
                    showStrength={false}
                    containerStyle={{ marginBottom: 14 }}
                    returnKeyType="done"
                    onSubmitEditing={handleCompleteReset}
                  />
                </View>

                <View style={styles.bottomActions}>
                  <Button
                    label={
                      loading
                        ? "UPDATING PASSWORD…"
                        : focusedField === "password"
                          ? "NEXT"
                          : "SAVE NEW PASSWORD"
                    }
                    variant="primary"
                    pill
                    size="lg"
                    loading={loading}
                    disabled={
                      loading || !newPassword || (focusedField !== "password" && !confirmPassword)
                    }
                    icon={
                      focusedField === "password" ? (
                        <ArrowRight size={16} color="#FFFFFF" />
                      ) : (
                        <CheckCircle size={16} color="#FFFFFF" />
                      )
                    }
                    onPress={
                      focusedField === "password"
                        ? () => confirmPasswordInputRef.current?.focus()
                        : handleCompleteReset
                    }
                    className="w-full"
                  />
                </View>
              </ScrollView>
            )}
          </KeyboardHugView>
        </View>
      )}
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
  backBtn: {
    position: "absolute",
    left: 16,
    padding: 7,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.22)",
    zIndex: 30,
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
  stepOneScrollBody: {
    flexGrow: 1,
    paddingHorizontal: 26,
    paddingTop: 12,
    justifyContent: "center",
    zIndex: 10,
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 22,
  },
  screenTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 27,
    color: BRAND_GREEN,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17,
    maxWidth: 290,
  },
  formContainer: {
    width: "100%",
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
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
  edgeTopLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 90,
    height: 90,
    zIndex: 0,
  },
  topBar: {
    paddingHorizontal: 16,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    zIndex: 10,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressPill: {
    height: 6,
    borderRadius: 3,
  },
  progressPillActive: {
    width: 28,
    backgroundColor: GREEN,
  },
  progressPillDone: {
    width: 18,
    backgroundColor: "rgba(26, 107, 60, 0.55)",
  },
  progressPillInactive: {
    width: 18,
    backgroundColor: "#E5E7EB",
  },
  centeredStepBody: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    justifyContent: "center",
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  stepHeader: {
    alignItems: "center",
    marginBottom: 6,
  },
  stepTitle: {
    fontFamily: "Fraunces_700Bold",
    fontSize: 28,
    color: BRAND_GREEN,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
  },
  emailPlainText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 280,
  },
  changeEmailLinkBtn: {
    marginTop: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  changeEmailLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
    textAlign: "center",
  },
  otpCenterBlock: {
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  bottomActions: {
    width: "100%",
    paddingTop: 8,
  },
  resendWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  resendPrompt: {
    fontSize: 13,
    color: "#6B7280",
  },
  resendBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: GREEN,
  },
});
