import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/apiError";
import { disconnectSocket, initSocket } from "@/lib/socket";
import type { AuthSession, AuthUser, RegisterPayload, RegisterResponse } from "@/types/auth";

const ACCESS_TOKEN_KEY = "ally_access_token";
const REFRESH_TOKEN_KEY = "ally_refresh_token";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** True while restoring a persisted session on app launch. */
  isLoading: boolean;
  /** Signs in and returns the resolved AuthSession so callers can check user_metadata. */
  signIn: (email: string, password: string) => Promise<AuthSession>;
  /** Register returns { userId, email } so the caller can navigate to OTP screen. */
  signUp: (payload: RegisterPayload) => Promise<RegisterResponse>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /** Apply a session obtained externally (e.g., after OTP verify). */
  completeLogin: (session: AuthSession) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On launch: check for a stored token and validate it against the
  // backend via GET /api/auth/session. If it's expired/invalid, clear it
  // silently and fall back to the login screen.
  useEffect(() => {
    async function restoreSession() {
      try {
        const storedToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        const session = await authApi.getSession(storedToken);
        applySession(session);
      } catch {
        // Token invalid/expired — clear it and let the user log in again.
        await clearStoredTokens();
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  async function applySession(session: AuthSession) {
    setUser(session.user);
    setAccessToken(session.accessToken ?? null);
    if (session.accessToken) {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
      initSocket(session.accessToken);
    } else {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
      disconnectSocket();
    }
    if (session.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  }

  async function clearStoredTokens() {
    try {
      await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    } catch {}
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {}
    disconnectSocket();
    setUser(null);
    setAccessToken(null);
  }

  async function signIn(email: string, password: string): Promise<AuthSession> {
    try {
      const session = await authApi.login({ email, password });
      await applySession(session);
      return session;
    } catch (err: any) {
      // Surface OTP-required as a special error shape the caller can act on
      if (err?.status === 403 && err?.body?.requiresOtp) {
        const otpErr: any = new Error('Email not verified');
        otpErr.requiresOtp = true;
        otpErr.userId = err.body.userId;
        otpErr.email = err.body.email;
        throw otpErr;
      }
      throw err;
    }
  }

  async function signUp(payload: RegisterPayload): Promise<RegisterResponse> {
    return authApi.Register(payload);
  }

  async function completeLogin(session: AuthSession): Promise<void> {
    await applySession(session);
  }

  async function signOut() {
    try {
      if (accessToken) {
        await authApi.logout(accessToken);
      }
    } catch {
      // Even if the network call fails, still clear local state so the
      // user isn't stuck signed in on-device.
    } finally {
      await clearStoredTokens();
    }
  }

  async function deleteAccount() {
    try {
      if (accessToken) {
        await authApi.deleteAccount(accessToken);
      }
    } catch {
      // Clear tokens even if network fails
    } finally {
      await clearStoredTokens();
    }
  }

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, signIn, signOut, deleteAccount, signUp, completeLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

export { ApiError };