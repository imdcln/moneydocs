"use client";

/**
 * OnboardingSpotlight – Interactive Guideline Mode Overlay
 *
 * Architecture:
 * ─────────────
 * State: `currentStep` (int) + `isOpen` (bool) drive rendering.
 * `spotlightRect` is computed imperatively via getBoundingClientRect() and
 * stored separately so it never influences document flow (zero layout shift).
 *
 * Z-index hierarchy:
 *   z-[50]  ← full-viewport overlay div (captures pointer events)
 *   z-[51]  ← spotlight cutout div (position:fixed, pointer-events:none)
 *             Uses box-shadow: 0 0 0 9999px rgba(0,0,0,X) to dim everything
 *             outside the spotlight box without clip-path or pseudo-elements.
 *   z-[52]  ← floating tooltip card (above the shadow ring)
 *   z-[53]  ← top-right HUD controls (always on top)
 *
 * Zero layout shift: spotlight div is position:fixed, reads viewport coords,
 * starts opacity-0 and fades in only after measurements are confirmed.
 * Two deferred measurements (150 ms + 380 ms) absorb smooth-scroll lag.
 */

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpotlightStep {
  /** Must match a DOM element's `id` attribute */
  targetId: string;
  /** Short title shown in the unified header badge */
  title: string;
  /** Longer microcopy displayed in the card body */
  description: string;
  /** Optional emoji icon prepended to the description area */
  icon?: string;
  /** Tooltip placement preference; falls back to auto-detection */
  preferredPlacement?: "top" | "bottom" | "auto";
}

interface OnboardingSpotlightProps {
  isOpen: boolean;
  steps: SpotlightStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onComplete: () => void;
  /** Extra px of breathing room added around the target element */
  padding?: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  borderRadius: number;
}

