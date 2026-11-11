import { API_BASE_URL } from "@/constants";
import { ApiError } from "./apiError";
import {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_CACHE_KEY,
  SESSION_CACHE_KEY,
  getPersistedItem,
  setPersistedItem,
} from "../auth/tokenStorage";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  noContent?: boolean;
}

type AuthListener = {
  onSessionExpired?: () => void;
  onTokenRefreshed?: (newToken: string, updatedUser?: any) => void;
  onAccountBanned?: (data?: any) => void;
};

const authListeners = new Set<AuthListener>();

export function registerAuthSessionListener(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyTokenRefreshed(newToken: string, updatedUser?: any) {
  authListeners.forEach((l) => l.onTokenRefreshed?.(newToken, updatedUser));
}

export function notifySessionExpired() {
  authListeners.forEach((l) => l.onSessionExpired?.());
}

export function notifyAccountBanned(data?: any) {
  authListeners.forEach((l) => l.onAccountBanned?.(data));
}

/**
 * Checks if a JWT access token is expired or will expire within `bufferSeconds`.
 * Decodes the JWT payload safely without external dependencies.
 */
export function isJwtExpired(token: string, bufferSeconds = 60): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    let jsonStr: string;
    if (typeof atob === "function") {
      jsonStr = atob(base64);
    } else {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
      let str = base64.replace(/=+$/, "");
      let output = "";
      for (
        let bc = 0, bs = 0, buffer, i = 0;
        (buffer = str.charAt(i++));
        ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer), bc++ % 4)
          ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
          : 0
      ) {
        buffer = chars.indexOf(buffer);
      }
      jsonStr = output;
    }
    const payload = JSON.parse(jsonStr);
    if (!payload.exp) return false;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return nowInSeconds >= payload.exp - bufferSeconds;
  } catch {
    return false;
  }
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Deduplicated silent refresh using the stored refresh token (Facebook-style sliding session).
 *
 * Guarantees only 1 network refresh request executes at any given time to eliminate
 * Supabase refresh token rotation reuse detection race conditions.
 *
 * Resilient against network drops: offline launches and transient connectivity drops
 * will NEVER revoke or log out the session. Only explicit server revocation (401/403
 * with invalid/revoked token or banned account) will expire the local session.
 */
