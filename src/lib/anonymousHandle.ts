export const ANON_HANDLE_REGEX = /^CHMSUAN #(?!0+\b)\d{3,5}$/i;
const EMBEDDED_CHMSUAN_REGEX = /\bCHMSUAN #(?!0+\b)\d{3,5}\b/i;

export const ANON_ANIMAL_KEYS = [
  "fox",
  "wolf",
  "whale",
  "owl",
  "panda",
  "otter",
  "falcon",
  "koala",
  "lynx",
  "dolphin",
  "raven",
  "badger",
] as const;

const VALID_ANIMAL_SET = new Set<string>(ANON_ANIMAL_KEYS);

export function isAnonymousAvatarKey(value?: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  return VALID_ANIMAL_SET.has(value.trim().toLowerCase());
}

/**
 * Resolves the user's single persistent anonymous avatar key ("fox", "wolf", "owl", ...)
 * across Feed, Comments, Discovery, Conversations, Notifications, Requests, and Profile Visit.
 */
export function getAnonymousAvatarKey(
  entity?: any,
  fallbackKey?: string | null,
  userIdFallback?: string | null
): string {
  const candidates = [
    entity?.anonymous_avatar,
    entity?.anonymousAvatar,
    entity?.avatarKey,
    entity?.avatar_key,
    entity?.partnerAvatar,
    entity?.partner_avatar,
    entity?.avatar_preset_id,
    entity?.avatarPresetId,
    entity?.from_user?.anonymous_avatar,
    entity?.from_user?.avatarKey,
    entity?.author?.anonymous_avatar,
    entity?.author?.avatarKey,
    entity?.fromUserAvatar,
    entity?.from_user_avatar,
    entity?.avatar,
    fallbackKey,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && isAnonymousAvatarKey(c)) {
      return c.trim().toLowerCase();
    }
  }

  const resolvedUserId =
    userIdFallback ||
    entity?.author_id ||
    entity?.authorId ||
    entity?.from_user_id ||
    entity?.fromUserId ||
    entity?.partnerUserId ||
    entity?.partnerId ||
    entity?.from_user?.id ||
    entity?.author?.id ||
    (entity && !("is_read" in entity) && !("conversation_members" in entity) ? entity.id : null);

  if (typeof resolvedUserId === "string" && resolvedUserId.trim() && resolvedUserId !== "anonymous" && resolvedUserId !== "default") {
    const clean = resolvedUserId.trim();
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
    }
    return ANON_ANIMAL_KEYS[hash % ANON_ANIMAL_KEYS.length];
  }

  return "fox";
}

export function isChmsuanHandle(name?: string | null): boolean {
  if (!name) return false;
  return ANON_HANDLE_REGEX.test(String(name).trim());
}

export function extractChmsuanHandle(text?: string | null): string | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (ANON_HANDLE_REGEX.test(trimmed)) return trimmed.toUpperCase();
  const match = trimmed.match(EMBEDDED_CHMSUAN_REGEX);
  return match ? match[0].toUpperCase() : null;
}

export function isAnonymousHandle(name?: string | null): boolean {
  if (!name) return false;
  const n = String(name).trim();
  return (
    ANON_HANDLE_REGEX.test(n) ||
    /^CHMSUAN\b/i.test(n) ||
    n.toLowerCase().startsWith("anonymous")
  );
}

function isLegacyGenericAlias(name?: string | null): boolean {
  if (!name) return true;
  const lower = String(name).trim().toLowerCase();
  return (
    !lower ||
    lower === "anonymous" ||
    lower === "@anonymous" ||
    lower.startsWith("anonymous ") ||
    /^chmsuan #0+$/i.test(lower)
  );
}

/**
 * Resolves the user's single persistent `profiles.anonymous_handle` ("CHMSUAN #<digits>")
 * supplied by the backend across Feed, Comments, Discovery, Conversations, Notifications, and Profile Visit.
 * Never invents client-side random/hashed numbers so handles stay 100% consistent with the database.
 */
export function getAnonymousDisplayName(
  entity?: any,
  fallback?: string | null,
  _userIdFallback?: string | null
): string {
  const directCandidates = [
    entity?.anonymous_handle,
    entity?.anonymousHandle,
    entity?.partnerAlias,
    entity?.from_user?.anonymous_handle,
    entity?.from_user?.anonymousHandle,
    entity?.author?.anonymous_handle,
    entity?.author?.anonymousHandle,
  ];

  for (const h of directCandidates) {
    const extracted = extractChmsuanHandle(h);
    if (extracted) return extracted;
  }

  const nameCandidates = [
    entity?.full_name,
    entity?.fullName,
    entity?.author_name,
    entity?.name,
    entity?.fromUserName,
    entity?.from_user?.full_name,
    entity?.title,
    fallback,
    entity?.description,
  ];

  for (const c of nameCandidates) {
    const extracted = extractChmsuanHandle(c);
    if (extracted) return extracted;
  }

  const handleField = entity?.anonymous_handle || entity?.anonymousHandle;
  if (typeof handleField === "string" && handleField.trim() && !isLegacyGenericAlias(handleField)) {
    return handleField.trim();
  }

  if (typeof fallback === "string" && fallback.trim() && !isLegacyGenericAlias(fallback)) {
    return fallback.trim();
  }

  return "CHMSU Student";
}
