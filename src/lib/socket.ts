import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/constants";
import { notifySessionExpired, notifyAccountBanned } from "./api/client";

// Socket.io attaches to the HTTP server root — strip a trailing /api if present.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

let socket: Socket | null = null;
let activeToken: string | null = null;

/**
 * Returns the shared socket, creating it on first call with the given token.
 * Re-creates the connection when the access token changes (login/logout).
 */
export function getSocket(accessToken?: string | null): Socket | null {
  if (!SOCKET_URL) return null;

  const token = accessToken ?? activeToken;
  if (!token) return null;

  if (socket && activeToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    activeToken = token;
    socket = io(SOCKET_URL, {
      auth: { token, platform: 'app' },
      query: { platform: 'app' },
      autoConnect: true,
      reconnection: true,
      transports: ["websocket", "polling"],
    });

    socket.on("auth:revoked", (payload: any) => {
      console.warn("[MobileSocket] Session revoked by server:", payload);
      if (payload?.reason === "banned" || payload?.is_banned || payload?.reason === "suspended" || payload?.is_suspended) {
        notifyAccountBanned(payload);
      } else {
        notifySessionExpired();
      }
    });

    socket.on("user:banned", (payload: any) => {
      console.warn("[MobileSocket] user:banned received:", payload);
      notifyAccountBanned(payload);
    });

    socket.on("user:suspended", (payload: any) => {
      console.warn("[MobileSocket] user:suspended received:", payload);
      notifyAccountBanned(payload);
    });
  }

  return socket;
}

export function initSocket(accessToken: string): Socket | null {
  return getSocket(accessToken);
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  activeToken = null;
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}