interface TooltipPos {
  top: number;
  left: number;
  placement: "top" | "bottom";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 356;
const TOOLTIP_HEIGHT_ESTIMATE = 210;
const CARD_GAP = 14;
const EDGE_MARGIN = 16;

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingSpotlight({
  isOpen,
  steps,
  currentStep,
  onNext,
  onPrev,
  onClose,
  onComplete,
  padding = 10,
}: OnboardingSpotlightProps) {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ top: 0, left: 0, placement: "bottom" });
  const [measured, setMeasured] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  // ── Core measurement ──────────────────────────────────────────────────────

  const measure = useCallback(() => {
    if (!isOpen || !step) return;

    const el = document.getElementById(step.targetId);

    let sr: SpotlightRect;
    if (!el) {
      // Graceful fallback: center a placeholder rectangle
      sr = {
        top: window.innerHeight / 2 - 80,
        left: window.innerWidth / 2 - 140,
        width: 280,
        height: 160,
        borderRadius: 20,
      };
    } else {
      const r = el.getBoundingClientRect();
      const radius = parseFloat(window.getComputedStyle(el).borderRadius) || 16;
      sr = {
        top: Math.max(0, r.top - padding),
        left: Math.max(0, r.left - padding),
        width: r.width + padding * 2,
        height: r.height + padding * 2,
        borderRadius: Math.min(radius + 4, 24),
      };
    }

    setRect(sr);

    // ── Tooltip placement math ──────────────────────────────────────────────
    // Determine whether the card fits better above or below the spotlight box.
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceBelow = vh - (sr.top + sr.height);
    const spaceAbove = sr.top;
    const fits = (space: number) => space >= TOOLTIP_HEIGHT_ESTIMATE + CARD_GAP + EDGE_MARGIN;

    let placement: "top" | "bottom" =
      step.preferredPlacement === "top" || step.preferredPlacement === "bottom"
        ? step.preferredPlacement
        : fits(spaceBelow)
        ? "bottom"
        : "top";

    // Safety flip: if our preference doesn't fit, switch
    if (placement === "bottom" && !fits(spaceBelow) && fits(spaceAbove)) placement = "top";
    if (placement === "top" && !fits(spaceAbove) && fits(spaceBelow)) placement = "bottom";

    let top =
      placement === "bottom"
        ? sr.top + sr.height + CARD_GAP
        : sr.top - TOOLTIP_HEIGHT_ESTIMATE - CARD_GAP;

    // Horizontal: center on spotlight, clamped to viewport edges
    let left = sr.left + sr.width / 2 - TOOLTIP_WIDTH / 2;

    top = Math.max(EDGE_MARGIN, Math.min(top, vh - TOOLTIP_HEIGHT_ESTIMATE - EDGE_MARGIN));
    left = Math.max(EDGE_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - EDGE_MARGIN));

    setTooltipPos({ top, left, placement });
    setMeasured(true);
  }, [isOpen, step, padding]);

  // ── Scroll into view + deferred re-measure on step change ─────────────────

  useEffect(() => {
    if (!isOpen || !step) return;
    setMeasured(false); // reset opacity while re-measuring (no flash)

    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    // Two measurements: fast (before scroll finishes) + settled (after scroll)
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 380);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isOpen, currentStep, step, measure]);

  // ── Passive scroll/resize listener ────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => measure();
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, [isOpen, measure]);

  // ── Keyboard accessibility ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        isLast ? onComplete() : onNext();
      } else if (e.key === "ArrowLeft" && !isFirst) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isLast, isFirst, onNext, onPrev, onClose, onComplete]);

  // ── Render guard ──────────────────────────────────────────────────────────

  if (!isOpen || !step) return null;

  // ── Backdrop click = advance (unless click is inside tooltip card) ─────────

  const handleBackdrop = (e: React.MouseEvent) => {
    if (tooltipRef.current?.contains(e.target as Node)) return;
    isLast ? onComplete() : onNext();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive onboarding tour"
      className="fixed inset-0 z-50 overflow-hidden select-none cursor-pointer"
      onClick={handleBackdrop}
    >
      {/* ── Spotlight Cutout ─────────────────────────────────────────────── */}
      {rect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            borderRadius: rect.borderRadius,
            // The enormous box-shadow creates the dark backdrop outside the box.
            // The box itself stays transparent, acting as the visible "window".
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.76), 0 0 32px 4px rgba(16,185,129,0.30)`,
            transition: "top 320ms cubic-bezier(0.4,0,0.2,1), left 320ms cubic-bezier(0.4,0,0.2,1), width 320ms cubic-bezier(0.4,0,0.2,1), height 320ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease",
            opacity: measured ? 1 : 0,
            pointerEvents: "none",
          }}
          className="border-2 border-emerald-400/80 ring-4 ring-emerald-500/15 z-[51]"
        >
          {/* Corner scan-line brackets (purely decorative) */}
          <BracketCorner pos="tl" />
          <BracketCorner pos="tr" />
          <BracketCorner pos="bl" />
          <BracketCorner pos="br" />
        </div>
      )}

      {/* ── HUD: top-right controls ──────────────────────────────────────── */}
      <div
        className="fixed top-4 right-4 z-[53] flex items-center gap-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Keyboard hint pill – desktop only */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#111318]/90 border border-white/[0.08] text-[11px] text-slate-400 backdrop-blur-md">
          <span>Click anywhere to advance</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-[#1a1c24] text-[10px] text-slate-300 border border-white/[0.08] font-mono">
            ESC
          </kbd>
        </div>

        {/* Skip Tour button */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#111318]/95 hover:bg-[#1a1c24] text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/20 transition-all text-xs font-medium shadow-xl backdrop-blur-md cursor-pointer"
          title="Skip onboarding tour (ESC)"
        >
          Skip
          <X className="w-3.5 h-3.5 opacity-60" />
        </button>
      </div>

      {/* ── Floating Tooltip Card ─────────────────────────────────────────── */}
      <div
        ref={tooltipRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_WIDTH,
          transition: "top 320ms cubic-bezier(0.4,0,0.2,1), left 320ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
          opacity: measured ? 1 : 0,
        }}
        className="z-[52] cursor-default"
      >
        {/* Card shell */}
        <div className="relative overflow-hidden rounded-2xl bg-[#131519]/98 border border-emerald-500/25 shadow-2xl shadow-black/60 backdrop-blur-2xl">

          {/* Subtle emerald glow bleed behind card */}
          <div
            aria-hidden="true"
            className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 bg-emerald-500/8 rounded-full blur-3xl pointer-events-none"
          />

          {/* ── Card Header: Unified Step Badge + Title ─────────────────── */}
          <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 min-w-0">
              {/* Step badge pill */}
              <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold tracking-wide uppercase">
                <SparkleIcon />
                {currentStep + 1}/{steps.length}
              </span>
              {/* Step title – in the same line as the badge */}
              <h3 className="text-sm font-semibold text-slate-100 truncate">
                {step.icon && <span className="mr-1.5">{step.icon}</span>}
                {step.title}
              </h3>
            </div>

            {/* Skip/close in header */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tour"
              className="flex-shrink-0 text-slate-500 hover:text-slate-200 p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Card Body: Description ───────────────────────────────────── */}
          <div className="px-4 py-3.5">
            <p className="text-[13px] text-slate-300 leading-[1.65] tracking-[0.01em]">
              {step.description}
            </p>
          </div>

          {/* ── Card Footer: Progress + Navigation ──────────────────────── */}
          <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1">
            {/* Segmented progress track */}
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: i === currentStep ? 20 : 6,
                    backgroundColor:
                      i === currentStep
                        ? "#10b981"           // emerald-500
                        : i < currentStep
                        ? "rgba(16,185,129,0.4)"  // emerald muted past
                        : "rgba(255,255,255,0.1)", // upcoming
                  }}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={isLast ? onComplete : onNext}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer hover:scale-[1.03] active:scale-[0.97] shadow-md ${
                  isLast
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 font-bold"
                    : "bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                }`}
              >
                {isLast ? (
                  <>
                    <span>Get Started</span>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Connector arrow pointing toward spotlight */}
        {rect && (
          <TooltipArrow
            placement={tooltipPos.placement}
            spotlightCenterX={rect.left + rect.width / 2}
            cardLeft={tooltipPos.left}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Animated scanning corner bracket decoration on the spotlight cutout */
function BracketCorner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base = "absolute w-3.5 h-3.5 pointer-events-none";
  const corners = {
    tl: "-top-px -left-px border-t-2 border-l-2 rounded-tl-sm",
    tr: "-top-px -right-px border-t-2 border-r-2 rounded-tr-sm",
    bl: "-bottom-px -left-px border-b-2 border-l-2 rounded-bl-sm",
    br: "-bottom-px -right-px border-b-2 border-r-2 rounded-br-sm",
  };
  return (
    <span
      className={`${base} ${corners[pos]} border-emerald-300 animate-pulse`}
      style={{ animationDuration: "2.4s" }}
    />
  );
}

/**
 * A small triangular arrow that points from the tooltip card toward
 * the spotlight target. Rendered outside the card div to avoid overflow clipping.
 */
function TooltipArrow({
  placement,
  spotlightCenterX,
  cardLeft,
}: {
  placement: "top" | "bottom";
  spotlightCenterX: number;
  cardLeft: number;
}) {
  // Position the arrow horizontally to roughly point at the spotlight center
  const arrowX = Math.max(16, Math.min(spotlightCenterX - cardLeft - 7, TOOLTIP_WIDTH - 32));

  if (placement === "bottom") {
    // Arrow points UP (card is below the spotlight)
    return (
      <div
        style={{ left: arrowX }}
        className="absolute -top-[7px] w-3.5 h-3.5 overflow-hidden pointer-events-none"
      >
        <div
          className="w-3 h-3 bg-[#131519] border-t border-l border-emerald-500/25 rotate-45 translate-x-0.5 translate-y-1"
        />
      </div>
    );
  }
  // Arrow points DOWN (card is above the spotlight)
  return (
    <div
      style={{ left: arrowX }}
      className="absolute -bottom-[7px] w-3.5 h-3.5 overflow-hidden pointer-events-none"
    >
      <div
        className="w-3 h-3 bg-[#131519] border-b border-r border-emerald-500/25 rotate-45 translate-x-0.5 -translate-y-1"
      />
    </div>
  );
}

/** Tiny custom star-sparkle SVG to avoid any external icon lib for this detail */
function SparkleIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      className="text-emerald-400"
    >
      <path
        d="M5 0.5L6.03 3.97L9.5 5L6.03 6.03L5 9.5L3.97 6.03L0.5 5L3.97 3.97L5 0.5Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
    </svg>
  );
}
