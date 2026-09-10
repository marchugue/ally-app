import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { useAuth } from "@/lib/auth/AuthContext";
import { sendHeartbeat, getOnlinePresence } from "@/lib/api/presense";
import { getSocket } from "@/lib/socket";

interface PresenceContextValue {
  onlineUserIds: Set<string>;
  isOnline: (userId?: string | null) => boolean;
  refreshOnlineUsers: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUserIds: new Set(),
  isOnline: () => false,
  refreshOnlineUsers: async () => {},
});

const HEARTBEAT_INTERVAL_MS = 25000; // 25s
const POLL_INTERVAL_MS = 15000; // 15s

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const refreshOnlineUsers = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await getOnlinePresence(accessToken);
      const ids = new Set<string>();

      if (Array.isArray(res.userIds)) {
        res.userIds.forEach((id) => {
          if (id) {
            ids.add(id);
            ids.add(id.toLowerCase());
          }
        });
      }

      if (Array.isArray(res.online)) {
        res.online.forEach((entry) => {
          if (entry?.user_id) {
            ids.add(entry.user_id);
            ids.add(entry.user_id.toLowerCase());
          }
        });
      }

      setOnlineUserIds(ids);
    } catch {
      // Best-effort presence check
    }
  }, [accessToken]);

  const doHeartbeat = useCallback(async () => {
    if (!accessToken) return;
    try {
      await sendHeartbeat(accessToken);
    } catch {
      // Best-effort heartbeat
    }
  }, [accessToken]);

  // Periodic heartbeat and poll
  useEffect(() => {
    if (!user || !accessToken) {
      setOnlineUserIds(new Set());
      return;
    }

    void doHeartbeat();
    void refreshOnlineUsers();

    const heartbeatTimer = setInterval(() => {
      void doHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    const pollTimer = setInterval(() => {
      void refreshOnlineUsers();
    }, POLL_INTERVAL_MS);

    // AppState listener: instantly refresh when app comes to foreground
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        void doHeartbeat();
        void refreshOnlineUsers();
      }
    };

    const appStateSub = AppState.addEventListener("change", handleAppStateChange);

    // Socket.io presence events (if emitted by backend)
    const socket = getSocket(accessToken);
    const onUserOnline = (payload: { userId?: string; user_id?: string }) => {
      const id = payload?.userId || payload?.user_id;
      if (id) {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          next.add(id.toLowerCase());
          return next;
        });
      }
    };

    const onUserOffline = (payload: { userId?: string; user_id?: string }) => {
      const id = payload?.userId || payload?.user_id;
      if (id) {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          next.delete(id.toLowerCase());
          return next;
        });
      }
    };

    if (socket) {
      socket.on("presence:online", onUserOnline);
      socket.on("presence:offline", onUserOffline);
    }

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(pollTimer);
      appStateSub.remove();
      if (socket) {
        socket.off("presence:online", onUserOnline);
        socket.off("presence:offline", onUserOffline);
      }
    };
  }, [user?.id, accessToken, doHeartbeat, refreshOnlineUsers]);

  const isOnline = useCallback(
    (userId?: string | null): boolean => {
      if (!userId) return false;
      return (
        onlineUserIds.has(userId) ||
        onlineUserIds.has(userId.toLowerCase())
      );
    },
    [onlineUserIds]
  );

  return (
    <PresenceContext.Provider value={{ onlineUserIds, isOnline, refreshOnlineUsers }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  return useContext(PresenceContext);
}
