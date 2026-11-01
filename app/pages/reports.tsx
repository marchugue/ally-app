// mobile/app/pages/reports.tsx
//
// Safety & Report Center for Ally-jis mobile.
// Synchronized with the web ReportPage:
//  - Ticket list with status filters (All, In Review, Resolved, Pending) and search
//  - Responsive master-detail split (Tickets List -> Agent Conversation drill-down)
//  - Ally Safety Agent conversation interface with online indicator and reference copy
//  - Visual vertical milestone progression stepper (Report submitted -> Review -> Evaluation -> Action)
//  - Incident Notice & Reassuring Reporter statement differentiation
//  - Attached Post card preview (author, time ago, content, images, likes count)
//  - Action Taken sanction card & Conduct Appeal modal

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  StatusBar,
  Dimensions,
  AppState,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  FileText,
  Copy,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Heart,
  Scale,
  ChevronRight,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { getSocket } from '@/lib/socket';
import { getMyReports, submitReportAppeal } from '@/lib/api/moderation';

const GREEN = '#1A6B3C';
const EMERALD = '#10B981';
const AMBER = '#D97706';
const RED = '#DC2626';

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
export type TargetKind = 'post' | 'user' | 'message';

export interface ProgressionStep {
  label: string;
  sublabel?: string;
  details?: string;
  status: 'completed' | 'active' | 'pending';
  tag?: string;
  time?: string;
}

export interface ActionTakenDetails {
  title: string;
  verdict: string;
  badge?: string;
  sanctions?: string[];
  actionType?: string;
  enforcedAt?: string;
  desk?: string;
  appealable?: boolean;
  appealSubmitted?: boolean;
  appealDocketId?: string;
  appealGrounds?: string;
  appealStatement?: string;
  appealSubmittedAt?: string;
}

export interface ChatMessage {
  id: string;
  post?: any;
  sender: 'user' | 'agent';
  senderName: string;
  time: string;
  text: string;
  card?: {
    title: string;
    type: 'telemetry' | 'verdict' | 'warning';
    details: string;
    badge?: string;
  };
  actionTaken?: ActionTakenDetails;
  evidenceName?: string;
  progression?: {
    title: string;
    steps: ProgressionStep[];
  };
}

export interface ReportItem {
  id: string;
  post?: any;
  targetKind: TargetKind;
  targetName: string;
  category: string;
  reason: string;
  description: string;
  status: ReportStatus;
  statusNote?: string;
  createdAt: string;
  isAnonymous: boolean;
  reporterHandle: string;
  evidenceName?: string;
  messages: ChatMessage[];
  hasAppeal?: boolean;
  appealDocketId?: string;
  actionType?: string;
  isReporter?: boolean;
  isReported?: boolean;
  userRole?: 'reporter' | 'reported';
}

