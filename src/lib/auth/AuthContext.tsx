import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/apiError";
import type { AuthSession, AuthUser, RegisterPayload } from "@/types/auth";

const ACCESS_TOKEN_KEY = "ally_access_token";
const REFRESH_TOKEN_KEY = "ally_refresh_token";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  /** True while restoring a persisted session on app launch. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
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
    setAccessToken(session.accessToken);
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken);
  }

  async function clearStoredTokens() {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    setUser(null);
    setAccessToken(null);
  }

  async function signIn(email: string, password: string) {
    const session = await authApi.login({ email, password });
    await applySession(session);
  }

  async function signUp(payload: RegisterPayload) {
    await authApi.Register(payload);
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

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, signIn, signOut, signUp }}>
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