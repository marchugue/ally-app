import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/apiError";
import { registerAuthSessionListener, performSilentRefresh, isJwtExpired } from "@/lib/api/client";
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
import {
  nativeGoogleSignIn,
  browserGoogleSignIn,
  configureGoogleSignIn,
  isNativeGoogleSignInAvailable,
} from "./googleOAuth";

// Configure native Google Sign-In at module load time
configureGoogleSignIn();

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** True while restoring a persisted session on app launch. */
  isLoading: boolean;
  /** Signs in and returns the resolved AuthSession so callers can check user_metadata. */
  signIn: (email: string, password: string) => Promise<AuthSession>;
  /** Initiates Google OAuth in-app browser session and exchanges token/code with backend. */
  signInWithGoogle: () => Promise<AuthSession>;
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

  // ── On launch: Instant cache hydration (Facebook-style) + background token refresh ──
  useEffect(() => {
    async function restoreSession() {
      try {
        // Step 1: Read all persisted session markers in parallel from SecureStore / AsyncStorage
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

        // ── 0ms Instant Hydration (Facebook-style): Render cached user immediately ──
        if (initialUser) {
          setUser(initialUser);
        }
        if (initialToken) {
          setAccessToken(initialToken);
          initSocket(initialToken);
        }

        // Unblock root navigation immediately so user sees the app with zero perceived lag
        setIsLoading(false);

        // If no credentials exist anywhere, user is simply unauthenticated
        if (!initialToken && !initialRefreshToken && !initialUser) {
          return;
        }

        // Step 2: Background validation / refresh (runs silently without dropping offline user)
        if (initialRefreshToken) {
          void (async () => {
            try {
              // Proactively refresh if access token is expired (>1 hr old) or nearing expiration
              const needsRefresh = !initialToken || isJwtExpired(initialToken, 90);
              const freshToken = await performSilentRefresh(needsRefresh);
              if (freshToken) {
                setAccessToken(freshToken);
                initSocket(freshToken);

                // Fetch latest server profile to sync moderation flags / verified status
                try {
                  const serverSession = await authApi.getSession(freshToken);
                  await applySession(serverSession);
                } catch (profileErr: any) {
                  if (profileErr?.status === 403 && (profileErr?.isBanned || profileErr?.body?.is_banned)) {
                    setUser((prev) => {
                      if (!prev) return prev;
                      const banned = {
                        ...prev,
                        user_metadata: { ...prev.user_metadata, is_banned: true, status: "banned" },
                      };
                      setPersistedItem(USER_CACHE_KEY, JSON.stringify(banned)).catch(() => {});
                      return banned;
                    });
                  }
                }
              }
            } catch (bgErr) {
              console.log("[AuthContext] Launch background refresh error (retaining offline session):", bgErr);
            }
          })();
        }
      } catch (err) {
        console.warn("[AuthContext] Restore session error:", err);
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  // ── Listen for auto-refreshed tokens and explicit session revocations from API client ──
  useEffect(() => {
    const unsubscribe = registerAuthSessionListener({
      onTokenRefreshed: (newToken: string, updatedUser?: AuthUser) => {
        setAccessToken(newToken);
        if (updatedUser) {
          setUser(updatedUser);
        }
      },
      onSessionExpired: () => {
        console.warn("[AuthContext] Explicit session revocation signal received. Revoking local session.");
        clearStoredTokens();
      },
      onAccountBanned: async () => {
        console.warn("[AuthContext] Account banned notification received. Updating user.");
        setUser((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            user_metadata: {
              ...prev.user_metadata,
              is_banned: true,
              status: "banned",
            },
          };
          setPersistedItem(USER_CACHE_KEY, JSON.stringify(updated)).catch(() => {});
          return updated;
        });
      },
    });
    return unsubscribe;
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
          // Use deduplicated performSilentRefresh: only refreshes if token expired
          const freshToken = await performSilentRefresh(false);
          if (freshToken) {
            setAccessToken(freshToken);
            initSocket(freshToken);
          }
        } catch {
          // Do not log out on transient / offline errors
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

    // Preserve existing refresh token if current session payload doesn't contain a new one
    let effectiveRefreshToken = session.refreshToken;
    if (effectiveRefreshToken) {
      await setPersistedItem(REFRESH_TOKEN_KEY, effectiveRefreshToken);
    } else {
      effectiveRefreshToken = (await getPersistedItem(REFRESH_TOKEN_KEY)) || undefined;
    }

    // Persist full session bundle with refresh token preserved
    const sessionToPersist: AuthSession = {
      ...session,
      refreshToken: effectiveRefreshToken || session.refreshToken,
    };
    await setPersistedItem(SESSION_CACHE_KEY, JSON.stringify(sessionToPersist));
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

  async function signInWithGoogle(): Promise<AuthSession> {
    let tokens: { accessToken: string; refreshToken?: string };

    if (isNativeGoogleSignInAvailable()) {
      try {
        tokens = await nativeGoogleSignIn();
      } catch (nativeErr: any) {
        if (nativeErr?.message === "cancelled") {
          throw nativeErr;
        }

        const isDeveloperError =
          nativeErr?.isDeveloperError ||
          nativeErr?.code === "DEVELOPER_ERROR" ||
          nativeErr?.code === "10" ||
          nativeErr?.code === 10 ||
          String(nativeErr?.message || "").toLowerCase().includes("developer_error");

        if (isDeveloperError) {
          console.warn(
            "[AuthContext] Native Google Sign-In failed with DEVELOPER_ERROR (misconfigured SHA-1/Google Cloud Client). Falling back to browser OAuth...",
            nativeErr
          );
          tokens = await browserGoogleSignIn();
        } else {
          throw nativeErr;
        }
      }
    } else {
      tokens = await browserGoogleSignIn();
    }

    // Exchange Supabase tokens with backend (same endpoint used by web)
    const session = await authApi.oauthGoogle({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || undefined,
    });

    await applySession(session);
    return session;
  }

  async function signUp(payload: RegisterPayload): Promise<RegisterResponse> {
    return authApi.Register(payload);
  }

  async function completeLogin(session: AuthSession): Promise<void> {
    await applySession(session);
  }

  async function refreshSession(): Promise<AuthSession | undefined> {
    try {
      const freshToken = await performSilentRefresh(true);
      if (freshToken) {
        setAccessToken(freshToken);
        initSocket(freshToken);
        const freshSession = await authApi.getSession(freshToken);
        await applySession(freshSession);
        return freshSession;
      }
      return undefined;
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
        signInWithGoogle,
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