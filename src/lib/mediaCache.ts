import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image as ExpoImage } from "expo-image";
import { getFallbackImageUri, resolveImageUri } from "@/components/UserAvatar";

const MEDIA_CACHE_STORAGE_KEY = "@ally/media_uri_cache_v1";
const MAX_CACHED_ENTRIES = 200;

// L1 in-memory map: normalized remote URL -> cached local URI (file:// / content://)
const remoteToLocalMap = new Map<string, string>();
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function isLocalUri(uri: string): boolean {
  return (
    uri.startsWith("file://") ||
    uri.startsWith("content://") ||
    uri.startsWith("ph://") ||
    uri.startsWith("assets-library://") ||
    uri.startsWith("blob:") ||
    uri.startsWith("data:")
  );
}

async function hydrateMediaCache(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(MEDIA_CACHE_STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (Array.isArray(entries)) {
      for (const pair of entries) {
        if (
          Array.isArray(pair) &&
          typeof pair[0] === "string" &&
          typeof pair[1] === "string" &&
          pair[0] &&
          pair[1]
        ) {
          if (!remoteToLocalMap.has(pair[0])) {
            remoteToLocalMap.set(pair[0], pair[1]);
          }
        }
      }
    }
  } catch {
    // Ignore corrupted cache
  }
}

void hydrateMediaCache();

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      const entries = Array.from(remoteToLocalMap.entries()).slice(-MAX_CACHED_ENTRIES);
      await AsyncStorage.setItem(MEDIA_CACHE_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Ignore storage quota errors
    }
  }, 400);
}

/**
 * Registers a mapping between an uploaded remote CDN URL and its already-cached
 * local device URI so reconciling an optimistic media message does not flash or
 * re-download from the network. Also warms ExpoImage's memory-disk cache.
 */
export function registerUploadedMediaCache(remoteUrl: string, localUri: string): void {
  if (!remoteUrl || !localUri || isLocalUri(remoteUrl)) return;

  const resolvedRemote = resolveImageUri(remoteUrl) || remoteUrl;
  const fallbackRemote = getFallbackImageUri(resolvedRemote);

  remoteToLocalMap.set(remoteUrl, localUri);
  remoteToLocalMap.set(resolvedRemote, localUri);
  if (fallbackRemote) {
    remoteToLocalMap.set(fallbackRemote, localUri);
  }

  // Keep map bounded
  while (remoteToLocalMap.size > MAX_CACHED_ENTRIES * 2) {
    const oldestKey = remoteToLocalMap.keys().next().value;
    if (!oldestKey) break;
    remoteToLocalMap.delete(oldestKey);
  }

  schedulePersist();

  try {
    void ExpoImage.prefetch(resolvedRemote, "memory-disk");
  } catch {
    // Best-effort prefetch
  }
}

/**
 * Resolves a message image URI through the client-side media cache.
 * Returns any cached local URI first, otherwise the normalized CDN URI.
 */
export function resolveCachedMediaUri(input: any): string | null {
  const resolved = resolveImageUri(input);
  if (!resolved) return null;
  if (isLocalUri(resolved)) return resolved;

  const cached =
    remoteToLocalMap.get(resolved) ||
    (typeof input === "string" ? remoteToLocalMap.get(input.trim()) : undefined);
  if (cached) return cached;

  const fallback = getFallbackImageUri(resolved);
  if (fallback) {
    const cachedFallback = remoteToLocalMap.get(fallback);
    if (cachedFallback) return cachedFallback;
  }

  return resolved;
}

/**
 * Pre-warms a list of remote image URLs in ExpoImage's memory-disk cache.
 */
export function prefetchChatMedia(urls: string[]): void {
  const remoteUrls = urls
    .map((u) => resolveImageUri(u))
    .filter((u): u is string => typeof u === "string" && u.length > 0 && !isLocalUri(u) && u !== "[removed]");
  if (remoteUrls.length === 0) return;
  try {
    void ExpoImage.prefetch(remoteUrls, "memory-disk");
  } catch {
    // Best-effort prefetch
  }
}
