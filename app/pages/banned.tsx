// app/pages/banned.tsx
//
// Shown to users whose accounts have been banned by moderators or administrators.
// Minimalist, flat, and easy to read — matching app/pages/pending-approval.tsx.
// Supports formal appeal submission, real-time socket events, and auto-redirect upon reinstatement.

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AppState,
  type AppStateStatus,
  StatusBar,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert, Scale, LogOut, Clock, RefreshCw, X, AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/lib/auth/AuthContext';
import * as authApi from '@/lib/api/auth';
import * as moderationApi from '@/lib/api/moderation';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/Button';

const POLL_INTERVAL_MS = 4_000;
const GREEN = '#1A6B3C';
const RED = '#DC2626';

export default function BannedPage() {
  const { user, accessToken, completeLogin, refreshSession, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [banStatus, setBanStatus] = useState<moderationApi.BanStatusResponse | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealAffirmed, setAppealAffirmed] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCheckingRef = useRef(false);

  // Load ban details from backend
  const loadBanDetails = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await moderationApi.getBanStatus(accessToken);
      setBanStatus(data);
    } catch (err) {
      console.warn('[BannedPage] Failed to fetch ban details:', err);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadBanDetails();
  }, [loadBanDetails]);

  // Check if user has been unbanned
  const checkStatus = useCallback(async () => {
    if (isCheckingRef.current || !accessToken) return;
    isCheckingRef.current = true;
    setChecking(true);
    try {
      const session = await authApi.getSession(accessToken);
      const meta = session.user?.user_metadata;
      const isStillBanned = Boolean(
        meta?.is_banned === true ||
        meta?.status === 'banned' ||
        meta?.is_suspended === true ||
        meta?.status === 'suspended' ||
        (session.user as any)?.is_banned === true ||
        (session.user as any)?.status === 'banned' ||
        (session.user as any)?.is_suspended === true ||
        (session.user as any)?.status === 'suspended'
      );

      if (!isStillBanned) {
        // Reinstated! Refresh tokens and redirect to tabs
        const refreshed = await refreshSession().catch(() => null);
        const resolved = refreshed || session;
        await completeLogin(resolved);
        Alert.alert(
          'Account Reinstated',
          'Your account privileges have been restored. Welcome back to the Ally-jis community!'
        );
        router.replace('/(tabs)');
        return;
      }

      // If still banned, refresh the appeal / case status in background
      void loadBanDetails();
    } catch {
      // Silently ignore network errors during periodic polling
    } finally {
      isCheckingRef.current = false;
      setChecking(false);
    }
  }, [accessToken, completeLogin, refreshSession, loadBanDetails]);

  // 1. Real-time Socket.io listener for instant unban or appeal status update
  useEffect(() => {
    const socket = getSocket(accessToken);
    if (!socket) return;

    const handleUpdate = () => {
      void checkStatus();
    };

    socket.on('user:updated', handleUpdate);
    socket.on('profile:updated', handleUpdate);
    socket.on('user:banned', handleUpdate);
    socket.on('user:unbanned', handleUpdate);
    socket.on('user:suspended', handleUpdate);
    socket.on('user:unsuspended', handleUpdate);
    socket.on('report:appeal_submitted', handleUpdate);
    socket.on('user:appeal_submitted', handleUpdate);

    return () => {
      socket.off('user:updated', handleUpdate);
      socket.off('profile:updated', handleUpdate);
      socket.off('user:banned', handleUpdate);
      socket.off('user:unbanned', handleUpdate);
      socket.off('user:suspended', handleUpdate);
      socket.off('user:unsuspended', handleUpdate);
      socket.off('report:appeal_submitted', handleUpdate);
      socket.off('user:appeal_submitted', handleUpdate);
    };
  }, [accessToken, checkStatus]);

  // 2. Fast background polling
  useEffect(() => {
    intervalRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkStatus]);

  // 3. Foreground change re-check
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void checkStatus();
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [checkStatus]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/pages/onboarding' as any);
  };

  const handleContactSupport = () => {
    Linking.openURL(
      'mailto:support@ally-jis.com?subject=Conduct%20Sanction%20Appeal%20Inquiry'
    ).catch(() => { });
  };

  const handleOpenAppealModal = () => {
    setAppealText('');
    setAppealAffirmed(false);
    setModalVisible(true);
  };

  const handleSubmitAppeal = async () => {
    if (!appealText.trim() || appealText.trim().length < 20) {
      Alert.alert(
        'Statement Required',
        'Please provide at least 20 characters explaining your grounds for appeal.'
      );
      return;
    }
    if (!appealAffirmed) {
      Alert.alert(
        'Affirmation Required',
        'Please affirm that your statement is truthful and submitted in good faith.'
      );
      return;
    }

    setSubmittingAppeal(true);
    try {
      const res = await moderationApi.submitBanAppeal(
        appealText.trim(),
        accessToken as string,
        banStatus?.reportId || undefined
      );

      setModalVisible(false);
      setBanStatus((prev) =>
        prev
          ? {
            ...prev,
            appealSubmitted: true,
            appealDocketId: res.appealDocketId,
            appealStatement: appealText.trim(),
          }
          : null
      );

      Alert.alert(
        'Appeal Submitted',
        `Your formal appeal (${res.appealDocketId}) has been delivered to the Student Conduct Appeals Board for review.`
      );
    } catch (err: any) {
      Alert.alert(
        'Submission Failed',
        err?.message || 'Unable to submit appeal. Please check your network and try again.'
      );
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const isSuspended = Boolean(
    banStatus?.isSuspended ||
    banStatus?.status === 'suspended' ||
    (user as any)?.is_suspended ||
    (user as any)?.status === 'suspended' ||
    user?.user_metadata?.is_suspended ||
    user?.user_metadata?.status === 'suspended'
  );

  const formattedDate = banStatus?.bannedAt
    ? new Date(banStatus.bannedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    : 'Recent';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.content}>

        {/* Top spacer */}
        <View style={{ flex: 1, minHeight: 20 }} />

        {/* Shield Icon with Horizontal Line Alignment (matching pending-approval.tsx) */}
        <View style={styles.magnifierRow}>
          <View style={styles.hLine} />
          <View style={[styles.iconCircle, isSuspended && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <ShieldAlert size={30} color={isSuspended ? '#D97706' : RED} strokeWidth={2.4} />
          </View>
          <View style={styles.hLine} />
          <View style={styles.hLine} />
        </View>

        {/* Main Headings */}
        <View style={styles.headerArea}>
          <Text style={styles.title}>
            {isSuspended ? 'Account Temporarily Suspended' : 'Account Permanently Banned'}
          </Text>
          <Text style={styles.subtitle}>
            {isSuspended
              ? 'Your access to Ally-jis has been temporarily suspended due to violations of CHMSU Community Guidelines and student conduct policies.'
              : 'Your access to Ally-jis has been revoked due to serious violations of CHMSU Community Guidelines and student conduct policies.'}
          </Text>
        </View>

        {/* Sanction Details Card */}
        <View style={styles.detailsCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>SANCTION DOCKET</Text>
            <View style={styles.docketPill}>
              <Text style={styles.docketPillText}>
                {banStatus?.docketId || (isSuspended ? `CHMSU-SUSP-${user?.id?.slice(0, 8).toUpperCase() || 'OFFICIAL'}` : `CHMSU-BAN-${user?.id?.slice(0, 8).toUpperCase() || 'OFFICIAL'}`)}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Violation:</Text>
              <Text style={styles.detailValue} numberOfLines={1}>
                {banStatus?.violationLabel || 'Safety & Conduct Policy'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Enforced On:</Text>
              <Text style={styles.detailValue}>{formattedDate}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sanction:</Text>
              <View style={[styles.statusPill, isSuspended && { backgroundColor: '#FEF3C7' }]}>
                <View style={[styles.statusDot, isSuspended && { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.statusPillText, isSuspended && { color: '#B45309' }]}>
                  {isSuspended
                    ? (banStatus?.suspendedUntil
                      ? `Suspended until ${new Date(banStatus.suspendedUntil).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`
                      : 'Temporary Suspension')
                    : 'Permanent Ban'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.reasonText}>
              "{banStatus?.reason || (isSuspended
                ? 'Account privileges temporarily suspended following formal conduct investigation. Platform features are restricted during the suspension period.'
                : 'Account privileges terminated following formal conduct investigation. All platform privileges are terminated.')}"
            </Text>
          </View>
        </View>

        {/* Appeal Under Review Banner */}
        {banStatus?.appealSubmitted && (
          <View style={styles.appealReviewCard}>
            <View style={styles.appealHeaderRow}>
              <Clock size={16} color={GREEN} />
              <Text style={styles.appealHeaderText}>Appeal Under Review</Text>
              {banStatus.appealDocketId && (
                <View style={styles.appealDocketPill}>
                  <Text style={styles.appealDocketPillText}>{banStatus.appealDocketId}</Text>
                </View>
              )}
            </View>
            <Text style={styles.appealDescText}>
              Your formal appeal is currently being reviewed by the Conduct Appeals Board. You will be notified when a decision is rendered.
            </Text>
            {banStatus.appealStatement && (
              <View style={styles.appealQuoteBox}>
                <Text style={styles.appealQuoteText} numberOfLines={2}>
                  "{banStatus.appealStatement}"
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom spacer */}
        <View style={{ flex: 2, minHeight: 25 }} />

        {/* Action Area: Appeal button or Check Status + Sign out & Support Link */}
        <View style={styles.bottomArea}>
          {!banStatus?.appealSubmitted ? (
            <Button
              label="Submit Conduct Appeal"
              variant="primary"
              pill
              size="lg"
              onPress={handleOpenAppealModal}
              className="w-full"
            />
          ) : (
            <Button
              label={checking ? "Checking Status…" : "Check Appeal Status"}
              variant="primary"
              pill
              size="lg"
              disabled={checking}
              onPress={checkStatus}
              className="w-full"
            />
          )}

          <Button
            label="Sign out"
            variant="secondary"
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
              Questions regarding this decision?{' '}
              <Text style={styles.supportTextBold}>Contact safety desk</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Appeal Submission Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconCircle}>
                <Scale size={20} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Submit Conduct Appeal</Text>
                <Text style={styles.modalSubtitle}>
                  Docket: {banStatus?.docketId || 'Official Review'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Grounds for Appeal & Statement</Text>
            <TextInput
              style={styles.statementInput}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="State your explanation, context, and mitigating factors. Why should this sanction be reconsidered?"
              placeholderTextColor="#9CA3AF"
              value={appealText}
              onChangeText={setAppealText}
            />
            <View style={styles.charCountRow}>
              <Text style={styles.charCountText}>Minimum 20 characters</Text>
              <Text style={styles.charCountText}>{appealText.length} characters</Text>
            </View>

            <TouchableOpacity
              style={styles.affirmRow}
              activeOpacity={0.7}
              onPress={() => setAppealAffirmed(!appealAffirmed)}
            >
              <View style={[styles.checkbox, appealAffirmed && styles.checkboxChecked]}>
                {appealAffirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.affirmText}>
                I affirm that the information provided in this appeal statement is true, accurate, and submitted in good faith.
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={submittingAppeal}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.submitAppealButton,
                  (submittingAppeal || appealText.trim().length < 20 || !appealAffirmed) &&
                  styles.submitAppealButtonDisabled,
                ]}
                onPress={handleSubmitAppeal}
                disabled={submittingAppeal || appealText.trim().length < 20 || !appealAffirmed}
              >
                {submittingAppeal ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitAppealButtonText}>Submit Formal Appeal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  magnifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 14,
  },
  hLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: '#E5E7EB',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  headerArea: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
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
    fontSize: 13.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 320,
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    width: '100%',
    marginVertical: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
  },
  docketPill: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  docketPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#1F2937',
  },
  cardBody: {
    paddingVertical: 10,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    maxWidth: '65%',
    textAlign: 'right',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RED,
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: RED,
  },
  cardFooter: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  reasonText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#4B5563',
    lineHeight: 18,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appealReviewCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    padding: 14,
    width: '100%',
    marginTop: 10,
  },
  appealHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  appealHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  appealDocketPill: {
    marginLeft: 'auto',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  appealDocketPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: GREEN,
  },
  appealDescText: {
    fontSize: 12.5,
    color: '#166534',
    lineHeight: 18,
  },
  appealQuoteBox: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 8,
  },
  appealQuoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#374151',
  },
  bottomArea: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 12,
    gap: 12,
  },
  supportLink: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  supportText: {
    fontSize: 12.5,
    color: '#6B7280',
    textAlign: 'center',
  },
  supportTextBold: {
    color: GREEN,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  modalIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  closeBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  statementInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    padding: 12,
    fontSize: 13.5,
    color: '#111827',
    minHeight: 110,
    backgroundColor: '#F9FAFB',
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  charCountText: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  affirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  affirmText: {
    flex: 1,
    fontSize: 11.5,
    color: '#4B5563',
    lineHeight: 17,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  submitAppealButton: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitAppealButtonDisabled: {
    opacity: 0.5,
  },
  submitAppealButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

