export interface ChatBrowseUserInput {
  id: string;
  name: string;
  username?: string | null;
  avatar: string | null;
  course?: string | null;
}

export interface ChatBrowseUser extends ChatBrowseUserInput {
  isAlly: boolean;
  score: number;
}

export interface ChatBrowseResults {
  allies: ChatBrowseUser[];
  others: ChatBrowseUser[];
}

export const CHAT_LIST_DEFAULT_MAX = 10;

export function getSearchScore(
  query: string,
  name: string,
  username?: string | null,
  course?: string | null,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const nameLower = name.toLowerCase();
  const handle = username ? `@${username}`.toLowerCase() : "";
  const handleBare = (username ?? "").toLowerCase();
  const courseLower = (course ?? "").toLowerCase();

  if (nameLower === q || handle === q || handleBare === q) return 100;
  if (nameLower.startsWith(q) || handle.startsWith(q) || handleBare.startsWith(q)) return 85;
  if (nameLower.includes(q) || handle.includes(q) || handleBare.includes(q)) return 70;
  if (courseLower.includes(q)) return 45;

  const words = [nameLower, handleBare, ...nameLower.split(/\s+/)].filter(Boolean);
  if (words.some((word) => word.startsWith(q))) return 55;

  return 0;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function toBrowseUser(input: ChatBrowseUserInput, isAlly: boolean, query: string): ChatBrowseUser {
  return {
    ...input,
    isAlly,
    score: query ? getSearchScore(query, input.name, input.username, input.course) : isAlly ? 1 : 0,
  };
}

export function buildChatBrowseResults(params: {
  query: string;
  allies: ChatBrowseUserInput[];
  allProfiles: ChatBrowseUserInput[];
  existingParticipantIds: Set<string>;
  maxItems: number;
}): ChatBrowseResults {
  const { query, allies, allProfiles, existingParticipantIds, maxItems } = params;
  const trimmedQuery = query.trim();
  const allyIds = new Set(allies.map((ally) => ally.id));

  const alliesWithoutConv = allies
    .filter((ally) => !existingParticipantIds.has(ally.id))
    .map((ally) => toBrowseUser(ally, true, trimmedQuery));

  const othersWithoutConv = allProfiles
    .filter((profile) => !allyIds.has(profile.id) && !existingParticipantIds.has(profile.id))
    .map((profile) => toBrowseUser(profile, false, trimmedQuery));

  if (!trimmedQuery) {
    return {
      allies: alliesWithoutConv.slice(0, maxItems),
      others: [],
    };
  }

  const matchedAllies = alliesWithoutConv
    .filter((user) => user.score > 0)
    .sort((a, b) => b.score - a.score);
  const matchedOthers = othersWithoutConv
    .filter((user) => user.score > 0)
    .sort((a, b) => b.score - a.score);

  let resultAllies = [...matchedAllies];
  let resultOthers = [...matchedOthers];
  let remaining = maxItems - resultAllies.length - resultOthers.length;

  if (remaining > 0) {
    const fillerAllies = shuffleInPlace(
      alliesWithoutConv.filter((user) => user.score === 0),
    ).slice(0, remaining);
    resultAllies = [...resultAllies, ...fillerAllies];
    remaining = maxItems - resultAllies.length - resultOthers.length;
  }

  if (remaining > 0) {
    const fillerOthers = shuffleInPlace(
      othersWithoutConv.filter((user) => user.score === 0),
    ).slice(0, remaining);
    resultOthers = [...resultOthers, ...fillerOthers];
  }

  const allySlots = Math.min(resultAllies.length, maxItems);
  const otherSlots = Math.min(resultOthers.length, Math.max(0, maxItems - allySlots));

  return {
    allies: resultAllies.slice(0, allySlots),
    others: resultOthers.slice(0, otherSlots),
  };
}
