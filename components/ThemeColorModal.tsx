"use client";

import React from "react";
import { X, Check, Palette, Sparkles, RotateCcw } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { DEFAULT_THEME_COLOR, ThemeColorId } from "@/lib/theme";

interface ThemeColorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ThemeColorModal({ isOpen, onClose }: ThemeColorModalProps) {
  const { colorId, currentColor, allColors, setColor } = useTheme();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#13151b] border border-white/10 rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transition-colors"
              style={{
                backgroundColor: currentColor.subtle,
                border: `1px solid ${currentColor.border}`,
                color: currentColor.primaryLight,
              }}
            >
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base tracking-tight flex items-center gap-2">
                Primary Theme Color
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: currentColor.primary }}
                />
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Customize the main accent color across the site
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Color Options Grid */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block px-1">
            Available Palettes
          </span>
          <div className="grid grid-cols-1 gap-2.5">
            {allColors.map((color) => {
              const isSelected = colorId === color.id;
              return (
                <button
                  key={color.id}
                  onClick={() => setColor(color.id as ThemeColorId)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-center justify-between group cursor-pointer ${
                    isSelected
                      ? "bg-white/8 shadow-md"
                      : "bg-[#181a22] border-white/6 hover:border-white/15 hover:bg-white/4"
                  }`}
                  style={{
                    borderColor: isSelected ? color.primary : undefined,
                    boxShadow: isSelected ? `0 4px 20px -2px ${color.glow}` : undefined,
                  }}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Color Swatch */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{
                        backgroundColor: color.primary,
                        boxShadow: `0 0 12px ${color.glow}`,
                      }}
                    >
                      {isSelected ? (
                        <Check className="w-4 h-4 text-white stroke-[3]" />
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-white/30" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white text-sm font-bold tracking-tight">
                          {color.name}
                        </span>
                        {color.badge && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
                            style={{
                              backgroundColor: color.subtle,
                              color: color.primaryLight,
                              border: `1px solid ${color.border}`,
                            }}
                          >
                            {color.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs truncate mt-0.5">
                        {color.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color.primary }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="p-4 rounded-2xl bg-[#171920] border border-white/8 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-slate-400" />
              Live Preview
            </span>
            <span
              className="font-bold uppercase text-[10px] px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: currentColor.subtle,
                color: currentColor.primaryLight,
              }}
            >
              {currentColor.name}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all cursor-default"
              style={{
                backgroundColor: currentColor.primary,
                boxShadow: `0 6px 18px -4px ${currentColor.glow}`,
              }}
            >
              Primary Button
            </button>

            <div
              className="px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{
                backgroundColor: currentColor.subtle,
                border: `1px solid ${currentColor.border}`,
                color: currentColor.primaryLight,
              }}
            >
              Accent Pill
            </div>

            <span
              className="text-xs font-bold"
              style={{ color: currentColor.primaryLight }}
            >
              Highlighted Text
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-1">
          {colorId !== DEFAULT_THEME_COLOR && (
            <button
              onClick={() => setColor(DEFAULT_THEME_COLOR)}
              className="flex items-center justify-center gap-1.5 px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Default
            </button>
          )}

          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-white font-bold text-xs tracking-wide transition-all shadow-lg active:scale-98 cursor-pointer"
            style={{
              backgroundColor: currentColor.primary,
              boxShadow: `0 8px 20px -4px ${currentColor.glow}`,
            }}
          >
            Apply &amp; Done
          </button>
        </div>
      </div>
    </div>
  );
}