function formatStepTitle(label: string) {
  if (!label) return '';
  const cleaned = label.replace(/^(\d+[\.\s\:\-]*)+/, '').trim();
  if (cleaned === cleaned.toUpperCase()) {
    return cleaned
      .toLowerCase()
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return cleaned;
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { accessToken, user } = useAuth();
  const { colors, isDark } = useTheme();
  const searchParams = useLocalSearchParams<{ id?: string; reportId?: string }>();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Appeal modal state
  const [appealModalReport, setAppealModalReport] = useState<ReportItem | null>(null);
  const [appealText, setAppealText] = useState('');
  const [appealAffirmed, setAppealAffirmed] = useState(false);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // Load user reports from server
  const fetchReports = useCallback(async (showLoading = true) => {
    if (!accessToken) return;
    if (showLoading) setLoading(true);
    setFetchError(null);
    try {
      const data = await getMyReports(accessToken);
      if (Array.isArray(data)) {
        setReports(data);
      }
    } catch (err: any) {
      console.warn('Failed to load user reports on mobile:', err);
      const rawMsg = err?.message || 'Unable to load report tickets.';
      const cleanMsg = typeof rawMsg === 'string'
        ? rawMsg.replace(/<[^>]*>/g, '').trim()
        : 'Unable to load report tickets.';
      setFetchError(cleanMsg || 'Unable to load report tickets.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchReports(true);
  }, [fetchReports]);

  // Deep-link selection sync if URL query parameter specifies a ticket id
  useEffect(() => {
    const queryId = searchParams.id || searchParams.reportId;
    if (queryId && reports.length > 0 && reports.some((r) => r.id === queryId)) {
      setSelectedReportId(queryId);
    }
  }, [searchParams.id, searchParams.reportId, reports]);

  // Real-time socket updates
  useEffect(() => {
    if (!accessToken) return;
    const socket = getSocket(accessToken);
    if (!socket) return;

    socket.emit('reports:subscribe');

    const handleSocketUpdate = () => {
      fetchReports(false);
    };

    socket.on('connect', handleSocketUpdate);
    socket.on('reconnect', handleSocketUpdate);
    socket.on('report:created', handleSocketUpdate);
    socket.on('report:assigned', handleSocketUpdate);
    socket.on('report:verified', handleSocketUpdate);
    socket.on('report:action_taken', handleSocketUpdate);
    socket.on('report:updated', handleSocketUpdate);
    socket.on('report:resolved', handleSocketUpdate);
    socket.on('report:dismissed', handleSocketUpdate);
    socket.on('report:appeal_submitted', handleSocketUpdate);
    socket.on('notification:new', handleSocketUpdate);

    return () => {
      socket.off('connect', handleSocketUpdate);
      socket.off('reconnect', handleSocketUpdate);
      socket.off('report:created', handleSocketUpdate);
      socket.off('report:assigned', handleSocketUpdate);
      socket.off('report:verified', handleSocketUpdate);
      socket.off('report:action_taken', handleSocketUpdate);
      socket.off('report:updated', handleSocketUpdate);
      socket.off('report:resolved', handleSocketUpdate);
      socket.off('report:dismissed', handleSocketUpdate);
      socket.off('report:appeal_submitted', handleSocketUpdate);
      socket.off('notification:new', handleSocketUpdate);
    };
  }, [accessToken, fetchReports]);

  // App foreground & soft polling fallback (keeps reports continuously updated without manual refresh)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        fetchReports(false);
      }
    });

    const interval = setInterval(() => {
      fetchReports(false);
    }, 5000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [fetchReports]);

  // Selected report object
  const selectedReport = useMemo(() => {
    if (!selectedReportId) return null;
    return reports.find((r) => r.id === selectedReportId) || null;
  }, [reports, selectedReportId]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: reports.length,
      reviewing: reports.filter((r) => r.status === 'reviewing').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      pending: reports.filter((r) => r.status === 'pending').length,
    };
  }, [reports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesFilter = filter === 'all' || r.status === filter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.targetName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [reports, filter, searchQuery]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/pages/settings' as any);
    }
  };

  // Copy reference ID
  const handleCopy = async (id: string) => {
    try {
      await Clipboard.setStringAsync(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      Alert.alert('Reference ID', id);
    }
  };

  // Submit appeal handler
  const handleSubmitAppeal = async () => {
    if (!appealModalReport || !appealText.trim() || !accessToken) return;
    if (appealText.trim().length < 20) {
      Alert.alert('Appeal Required', 'Please provide at least 20 characters explaining the circumstances.');
      return;
    }
    if (!appealAffirmed) {
      Alert.alert('Affirmation Required', 'Please affirm that the appeal statement is true and accurate.');
      return;
    }

    setSubmittingAppeal(true);
    try {
      await submitReportAppeal(appealModalReport.id, appealText.trim(), accessToken);
      Alert.alert('Appeal Submitted', 'Your formal appeal statement has been registered with the safety desk.');
      setAppealModalReport(null);
      setAppealText('');
      setAppealAffirmed(false);
      await fetchReports(false);
    } catch (err: any) {
      Alert.alert('Submission Error', err?.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: EMBEDDED POST CARD
  // ─────────────────────────────────────────────────────────────────────────────
  const renderEmbeddedPostCard = (post: any) => {
    if (!post) return null;
    const displayName = post.author_name || 'CHMSU Student';
    const mediaList = Array.isArray(post.media) ? post.media : [];

    return (
      <View style={[styles.postCard, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}>
        <View style={styles.postHeader}>
          <View style={styles.postAuthorRow}>
            <View style={styles.postAvatarCircle}>
              <Text style={styles.postAvatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={[styles.postAuthorName, { color: isDark ? '#F3F4F6' : '#111827' }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.postTime, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Flagged Community Post</Text>
            </View>
          </View>
          <View style={styles.postAudiencePill}>
            <Text style={styles.postAudienceText}>Public</Text>
          </View>
        </View>

        {Boolean(post.content) && (
          <Text style={[styles.postContentText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
            {post.content}
          </Text>
        )}

        {mediaList.length > 0 && (
          <View style={styles.postMediaGrid}>
            {mediaList.slice(0, 2).map((m: any, idx: number) => (
              <Image
                key={idx}
                source={{ uri: m.url || m }}
                style={styles.postMediaThumb}
                resizeMode="cover"
              />
            ))}
          </View>
        )}

        <View style={styles.postFooterRow}>
          <View style={styles.postLikeRow}>
            <Heart size={14} color="#EF4444" fill="#EF4444" />
            <Text style={[styles.postLikeCount, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {post.likes_count || 0}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: PROGRESSION STEPPER
  // ─────────────────────────────────────────────────────────────────────────────
  const renderProgressionStepper = (progression: { title: string; steps: ProgressionStep[] }) => {
    return (
      <View style={[styles.stepperContainer, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
        <Text style={[styles.stepperTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
          {progression.title}
        </Text>

        <View style={styles.stepperTrack}>
          {progression.steps.map((step, idx) => {
            const isCompleted = step.status === 'completed';
            const isActive = step.status === 'active';
            const isPending = step.status === 'pending';
            const isLast = idx === progression.steps.length - 1;
            const nextStep = progression.steps[idx + 1];
            const isLineGreen = isCompleted && (nextStep?.status === 'completed' || nextStep?.status === 'active');

            return (
              <View key={idx} style={styles.stepItemRow}>
                {/* Continuous Vertical Line */}
                {!isLast && (
                  <View
                    style={[
                      styles.stepVerticalLine,
                      { backgroundColor: isLineGreen ? GREEN : (isDark ? 'rgba(255,255,255,0.15)' : '#D1D5DB') },
                    ]}
                  />
                )}

                {/* Node Indicator Dot */}
                <View style={styles.stepNodeWrap}>
                  {isCompleted ? (
                    <View style={styles.stepDotCompleted} />
                  ) : isActive ? (
                    <View style={styles.stepDotActive} />
                  ) : (
                    <View style={styles.stepDotPending} />
                  )}
                </View>

                {/* Content */}
                <View style={styles.stepContentCol}>
                  <Text
                    style={[
                      styles.stepLabelText,
                      { color: isCompleted ? (isDark ? '#FFFFFF' : '#111827') : isActive ? '#2563EB' : (isDark ? '#9CA3AF' : '#6B7280') },
                    ]}
                  >
                    {idx + 1} {formatStepTitle(step.label)}
                  </Text>
                  <Text style={[styles.stepTimeText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {step.time || (isPending ? 'Pending' : isActive ? 'In Progress' : '')}
                  </Text>
                  {Boolean(step.details) && (
                    <Text style={[styles.stepDetailsText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                      {step.details}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: ACTION TAKEN / SANCTION CARD
  // ─────────────────────────────────────────────────────────────────────────────
  const renderActionTakenCard = (action: ActionTakenDetails, report: ReportItem) => {
    return (
      <View style={[styles.actionCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' }]}>
        <View style={styles.actionHeaderRow}>
          <Text style={[styles.actionTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            {action.title || 'Official Moderation Verdict'}
          </Text>
          <View style={[styles.verdictBadge, { backgroundColor: report.status === 'resolved' ? '#DC2626' : '#D97706' }]}>
            <Text style={styles.verdictBadgeText}>{action.badge || 'ACTION ENFORCED'}</Text>
          </View>
        </View>

        <Text style={[styles.actionVerdictText, { color: isDark ? '#D1D5DB' : '#374151' }]}>
          {action.verdict}
        </Text>

        {Array.isArray(action.sanctions) && action.sanctions.length > 0 && (
          <View style={styles.sanctionsRow}>
            {action.sanctions.map((s, idx) => (
              <View key={idx} style={styles.sanctionPill}>
                <Text style={styles.sanctionPillText}>{s}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Appeal Button or Appeal Under Review Banner */}
        {action.appealable && !action.appealSubmitted && !report.hasAppeal && (
          <TouchableOpacity
            style={styles.appealBtn}
            onPress={() => {
              setAppealModalReport(report);
              setAppealText('');
              setAppealAffirmed(false);
            }}
          >
            <Scale size={15} color="#FFFFFF" />
            <Text style={styles.appealBtnText}>Submit Conduct Appeal</Text>
          </TouchableOpacity>
        )}

        {(action.appealSubmitted || report.hasAppeal) && (
          <View style={styles.appealSubmittedCard}>
            <View style={styles.appealSubmittedHeader}>
              <Clock size={14} color={GREEN} />
              <Text style={styles.appealSubmittedTitle}>Appeal Under Review</Text>
            </View>
            <Text style={styles.appealSubmittedDesc}>
              Your formal appeal statement is currently pending evaluation by the Conduct Appeals Committee.
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: STATUS BADGE PILL
  // ─────────────────────────────────────────────────────────────────────────────
  const renderStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'resolved':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#D1FAE5' }]}>
            <CheckCircle2 size={11} color="#065F46" />
            <Text style={[styles.statusPillText, { color: '#065F46' }]}>Resolved</Text>
          </View>
        );
      case 'reviewing':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#FEF3C7' }]}>
            <View style={[styles.dotPill, { backgroundColor: '#D97706' }]} />
            <Text style={[styles.statusPillText, { color: '#92400E' }]}>In Review</Text>
          </View>
        );
      case 'pending':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#E0E7FF' }]}>
            <Clock size={11} color="#3730A3" />
            <Text style={[styles.statusPillText, { color: '#3730A3' }]}>Pending</Text>
          </View>
        );
      case 'dismissed':
        return (
          <View style={[styles.statusPill, { backgroundColor: '#F3F4F6' }]}>
            <Text style={[styles.statusPillText, { color: '#6B7280' }]}>Dismissed</Text>
          </View>
        );
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: CONVERSATION PANEL (DRILL-DOWN)
  // ─────────────────────────────────────────────────────────────────────────────
  if (selectedReport) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF', paddingTop: insets.top }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Conversation Header */}
        <View style={[styles.convHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
          <View style={styles.convHeaderLeft}>
            <TouchableOpacity
              onPress={() => setSelectedReportId(null)}
              style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <ArrowLeft size={18} color={isDark ? '#F3F4F6' : '#111827'} />
            </TouchableOpacity>

            <View style={styles.agentAvatarContainer}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.agentAvatarImg}
                resizeMode="cover"
              />
              <View style={styles.onlineDot} />
            </View>

            <View style={styles.agentHeaderInfo}>
              <Text style={[styles.agentTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                Ally Safety Agent
              </Text>
              <Text style={[styles.agentSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                Automated Case Officer
              </Text>
            </View>
          </View>

          <View style={styles.convHeaderRight}>
            <TouchableOpacity
              onPress={() => handleCopy(selectedReport.id)}
              style={[styles.copyBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {copiedId === selectedReport.id ? (
                <Check size={14} color={GREEN} />
              ) : (
                <Copy size={14} color={isDark ? '#D1D5DB' : '#6B7280'} />
              )}
            </TouchableOpacity>
            {renderStatusBadge(selectedReport.status)}
          </View>
        </View>

        {/* Messages Feed */}
        <ScrollView
          style={styles.convMessagesScroll}
          contentContainerStyle={[styles.convMessagesContent, { paddingBottom: 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Date Separator Pill */}
          <View style={styles.dateSeparatorRow}>
            <View style={[styles.dateSeparatorPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
              <Text style={[styles.dateSeparatorText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                {selectedReport.isReported ? 'Conduct Inquiry' : 'Incident Report'} • {selectedReport.createdAt}
              </Text>
            </View>
          </View>

          {/* Messages Loop */}
          {selectedReport.messages
            .filter((msg) => msg.sender !== 'user')
            .map((msg, msgIdx) => {
              const postData = msgIdx === 0 && (selectedReport.post || msg.post);

              return (
                <View key={msg.id} style={styles.messageRow}>
                  {/* Agent Avatar */}
                  <View style={styles.msgAvatarContainer}>
                    <Image
                      source={require('../../assets/images/logo.png')}
                      style={styles.msgAvatarImg}
                      resizeMode="cover"
                    />
                  </View>

                  {/* Message Bubble + Embedded Components */}
                  <View style={styles.msgCol}>
                    {/* Inquiry Notice Bubble */}
                    <View style={[styles.agentBubble, { backgroundColor: isDark ? '#1F2937' : '#F3F4F6' }]}>
                      <Text style={[styles.agentBubbleText, { color: isDark ? '#F3F4F6' : '#111827' }]}>
                        {msg.text}
                      </Text>
                    </View>

                    {/* Attached Post Card (Only for first message if flagged post exists) */}
                    {postData && renderEmbeddedPostCard(postData)}

                    {/* Progression Stepper */}
                    {msg.progression && renderProgressionStepper(msg.progression)}

                    {/* Action Taken / Sanctions Card */}
                    {msg.actionTaken && renderActionTakenCard(msg.actionTaken, selectedReport)}

                    {/* Telemetry / Warning Card */}
                    {msg.card && !msg.actionTaken && (
                      <View style={[styles.cardNotice, { backgroundColor: isDark ? '#1F2937' : '#FFFFFF', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB' }]}>
                        <View style={styles.cardNoticeHeader}>
                          <Text style={[styles.cardNoticeTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                            {msg.card.title}
                          </Text>
                          {Boolean(msg.card.badge) && (
                            <View style={styles.cardNoticeBadge}>
                              <Text style={styles.cardNoticeBadgeText}>{msg.card.badge}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.cardNoticeDetails, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                          {msg.card.details}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
        </ScrollView>

        {/* Anchored Bottom Footer Notice */}
        <View
          style={[
            styles.convFooter,
            {
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Text style={[styles.convFooterText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            You cannot reply to this automated agent. Updates and moderation findings are automatically logged here.
          </Text>
        </View>

        {/* Appeal Submission Modal */}
        <Modal
          visible={Boolean(appealModalReport)}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setAppealModalReport(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderIconWrap}>
                  <Scale size={20} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalHeaderTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    Submit Conduct Appeal
                  </Text>
                  <Text style={[styles.modalHeaderSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    Ticket: #{appealModalReport?.id.slice(0, 8).toUpperCase() || 'REVIEW'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setAppealModalReport(null)}
                  style={styles.modalCloseBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={isDark ? '#9CA3AF' : '#6B7280'} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.inputLabel, { color: isDark ? '#D1D5DB' : '#374151' }]}>
                Grounds for Appeal & Explanation
              </Text>
              <TextInput
                style={[
                  styles.statementInput,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F9FAFB',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#D1D5DB',
                    color: isDark ? '#FFFFFF' : '#111827',
                  },
                ]}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                placeholder="State your explanation, context, and mitigating factors. Why should this sanction be reconsidered?"
                placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
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
                <Text style={[styles.affirmText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
                  I affirm that the information provided in this appeal statement is true, accurate, and submitted in good faith.
                </Text>
              </TouchableOpacity>

              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  onPress={() => setAppealModalReport(null)}
                  style={[styles.modalCancelBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
                >
                  <Text style={[styles.modalCancelText, { color: isDark ? '#D1D5DB' : '#374151' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSubmitAppeal}
                  disabled={submittingAppeal || appealText.trim().length < 20 || !appealAffirmed}
                  style={[
                    styles.modalSubmitBtn,
                    (submittingAppeal || appealText.trim().length < 20 || !appealAffirmed) && { opacity: 0.5 },
                  ]}
                >
                  {submittingAppeal ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Submit Appeal</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VIEW: TICKETS LIST (CHATLIST)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#FFFFFF', paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Screen Header */}
      <View style={[styles.listHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB', backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ArrowLeft size={18} color={isDark ? '#F3F4F6' : '#111827'} />
        </TouchableOpacity>

        <View style={styles.listHeaderTitleCol}>
          <Text style={[styles.listHeaderTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            Report Center
          </Text>
          <Text style={[styles.listHeaderSub, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {counts.all} {counts.all === 1 ? 'incident ticket' : 'incident tickets'}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => fetchReports(true)}
          style={[styles.refreshIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6' }]}
          activeOpacity={0.7}
        >
          <RotateCcw size={16} color={GREEN} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={[styles.searchBarWrap, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }]}>
          <Search size={15} color={isDark ? '#9CA3AF' : '#6B7280'} />
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#FFFFFF' : '#111827' }]}
            placeholder="Search ticket, name, or reason..."
            placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={14} color={isDark ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { backgroundColor: isDark ? '#111827' : '#FFFFFF' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'reviewing', label: 'In Review', count: counts.reviewing },
            { id: 'resolved', label: 'Resolved', count: counts.resolved },
            { id: 'pending', label: 'Pending', count: counts.pending },
          ].map((tab) => {
            const isTabActive = filter === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setFilter(tab.id as any)}
                style={[
                  styles.filterTabPill,
                  isTabActive
                    ? { backgroundColor: GREEN }
                    : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' },
                ]}
              >
                <Text
                  style={[
                    styles.filterTabLabel,
                    isTabActive ? { color: '#FFFFFF', fontWeight: '700' } : { color: isDark ? '#D1D5DB' : '#4B5563' },
                  ]}
                >
                  {tab.label}
                </Text>
                <View
                  style={[
                    styles.filterCountBadge,
                    isTabActive ? { backgroundColor: 'rgba(255,255,255,0.25)' } : { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB' },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      isTabActive ? { color: '#FFFFFF' } : { color: isDark ? '#9CA3AF' : '#6B7280' },
                    ]}
                  >
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Ticket List Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={GREEN} />
          <Text style={[styles.centerLoadingText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Loading incident tickets...
          </Text>
        </View>
      ) : fetchError ? (
        <View style={styles.centerContainer}>
          <AlertTriangle size={32} color={AMBER} />
          <Text style={[styles.centerErrorTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            Unable to load reports
          </Text>
          <Text style={[styles.centerErrorDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {fetchError}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchReports(true)}>
            <RotateCcw size={14} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredReports.length === 0 ? (
        <View style={styles.centerContainer}>
          <ShieldCheck size={40} color={GREEN} />
          <Text style={[styles.centerEmptyTitle, { color: isDark ? '#FFFFFF' : '#111827' }]}>
            No reports found
          </Text>
          <Text style={[styles.centerEmptyDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {searchQuery || filter !== 'all'
              ? 'No tickets match your filter criteria.'
              : 'You currently have no active or historical incident reports.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContainer, { paddingBottom: Math.max(insets.bottom, 20) + 16 }]}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.ticketCard,
                {
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E5E7EB',
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setSelectedReportId(item.id)}
            >
              <View style={styles.ticketCardHeader}>
                <View style={styles.ticketIdRow}>
                  <Text style={[styles.ticketIdText, { color: isDark ? '#FFFFFF' : '#111827' }]}>
                    #{item.id.slice(0, 8).toUpperCase()}
                  </Text>
                  {item.isReported && (
                    <View style={styles.inquiryBadge}>
                      <Text style={styles.inquiryBadgeText}>Inquiry</Text>
                    </View>
                  )}
                </View>

                {renderStatusBadge(item.status)}
              </View>

              <View style={styles.ticketCardBody}>
                <Text style={[styles.ticketTargetName, { color: isDark ? '#F3F4F6' : '#374151' }]} numberOfLines={1}>
                  {item.targetName}
                </Text>
                <Text style={[styles.ticketDateText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {item.createdAt.split('•')[0].trim()}
                </Text>
              </View>

              <View style={styles.ticketCardFooter}>
                <Text style={[styles.ticketCategoryText, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                  {item.category} • {item.reason}
                </Text>
                <ChevronRight size={16} color={isDark ? '#6B7280' : '#9CA3AF'} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeaderTitleCol: {
    flex: 1,
    marginLeft: 8,
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: 'Fraunces_700Bold',
  },
  listHeaderSub: {
    fontSize: 11,
    marginTop: 1,
  },
  refreshIconBtn: {
    padding: 8,
    borderRadius: 10,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterBar: {
    paddingBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  filterTabLabel: {
    fontSize: 12,
  },
  filterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  ticketCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ticketIdText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  inquiryBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  inquiryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#B45309',
  },
  ticketCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ticketTargetName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  ticketDateText: {
    fontSize: 11,
  },
  ticketCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150,150,150,0.15)',
  },
  ticketCategoryText: {
    fontSize: 11,
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  dotPill: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  centerLoadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  centerErrorTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  centerErrorDesc: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    marginTop: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  centerEmptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  centerEmptyDesc: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },

  // Conversation Screen Styles
  convHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  convHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  agentAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  agentAvatarImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  agentHeaderInfo: {
    flex: 1,
  },
  agentTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  agentSubtitle: {
    fontSize: 10.5,
  },
  convHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyBtn: {
    padding: 6,
    borderRadius: 8,
  },
  convMessagesScroll: {
    flex: 1,
  },
  convMessagesContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  dateSeparatorRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  msgAvatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 2,
  },
  msgAvatarImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  msgCol: {
    flex: 1,
  },
  agentBubble: {
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
  },
  agentBubbleText: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  convFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convFooterText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Embedded Post Card
  postCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  postAvatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  postAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 160,
  },
  postTime: {
    fontSize: 10,
  },
  postAudiencePill: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  postAudienceText: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
  },
  postContentText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  postMediaGrid: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  postMediaThumb: {
    flex: 1,
    height: 110,
    borderRadius: 8,
  },
  postFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postLikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postLikeCount: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Stepper
  stepperContainer: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  stepperTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  stepperTrack: {
    paddingLeft: 2,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    position: 'relative',
    paddingBottom: 16,
  },
  stepVerticalLine: {
    position: 'absolute',
    left: 4.5,
    top: 14,
    bottom: 0,
    width: 2,
  },
  stepNodeWrap: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  stepDotCompleted: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GREEN,
  },
  stepDotActive: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2.5,
    borderColor: '#3B82F6',
    backgroundColor: '#FFFFFF',
  },
  stepDotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  stepContentCol: {
    flex: 1,
  },
  stepLabelText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  stepTimeText: {
    fontSize: 10,
    marginTop: 1,
    marginBottom: 2,
  },
  stepDetailsText: {
    fontSize: 11,
    lineHeight: 15,
  },

  // Action Taken Card
  actionCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  verdictBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verdictBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  actionVerdictText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  sanctionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  sanctionPill: {
    backgroundColor: 'rgba(220,38,38,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sanctionPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  appealBtn: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  appealBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  appealSubmittedCard: {
    backgroundColor: 'rgba(26,107,60,0.08)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(26,107,60,0.2)',
  },
  appealSubmittedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  appealSubmittedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: GREEN,
  },
  appealSubmittedDesc: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 15,
  },

  // Card Notice
  cardNotice: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardNoticeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardNoticeBadge: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  cardNoticeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  cardNoticeDetails: {
    fontSize: 11.5,
    lineHeight: 16,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  modalHeaderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(26,107,60,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalHeaderSubtitle: {
    fontSize: 11,
  },
  modalCloseBtn: {
    padding: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  statementInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    minHeight: 100,
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 12,
  },
  charCountText: {
    fontSize: 10.5,
    color: '#9CA3AF',
  },
  affirmRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 18,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#9CA3AF',
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
    fontSize: 11,
    fontWeight: '800',
  },
  affirmText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: GREEN,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
