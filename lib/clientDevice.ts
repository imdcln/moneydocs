"use client";

/**
 * Returns a persistent unique device ID for this client/browser.
 * Stored in localStorage and mirrored into a cookie so both client and
 * server endpoints can identify the physical session.
 */
export function getClientDeviceId(): string {
  if (typeof window === "undefined") return "";

  try {
    let id = localStorage.getItem("dclne_device_id");
    if (!id || !id.startsWith("dev_")) {
      id = "dev_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
      localStorage.setItem("dclne_device_id", id);
    }
    // Also ensure cookie is kept up to date (1 year expiry)
    document.cookie = `dclne_device_id=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
    return id;
  } catch {
    return "";
  }
}
