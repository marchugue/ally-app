import { useEffect, useRef, useState } from "react";
import { getPasswordResetSocket, disconnectPasswordResetSocket } from "@/lib/socket/passwordReset";
import * as authApi from "@/lib/api/auth";

const POLL_MS = 4_000;

export function usePasswordResetWatch(trackingToken: string | null) {
  const [completed, setCompleted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!trackingToken) return;

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const status = await authApi.getPasswordResetStatus(trackingToken);
        if (!cancelled && status.status === "completed") {
          setCompleted(true);
        }
      } catch {
        /* ignore */
      }
    };

    void checkStatus();
    pollRef.current = setInterval(checkStatus, POLL_MS);

    const socket = getPasswordResetSocket(trackingToken);
    const onCompleted = () => {
      if (!cancelled) setCompleted(true);
    };
    socket?.on("password_reset:completed", onCompleted);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      socket?.off("password_reset:completed", onCompleted);
      disconnectPasswordResetSocket();
    };
  }, [trackingToken]);

  return { completed };
}
