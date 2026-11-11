// app/pages/verify-otp.tsx
//
// OTP verification screen for mobile.
// Params: userId, email (passed via router or AsyncStorage from register).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  BackHandler,
} from 'react-native';

import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Pencil } from 'lucide-react-native';
import * as authApi from '@/lib/api/auth';
import {
  getMobileRegisterCache,
  saveMobileRegisterCache,
  clearMobileRegisterCache,
} from '@/lib/registerCache';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { AnimatedOtpInput } from '@/components/AnimatedOtpInput';
import { ErrorAlertModal } from '@/components/ErrorAlertModal';
import { KeyboardHugView } from '@/components/KeyboardHugView';
import { useKeyboard } from '@/hooks/useKeyboard';

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
  const { isKeyboardVisible } = useKeyboard();

  const [userId, setUserId] = useState(params.userId ?? '');
  const [email, setEmail] = useState(params.email ?? '');

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCount, setResendCount] = useState(0);
  const [resendLimit, setResendLimit] = useState(3);
  const [cooldown, setCooldown] = useState(0);
  const [focusFirstTrigger, setFocusFirstTrigger] = useState(0);
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

      router.replace(isPending ? ('/pages/pending-approval' as any) : '/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? 'Incorrect code. Please try again.');
      setDigits(Array(OTP_LENGTH).fill(''));
      setFocusFirstTrigger((n) => n + 1);
    } finally {
      setIsVerifying(false);
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
      setFocusFirstTrigger((n) => n + 1);
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
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 12) }]}>
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

      <KeyboardHugView style={{ flex: 1 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' }}>
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

            {/* Animated OTP boxes */}
            <AnimatedOtpInput
              digits={digits}
              onChange={setDigits}
              onComplete={submitCode}
              onInputActivity={() => {
                if (error) setError('');
              }}
              disabled={isVerifying}
              focusFirstTrigger={focusFirstTrigger}
              boxWidth={BOX_SIZE}
              boxHeight={BOX_SIZE + 10}
              borderRadius={12}
              fontSize={BOX_FONT}
              filledBackgroundColor="#F0FDF4"
              containerStyle={styles.otpRow}
            />
          </ScrollView>

          {/* Bottom Area: Verify button + Didn't receive the code? + Resend with 00:00 timer */}
          <View
            style={[
              styles.bottomSection,
              {
                paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom + 12, 16),
              },
            ]}
          >
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
        </View>
      </KeyboardHugView>

      <ErrorAlertModal
        visible={Boolean(error)}
        title="Verification failed"
        message={error || null}
        onClose={() => {
          setError('');
          setFocusFirstTrigger((n) => n + 1);
        }}
      />
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
    flexGrow: 1,
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
    marginBottom: 20,
    width: '100%',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingTop: 12,
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
