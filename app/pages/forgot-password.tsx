import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StyleSheet,
} from "react-native";
import { router } from "expo-router";
import {
  ArrowLeft,
  ArrowRight,
  KeyRound,
  CheckCircle,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import EmailInput from "@/components/buttons/email";
import PasswordInput from "@/components/buttons/password";
import AlertMessage from "@/components/AlertMessage";
import { KeyboardHugView } from "@/components/KeyboardHugView";
import { useKeyboard } from "@/hooks/useKeyboard";
import { validateEmail } from "@/lib/validator";
import { validatePass } from "@/lib/validator/password";
import * as authApi from "@/lib/api/auth";
import {
  EmailSelectIllustration,
  OtpIllustration,
} from "@/components/OnboardingIllustrations";

type ResetStep = "email" | "otp" | "new_password";
const OTP_LENGTH = 6;
const GREEN = "#1A6B3C";
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { isKeyboardVisible } = useKeyboard();

  const [step, setStep] = useState<ResetStep>("email");
  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputsRef = useRef<Array<TextInput | null>>([]);
  const cooldownTimerRef = useRef<any>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const passwordYRef = useRef(0);
  const confirmPasswordYRef = useRef(0);

  const [focusedField, setFocusedField] = useState<"password" | "confirmPassword" | null>(null);

  const isPasswordOrConfirmFocused =
    step === "new_password" &&
    (focusedField === "password" || focusedField === "confirmPassword");

  const handleInputFocus = (field: "password" | "confirmPassword") => {
    setFocusedField(field);

    if (field === "password") {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: passwordYRef.current, animated: true });
      });
    } else if (field === "confirmPassword") {
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollTo({ y: confirmPasswordYRef.current, animated: true });
      });
    }
  };

  // Restore scroll and reset focus state when keyboard closes
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

  function startResendCooldown() {
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setResendCooldown(60);
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

  // ── Step 1: Request OTP Code ───────────────────────────────────────────────
  async function handleSendCode() {
    const err = validateEmail(email, "any");
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setStep("otp");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      startResendCooldown();
      setTimeout(() => {
        inputsRef.current[0]?.focus();
      }, 300);
    } catch (err: any) {
      setError(err?.message || "Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Resend Code ────────────────────────────────────────────────────────────
  async function handleResend() {
    if (loading || resendCooldown > 0 || !email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await authApi.forgotPassword(email.trim().toLowerCase());
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      startResendCooldown();
      inputsRef.current[0]?.focus();
    } catch (err: any) {
      setError(err?.message || "Could not resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── OTP Digit Input Handlers ───────────────────────────────────────────────
  function handleDigitChange(idx: number, value: string) {
    setError("");
    const cleaned = value.replace(/\D/g, "");

    // Multi-digit / Paste handling
    if (cleaned.length >= OTP_LENGTH) {
      const next = cleaned.slice(0, OTP_LENGTH).split("");
      setOtpDigits(next);
      inputsRef.current[OTP_LENGTH - 1]?.focus();
      handleVerifyOtp(cleaned.slice(0, OTP_LENGTH));
      return;
    }

    const single = cleaned.slice(-1);
    const next = [...otpDigits];
    next[idx] = single;
    setOtpDigits(next);

    // Auto-advance
    if (single && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }

    // Auto-verify when all 6 filled
    if (single && next.every(Boolean)) {
      handleVerifyOtp(next.join(""));
    }
  }

  function handleKeyPress(idx: number, key: string) {
    if (key === "Backspace" && !otpDigits[idx] && idx > 0) {
      const next = [...otpDigits];
      next[idx - 1] = "";
      setOtpDigits(next);
      inputsRef.current[idx - 1]?.focus();
    }
  }

  // ── Step 2: Verify OTP Code ────────────────────────────────────────────────
  async function handleVerifyOtp(codeToVerify: string) {
    if (loading) return;
    const code = codeToVerify.trim();
    if (code.length !== OTP_LENGTH) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await authApi.verifyPasswordResetOtp(email.trim().toLowerCase(), code);
      setStep("new_password");
    } catch (err: any) {
      setError(err?.message || "Invalid or expired verification code.");
      setOtpDigits(Array(OTP_LENGTH).fill(""));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  // ── Step 3: Complete Reset ─────────────────────────────────────────────────
  async function handleCompleteReset() {
    const pwErr = validatePass(newPassword);
    if (pwErr) {
      setError(pwErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await authApi.resetPassword({
        email: email.trim().toLowerCase(),
        code: otpDigits.join(""),
        password: newPassword,
      });

      router.replace("/pages/password-reset-success" as any);
    } catch (err: any) {
      setError(err?.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setError("");
    setFocusedField(null);
    if (step === "new_password") {
      setStep("otp");
      return;
    }
    if (step === "otp") {
      setStep("email");
      return;
    }
    router.back();
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <StatusBar barStyle="dark-content" />

      <KeyboardHugView style={{ flex: 1 }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 620, alignSelf: "center" }}>
          {/* ── Header ── */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: 10,
              backgroundColor: "#FFFFFF",
            }}
          >
            {/* Header row: green arrow back (left, no border) + Title (center) */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Pressable
                onPress={handleBack}
                hitSlop={14}
                style={{
                  width: 40,
                  height: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityLabel="Go back"
              >
                <ArrowLeft size={24} color={GREEN} />
              </Pressable>

              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: "#111827",
                  textAlign: "center",
                  letterSpacing: -0.4,
                }}
              >
                {step === "email" && "Reset Password"}
                {step === "otp" && "Check your email"}
                {step === "new_password" && "Create new password"}
              </Text>

              {/* Balanced spacer so title is centered */}
              <View style={{ width: 40 }} />
            </View>

            {error ? (
              <View style={{ marginTop: 10, width: "100%" }}>
                <AlertMessage message={error} type="error" />
              </View>
            ) : null}
          </View>

          {/* ── Scrollable Body ── */}
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1, backgroundColor: "#FFFFFF" }}
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: isPasswordOrConfirmFocused ? SCREEN_WIDTH * 0.9 : 24,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEnabled={!isPasswordOrConfirmFocused}
          >
            {/* STEP 1: Email Form */}
            {step === "email" && (
              <View>
                <View style={{ alignItems: "center", marginVertical: 12 }}>
                  <EmailSelectIllustration size={160} />
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#6B7280",
                      textAlign: "center",
                      lineHeight: 20,
                      marginTop: 16,
                      marginBottom: 8,
                      paddingHorizontal: 8,
                    }}
                  >
                    Enter your registered university email below. We&apos;ll send a 6-digit verification code to reset your password.
                  </Text>
                </View>

                <EmailInput
                  value={email}
                  onChangeText={(val) => {
                    setEmail(val);
                    setError("");
                  }}
                  placeholder="yourname@chmsu.edu.ph"
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                />
              </View>
            )}

            {/* STEP 2: OTP Verification */}
            {step === "otp" && (
              <View style={{ alignItems: "center" }}>
                <View style={{ marginVertical: 8 }}>
                  <OtpIllustration size={150} />
                </View>

                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: "800",
                    color: "#111827",
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  We just sent a verification code
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    textAlign: "center",
                    marginTop: 4,
                  }}
                >
                  Enter the 6-digit code sent to
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: GREEN,
                    textAlign: "center",
                    marginBottom: 18,
                  }}
                >
                  {email}
                </Text>

                {/* 6 OTP Boxes */}
                <View style={styles.otpContainer}>
                  {otpDigits.map((digit, idx) => (
                    <TextInput
                      key={idx}
                      ref={(el) => {
                        inputsRef.current[idx] = el;
                      }}
                      value={digit}
                      onChangeText={(val) => handleDigitChange(idx, val)}
                      onKeyPress={({ nativeEvent }) => handleKeyPress(idx, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={6}
                      textAlign="center"
                      editable={!loading}
                      selectTextOnFocus
                      caretHidden
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : styles.otpBoxEmpty,
                      ]}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* STEP 3: Create New Password */}
            {step === "new_password" && (
              <View style={{ paddingTop: 8 }}>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 18,
                      backgroundColor: `${GREEN}15`,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                    }}
                  >
                    <KeyRound size={26} color={GREEN} />
                  </View>
                  <Text style={{ fontSize: 13, color: "#6B7280", textAlign: "center", paddingHorizontal: 12 }}>
                    Your new password must be secure and meet all password criteria below.
                  </Text>
                </View>

                <View
                  onLayout={(e) => {
                    passwordYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <PasswordInput
                    ref={passwordInputRef}
                    value={newPassword}
                    onChangeText={(val) => {
                      setNewPassword(val);
                      setError("");
                    }}
                    onFocus={() => handleInputFocus("password")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter new password"
                    showStrength={true}
                    containerStyle={{ marginBottom: 16 }}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  />
                </View>

                <View
                  onLayout={(e) => {
                    confirmPasswordYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <PasswordInput
                    ref={confirmPasswordInputRef}
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      setError("");
                    }}
                    onFocus={() => handleInputFocus("confirmPassword")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Confirm new password"
                    showStrength={false}
                    containerStyle={{ marginBottom: 16 }}
                    returnKeyType="done"
                    onSubmitEditing={handleCompleteReset}
                  />
                </View>
              </View>
            )}
          </ScrollView>

          {/* ── Fixed Footer ── */}
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 10,
              paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16),
              backgroundColor: "#FFFFFF",
            }}
          >
            {/* Primary Action Button */}
            {step === "email" && (
              <Button
                label={loading ? "Sending code…" : "Send Reset Code"}
                variant="primary"
                pill
                size="lg"
                loading={loading}
                disabled={loading || !email.trim()}
                icon={<ArrowRight size={16} color="#FFFFFF" />}
                onPress={handleSendCode}
                className="w-full"
              />
            )}

            {step === "otp" && (
              <>
                <Button
                  label={loading ? "Verifying…" : "Verify Code"}
                  variant="primary"
                  pill
                  size="lg"
                  loading={loading}
                  disabled={loading || !otpDigits.every(Boolean)}
                  onPress={() => handleVerifyOtp(otpDigits.join(""))}
                  className="w-full"
                />

                {/* Resend under verify button */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "center",
                    alignItems: "center",
                    marginTop: 14,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 13, color: "#6B7280" }}>
                    Didn&apos;t receive code?
                  </Text>
                  {resendCooldown > 0 ? (
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#9CA3AF" }}>
                      Resend in {resendCooldown}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: GREEN }}>
                        Resend
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setStep("email");
                    setError("");
                  }}
                  style={{ marginTop: 8, padding: 4 }}
                >
                  <Text style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
                    ← Change email address
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {step === "new_password" && (
              <Button
                label={
                  loading
                    ? "Updating password…"
                    : focusedField === "password"
                    ? "Next"
                    : "Reset Password"
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
            )}

            {!isKeyboardVisible && step === "email" && (
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  marginTop: 14,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 13, color: "#6B7280" }}>
                  Remember your password?
                </Text>
                <Pressable onPress={() => router.replace("/pages/login")}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: GREEN }}>
                    Sign in
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </KeyboardHugView>
    </View>
  );
}

const styles = StyleSheet.create({
  otpContainer: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 18,
    justifyContent: "center",
  },
  otpBox: {
    width: 46,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
  },
  otpBoxFilled: {
    borderColor: GREEN,
    backgroundColor: "#F0FDF4",
    color: GREEN,
  },
  otpBoxEmpty: {
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    color: "#111827",
  },
});
