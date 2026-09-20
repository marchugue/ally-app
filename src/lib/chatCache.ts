import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Conversation, Message } from "@/types/conversation";

const CONVERSATIONS_CACHE_KEY_PREFIX = "ally_conversations_cache_";
const CHAT_CACHE_KEY_PREFIX = "ally_chat_cache_";
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHED_CONVERSATIONS = 40;
const MAX_CACHED_MESSAGES = 50;

export interface MobileChatCache {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
  cachedAt: number;
}

// ── L1 In-Memory Caches (Synchronous 0ms access) ───────────────────────────
const memoryConversationsCache = new Map<string, Conversation[]>();
const memoryChatCache = new Map<string, MobileChatCache>();

export function getChatCacheKey(convId: string, userId?: string | null): string {
  return userId ? `${CHAT_CACHE_KEY_PREFIX}${userId}_${convId}` : `${CHAT_CACHE_KEY_PREFIX}${convId}`;
}

// ── Conversations (Chat List) Cache ──────────────────────────────────────

/**
 * Synchronously get cached conversations from memory (0ms).
 */
export function getMemoryConversations(userId?: string | null): Conversation[] | null {
  if (!userId) return null;
  return memoryConversationsCache.get(userId) || null;
}

/**
 * Get cached conversations, checking memory first then AsyncStorage.
 */
export async function getCachedConversations(userId: string): Promise<Conversation[] | null> {
  const inMemory = memoryConversationsCache.get(userId);
  if (inMemory && inMemory.length > 0) {
    return inMemory;
  }

  try {
    const raw = await AsyncStorage.getItem(CONVERSATIONS_CACHE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.conversations)) {
      const cachedAt = Number(parsed.cachedAt) || 0;
      if (Date.now() - cachedAt > MAX_CACHE_AGE_MS) {
        await AsyncStorage.removeItem(CONVERSATIONS_CACHE_KEY_PREFIX + userId).catch(() => {});
        return null;
      }
      // Populate memory cache
      memoryConversationsCache.set(userId, parsed.conversations);
      // Also prime chat cache with messages inside these conversations
      primeChatCacheFromConversationsList(parsed.conversations, userId);
      return parsed.conversations;
    }
  } catch {
    // ignore corrupted cache
  }
  return null;
}

/**
 * Set conversations in both memory (sync) and AsyncStorage (async).
 */
export async function setCachedConversations(userId: string, conversations: Conversation[]): Promise<void> {
  // 1. Immediately update L1 memory cache (0ms)
  memoryConversationsCache.set(userId, conversations);

  // 2. Prime chat cache for individual conversations
  primeChatCacheFromConversationsList(conversations, userId);

  // 3. Persist to L2 AsyncStorage in background
  try {
    const toCache = conversations.slice(0, MAX_CACHED_CONVERSATIONS);
    await AsyncStorage.setItem(
      CONVERSATIONS_CACHE_KEY_PREFIX + userId,
      JSON.stringify({
        conversations: toCache,
        cachedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage errors
  }
}

// ── Messages (Single Chat) Cache ──────────────────────────────────────────

/**
 * Synchronously get cached messages from memory (0ms).
 */
export function getMemoryChat(convId: string, userId?: string | null): MobileChatCache | null {
  if (!convId) return null;
  const key = getChatCacheKey(convId, userId);
  return memoryChatCache.get(key) || null;
}

/**
 * Get cached chat, checking memory first then AsyncStorage.
 */
export async function getCachedChat(convId: string, userId?: string | null): Promise<MobileChatCache | null> {
  if (!convId) return null;
  const key = getChatCacheKey(convId, userId);
  const inMemory = memoryChatCache.get(key);
  if (inMemory && inMemory.messages.length > 0) {
    return inMemory;
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.messages)) {
      const cachedAt = Number(parsed.cachedAt) || 0;
      if (Date.now() - cachedAt > MAX_CACHE_AGE_MS) {
        await AsyncStorage.removeItem(key).catch(() => {});
        return null;
      }
      const data: MobileChatCache = {
        messages: parsed.messages,
        hasMore: Boolean(parsed.hasMore),
        nextCursor: parsed.nextCursor ?? null,
        cachedAt,
      };
      memoryChatCache.set(key, data);
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Set chat messages in both memory (sync) and AsyncStorage (async).
 */
export async function setCachedChat(
  convId: string,
  messages: Message[],
  hasMore: boolean,
  nextCursor: string | null,
  userId?: string | null
): Promise<void> {
  if (!convId) return;
  const key = getChatCacheKey(convId, userId);

  const confirmed = messages.filter(
    (m) => !m.id.startsWith("temp-") && m.status !== "failed" && m.status !== "sending"
  );
  const toCache = confirmed.slice(-MAX_CACHED_MESSAGES);
  const entry: MobileChatCache = {
    messages: toCache,
    hasMore,
    nextCursor,
    cachedAt: Date.now(),
  };

  // 1. Update memory cache immediately (0ms)
  memoryChatCache.set(key, entry);

  // 2. Persist to AsyncStorage
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

/**
 * Prime the memory chat cache with initial messages from a conversation.
 * Ensures that when a conversation screen opens, messages are visible at frame 0.
 */
export function primeChatCacheFromConversation(
  convId: string,
  messages: Message[],
  userId?: string | null
): void {
  if (!convId || !messages || messages.length === 0) return;
  const key = getChatCacheKey(convId, userId);
  const existing = memoryChatCache.get(key);
  if (!existing || existing.messages.length === 0) {
    memoryChatCache.set(key, {
      messages,
      hasMore: false,
      nextCursor: null,
      cachedAt: Date.now(),
    });
  }
}

/**
 * Batch prime chat cache from a list of conversations.
 */
export function primeChatCacheFromConversationsList(
  conversations: Conversation[],
  userId?: string | null
): void {
  for (const conv of conversations) {
    if (conv.id && conv.messages && conv.messages.length > 0) {
      primeChatCacheFromConversation(conv.id, conv.messages, userId);
    }
  }
}