export async function performSilentRefresh(force = false): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getPersistedItem(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        return null;
      }

      // Check if current access token is already valid when not forced
      if (!force) {
        const currentAccessToken = await getPersistedItem(ACCESS_TOKEN_KEY);
        if (currentAccessToken && !isJwtExpired(currentAccessToken, 90)) {
          return currentAccessToken;
        }
      }

      const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
      let res: Response;
      try {
        res = await fetch(refreshUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });
      } catch (fetchErr: any) {
        // Network error / offline / server unreachable:
        // KEEP SESSION INTACT! Never log out on transient network failure.
        console.warn("[Auth] Silent refresh network error (device offline or server unreachable):", fetchErr?.message);
        return null;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        const errMsg = String(errorData?.message || "").toLowerCase();
        console.warn(`[Auth] Refresh endpoint returned status ${res.status}:`, errMsg);

        // Check for account ban or suspension first
        if (
          errorData?.is_banned ||
          errorData?.status === "banned" ||
          errorData?.is_suspended ||
          errorData?.status === "suspended"
        ) {
          notifyAccountBanned(errorData);
          return null;
        }

        // ONLY treat as revoked if status is 401/403 AND explicitly indicates invalid/revoked token
        const isExplicitRevocation =
          (res.status === 401 || res.status === 403) &&
          (errMsg.includes("invalid") ||
            errMsg.includes("expired") ||
            errMsg.includes("revoked") ||
            errMsg.includes("not found") ||
            errMsg.includes("signed out") ||
            errMsg.includes("session invalid"));

        if (isExplicitRevocation) {
          console.warn("[Auth] Refresh token was explicitly revoked by server. Expiring session.");
          notifySessionExpired();
        } else {
          // 5xx, rate limits, maintenance: preserve local session for offline resilience
          console.warn("[Auth] Server returned non-revocation error. Preserving session for offline use.");
        }
        return null;
      }

      const refreshData = await res.json().catch(() => null);
      const newAccessToken = refreshData?.accessToken;
      const newRefreshToken = refreshData?.refreshToken || storedRefreshToken;

      if (!newAccessToken) {
        return null;
      }

      // Persist across both SecureStore and AsyncStorage layers
      await Promise.all([
        setPersistedItem(ACCESS_TOKEN_KEY, newAccessToken),
        setPersistedItem(REFRESH_TOKEN_KEY, newRefreshToken),
        refreshData?.user
          ? setPersistedItem(USER_CACHE_KEY, JSON.stringify(refreshData.user))
          : Promise.resolve(),
        setPersistedItem(
          SESSION_CACHE_KEY,
          JSON.stringify({ ...refreshData, accessToken: newAccessToken, refreshToken: newRefreshToken })
        ),
      ]);

      notifyTokenRefreshed(newAccessToken, refreshData?.user);
      return newAccessToken;
    } catch (err: any) {
      console.warn("[Auth] Unexpected silent refresh error:", err);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Thin fetch wrapper around the Express API.
 *
 * - Prefixes every path with API_BASE_URL + /api
 * - Sends/parses JSON automatically
 * - Attaches `Authorization: Bearer <token>` when accessToken is passed (or stored)
 * - Automatically attempts silent token refresh and single retry on 401
 * - Notifies session listeners when refresh succeeds or fails
 * - Throws ApiError({ message, status }) on any non-2xx response,
 *   matching the backend's errorHandler.ts shape exactly.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, accessToken, noContent = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let tokenToUse = accessToken;
  const isAuthRoute =
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/otp") ||
    path.startsWith("/auth/forgot-password") ||
    path.startsWith("/auth/password-reset") ||
    path.startsWith("/auth/reset-password") ||
    path.startsWith("/auth/check-email");

  if (!tokenToUse && !isAuthRoute) {
    tokenToUse = await getPersistedItem(ACCESS_TOKEN_KEY);

    // Proactive refresh (Facebook-style): if token is expired or expiring within 60s,
    // refresh it seamlessly before dispatching the request so the user never sees 401s!
    if (tokenToUse && isJwtExpired(tokenToUse, 60)) {
      const refreshedToken = await performSilentRefresh(true);
      if (refreshedToken) {
        tokenToUse = refreshedToken;
      }
    }
  }

  if (tokenToUse) {
    headers.Authorization = `Bearer ${tokenToUse}`;
  }

  let response: Response;
  const fullUrl = `${API_BASE_URL}/api${path}`;

  try {
    response = await fetch(fullUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err: any) {
    console.error(`[API Error] ${method} ${fullUrl} failed:`, err);
    throw new ApiError(
      err?.message
        ? `Cannot connect to backend (${fullUrl}): ${err.message}`
        : `Unable to reach backend at ${fullUrl}. Check connection.`,
      0
    );
  }

  // Intercept 401 Unauthorized for authenticated endpoints
  if (response.status === 401 && !isAuthRoute) {
    const refreshedToken = await performSilentRefresh(true);
    if (refreshedToken) {
      // Retry once with refreshed access token
      headers.Authorization = `Bearer ${refreshedToken}`;
      try {
        response = await fetch(fullUrl, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (retryErr: any) {
        throw new ApiError(
          retryErr?.message
            ? `Cannot connect to backend (${fullUrl}): ${retryErr.message}`
            : `Unable to reach backend at ${fullUrl}. Check connection.`,
          0
        );
      }
    } else {
      console.warn(`[API] 401 on ${path}. performSilentRefresh handled revocation check.`);
    }
  }

  if (noContent || response.status === 204) {
    if (!response.ok) {
      throw new ApiError("Request failed", response.status);
    }
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 403 && data && typeof data === "object" && ((data as any).is_banned || (data as any).status === "banned" || (data as any).is_suspended || (data as any).status === "suspended")) {
      notifyAccountBanned(data);
    }
    const isMaintenance =
      response.status === 503 &&
      Boolean(data && typeof data === "object" && "maintenance" in data && (data as any).maintenance);
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : "Something went wrong";
    throw new ApiError(message, response.status, isMaintenance);
  }

  return data as T;
}