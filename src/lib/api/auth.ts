import { apiRequest } from "./client";
import type { AuthSession, LoginPayload, RegisterPayload } from "@/types/auth";

export function login(payload: LoginPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/login", { method: "POST", body: payload });
}

// Capitalized to match the existing call site in AuthProvider (`authApi.Register(...)`).
// Rename both together if you want to fix the casing later.
export function Register(payload: RegisterPayload): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/register", { method: "POST", body: payload });
}

export function logout(accessToken: string): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST", accessToken, noContent: true });
}

export function getSession(accessToken: string): Promise<AuthSession> {
  return apiRequest<AuthSession>("/auth/session", { accessToken });
}

export function forgotPassword(email: string): Promise<void> {
  return apiRequest<void>("/auth/forgot-password", {
    method: "POST",
    body: { email },
    noContent: true,
  });
}

// recoveryToken = the access token pulled from the reset-link URL hash,
// not a normal logged-in session token.
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