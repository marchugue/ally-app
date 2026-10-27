// app/pages/pending-approval.tsx
//
// Shown to external-email students whose student ID is pending admin review.
// Minimalist, pure white background design with no container boxes.

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  AppState,
  type AppStateStatus,
  StatusBar,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useAuth } from '@/lib/auth/AuthContext';
import * as authApi from '@/lib/api/auth';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/Button';

const POLL_INTERVAL_MS = 3_000; // 3s fast poll fallback for near-realtime detection
const GREEN = '#1A6B3C';

export default function PendingApprovalPage() {
  const { user, accessToken, completeLogin, refreshSession, signOut } = useAuth();
  const [, setChecking] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);

  const status: string = (user?.user_metadata?.student_verification_status as string) ?? 'pending';
  const isRejected = status === 'rejected';
  const hasStudentId = Boolean(
    user?.user_metadata?.student_id_url || (user as any)?.student_id_url
  );

  const checkStatus = async () => {
    if (isCheckingRef.current || !accessToken) return;
    isCheckingRef.current = true;
    setChecking(true);
    try {
      const session = await authApi.getSession(accessToken);
      const meta = session.user?.user_metadata;
      const updatedStatus = meta?.student_verification_status;
      const isApproved = Boolean(
        meta?.is_approved ||
        meta?.admin_verified ||
        updatedStatus === 'approved' ||
        meta?.chmsu_auto_verified ||
        (meta?.email_type && meta.email_type !== 'external')
      );

      if (isApproved) {
        // Approved — refresh session with backend to acquire fresh JWT and updated claims
        const refreshed = await refreshSession().catch(() => null);
        const resolvedSession = refreshed || session;
        await completeLogin(resolvedSession);
        router.replace('/(tabs)');
        return;
      }

      if (updatedStatus === 'rejected') {
        await completeLogin(session);
      }
    } catch {
      // Silently ignore network errors — try again next tick
    } finally {
      isCheckingRef.current = false;
      setChecking(false);
    }
  };

  // 1. Real-time Socket.io listener for instant wakeup when approved on the spot
  useEffect(() => {
    const socket = getSocket(accessToken);
    if (!socket) return;

    const handleVerificationEvent = (payload: any) => {
      if (
        payload?.is_approved ||
        payload?.status === 'approved' ||
        payload?.student_verification_status === 'approved' ||
        payload?.admin_verified
      ) {
        void checkStatus();
      }
    };

    socket.on('user:verification_status', handleVerificationEvent);
    socket.on('user:updated', handleVerificationEvent);
    socket.on('profile:updated', handleVerificationEvent);

    return () => {
      socket.off('user:verification_status', handleVerificationEvent);
      socket.off('user:updated', handleVerificationEvent);
      socket.off('profile:updated', handleVerificationEvent);
    };
  }, [accessToken]);

  // 2. Fast background polling fallback
  useEffect(() => {
    void checkStatus();
    intervalRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [accessToken]);

  // 3. Foreground change re-check
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void checkStatus();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [accessToken]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/pages/landing' as any);
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@ally-jis.com?subject=Student%20Verification%20Inquiry').catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top spacer */}
        <View style={{ flex: 1, minHeight: 40 }} />

        {/* Magnifying Glass Icon with Horizontal Line Alignment */}
        <View style={styles.magnifierRow}>
          <View style={styles.hLine} />
          <View style={styles.iconCircle}>
            <Search size={26} color={GREEN} strokeWidth={2.4} />
          </View>
          <View style={styles.hLine} />
        </View>

        {/* Main Headings */}
        <View style={styles.headerArea}>
          <Text style={styles.title}>
            {isRejected ? 'Verification Rejected' : 'Your account is under review'}
          </Text>
          <Text style={styles.subtitle}>
            {isRejected
              ? 'Your student ID could not be verified. Please contact campus support for enrollment assistance.'
              : 'Our administrators are verifying your student credentials. You will gain full access to the campus community as soon as review is complete.'}
          </Text>
        </View>

        {/* Bottom spacer */}
        <View style={{ flex: 2, minHeight: 40 }} />

        {/* Action Area: Upload ID (if missing or rejected) + Sign out & Support Link */}
        <View style={styles.bottomArea}>
          {(!hasStudentId || isRejected) && (
            <Button
              label={!hasStudentId ? "Upload Student ID Now" : "Re-upload Student ID"}
              variant="primary"
              pill
              size="lg"
              onPress={() => router.push("/pages/id-upload" as any)}
              className="w-full"
            />
          )}

          <Button
            label="Sign out"
            variant={!hasStudentId || isRejected ? "secondary" : "primary"}
            pill
            size="lg"
            onPress={handleSignOut}
            className="w-full"
          />

          <TouchableOpacity
            onPress={handleContactSupport}
            style={styles.supportLink}
            activeOpacity={0.7}
          >
            <Text style={styles.supportText}>
              Need help?{' '}
              <Text style={styles.supportTextBold}>Contact support</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  magnifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 16,
  },
  hLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E5E7EB',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  headerArea: {
    alignItems: 'center',
    marginTop: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 16,
    gap: 16,
  },
  supportLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  supportText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  supportTextBold: {
    color: GREEN,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
