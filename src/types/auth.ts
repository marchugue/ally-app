/**
 * Mirrors AuthSession from the backend's src/types/auth.types.ts.
 * This is the exact shape returned by POST /api/auth/login,
 * POST /api/auth/register, and GET /api/auth/session.
 */
export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    pending_student_verification?: boolean;
    student_verification_status?: string | null;
    [key: string]: unknown;
  };
  app_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  username: string;
  bio?: string | null;
  department?: string | null;
  course?: string | null;
  year_level?: string | null;
  interests?: string[];
  organizations?: string[];
  avatar_url?: string | null;
  email_type?: 'chmsu' | 'external';
  student_id_url?: string | null;
}

/** Returned by POST /auth/register — no session until OTP is verified */
export interface RegisterResponse {
  userId: string;
  email: string;
  accessToken: string;
}

export interface OtpStatus {
  exists: boolean;
  verified: boolean;
  resendCount: number;
  resendLimit: number;
  expiresAt: string | null;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  department: string;
  course: string;
  yearLevel: string;
  organizations: string[];
  interests: string[];
  avatar: string;
  bio: string;
}