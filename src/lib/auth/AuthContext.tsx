import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/apiError";
import { disconnectSocket, initSocket } from "@/lib/socket";
import type { AuthSession, AuthUser, RegisterPayload, RegisterResponse } from "@/types/auth";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_CACHE_KEY,
  SESSION_CACHE_KEY,
  getPersistedItem,
  setPersistedItem,
  removePersistedItem,
} from "./tokenStorage";

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
  /** Refresh the current user and session from the backend. */
  refreshSession: () => Promise<AuthSession | undefined>;
  /** Update user metadata locally and in persistent cache. */
  updateUserMetadata: (metadata: Partial<AuthUser['user_metadata']>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isRefreshingRef = useRef(false);

  // ── On launch: Instant cache hydration + background token validation/refresh ──
  useEffect(() => {
    async function restoreSession() {
      try {
        // Step 1: Read all persisted session markers in parallel
        const [storedAccessToken, storedRefreshToken, cachedUserStr, cachedSessionStr] = await Promise.all([
          getPersistedItem(ACCESS_TOKEN_KEY),
          getPersistedItem(REFRESH_TOKEN_KEY),
          getPersistedItem(USER_CACHE_KEY),
          getPersistedItem(SESSION_CACHE_KEY),
        ]);

        let initialUser: AuthUser | null = null;
        let initialToken: string | null = storedAccessToken;
        let initialRefreshToken: string | null = storedRefreshToken;

        if (cachedSessionStr) {
          try {
            const parsedSession: AuthSession = JSON.parse(cachedSessionStr);
            if (parsedSession.user) {
              initialUser = parsedSession.user;
            }
            if (parsedSession.accessToken && !initialToken) {
              initialToken = parsedSession.accessToken;
            }
            if (parsedSession.refreshToken && !initialRefreshToken) {
              initialRefreshToken = parsedSession.refreshToken;
            }
          } catch {}
        }

        if (!initialUser && cachedUserStr) {
          try {
            initialUser = JSON.parse(cachedUserStr);
          } catch {}
        }

        // ── 0ms Instant Hydration: Apply cached user & token to state immediately ──
        if (initialUser) {
          setUser(initialUser);
        }
        if (initialToken) {
          setAccessToken(initialToken);
          initSocket(initialToken);
        }

        // If no credentials exist anywhere, we are unauthenticated
        if (!initialToken && !initialRefreshToken && !initialUser) {
          setIsLoading(false);
          return;
        }

        // Step 2: Validate or Refresh session with the server in background
        let sessionConfirmed = false;

        if (initialToken) {
          try {
            const serverSession = await authApi.getSession(initialToken);
            await applySession(serverSession);
            sessionConfirmed = true;
          } catch (err: any) {
            console.log("[AuthContext] getSession status:", err?.status);
            // 401/403 means the short-lived access token expired, we attempt refresh below
          }
        }

        // If access token was expired or absent, attempt silent refresh using refresh token
        if (!sessionConfirmed && initialRefreshToken) {
          try {
            console.log("[AuthContext] Attempting silent token refresh on launch...");
            const refreshedSession = await authApi.refreshSessionWithToken(initialRefreshToken);
            await applySession(refreshedSession);
            sessionConfirmed = true;
            console.log("[AuthContext] Silent token refresh succeeded on launch!");
          } catch (refreshErr: any) {
            console.warn("[AuthContext] Launch token refresh failed:", refreshErr?.status);
            // ONLY if the refresh token was explicitly rejected (401/403) by backend,
            // revoke the session. Network errors do NOT clear tokens!
            if (refreshErr?.status === 401 || refreshErr?.status === 403) {
              console.log("[AuthContext] Refresh token invalid/revoked. Clearing session.");
              await clearStoredTokens();
              return;
            }
          }
        }

        // If offline / server unreachable but we had a cached user, RETAIN the session!
        if (!sessionConfirmed && initialUser) {
          console.log("[AuthContext] Retaining cached auth session for offline use.");
        }
      } catch (err) {
        console.warn("[AuthContext] Restore session error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ── AppState watcher: Re-validate/refresh session when app comes to foreground ──
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "active" && !isRefreshingRef.current) {
        const storedRefreshToken = await getPersistedItem(REFRESH_TOKEN_KEY);
        const storedAccessToken = await getPersistedItem(ACCESS_TOKEN_KEY);
        if (!storedAccessToken && !storedRefreshToken) return;

        isRefreshingRef.current = true;
        try {
          if (storedAccessToken) {
            try {
              const freshSession = await authApi.getSession(storedAccessToken);
              await applySession(freshSession);
              return;
            } catch (err: any) {
              if (err?.status !== 401 && err?.status !== 403) {
                return; // Network error, retain session
              }
            }
          }
          if (storedRefreshToken) {
            const refreshed = await authApi.refreshSessionWithToken(storedRefreshToken);
            await applySession(refreshed);
          }
        } catch {
          // Do not log out on transient errors
        } finally {
          isRefreshingRef.current = false;
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  async function applySession(session: AuthSession) {
    setUser(session.user);
    setAccessToken(session.accessToken ?? null);

    if (session.user) {
      await setPersistedItem(USER_CACHE_KEY, JSON.stringify(session.user));
    }

    if (session.accessToken) {
      await setPersistedItem(ACCESS_TOKEN_KEY, session.accessToken);
      initSocket(session.accessToken);
    } else {
      await removePersistedItem(ACCESS_TOKEN_KEY);
      disconnectSocket();
    }

    if (session.refreshToken) {
      await setPersistedItem(REFRESH_TOKEN_KEY, session.refreshToken);
    }

    // Persist full session bundle
    await setPersistedItem(SESSION_CACHE_KEY, JSON.stringify(session));
  }

  async function clearStoredTokens() {
    await removePersistedItem(ACCESS_TOKEN_KEY);
    await removePersistedItem(REFRESH_TOKEN_KEY);
    await removePersistedItem(USER_CACHE_KEY);
    await removePersistedItem(SESSION_CACHE_KEY);

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const chatKeys = allKeys.filter(
        (k) => k.startsWith('ally_chat_cache_') || k.startsWith('ally_conversations_cache_')
      );
      if (chatKeys.length > 0) {
        await AsyncStorage.multiRemove(chatKeys);
      }
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

  async function refreshSession(): Promise<AuthSession | undefined> {
    const refreshToken = await getPersistedItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return undefined;
    try {
      const session = await authApi.refreshSessionWithToken(refreshToken);
      await applySession(session);
      return session;
    } catch (err) {
      console.warn("[AuthContext] Failed to refresh session:", err);
      return undefined;
    }
  }

  async function updateUserMetadata(metadata: Partial<AuthUser['user_metadata']>): Promise<void> {
    setUser((prev) => {
      if (!prev) return null;
      const updatedUser: AuthUser = {
        ...prev,
        user_metadata: {
          ...prev.user_metadata,
          ...metadata,
        },
      };
      setPersistedItem(USER_CACHE_KEY, JSON.stringify(updatedUser)).catch(() => {});
      return updatedUser;
    });
  }

  async function signOut() {
    try {
      if (accessToken) {
        await authApi.logout(accessToken);
      }
    } catch {} finally {
      await clearStoredTokens();
    }
  }

  async function deleteAccount() {
    try {
      if (accessToken) {
        await authApi.deleteAccount(accessToken);
      }
    } catch {} finally {
      await clearStoredTokens();
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        signIn,
        signOut,
        deleteAccount,
        signUp,
        completeLogin,
        refreshSession,
        updateUserMetadata,
      }}
    >
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