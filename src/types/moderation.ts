export interface BlockRecord { blockedUserId: string; blockedBy: string; created_at: string; }
export interface UnblockResult { blockedUserId: string; unblocked: boolean; }
export interface BlockedUserEntry { blockedUserId: string; blockedAt: string; }
export interface Report { id: string; reporter_id: string; target_user_id: string; reason: string; created_at: string; }