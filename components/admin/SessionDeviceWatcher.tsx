"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";
import { getClientDeviceId } from "@/lib/clientDevice";

/**
 * SessionDeviceWatcher operates like WhatsApp Web session monitoring:
 * Constantly verifies that the current device has not been disconnected by another session.
 * If disconnected, it immediately logs the user out and redirects to /auth/signin?disconnected=1.
 */
export default function SessionDeviceWatcher() {
  const isKickingOutRef = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem("google_signin_pending");
    } catch {}
    const deviceId = getClientDeviceId();
    if (!deviceId) return;

    const checkDeviceSession = async () => {
      if (isKickingOutRef.current) return;

      try {
        const res = await fetch(`/api/finance/user/session-check?deviceId=${encodeURIComponent(deviceId)}`, {
          method: "GET",
          headers: {
            "x-device-id": deviceId,
          },
          cache: "no-store",
        });

        if (res.status === 401) {
          const data = await res.json().catch(() => ({}));
          if (data.reason === "DEVICE_DISCONNECTED" || data.reason === "UNAUTHENTICATED") {
            isKickingOutRef.current = true;
            if (data.reason === "DEVICE_DISCONNECTED") {
              try {
                localStorage.removeItem("dclne_device_id");
                document.cookie = "dclne_device_id=; path=/; max-age=0; SameSite=Lax";
              } catch {}
            }
            // Kick out immediately
            await signOut({ redirect: true, callbackUrl: "/auth/signin?disconnected=1" });
          }
        }
      } catch {
        // Network glitches shouldn't immediately log out
      }
    };

    // Run first check promptly after load
    const initialTimer = setTimeout(checkDeviceSession, 1200);

    // Poll every 3.5 seconds
    const interval = setInterval(checkDeviceSession, 3500);

    // Also check on tab focus or visibility return
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkDeviceSession();
      }
    };

    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return null;
}
