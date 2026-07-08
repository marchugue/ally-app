import { API_BASE_URL } from "@/constants";
import { ApiError } from "./apiError";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  noContent?: boolean;
}

/**
 * Thin fetch wrapper around the Express API.
 *
 * - Prefixes every path with API_BASE_URL + /api
 * - Sends/parses JSON automatically
 * - Attaches `Authorization: Bearer <token>` when accessToken is passed
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

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Network failure (no connection, backend unreachable, etc.)
    throw new ApiError("Unable to reach the server. Check your connection.", 0);
  }

  if (noContent || response.status === 204) {
    if (!response.ok) {
      throw new ApiError("Request failed", response.status);
    }
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : "Something went wrong";
    throw new ApiError(message, response.status);
  }

  return data as T;
}