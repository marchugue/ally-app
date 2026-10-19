// src/components/GameInviteCard.tsx

import React, { useState } from 'react';
import { View, Text, Pressable, Linking, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Swords, Trophy, Clock, X, Check, ExternalLink, Sparkles, Hash, Search } from 'lucide-react-native';
import type { GameInvitePayload } from '../types/conversation';
import { getPersistedItem, ACCESS_TOKEN_KEY } from '../lib/auth/tokenStorage';
import { acceptGameInvite, declineGameInvite, cancelGameInvite } from '../lib/api/games';

interface GameInviteCardProps {
  invite: GameInvitePayload;
  isMine: boolean;
  currentUserId: string;
}

const GAME_META: Record<
  'merge' | 'ttt' | 'clue',
  {
    title: string;
    tagline: string;
    colors: [string, string, string];
    borderColor: string;
    badgeBg: string;
    badgeText: string;
    icon: (color: string) => React.ReactNode;
  }
> = {
  merge: {
    title: '2048: Number Merge',
    tagline: 'Timed speed & merge race',
    colors: ['#291807', '#1c1006', '#140c05'],
    borderColor: 'rgba(245, 158, 11, 0.45)',
    badgeBg: 'rgba(245, 158, 11, 0.2)',
    badgeText: '#FCD34D',
    icon: (c) => <Hash size={18} color={c} />,
  },
  ttt: {
    title: 'Tic-Tac-Toe',
    tagline: 'Turn-based tactical duel',
    colors: ['#062319', '#041711', '#03100c'],
    borderColor: 'rgba(16, 185, 129, 0.45)',
    badgeBg: 'rgba(16, 185, 129, 0.2)',
    badgeText: '#6EE7B7',
    icon: (c) => <Swords size={18} color={c} />,
  },
  clue: {
    title: 'Secret Clue',
    tagline: 'Clue giver & guesser duel',
    colors: ['#1d1135', '#130c24', '#0d0718'],
    borderColor: 'rgba(168, 85, 247, 0.45)',
    badgeBg: 'rgba(168, 85, 247, 0.2)',
    badgeText: '#D8B4FE',
    icon: (c) => <Search size={18} color={c} />,
  },
};

