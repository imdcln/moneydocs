"use client";

import React, { useEffect, useState } from "react";

interface LoadingOverlayProps {
  onLoaded?: () => void;
}

export function LoadingOverlay({ onLoaded }: LoadingOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const timer1 = setTimeout(() => {
      setProgress(100);
    }, 100);

    const timer2 = setTimeout(() => {
      setHidden(true);
      if (onLoaded) onLoaded();
    }, 1100);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onLoaded]);

  if (hidden) return null;

  return (
    <div
      id="loading-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 pointer-events-none transition-opacity duration-500"
      style={{ opacity: progress === 100 ? 0 : 1 }}
    >
      <div className="text-center font-pixel-heading text-[var(--text-color)]">
        <div className="text-xl md:text-2xl mb-5 animate-pulse">
          Loading Portfolio...
        </div>
        <div className="w-64 h-5 border-2 border-[var(--border-color)] p-0.5 mx-auto bg-black/40">
          <div
            className="h-full bg-[var(--accent-color)] transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
