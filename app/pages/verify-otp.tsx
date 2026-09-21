// app/pages/verify-otp.tsx
//
// OTP verification screen for mobile.
// Params: userId, email (passed via router or AsyncStorage from register).
// ─ Auto-advances on each digit input
// ─ Supports paste of full 6-digit code
// ─ Responsive box sizing based on screen width

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, Dimensions, Clipboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AlertCircle, ClipboardPaste } from 'lucide-react-native';
import * as authApi from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthContext';
import { OtpIllustration } from '@/components/OnboardingIllustrations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive box: fits 6 boxes + gaps in any screen width
const BOX_GAP = 8;
const CARD_PADDING = 24 * 2;
const BOX_SIZE = Math.min(
  Math.floor((SCREEN_WIDTH - CARD_PADDING - BOX_GAP * (OTP_LENGTH - 1)) / OTP_LENGTH),
  48, // cap so it doesn't grow huge on tablets
);
const BOX_FONT = Math.round(BOX_SIZE * 0.44);

const GREEN = '#1A6B3C';

export default function VerifyOtpPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId: string; email: string }>();
  const { completeLogin } = useAuth();

  const userId = params.userId ?? '';
  const email = params.email ?? '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCount, setResendCount] = useState(0);
  const [resendLimit, setResendLimit] = useState(3);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load OTP status on mount
  useEffect(() => {
    if (!userId) return;
    authApi.getOtpStatus(userId)
      .then((s) => { setResendCount(s.resendCount); setResendLimit(s.resendLimit); })
      .catch(() => {});
  }, [userId]);

  // Focus first box
  useEffect(() => {
    setTimeout(() => inputsRef.current[0]?.focus(), 300);
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const submitCode = async (code: string) => {
    if (isVerifying || code.length < OTP_LENGTH) return;
    setIsVerifying(true);
    setError('');
    try {
      const session = await authApi.verifyOtp(userId, code);
      await completeLogin(session);

      const userNeedsOnboarding = !session.user?.user_metadata?.onboarding_complete;
      if (userNeedsOnboarding) {
        router.replace({ pathname: '/pages/register' as any, params: { startStep: '2' } });
        return;
      }

      const isPending =
        session.user?.user_metadata?.pending_student_verification === true &&
        session.user?.user_metadata?.student_verification_status !== 'approved';

      router.replace(isPending ? ('/pages/pending-approval' as any) : '/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Incorrect code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle single digit input — auto-advance to next box
  const handleDigitChange = (idx: number, value: string) => {
    setError('');

    // Support paste of full code into any box
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= OTP_LENGTH) {
      const next = cleaned.slice(0, OTP_LENGTH).split('');
      setDigits(next);
      inputsRef.current[OTP_LENGTH - 1]?.focus();
      submitCode(next.join(''));
      return;
    }

    // Single digit — take last char typed (handles both empty and fill)
    const singleDigit = cleaned.slice(-1);
    const next = [...digits];
    next[idx] = singleDigit;
    setDigits(next);

    // Auto-advance
    if (singleDigit && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }

    // Auto-submit when all filled
    if (singleDigit && next.every(Boolean)) {
      submitCode(next.join(''));
    }
  };

  const handleKeyPress = (idx: number, key: string) => {
    if (key === 'Backspace' && !digits[idx] && idx > 0) {
      const next = [...digits];
      next[idx - 1] = '';
      setDigits(next);
      inputsRef.current[idx - 1]?.focus();
    }
  };

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getString();
      const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (cleaned.length > 0) {
        const next = cleaned.padEnd(OTP_LENGTH, '').split('').slice(0, OTP_LENGTH);
        setDigits(next);
        inputsRef.current[Math.min(cleaned.length, OTP_LENGTH - 1)]?.focus();
        if (cleaned.length === OTP_LENGTH) submitCode(cleaned);
      }
    } catch {}
  };

  const handleResend = async () => {
    if (isResending || cooldown > 0 || resendCount >= resendLimit) return;
    setIsResending(true);
    setError('');
    try {
      const result = await authApi.resendOtp(userId);
      setResendCount(result.resendCount);
      setResendLimit(result.resendLimit);
      setDigits(Array(OTP_LENGTH).fill(''));
      inputsRef.current[0]?.focus();
      startCooldown();
    } catch (err: any) {
      setError(err?.message ?? 'Could not resend code.');
    } finally {
      setIsResending(false);
    }
  };

  if (!userId || !email) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Invalid verification link. Please register again.</Text>
        <TouchableOpacity onPress={() => router.replace('/pages/register')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Go to Registration</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const fullCode = digits.join('');
  const canVerify = fullCode.length === OTP_LENGTH && !isVerifying;
  const canResend = !isResending && cooldown === 0 && resendCount < resendLimit;
  const resendsLeft = resendLimit - resendCount;
  const illustrationSize = Math.min(SCREEN_WIDTH * 0.38, 150);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 20) }]}>
          <TouchableOpacity
            onPress={() => router.canGoBack() ? router.back() : router.replace('/pages/register' as any)}
            style={styles.backBtn}
          >
            <ArrowLeft size={18} color="#374151" />
          </TouchableOpacity>

          <View style={styles.illustrationWrap}>
            <OtpIllustration size={illustrationSize} />
          </View>

          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <View style={styles.dotsRow}>
            {[1, 2].map((i) => (
              <View key={i} style={[styles.dot, i === 1 ? styles.dotDone : styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.instructionRow}>
            <Text style={styles.instruction}>
              Enter the code below — expires in{' '}
              <Text style={{ fontWeight: '700', color: '#111827' }}>10 minutes</Text>.
            </Text>
            {/* Paste button */}
            <TouchableOpacity onPress={handlePaste} style={styles.pasteBtn} hitSlop={8}>
              <ClipboardPaste size={15} color={GREEN} />
              <Text style={styles.pasteBtnText}>Paste</Text>
            </TouchableOpacity>
          </View>

          {/* OTP boxes */}
          <View style={styles.otpRow}>
            {digits.map((d, i) => (
              <TextInput
                key={i}
                ref={(el) => { inputsRef.current[i] = el; }}
                style={[
                  styles.otpBox,
                  d ? styles.otpBoxFilled : null,
                  error ? styles.otpBoxError : null,
                ]}
                value={d}
                onChangeText={(v) => handleDigitChange(i, v)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
                keyboardType="number-pad"
                maxLength={6} // allow paste of full code
                textAlign="center"
                editable={!isVerifying}
                selectTextOnFocus
                caretHidden
              />
            ))}
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <AlertCircle size={14} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          {/* Verify button */}
          <TouchableOpacity
            onPress={() => submitCode(fullCode)}
            disabled={!canVerify}
            style={[styles.verifyBtn, !canVerify && styles.verifyBtnDisabled]}
            activeOpacity={0.85}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify Email</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendSection}>
            {resendCount >= resendLimit ? (
              <Text style={styles.resendLimitText}>Maximum resends reached. Contact support.</Text>
            ) : (
              <>
                <Text style={styles.resendHint}>
                  {resendsLeft} resend{resendsLeft !== 1 ? 's' : ''} remaining
                </Text>
                <TouchableOpacity onPress={handleResend} disabled={!canResend}>
                  <Text style={[styles.resendBtn, !canResend && styles.resendBtnDisabled]}>
                    {cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? 'Sending…' : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={styles.spamHint}>Check your spam folder if you don't see the email.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: {
    alignSelf: 'flex-start',
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  illustrationWrap: { marginBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 5,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'center',
  },
  emailHighlight: { color: GREEN, fontWeight: '700' },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  dot: { height: 7, borderRadius: 4 },
  dotDone: { width: 7, backgroundColor: GREEN },
  dotActive: { width: 20, backgroundColor: GREEN },
  card: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  instruction: { fontSize: 12, color: '#6B7280', lineHeight: 18, flex: 1 },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginLeft: 8,
  },
  pasteBtnText: { fontSize: 11, color: GREEN, fontWeight: '700' },
  otpRow: {
    flexDirection: 'row',
    gap: BOX_GAP,
    justifyContent: 'center',
    marginBottom: 14,
  },
  otpBox: {
    width: BOX_SIZE,
    height: BOX_SIZE + 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    fontSize: BOX_FONT,
    fontWeight: '700',
    color: '#111827',
  },
  otpBoxFilled: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  otpBoxError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorBannerText: { fontSize: 12, color: '#DC2626', flex: 1 },
  verifyBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyBtnDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  resendSection: {
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  resendHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 5 },
  resendBtn: { fontSize: 13, color: GREEN, fontWeight: '600' },
  resendBtnDisabled: { color: '#9CA3AF' },
  resendLimitText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  spamHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  linkBtn: { paddingVertical: 8 },
  linkText: { color: GREEN, fontWeight: '600', textDecorationLine: 'underline' },
});
