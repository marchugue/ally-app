// app/pages/verify-otp.tsx
//
// OTP verification screen for mobile.
// Params: userId, email (passed via router or AsyncStorage from register).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Clipboard,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, AlertCircle, Pencil } from 'lucide-react-native';
import * as authApi from '@/lib/api/auth';
import {
  getMobileRegisterCache,
  saveMobileRegisterCache,
  clearMobileRegisterCache,
} from '@/lib/registerCache';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive box: fits 6 boxes + gaps on any screen width
const BOX_GAP = 8;
const HORIZONTAL_PADDING = 24 * 2;
const BOX_SIZE = Math.min(
  Math.floor((SCREEN_WIDTH - HORIZONTAL_PADDING - BOX_GAP * (OTP_LENGTH - 1)) / OTP_LENGTH),
  48
);
const BOX_FONT = Math.round(BOX_SIZE * 0.44);

const GREEN = '#1A6B3C';

function formatTimer(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VerifyOtpPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId: string; email: string }>();
  const { completeLogin } = useAuth();

  const [userId, setUserId] = useState(params.userId ?? '');
  const [email, setEmail] = useState(params.email ?? '');

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCount, setResendCount] = useState(0);
  const [resendLimit, setResendLimit] = useState(3);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVerifiedRef = useRef<boolean>(false);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/pages/register' as any);
    }
  }, [router]);

  // Intercept hardware back button on Android
  useEffect(() => {
    const onBackPress = () => {
      handleBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  // Restore and persist verification cache (does not cancel on unmount or navigation)
  useEffect(() => {
    if (params.userId) {
      setUserId(params.userId);
      saveMobileRegisterCache({ registeredUserId: params.userId, showOtpView: true });
    }
    if (params.email) {
      setEmail(params.email);
    }
    if (!params.userId) {
      getMobileRegisterCache().then((cached) => {
        if (cached?.registeredUserId) {
          setUserId(cached.registeredUserId);
          if (cached.form?.email) setEmail(cached.form.email);
        }
      }).catch(() => {});
    }
  }, [params.userId, params.email]);

  // Load OTP status on mount
  useEffect(() => {
    if (!userId) return;
    authApi.getOtpStatus(userId)
      .then((s) => {
        setResendCount(s.resendCount);
        setResendLimit(s.resendLimit);
        if (s.verified) {
          isVerifiedRef.current = true;
        }
      })
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
      isVerifiedRef.current = true;
      await completeLogin(session);
      await clearMobileRegisterCache();

      const hasMetadata = Boolean(
        (session.user?.user_metadata?.course || session.user?.user_metadata?.department) &&
        session.user?.user_metadata?.year_level
      );

      const userNeedsOnboarding = Boolean(
        !session.user?.user_metadata?.onboarding_complete && !hasMetadata
      );
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

    // Single digit — take last char typed
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

  const handleEditEmail = () => {
    router.push({
      pathname: '/pages/register' as any,
      params: {
        ...params,
        step: '1',
        subStep: 'email',
      },
    });
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

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Top Bar with Back Button */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={14}
          style={styles.backBtn}
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={GREEN} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title & Subtitle */}
          <View style={styles.headerContent}>
            <Text style={styles.title}>We just sent a 6-digit code</Text>
            <Text style={styles.subtitle}>Enter the 6-digit code we sent to</Text>
            <View style={styles.emailRow}>
              <Text style={styles.emailHighlight}>{email}</Text>
              <TouchableOpacity
                onPress={handleEditEmail}
                hitSlop={12}
                accessibilityLabel="Edit email"
                style={styles.editPenBtn}
              >
                <Pencil size={15} color={GREEN} />
              </TouchableOpacity>
            </View>
          </View>

          {/* OTP boxes (blended to white screen, no container) */}
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
                maxLength={6}
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
        </ScrollView>

        {/* Bottom Area: Verify button + Didn't receive the code? + Resend with 00:00 timer */}
        <View style={styles.bottomSection}>
          <Button
            label={isVerifying ? "Verifying…" : "Verify"}
            variant="primary"
            pill
            size="lg"
            loading={isVerifying}
            disabled={!canVerify || isVerifying}
            onPress={() => submitCode(fullCode)}
            className="w-full"
          />

          <View style={styles.resendArea}>
            {resendCount >= resendLimit ? (
              <Text style={styles.resendLimitText}>Maximum resends reached. Contact support.</Text>
            ) : (
              <View style={styles.resendInner}>
                <Text style={styles.didntReceiveText}>
                  Didn&apos;t receive the code?
                </Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={!canResend}
                  style={styles.resendBtnTouch}
                >
                  <Text
                    style={[
                      styles.resendText,
                      !canResend && styles.resendTextDisabled,
                    ]}
                  >
                    Resend ({formatTimer(cooldown)})
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    paddingHorizontal: 20,
    height: 48,
    justifyContent: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  emailHighlight: {
    fontSize: 14,
    color: GREEN,
    fontWeight: '700',
  },
  editPenBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    gap: BOX_GAP,
    justifyContent: 'center',
    marginBottom: 20,
    width: '100%',
  },
  otpBox: {
    width: BOX_SIZE,
    height: BOX_SIZE + 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    fontSize: BOX_FONT,
    fontWeight: '700',
    color: '#111827',
  },
  otpBoxFilled: {
    borderColor: GREEN,
    backgroundColor: '#F0FDF4',
  },
  otpBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    width: '100%',
  },
  errorBannerText: {
    fontSize: 12,
    color: '#DC2626',
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  resendArea: {
    alignItems: 'center',
    marginTop: 14,
  },
  resendInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  didntReceiveText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  resendBtnTouch: {
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  resendText: {
    fontSize: 13,
    fontWeight: '700',
    color: GREEN,
    textAlign: 'center',
  },
  resendTextDisabled: {
    color: '#9CA3AF',
  },
  resendLimitText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  linkBtn: {
    paddingVertical: 8,
  },
  linkText: {
    color: GREEN,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
