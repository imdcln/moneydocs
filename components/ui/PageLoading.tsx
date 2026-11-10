"use client";

import React from "react";
import Image from "next/image";

interface PageLoadingProps {
  title?: string;
  subtitle?: string;
  fullScreen?: boolean;
  className?: string;
  iconSrc?: string;
}

export default function PageLoading({
  title = "Loading...",
  subtitle = "Please wait a moment",
  fullScreen = false,
  className = "",
  iconSrc = "/assets/icons/favicon2.png",
}: PageLoadingProps) {
  const content = (
    <div className="flex flex-col items-center justify-center text-center p-6 space-y-4 animate-fade-in relative z-10">
      {/* Ambient glow in primary theme color */}
      <div
        className="absolute -inset-10 w-48 h-48 mx-auto rounded-full blur-3xl opacity-25 pointer-events-none transition-colors duration-500"
        style={{ backgroundColor: "var(--color-primary, #10b981)" }}
      />

      {/* Spinner & Logo Icon */}
      <div className="relative flex items-center justify-center">
        {/* Outer glowing spinner ring */}
        <div
          className="w-14 h-14 rounded-full border-2 border-white/10 border-t-transparent animate-spin"
          style={{
            borderTopColor: "var(--color-primary, #10b981)",
            boxShadow: "0 0 16px var(--color-primary-glow, rgba(16, 185, 129, 0.2))",
          }}
        />

        {/* Inner static/pulsing logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-white/5 border border-white/10 shadow-md animate-pulse"
          >
            <Image
              src={iconSrc}
              alt="Loading"
              width={20}
              height={20}
              className="w-5 h-5 object-contain"
            />
          </div>
        </div>
      </div>

      {/* Text Info */}
      <div className="space-y-1 max-w-xs">
        <h3 className="text-white font-bold text-sm tracking-tight">{title}</h3>
        {subtitle && (
          <p className="text-slate-400 text-xs font-medium leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Subtle modern progress bar */}
      <div className="w-28 h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"
          style={{
            background: "linear-gradient(90deg, transparent, var(--color-primary, #10b981), transparent)",
            width: "100%",
          }}
        />
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        className={`fixed inset-0 z-[80] bg-[#0c0d10] flex items-center justify-center ${className}`}
        data-testid="page-loading-fullscreen"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`min-h-[55vh] w-full flex items-center justify-center py-12 ${className}`}
      data-testid="page-loading-inline"
    >
      {content}
    </div>
  );
}
