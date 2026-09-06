import { apiRequest } from "./client";
import type { AuthSession, LoginPayload, RegisterPayload, RegisterResponse, OtpStatus } from "@/types/auth";

export function login(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", { method: "POST", body: payload });
}

// Capitalized to match the existing call site in AuthProvider (`authApi.Register(...)`).
export function Register(payload: RegisterPayload): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>("/auth/register", { method: "POST", body: payload });
}

export function logout(accessToken: string): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST", accessToken, noContent: true });
}

export function deleteAccount(accessToken: string): Promise<void> {
  return apiRequest<void>("/auth/delete-account", { method: "DELETE", accessToken });
}

export function getSession(accessToken: string): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/session", { accessToken });
}

export function forgotPassword(email: string): Promise<void> {
  return apiRequest<void>("/auth/forgot-password", { method: "POST", body: { email }, noContent: true });
}

export function resetPassword(token: string, password: string): Promise<void> {
  return apiRequest<void>("/auth/reset-password", {
    method: "POST",
    body: { token, password },
    noContent: true,
  });
}

export function getEmailVerificationStatus(
  id: string,
  accessToken: string
): Promise<{ email: string; isEmailVerified: boolean; emailConfirmedAt: string | null }> {
  return apiRequest(`/auth/email/${id}`, { accessToken });
}

export function confirmEmail(tokenHash: string): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/confirm", { method: "POST", body: { tokenHash } });
}

// ─── OTP ─────────────────────────────────────────────────────────────────────

export function sendOtp(userId: string, email: string): Promise<void> {
  return apiRequest<void>("/auth/otp/send", { method: "POST", body: { userId, email }, noContent: true });
}

export function verifyOtp(userId: string, code: string): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/otp/verify", { method: "POST", body: { userId, code } });
}

export function resendOtp(userId: string): Promise<{ resendCount: number; resendLimit: number }> {
  return apiRequest("/auth/otp/resend", { method: "POST", body: { userId } });
}

export function getOtpStatus(userId: string): Promise<OtpStatus> {
  return apiRequest<OtpStatus>(`/auth/otp/status/${userId}`);
}

// ─── Registration Rollback ─────────────────────────────────────────────────────

/**
 * Cancels an in-progress (unverified) registration.
 * Deletes the pending auth user, profile row, and OTP entry so the user
 * can restart fresh with the same or a different username/email.
 * Safe: the backend refuses if the OTP is already verified.
 */
export function cancelRegistration(userId: string): Promise<void> {
  return apiRequest<void>('/auth/register/cancel', {
    method: 'DELETE',
    body: { userId },
    noContent: true,
  });
}