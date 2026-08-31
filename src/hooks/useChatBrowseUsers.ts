import { useEffect, useState } from "react";
import { listAllies } from "@/lib/api/interaction";
import { listProfiles } from "@/lib/api/profiles";
import type { ChatBrowseUserInput } from "@/lib/chatUserSearch";

function allyToBrowseInput(ally: {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  course: string | null;
}): ChatBrowseUserInput {
  return {
    id: ally.id,
    name: ally.username ? `@${ally.username}` : ally.fullName ?? "Student",
    username: ally.username,
    avatar: ally.avatarUrl,
    course: ally.course,
  };
}

export function useChatBrowseUsers(
  userId: string | null,
  accessToken: string | null,
  enabled: boolean,
) {
  const [allies, setAllies] = useState<ChatBrowseUserInput[]>([]);
  const [profiles, setProfiles] = useState<ChatBrowseUserInput[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId || !accessToken || !enabled) {
      setAllies([]);
      setProfiles([]);
      return;
    }

    let cancelled = false;

    async function loadAllies() {
      const items = [];
      let cursor: string | null = null;

      do {
        const page = await listAllies(userId!, accessToken!, cursor);
        items.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);

      return items.map(allyToBrowseInput);
    }

    async function load() {
      setIsLoading(true);
      try {
        const [allyItems, profileItems] = await Promise.all([
          loadAllies(),
          listProfiles(accessToken!, userId!),
        ]);

        if (cancelled) return;

        setAllies(allyItems);
        setProfiles(
          profileItems.map((profile) => ({
            id: profile.id,
            name: profile.username ? `@${profile.username}` : profile.full_name ?? "Student",
            username: profile.username,
            avatar: profile.avatar_url ?? null,
            course: profile.course ?? null,
          })),
        );
      } catch (err) {
        console.warn("Failed to load chat browse users:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, accessToken, enabled]);

  return { allies, profiles, isLoading };
}
