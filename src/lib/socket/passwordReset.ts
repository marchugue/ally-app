import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "@/constants";

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

let resetSocket: Socket | null = null;
let activeTracking: string | null = null;

/** Anonymous socket scoped to a password-reset tracking token (no login required). */
export function getPasswordResetSocket(trackingToken: string): Socket | null {
  if (!SOCKET_URL || !trackingToken) return null;

  if (resetSocket && activeTracking !== trackingToken) {
    resetSocket.disconnect();
    resetSocket = null;
  }

  if (!resetSocket) {
    activeTracking = trackingToken;
    resetSocket = io(SOCKET_URL, {
      auth: { passwordResetTracking: trackingToken },
      autoConnect: true,
      reconnection: true,
      transports: ["websocket", "polling"],
    });
  }

  return resetSocket;
}

export function disconnectPasswordResetSocket(): void {
  resetSocket?.disconnect();
  resetSocket = null;
  activeTracking = null;
}
