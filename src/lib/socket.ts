import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/constants";

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
      auth: { token },
      autoConnect: true,
      reconnection: true,
      transports: ["websocket", "polling"],
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
