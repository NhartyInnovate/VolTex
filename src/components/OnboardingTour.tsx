"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X, ChevronRight, ChevronLeft, Check } from "lucide-react";

export interface TourStep {
  targetId: string;
  title: string;
  message: string;
  tabKey?: "templates" | "referrals" | "leaderboard";
}

interface OnboardingTourProps {
  steps: TourStep[];
  isOpen: boolean;
  onFinish: () => void;
  onSkip: () => void;
  onStepChange?: (stepIndex: number, step: TourStep) => void;
}

interface RectBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

export function OnboardingTour({
  steps,
  isOpen,
  onFinish,
  onSkip,
  onStepChange,
}: OnboardingTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<RectBounds | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset to first step whenever reopened
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  const currentStep = steps[currentStepIndex];

  // Notify parent of step change so it can switch tabs or perform actions
  useEffect(() => {
    if (isOpen && currentStep && onStepChange) {
      onStepChange(currentStepIndex, currentStep);
    }
  }, [isOpen, currentStepIndex, currentStep, onStepChange]);

  // Recalculate target bounding box
  const updateTargetRect = useCallback(() => {
    if (!isOpen || !currentStep) {
      setTargetRect(null);
      return;
    }

    const element = document.getElementById(currentStep.targetId);
    if (!element) {
      setTargetRect(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setTargetRect({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
  }, [isOpen, currentStep]);

  // Scroll target element into view smoothly when step changes
  useEffect(() => {
    if (!isOpen || !currentStep) return;

    // Small timeout to allow tab transition animations / DOM layout updates
    const timer = setTimeout(() => {
      const element = document.getElementById(currentStep.targetId);
      if (element) {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
        // Update coordinates after potential scroll
        setTimeout(updateTargetRect, 250);
      } else {
        updateTargetRect();
      }
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, currentStepIndex, currentStep, updateTargetRect]);

  // Handle resize, scroll, and orientation change
  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateTargetRect();
    };

    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("orientationchange", handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("orientationchange", handleScrollOrResize);
    };
  }, [isOpen, updateTargetRect]);

  // Keyboard navigation: Escape to skip, Left to go back, Right to advance
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      } else if (e.key === "ArrowRight") {
        if (currentStepIndex < steps.length - 1) {
          e.preventDefault();
          setCurrentStepIndex((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStepIndex > 0) {
          e.preventDefault();
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStepIndex, steps.length, onSkip]);

  if (!isOpen || !mounted || !currentStep) return null;

  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const handleNext = () => {
    if (isLastStep) {
      onFinish();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  // Calculate dynamic placement for tooltip
  const getTooltipStyle = (): React.CSSProperties => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

    if (!targetRect || isMobile) {
      // Mobile or target not located: render docked near bottom with safe area spacing
      return {
        position: "fixed",
        bottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        left: "12px",
        right: "12px",
        margin: "0 auto",
        maxWidth: "420px",
        zIndex: 9999,
      };
    }

    const padding = 12;
    const tooltipWidth = 360;
    const tooltipEstimatedHeight = 220;

    // Viewport dimensions
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = targetRect.bottom + padding;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

    // If placed below and overflows bottom, try placing above target
    if (top + tooltipEstimatedHeight > vh - 20) {
      top = Math.max(20, targetRect.top - tooltipEstimatedHeight - padding);
    }

    // Horizontal boundary clamping
    if (left + tooltipWidth > vw - 16) {
      left = vw - tooltipWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    return {
      position: "fixed",
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${tooltipWidth}px`,
      zIndex: 9999,
    };
  };

  // Render modal content
  const modalContent = (
    <div
      className="fixed inset-0 z-[9998] overflow-hidden select-none pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Guided Onboarding Tour"
    >
      {/* 1. Backdrop Overlay with SVG Cutout Spotlight */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none transition-opacity duration-300"
        style={{ width: "100vw", height: "100vh" }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White reveals the dark backdrop */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black cuts out the spotlight hole for the target element */}
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="10"
                ry="10"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.76)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Target Pulsing Highlight Ring */}
      {targetRect && (
        <div
          className="fixed pointer-events-none rounded-xl border-2 border-tedx-red shadow-[0_0_15px_rgba(235,0,40,0.5)] transition-all duration-300 motion-reduce:transition-none"
          style={{
            top: `${Math.round(targetRect.top - 6)}px`,
            left: `${Math.round(targetRect.left - 6)}px`,
            width: `${Math.round(targetRect.width + 12)}px`,
            height: `${Math.round(targetRect.height + 12)}px`,
            zIndex: 9999,
          }}
        />
      )}

      {/* 2. Tooltip Card */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="bg-white dark:bg-[#141417] text-zinc-900 dark:text-zinc-100 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl p-4 sm:p-5 transition-all duration-200 motion-reduce:transition-none animate-subtle-fade-up max-h-[calc(100vh-32px)] overflow-y-auto"
      >
        {/* Header: Step counter & close button */}
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-tedx-red dark:bg-tedx-red/15 dark:text-red-400 border border-tedx-red/20">
            <Sparkles className="w-3 h-3 text-tedx-red" />
            <span>
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          </div>

          <button
            onClick={onSkip}
            aria-label="Skip tour"
            title="Skip tour (Esc)"
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
          {currentStep.title}
        </h3>

        {/* Message */}
        <p className="mt-1.5 text-xs sm:text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {currentStep.message}
        </p>

        {/* Action Controls */}
        <div className="mt-5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
          <button
            onClick={onSkip}
            className="text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 px-2 py-1.5 rounded transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 transition-all flex items-center gap-1 active:scale-[0.98]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-tedx-red hover:bg-tedx-darkred text-white shadow-xs transition-all flex items-center gap-1 active:scale-[0.98]"
            >
              <span>{isLastStep ? "Finish" : "Next"}</span>
              {isLastStep ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