export const GameInviteCard: React.FC<GameInviteCardProps> = ({ invite, currentUserId }) => {
  const [submitting, setSubmitting] = useState(false);
  const meta = GAME_META[invite.gameId] || GAME_META.ttt;
  const isHost = invite.hostId === currentUserId;
  const isGuest = invite.guestId === currentUserId;

  const openGamePortal = async (sessionId: string) => {
    try {
      const token = await getPersistedItem(ACCESS_TOKEN_KEY);
      // In development on Android emulator or connected device via adb reverse, port 5174 is forwarded.
      // In production, fallback to https://game.ally-jis.com
      const isProd = !__DEV__;
      const baseGameUrl = isProd
        ? 'https://game.ally-jis.com'
        : (process.env.EXPO_PUBLIC_GAME_URL || 'http://localhost:5174');

      const fullUrl = token
        ? `${baseGameUrl}?session=${encodeURIComponent(sessionId)}&token=${encodeURIComponent(token)}`
        : `${baseGameUrl}?session=${encodeURIComponent(sessionId)}`;

      await Linking.openURL(fullUrl);
    } catch (err: any) {
      Alert.alert('Unable to open game', err?.message || 'Please check your connection.');
    }
  };

  const handleAccept = async () => {
    try {
      setSubmitting(true);
      await acceptGameInvite(invite.sessionId);
      await openGamePortal(invite.sessionId);
    } catch (err: any) {
      Alert.alert('Duel Error', err?.message || 'Could not accept invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    try {
      setSubmitting(true);
      await declineGameInvite(invite.sessionId);
    } catch (err: any) {
      Alert.alert('Duel Error', err?.message || 'Could not decline invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      setSubmitting(true);
      await cancelGameInvite(invite.sessionId);
    } catch (err: any) {
      Alert.alert('Duel Error', err?.message || 'Could not cancel invite.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinearGradient
      colors={meta.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { borderColor: meta.borderColor }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconWrapper}>{meta.icon(meta.badgeText)}</View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {meta.title}
          </Text>
          <Text style={styles.tagline} numberOfLines={1}>
            {meta.tagline}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: meta.badgeBg, borderColor: meta.borderColor }]}>
          <Text style={[styles.badgeText, { color: meta.badgeText }]}>
            {invite.status === 'pending'
              ? 'Invited'
              : invite.status === 'active'
              ? 'Live'
              : invite.status === 'finished'
              ? 'Over'
              : invite.status}
          </Text>
        </View>
      </View>

      {/* Body Info */}
      <View style={styles.bodyBox}>
        {invite.status === 'pending' && (
          <View>
            {isGuest ? (
              <Text style={styles.bodyText}>You were challenged to a duel! Accept to enter the arena.</Text>
            ) : isHost ? (
              <View style={styles.row}>
                <Clock size={13} color="#F59E0B" />
                <Text style={styles.bodyTextMuted}>Waiting for ally to accept…</Text>
              </View>
            ) : (
              <Text style={styles.bodyTextMuted}>A duel was initiated.</Text>
            )}
          </View>
        )}

        {invite.status === 'active' && (
          <View style={styles.row}>
            <Sparkles size={13} color="#34D399" />
            <Text style={styles.bodyTextSuccess}>Duel underway! Rejoin anytime.</Text>
          </View>
        )}

        {invite.status === 'finished' && (
          <View style={styles.row}>
            <Trophy size={13} color="#FBBF24" />
            <Text style={styles.bodyTextMuted}>Match completed. Recorded on leaderboard.</Text>
          </View>
        )}

        {invite.status === 'declined' && (
          <Text style={styles.bodyTextItalic}>Challenge was declined.</Text>
        )}

        {invite.status === 'expired' && (
          <Text style={styles.bodyTextItalic}>Challenge has expired.</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        {invite.status === 'pending' && (
          <>
            {isGuest && (
              <>
                <Pressable
                  disabled={submitting}
                  onPress={handleAccept}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: '#059669', opacity: pressed || submitting ? 0.75 : 1 },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Check size={14} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Accept & Play</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  disabled={submitting}
                  onPress={handleDecline}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { opacity: pressed || submitting ? 0.75 : 1 },
                  ]}
                >
                  <X size={14} color="#9CA3AF" />
                </Pressable>
              </>
            )}

            {isHost && (
              <>
                <Pressable
                  onPress={() => openGamePortal(invite.sessionId)}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: '#D97706', opacity: pressed ? 0.75 : 1 },
                  ]}
                >
                  <ExternalLink size={14} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Enter Room</Text>
                </Pressable>

                <Pressable
                  disabled={submitting}
                  onPress={handleCancel}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    { opacity: pressed || submitting ? 0.75 : 1 },
                  ]}
                >
                  <X size={14} color="#9CA3AF" />
                </Pressable>
              </>
            )}
          </>
        )}

        {invite.status === 'active' && (
          <Pressable
            onPress={() => openGamePortal(invite.sessionId)}
            style={({ pressed }) => [
              styles.primaryBtnFull,
              { backgroundColor: '#059669', opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <ExternalLink size={14} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Resume Duel</Text>
          </Pressable>
        )}

        {invite.status === 'finished' && (
          <Pressable
            onPress={() => openGamePortal(invite.sessionId)}
            style={({ pressed }) => [
              styles.primaryBtnFull,
              { backgroundColor: '#374151', opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Trophy size={14} color="#FBBF24" />
            <Text style={styles.primaryBtnText}>Open Game Arena</Text>
          </Pressable>
        )}

        {(invite.status === 'declined' || invite.status === 'expired') && (
          <Pressable
            onPress={() => openGamePortal(invite.sessionId)}
            style={({ pressed }) => [
              styles.primaryBtnFull,
              { backgroundColor: 'rgba(55, 65, 81, 0.4)', opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <ExternalLink size={14} color="#9CA3AF" />
            <Text style={[styles.primaryBtnText, { color: '#9CA3AF' }]}>Visit Arena</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 250,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  tagline: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bodyBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bodyText: {
    fontSize: 11,
    color: '#E5E7EB',
    lineHeight: 15,
  },
  bodyTextMuted: {
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 15,
  },
  bodyTextSuccess: {
    fontSize: 11,
    color: '#6EE7B7',
    fontWeight: '600',
  },
  bodyTextItalic: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
  },
  primaryBtnFull: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(31, 41, 55, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
