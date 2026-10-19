// src/lib/api/games.ts

import { apiRequest } from './client';
import type { GameInvitePayload } from '../../types/conversation';

export interface GameSessionResponse {
  session: {
    id: string;
    game_id: 'merge' | 'ttt' | 'clue';
    status: 'pending' | 'active' | 'finished' | 'declined' | 'expired';
    host_id: string;
    guest_id: string;
    winner_id: string | null;
    expires_at: string | null;
    created_at: string;
  };
}

export function inviteToGame(friendId: string, gameId: 'merge' | 'ttt' | 'clue') {
  return apiRequest<GameSessionResponse>('/games/invite', {
    method: 'POST',
    body: { friendId, gameId },
  });
}

export function acceptGameInvite(sessionId: string) {
  return apiRequest<GameSessionResponse>(`/games/${sessionId}/accept`, {
    method: 'POST',
  });
}

export function declineGameInvite(sessionId: string) {
  return apiRequest<GameSessionResponse>(`/games/${sessionId}/decline`, {
    method: 'POST',
  });
}

export function cancelGameInvite(sessionId: string) {
  return apiRequest<GameSessionResponse>(`/games/${sessionId}/cancel`, {
    method: 'POST',
  });
}

export function getGameSession(sessionId: string) {
  return apiRequest<GameSessionResponse>(`/games/${sessionId}`);
}
