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
  onTokenRefreshed?: (newToken: string) => void;
};

const authListeners = new Set<AuthListener>();

export function registerAuthSessionListener(listener: AuthListener): () => void {
  authListeners.add(listener);
  return () => {
    authListeners.delete(listener);
  };
}

function notifyTokenRefreshed(newToken: string) {
  authListeners.forEach((l) => l.onTokenRefreshed?.(newToken));
}

export function notifySessionExpired() {
  authListeners.forEach((l) => l.onSessionExpired?.());
}

let refreshPromise: Promise<string | null> | null = null;

/**
 * Deduplicated silent refresh using the stored refresh token.
 * Guarantees only 1 network refresh request executes at any given time.
 */
async function performSilentRefresh(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const storedRefreshToken = await getPersistedItem(REFRESH_TOKEN_KEY);
      if (!storedRefreshToken) {
        return null;
      }

      const refreshUrl = `${API_BASE_URL}/api/auth/refresh`;
      const res = await fetch(refreshUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!res.ok) {
        return null;
      }

      const refreshData = await res.json().catch(() => null);
      const newAccessToken = refreshData?.accessToken;
      const newRefreshToken = refreshData?.refreshToken || storedRefreshToken;

      if (!newAccessToken) {
        return null;
      }

      await setPersistedItem(ACCESS_TOKEN_KEY, newAccessToken);
      if (newRefreshToken) {
        await setPersistedItem(REFRESH_TOKEN_KEY, newRefreshToken);
      }
      if (refreshData?.user) {
        await setPersistedItem(USER_CACHE_KEY, JSON.stringify(refreshData.user));
      }
      await setPersistedItem(
        SESSION_CACHE_KEY,
        JSON.stringify({ ...refreshData, refreshToken: newRefreshToken })
      );

      notifyTokenRefreshed(newAccessToken);
      return newAccessToken;
    } catch {
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
  if (!tokenToUse && !path.startsWith("/auth/")) {
    tokenToUse = await getPersistedItem(ACCESS_TOKEN_KEY);
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
  const isAuthRoute =
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/register") ||
    path.startsWith("/auth/otp") ||
    path.startsWith("/auth/forgot-password") ||
    path.startsWith("/auth/reset-password");

  if (response.status === 401 && !isAuthRoute) {
    const refreshedToken = await performSilentRefresh();
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
      console.warn(`[API] 401 Unauthorized on ${path} and refresh failed. Notifying session expired.`);
      notifySessionExpired();
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