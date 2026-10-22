export interface BlockRecord { blockedUserId: string; blockedBy: string; created_at: string; }
export interface UnblockResult { blockedUserId: string; unblocked: boolean; }
export interface BlockedUserEntry { blockedUserId: string; blockedAt: string; }
export interface Report { id: string; reporter_id: string; target_user_id: string; reason: string; created_at: string; }

export interface RestrictRecord { restrictedUserId: string; restrictedBy: string; created_at: string; }
export interface UnrestrictResult { restrictedUserId: string; success?: boolean; }
export interface RestrictedUserEntry { restrictedUserId: string; restrictedAt: string; }

export interface MuteRecord { mutedUserId: string; mutedBy: string; created_at: string; }
export interface UnmuteResult { mutedUserId: string; success?: boolean; }
export interface MutedUserEntry { mutedUserId: string; mutedAt: string; }