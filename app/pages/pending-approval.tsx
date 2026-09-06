// app/pages/pending-approval.tsx
//
// Shown to external-email students whose student ID is pending admin review.
// They are hard-locked here via _layout.tsx routing until approved.
// Polls every 30s and auto-redirects to main tabs on approval.

import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth/AuthContext';
import * as authApi from '@/lib/api/auth';

export default function PendingApprovalPage() {
  const { user, accessToken, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const status: string = (user?.user_metadata?.student_verification_status as string) ?? 'pending';
  const isPending = status === 'pending' || !status;
  const isRejected = status === 'rejected';

  const checkStatus = async () => {
    if (checking || !accessToken) return;
    setChecking(true);
    try {
      const session = await authApi.getSession(accessToken);
      const updatedStatus = session.user?.user_metadata?.student_verification_status;
      const stillPending = session.user?.user_metadata?.pending_student_verification;

      if (!stillPending || updatedStatus === 'approved') {
        // Approved — navigate to main app
        router.replace('/(tabs)');
      }
    } catch {
      // Silently ignore — try again next tick
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    intervalRef.current = setInterval(checkStatus, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/pages/landing' as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top card */}
        <View style={[styles.card, isRejected ? styles.cardRejected : styles.cardPending]}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>{isRejected ? '✗' : '⏳'}</Text>
          </View>
          <Text style={styles.cardTitle}>
            {isRejected ? 'Verification Rejected' : 'Pending Approval'}
          </Text>
          <Text style={styles.cardSubtitle}>
            {isRejected
              ? 'Your student ID could not be verified.'
              : 'Your student ID is under review.'}
          </Text>
        </View>

        {/* Body */}
        <View style={styles.body}>
          {isPending && (
            <>
              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>What's happening?</Text>
                <Text style={styles.infoText}>
                  Our team is reviewing your uploaded student ID to verify if you are a bona fide
                  CHMSU student. This process usually takes <Text style={{ fontWeight: '700' }}>less than 24 hours</Text>.
                </Text>
              </View>

              <View style={styles.steps}>
                <Text style={styles.step}>✅ Email verified</Text>
                <Text style={styles.step}>✅ Student ID submitted</Text>
                <Text style={[styles.step, { color: '#F59E0B' }]}>⏳ Waiting for admin approval…</Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, checking && styles.btnDisabled]}
                onPress={checkStatus}
                disabled={checking}
                activeOpacity={0.8}
              >
                {checking
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnText}>Check Status Now</Text>
                }
              </TouchableOpacity>
            </>
          )}

          {isRejected && (
            <>
              <View style={[styles.infoBox, styles.infoBoxRejected]}>
                <Text style={[styles.infoTitle, { color: '#DC2626' }]}>Why was it rejected?</Text>
                <Text style={[styles.infoText, { color: '#7F1D1D' }]}>
                  Your student ID could not be verified. Please re-upload a clear, unobstructed
                  photo of your valid CHMSU student ID.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.btn, styles.btnRejected]}
                onPress={() => router.push('/pages/register' as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.btnText}>Re-upload Student ID</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={handleSignOut} activeOpacity={0.8}>
            <Text style={styles.btnOutlineText}>Sign out</Text>
          </TouchableOpacity>

          <Text style={styles.supportText}>
            Need help?{' '}
            <Text style={{ color: '#1A6B3C', textDecorationLine: 'underline' }}>
              Contact Support
            </Text>
          </Text>
        </View>

        <Text style={styles.brand}>Ally-jis</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F4EF' },
  scroll: { flexGrow: 1, padding: 20 },
  card: {
    borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24,
  },
  cardPending: { backgroundColor: '#F59E0B' },
  cardRejected: { backgroundColor: '#EF4444' },
  iconWrap: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 32, color: '#fff' },
  cardTitle: { fontSize: 22, fontFamily: 'Fraunces', fontWeight: '700', color: '#fff', marginBottom: 6, textAlign: 'center' },
  cardSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  body: { backgroundColor: '#fff', borderRadius: 24, padding: 24, gap: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  infoBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 16, padding: 14 },
  infoBoxRejected: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  infoTitle: { fontWeight: '700', fontSize: 13, color: '#92400E', marginBottom: 4 },
  infoText: { fontSize: 13, color: '#78350F', lineHeight: 20 },
  steps: { gap: 6 },
  step: { fontSize: 14, color: '#374151', fontWeight: '500' },
  btn: {
    paddingVertical: 14, borderRadius: 16, alignItems: 'center',
  },
  btnPrimary: { backgroundColor: '#F59E0B' },
  btnRejected: { backgroundColor: '#DC2626' },
  btnDisabled: { opacity: 0.6 },
  btnOutline: { borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: 'transparent' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14, fontFamily: 'PlusJakartaSans' },
  btnOutlineText: { color: '#6B7280', fontWeight: '600', fontSize: 14 },
  supportText: { textAlign: 'center', fontSize: 12, color: '#9CA3AF' },
  brand: { textAlign: 'center', marginTop: 28, fontFamily: 'Fraunces', color: '#9CA3AF', fontSize: 14 },
});
