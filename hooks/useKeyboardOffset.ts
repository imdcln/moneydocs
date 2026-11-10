"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect mobile virtual keyboard height / viewport offset.
 * Uses window.visualViewport to determine if a virtual keyboard is open
 * and how many pixels it takes from the bottom of the screen.
 */
export function useKeyboardOffset() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // Calculate distance between bottom of visual viewport and bottom of layout window
      const offset = Math.max(0, window.innerHeight - (vv.height + (vv.offsetTop || 0)));
      // Viewport shifts under 60px are typically mobile URL bar / home indicator changes
      setKeyboardHeight(offset > 60 ? offset : 0);
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);

    // Initial check
    handleResize();

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return keyboardHeight;
}
