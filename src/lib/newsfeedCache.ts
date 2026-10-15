// src/lib/newsfeedCache.ts
//
// Newsfeed client cache for mobile (AsyncStorage + L1 in-memory cache).
// Stores up to 20 posts per filter tab.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedPost } from '@/types/feed';

const FEED_CACHE_KEY_PREFIX = 'ally_newsfeed_cache_v1_';
const MAX_CACHED_POSTS = 20;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedFeed {
  posts: FeedPost[];
  cachedAt: number;
  latestPostId: string | null;
  latestCreatedAt: string | null;
}

// In-memory cache for synchronous 0ms access
const memoryCache = new Map<string, CachedFeed>();

function buildKey(filter: string, userId?: string | null): string {
  const uid = userId || 'anonymous';
  return `${FEED_CACHE_KEY_PREFIX}${uid}_${filter}`;
}

export const newsfeedCache = {
  /**
   * Synchronously get cached posts from memory if available
   */
  getMemory(filter: string, userId?: string | null): CachedFeed | null {
    const key = buildKey(filter, userId);
    return memoryCache.get(key) || null;
  },

  /**
   * Get cached feed: memory first, then AsyncStorage
   */
  async get(filter: string, userId?: string | null): Promise<CachedFeed | null> {
    const key = buildKey(filter, userId);
    const inMem = memoryCache.get(key);
    if (inMem) return inMem;

    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const parsed: CachedFeed = JSON.parse(raw);

      if (Date.now() - parsed.cachedAt > MAX_CACHE_AGE_MS) {
        await AsyncStorage.removeItem(key).catch(() => {});
        return null;
      }

      memoryCache.set(key, parsed);
      return parsed;
    } catch {
      return null;
    }
  },

  /**
   * Save up to 20 posts to cache
   */
  async set(filter: string, posts: FeedPost[], userId?: string | null): Promise<void> {
    const key = buildKey(filter, userId);
    const trimmed = posts.slice(0, MAX_CACHED_POSTS);

    const payload: CachedFeed = {
      posts: trimmed,
      cachedAt: Date.now(),
      latestPostId: trimmed[0]?.id ?? null,
      latestCreatedAt: trimmed[0]?.created_at ?? null,
    };

    memoryCache.set(key, payload);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn('[newsfeedCache] Failed to write cache to AsyncStorage:', err);
    }
  },

  /**
   * Update a single post in cache (e.g. for optimistic likes)
   */
  async updatePost(filter: string, updatedPost: FeedPost, userId?: string | null): Promise<void> {
    const key = buildKey(filter, userId);
    const existing = memoryCache.get(key) || (await this.get(filter, userId));
    if (!existing) return;

    const updatedPosts = existing.posts.map((p) => (p.id === updatedPost.id ? updatedPost : p));
    const payload: CachedFeed = {
      ...existing,
      posts: updatedPosts,
      cachedAt: Date.now(),
    };

    memoryCache.set(key, payload);
    try {
      await AsyncStorage.setItem(key, JSON.stringify(payload));
    } catch {
      // Ignore write errors
    }
  },

  /**
   * Clear cache
   */
  async clear(filter?: string, userId?: string | null): Promise<void> {
    if (filter) {
      const key = buildKey(filter, userId);
      memoryCache.delete(key);
      try {
        await AsyncStorage.removeItem(key);
      } catch {}
    } else {
      memoryCache.clear();
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const feedKeys = allKeys.filter((k) => k.startsWith(FEED_CACHE_KEY_PREFIX));
        if (feedKeys.length > 0) {
          await AsyncStorage.multiRemove(feedKeys);
        }
      } catch {}
    }
  },
};
