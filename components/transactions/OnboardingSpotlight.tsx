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
 * Responsive:
 *   Adapts tooltip width on small devices so it never overflows the viewport width.
 *   Clamps spotlight bounds to viewport edges.
 *   Respects active user color theme dynamically (not fixed green).
 *   Locks body and touch/wheel scrolling during active tour.
 */

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

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
  width: number;
  placement: "top" | "bottom";
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOLTIP_MAX_WIDTH = 356;
const TOOLTIP_HEIGHT_ESTIMATE = 210;
const CARD_GAP = 14;

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
  const { currentColor } = useTheme();
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({
    top: 0,
    left: 0,
    width: TOOLTIP_MAX_WIDTH,
    placement: "bottom",
  });
  const [measured, setMeasured] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  // ── Core measurement ──────────────────────────────────────────────────────

  const measure = useCallback(() => {
    if (!isOpen || !step) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const effectiveMargin = vw < 380 ? 12 : 16;

    // Tooltip width is responsive: fits comfortably within small devices without overflowing
    const cardWidth = Math.min(TOOLTIP_MAX_WIDTH, Math.max(260, vw - effectiveMargin * 2));

    const el = document.getElementById(step.targetId);

    let sr: SpotlightRect;
    if (!el) {
      // Graceful fallback: center a placeholder rectangle
      const fallbackW = Math.min(280, vw - effectiveMargin * 2);
      sr = {
        top: Math.max(16, vh / 2 - 80),
        left: Math.max(effectiveMargin, (vw - fallbackW) / 2),
        width: fallbackW,
        height: 160,
        borderRadius: 20,
      };
    } else {
      const r = el.getBoundingClientRect();
      const radius = parseFloat(window.getComputedStyle(el).borderRadius) || 16;

      // Ensure the spotlight highlight cutout never extends beyond viewport boundaries
      const sLeft = Math.max(4, r.left - padding);
      const sRight = Math.min(vw - 4, r.right + padding);
      const sWidth = Math.max(0, sRight - sLeft);

      sr = {
        top: Math.max(0, r.top - padding),
        left: sLeft,
        width: sWidth,
        height: r.height + padding * 2,
        borderRadius: Math.min(radius + 4, 24),
      };
    }

    // ── Tooltip placement math ──────────────────────────────────────────────
    // Ensure card stays above the bottom navigation bar (accounting for FAB button protrusion)
    const bottomNavEl = document.querySelector("nav.fixed.bottom-0") || document.getElementById("bottom-nav");
    let bottomNavClearance = 84;
    if (bottomNavEl) {
      const navRect = bottomNavEl.getBoundingClientRect();
      if (navRect.top > 0 && navRect.top < vh) {
        bottomNavClearance = Math.max(bottomNavClearance, vh - navRect.top + 36);
      }
    }
    const maxBottom = vh - bottomNavClearance;

    const cardHeight = tooltipRef.current?.offsetHeight || TOOLTIP_HEIGHT_ESTIMATE;

    // Cap spotlight height if element is unusually tall, so it doesn't crowd out the bottom card space
    const maxSpotlightHeight = Math.max(100, maxBottom - sr.top - cardHeight - CARD_GAP - 8);
    if (sr.height > maxSpotlightHeight) {
      sr.height = maxSpotlightHeight;
    }

    setRect(sr);

    // ── Tooltip placement: Always place BELOW spotlight area to never collide with top Skip button ──
    const placement: "top" | "bottom" = "bottom";

    let top = sr.top + sr.height + CARD_GAP;

    // Strict boundary clamping:
    // minTop: strictly 64px down (below the top-right Skip HUD button)
    // maxTop: maxBottom - cardHeight (strictly above the footer nav)
    const minTop = 64;
    const maxTop = Math.max(minTop, maxBottom - cardHeight);
    top = Math.max(minTop, Math.min(top, maxTop));

    // Horizontal: center on spotlight, strictly clamped to viewport edges
    let left = sr.left + sr.width / 2 - cardWidth / 2;
    left = Math.max(effectiveMargin, Math.min(left, vw - cardWidth - effectiveMargin));

    setTooltipPos({ top, left, width: cardWidth, placement });
    setMeasured(true);
  }, [isOpen, step, padding]);

  // ── Lock page scroll when tour is open ───────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Compensate for scrollbar jump on desktop when overflow is hidden
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    }

    document.body.style.overflow = "hidden";

    // Intercept touch and wheel scroll events to prevent page scrolling
    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const scrollKeys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
      if (scrollKeys.includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { passive: false });

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;

      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // ── Scroll into view + deferred re-measure on step change ─────────────────

  useEffect(() => {
    if (!isOpen || !step) return;
    setMeasured(false); // reset opacity while re-measuring (no flash)

    const el = document.getElementById(step.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      const topHudOffset = 70; // Clearance below the top Skip button HUD
      // Scroll element so its top is positioned below the top HUD,
      // maximizing open space below for the tooltip card
      const elementAbsoluteTop = window.scrollY + rect.top;
      const targetScrollY = Math.max(0, elementAbsoluteTop - topHudOffset);
      window.scrollTo({ top: targetScrollY, behavior: "smooth" });
    }

    // Two measurements: fast (before scroll finishes) + settled (after scroll)
    const t1 = setTimeout(measure, 150);
    const t2 = setTimeout(measure, 380);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen, currentStep, step, measure]);

  // ── Passive resize & scroll listener for responsive updates ───────────────

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
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
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
      className="fixed inset-0 z-[70] overflow-hidden select-none cursor-pointer touch-none overscroll-none"
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
            boxShadow: `0 0 0 9999px rgba(0,0,0,0.76), 0 0 0 3px var(--color-primary-subtle, ${currentColor.subtle}), 0 0 32px 6px var(--color-primary-glow, ${currentColor.glow})`,
            borderColor: `var(--color-primary-light, ${currentColor.primaryLight})`,
            transition:
              "top 320ms cubic-bezier(0.4,0,0.2,1), left 320ms cubic-bezier(0.4,0,0.2,1), width 320ms cubic-bezier(0.4,0,0.2,1), height 320ms cubic-bezier(0.4,0,0.2,1), opacity 180ms ease",
            opacity: measured ? 1 : 0,
            pointerEvents: "none",
          }}
          className="border-2 z-[71]"
        >
          {/* Corner scan-line brackets (respects user theme) */}
          <BracketCorner pos="tl" color={currentColor.primaryLight} />
          <BracketCorner pos="tr" color={currentColor.primaryLight} />
          <BracketCorner pos="bl" color={currentColor.primaryLight} />
          <BracketCorner pos="br" color={currentColor.primaryLight} />
        </div>
      )}

      {/* ── HUD: top-right controls ──────────────────────────────────────── */}
      <div
        className="fixed top-3 right-3 sm:top-4 sm:right-4 z-[73] flex items-center gap-2.5"
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
          className="flex items-center gap-1.5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-[#111318]/95 hover:bg-[#1a1c24] text-slate-300 hover:text-white border border-white/[0.08] hover:border-white/20 transition-all text-xs font-medium shadow-xl backdrop-blur-md cursor-pointer"
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
          width: tooltipPos.width,
          maxWidth: "calc(100vw - 24px)",
          boxSizing: "border-box",
          transition:
            "top 320ms cubic-bezier(0.4,0,0.2,1), left 320ms cubic-bezier(0.4,0,0.2,1), width 320ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease",
          opacity: measured ? 1 : 0,
        }}
        className="z-[72] cursor-default"
      >
        {/* Card shell */}
        <div
          style={{
            borderColor: `var(--color-primary-border, ${currentColor.border})`,
            boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px -4px var(--color-primary-subtle, ${currentColor.subtle})`,
          }}
          className="relative overflow-hidden rounded-2xl bg-[#131519]/98 border shadow-2xl backdrop-blur-2xl"
        >
          {/* Subtle theme glow bleed behind card */}
          <div
            aria-hidden="true"
            style={{
              backgroundColor: `var(--color-primary, ${currentColor.primary})`,
            }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-24 opacity-15 rounded-full blur-3xl pointer-events-none"
          />

          {/* ── Card Header: Unified Step Badge + Title ─────────────────── */}
          <div className="flex items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-4 pt-3.5 sm:pt-4 pb-2.5 sm:pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Step badge pill */}
              <span
                style={{
                  backgroundColor: `var(--color-primary-subtle, ${currentColor.subtle})`,
                  borderColor: `var(--color-primary-border, ${currentColor.border})`,
                  color: `var(--color-primary-light, ${currentColor.primaryLight})`,
                }}
                className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border"
              >
                <SparkleIcon color={currentColor.primaryLight} />
                {currentStep + 1}/{steps.length}
              </span>
              {/* Step title */}
              <h3 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                {step.icon && <span className="mr-1">{step.icon}</span>}
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
          <div className="px-3.5 sm:px-4 py-3 sm:py-3.5">
            <p className="text-xs sm:text-[13px] text-slate-300 leading-[1.65] tracking-[0.01em]">
              {step.description}
            </p>
          </div>

          {/* ── Card Footer: Progress + Navigation ──────────────────────── */}
          <div className="flex items-center justify-between gap-2 px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1">
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
                        ? `var(--color-primary, ${currentColor.primary})`
                        : i < currentStep
                        ? `var(--color-primary-border, ${currentColor.border})`
                        : "rgba(255,255,255,0.12)",
                  }}
                />
              ))}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {!isFirst && (
                <button
                  type="button"
                  onClick={onPrev}
                  className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={isLast ? onComplete : onNext}
                style={{
                  backgroundColor: `var(--color-primary, ${currentColor.primary})`,
                  boxShadow: `0 4px 14px 0 var(--color-primary-glow, ${currentColor.glow})`,
                }}
                className={`flex items-center gap-1 sm:gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer hover:brightness-110 hover:scale-[1.03] active:scale-[0.97] shadow-md ${
                  isLast ? "font-bold" : ""
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
            cardWidth={tooltipPos.width}
            borderColor={currentColor.border}
          />
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

/** Animated scanning corner bracket decoration on the spotlight cutout */
function BracketCorner({
  pos,
  color,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  color?: string;
}) {
  const base = "absolute w-3.5 h-3.5 pointer-events-none";
  const corners = {
    tl: "-top-px -left-px border-t-2 border-l-2 rounded-tl-sm",
    tr: "-top-px -right-px border-t-2 border-r-2 rounded-tr-sm",
    bl: "-bottom-px -left-px border-b-2 border-l-2 rounded-bl-sm",
    br: "-bottom-px -right-px border-b-2 border-r-2 rounded-br-sm",
  };
  return (
    <span
      className={`${base} ${corners[pos]} animate-pulse`}
      style={{
        animationDuration: "2.4s",
        borderColor: color || "var(--color-primary-light)",
      }}
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
  cardWidth,
  borderColor,
}: {
  placement: "top" | "bottom";
  spotlightCenterX: number;
  cardLeft: number;
  cardWidth: number;
  borderColor?: string;
}) {
  // Position the arrow horizontally to roughly point at the spotlight center within the card
  const arrowX = Math.max(16, Math.min(spotlightCenterX - cardLeft - 7, Math.max(20, cardWidth - 32)));
  const borderStyle = { borderColor: borderColor || "var(--color-primary-border)" };

  if (placement === "bottom") {
    // Arrow points UP (card is below the spotlight)
    return (
      <div
        style={{ left: arrowX }}
        className="absolute -top-[7px] w-3.5 h-3.5 overflow-hidden pointer-events-none"
      >
        <div
          style={borderStyle}
          className="w-3 h-3 bg-[#131519] border-t border-l rotate-45 translate-x-0.5 translate-y-1"
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
        style={borderStyle}
        className="w-3 h-3 bg-[#131519] border-b border-r rotate-45 translate-x-0.5 -translate-y-1"
      />
    </div>
  );
}

/** Tiny custom star-sparkle SVG to avoid any external icon lib for this detail */
function SparkleIcon({ color }: { color?: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden="true"
      style={{ color: color || "var(--color-primary-light)" }}
    >
      <path
        d="M5 0.5L6.03 3.97L9.5 5L6.03 6.03L5 9.5L3.97 6.03L0.5 5L3.97 3.97L5 0.5Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
    </svg>
  );
}
