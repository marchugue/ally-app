// app/pages/verify-otp.tsx
//
// OTP verification screen for mobile.
// Params: userId, email (passed via router or AsyncStorage from register).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Mail, AlertCircle } from 'lucide-react-native';
import * as authApi from '@/lib/api/auth';
import { useAuth } from '@/lib/auth/AuthContext';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function VerifyOtpPage() {
  const router = useRouter();
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

      // Non-CHMSU students who uploaded a student ID must wait for admin approval.
      // Check pending_student_verification injected into user_metadata by buildAuthSession.
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

  const handleDigitChange = (idx: number, value: string) => {
    setError('');
    const cleaned = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = cleaned;
    setDigits(next);
    if (cleaned && idx < OTP_LENGTH - 1) {
      inputsRef.current[idx + 1]?.focus();
    }
    if (cleaned && next.every(Boolean)) {
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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.iconWrap}>
            <Mail size={28} color="#fff" />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailText}>{email}</Text>
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.instruction}>
            Enter the code below. It expires in <Text style={{ fontWeight: '700' }}>10 minutes</Text>.
          </Text>

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
                maxLength={1}
                textAlign="center"
                editable={!isVerifying}
                selectTextOnFocus
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
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <Text style={styles.spamHint}>Check your spam folder if you don't see the email.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#1A6B3C';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F4EF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: {
    backgroundColor: GREEN,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  backBtn: { marginBottom: 20 },
  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
  emailText: { color: '#fff', fontWeight: '700' },
  card: {
    margin: 20, backgroundColor: '#fff',
    borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
  },
  instruction: { fontSize: 13, color: '#6B7280', marginBottom: 20, lineHeight: 20 },
  otpRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 16 },
  otpBox: {
    width: 46, height: 56, borderRadius: 14, borderWidth: 2,
    borderColor: '#E2DED7', backgroundColor: '#F7F4EF',
    fontSize: 22, fontWeight: '700', color: '#111827',
  },
  otpBoxFilled: { borderColor: GREEN, backgroundColor: '#F0FDF4' },
  otpBoxError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 10, padding: 10, marginBottom: 16,
  },
  errorBannerText: { fontSize: 12, color: '#DC2626', flex: 1 },
  verifyBtn: {
    backgroundColor: GREEN, borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  verifyBtnDisabled: { backgroundColor: '#D1D5DB' },
  verifyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resendSection: { alignItems: 'center', paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0EDE8' },
  resendHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 6 },
  resendBtn: { fontSize: 13, color: GREEN, fontWeight: '600' },
  resendBtnDisabled: { color: '#9CA3AF' },
  resendLimitText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  spamHint: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 12, paddingHorizontal: 24 },
  errorText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 12 },
  linkBtn: { paddingVertical: 8 },
  linkText: { color: GREEN, fontWeight: '600', textDecorationLine: 'underline' },
});
