// src/components/GameInviteCard.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, Linking, Alert, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    cover: any;
  }
> = {
  merge: {
    title: '2048 Merge',
    cover: require('../../assets/images/game-merge-cover.jpg'),
  },
  ttt: {
    title: 'Tic-Tac-Toe',
    cover: require('../../assets/images/game-ttt-cover.jpg'),
  },
  clue: {
    title: 'Secret Clue',
    cover: require('../../assets/images/game-clue-cover.jpg'),
  },
};

export const GameInviteCard: React.FC<GameInviteCardProps> = ({ invite, isMine, currentUserId }) => {
  const [submitting, setSubmitting] = useState(false);
  const meta = GAME_META[invite.gameId] || GAME_META.ttt;

  // Authoritative host / guest determination
  const isHost = isMine || (invite.hostId && invite.hostId === currentUserId);
  const isGuest = !isMine || (invite.guestId && invite.guestId === currentUserId);

  // Normalize status ('invited', 'pending', etc.)
  const rawStatus = (invite.status || 'pending').toLowerCase();
  const isPending = rawStatus === 'pending' || rawStatus === 'invited';
  const isActive = rawStatus === 'active';
  const isFinished = rawStatus === 'finished';
  const isDeclined = rawStatus === 'declined' || rawStatus === 'cancelled';
  const isExpired = rawStatus === 'expired';

  const openGamePortal = async (sessionId?: string) => {
    try {
      const token = await getPersistedItem(ACCESS_TOKEN_KEY);
      const isProd = !__DEV__;
      const baseGameUrl = isProd
        ? 'https://game.ally-jis.com'
        : (process.env.EXPO_PUBLIC_GAME_URL || 'http://localhost:5174');

      const params: string[] = [];
      if (sessionId) params.push(`session=${encodeURIComponent(sessionId)}`);
      if (token) params.push(`token=${encodeURIComponent(token)}`);

      const fullUrl = `${baseGameUrl}${params.length > 0 ? `?${params.join('&')}` : ''}`;
      await Linking.openURL(fullUrl);
    } catch (err: any) {
      Alert.alert('Unable to open game', err?.message || 'Please check your connection.');
    }
  };

  const handleAccept = async () => {
    try {
      setSubmitting(true);
      if (invite.sessionId) {
        await acceptGameInvite(invite.sessionId);
      }
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
      if (invite.sessionId) {
        await declineGameInvite(invite.sessionId);
      }
    } catch (err: any) {
      Alert.alert('Duel Error', err?.message || 'Could not decline invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      setSubmitting(true);
      if (invite.sessionId) {
        await cancelGameInvite(invite.sessionId);
      }
    } catch (err: any) {
      Alert.alert('Duel Error', err?.message || 'Could not cancel invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = isPending
    ? 'Invited'
    : isActive
    ? 'Live'
    : isFinished
    ? 'Over'
    : isDeclined
    ? 'Declined'
    : 'Expired';

  const statusBg = isPending
    ? '#D97706'
    : isActive
    ? '#059669'
    : isFinished
    ? '#2563EB'
    : isDeclined
    ? '#DC2626'
    : '#4B5563';

  return (
    <View style={styles.container}>
      {/* ═══ Full Bleed Background Image ═══ */}
      <Image source={meta.cover} style={styles.fullBleedImage} resizeMode="cover" />

      {/* ═══ Dark Gradient Overlay ═══ */}
      <LinearGradient
        colors={['rgba(6, 12, 20, 0.35)', 'rgba(6, 12, 20, 0.65)', 'rgba(6, 12, 20, 0.95)']}
        locations={[0, 0.45, 0.95]}
        style={styles.gradientOverlay}
      />

      {/* ═══ Top Section: Game Title & Status ═══ */}
      <View style={styles.topRow}>
        <View style={styles.titleBadge}>
          <Text style={styles.titleText}>{meta.title}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {/* ═══ Bottom Section: Short Invite Message & Buttons ═══ */}
      <View style={styles.bottomSection}>
        <View style={styles.messageBox}>
          {isPending ? (
            isGuest ? (
              <Text style={styles.messageText}>Challenged you to play!</Text>
            ) : (
              <Text style={styles.messageTextMuted}>Waiting for opponent to accept...</Text>
            )
          ) : isActive ? (
            <Text style={styles.messageTextActive}>Duel is underway!</Text>
          ) : isFinished ? (
            <Text style={styles.messageTextMuted}>Match concluded.</Text>
          ) : (
            <Text style={styles.messageTextItalic}>Invite expired or declined.</Text>
          )}
        </View>

        {/* Action Buttons (No Icons) */}
        <View style={styles.actions}>
          {isPending && (
            <>
              {isGuest ? (
                <View style={styles.rowButtons}>
                  <Pressable
                    disabled={submitting}
                    onPress={handleAccept}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { opacity: pressed || submitting ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={styles.primaryBtnText}>Accept</Text>
                  </Pressable>

                  <Pressable
                    disabled={submitting}
                    onPress={handleDecline}
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      { opacity: pressed || submitting ? 0.75 : 1 },
                    ]}
                  >
                    <Text style={styles.secondaryBtnText}>Decline</Text>
                  </Pressable>
                </View>
              ) : isHost ? (
                <View style={styles.rowButtons}>
                  <Pressable
                    onPress={() => openGamePortal(invite.sessionId)}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      { opacity: pressed ? 0.75 : 1 },
                    ]}
                  >
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
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          )}

          {isActive && (
            <Pressable
              onPress={() => openGamePortal(invite.sessionId)}
              style={({ pressed }) => [
                styles.primaryBtnFull,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.primaryBtnText}>Resume</Text>
            </Pressable>
          )}

          {(isFinished || isDeclined || isExpired) && (
            <Pressable
              onPress={() => openGamePortal(invite.sessionId)}
              style={({ pressed }) => [
                styles.secondaryBtnFull,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={styles.secondaryBtnText}>Open Arena</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: 240,
    borderRadius: 22,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  fullBleedImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  titleBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  bottomSection: {
    zIndex: 10,
    gap: 8,
  },
  messageBox: {
    paddingHorizontal: 2,
  },
  messageText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  messageTextMuted: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  messageTextActive: {
    color: '#38C185',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  messageTextItalic: {
    color: '#94A3B8',
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  actions: {
    width: '100%',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#38C185',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnFull: {
    width: '100%',
    backgroundColor: '#38C185',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#05180f',
    fontSize: 12,
    fontWeight: '800',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnFull: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
});
