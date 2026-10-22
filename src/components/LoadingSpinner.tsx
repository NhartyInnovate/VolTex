import React from "react";

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl" | "page";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
  colorScheme?: "red-white" | "red-dark" | "monochrome";
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: "w-3.5 h-3.5 max-w-[14px] max-h-[14px]",
  sm: "w-4.5 h-4.5 max-w-[18px] max-h-[18px]",
  md: "w-6.5 h-6.5 max-w-[26px] max-h-[26px]",
  lg: "w-9 h-9 sm:w-10 sm:h-10",
  xl: "w-14 h-14 sm:w-16 sm:h-16",
  page: "w-[72px] h-[72px] sm:w-[92px] sm:h-[92px]",
};

/**
 * LoadingSpinner — inspired by the reference design.
 * Features two concentric rings of thin, curved circular segments with rounded ends:
 * - Outer ring: 2 diametrically opposed curved segments (TEDx Red).
 * - Inner ring: 2 offset curved segments (White in dark/red backgrounds, contrasting in light).
 * Smooth, continuous rotation with rounded stroke caps.
 */
export function LoadingSpinner({
  size = "md",
  className = "",
  label = "Loading",
  colorScheme = "red-white",
}: LoadingSpinnerProps) {
  // Colors adapted for contrast across dark & light themes
  // Outer segments: official TEDx Red (#e62b1e / rgb(230, 43, 30))
  // Inner segments: high contrast white/neutral (#ffffff or #f4f4f5 in dark mode; zinc-800 or white in light depending on context)
  let outerStroke = "#e62b1e";
  let innerStroke = "#ffffff";

  if (colorScheme === "red-dark") {
    // When used on light surfaces (e.g. white cards or light theme), inner ring adopts a clean dark slate/neutral
    innerStroke = "currentColor";
  } else if (colorScheme === "monochrome") {
    outerStroke = "currentColor";
    innerStroke = "currentColor";
  }

  // Radii for outer and inner segments within 100x100 SVG coordinate space
  // ViewBox: 0 0 100 100, center at (50, 50)
  const outerR = 41;
  const innerR = 25;

  // Thin, elegant stroke calibrated in SVG units (approx 3.8% of viewBox)
  const svgStrokeWidth = size === "xs" || size === "sm" ? 6.5 : size === "md" ? 5.5 : 4.5;

  // Circumferences
  const outerC = 2 * Math.PI * outerR; // ~257.6
  const innerC = 2 * Math.PI * innerR; // ~157.1

  // Outer segments: 2 arcs of ~95 degrees each (arc length ~ 0.28 * outerC)
  const outerArc = outerC * 0.28;
  const outerGap = outerC * 0.22;

  // Inner segments: 2 arcs of ~90 degrees each (arc length ~ 0.27 * innerC)
  const innerArc = innerC * 0.27;
  const innerGap = innerC * 0.23;

  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-flex items-center justify-center shrink-0 ${sizeClasses[size]} ${className}`}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full animate-spin motion-reduce:animate-[spin_4s_linear_infinite]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outer segmented circular arcs (TEDx Red) */}
        <circle
          cx="50"
          cy="50"
          r={outerR}
          stroke={outerStroke}
          strokeWidth={svgStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${outerArc} ${outerGap}`}
          strokeDashoffset="0"
          className="opacity-95"
        />

        {/* Inner segmented circular arcs (White / Contrast) */}
        <circle
          cx="50"
          cy="50"
          r={innerR}
          stroke={innerStroke}
          strokeWidth={svgStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${innerArc} ${innerGap}`}
          strokeDashoffset={innerC * 0.25}
          className="opacity-90"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * FullPageLoader — clean, uncluttered, vertically and horizontally centred loading screen.
 * Displays the large segmented red-and-white spinner with an optional subtle message.
 * Completely eliminates skeleton placeholders and empty boxes.
 */
interface FullPageLoaderProps {
  message?: string;
  subMessage?: string;
  label?: string;
}

export function FullPageLoader({
  message = "Loading VolTex...",
  subMessage,
  label = "Loading page content",
}: FullPageLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex-1 min-h-[calc(100vh-14rem)] flex flex-col items-center justify-center px-4 py-20 text-center animate-subtle-fade-up select-none"
    >
      <div className="flex flex-col items-center justify-center gap-6 max-w-sm mx-auto">
        <LoadingSpinner
          size="page"
          colorScheme="red-dark"
          label={label}
        />
        {message && (
          <div className="space-y-1.5">
            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {message}
            </h2>
            {subMessage && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                {subMessage}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CenteredProcessingOverlay — unobtrusive, elegant translucent loading overlay.
 * Renders independent of any button, centred in the viewport when an authentication or
 * form submission request is actively processing.
 * Prevents stretching buttons, preserves form dimensions, and displays the red-and-white
 * segmented spinner with a subtle status message.
 */
interface CenteredProcessingOverlayProps {
  message?: string;
  label?: string;
  hasBackdrop?: boolean;
  className?: string;
}

export function CenteredProcessingOverlay({
  message = "Processing...",
  label = "Processing request",
  hasBackdrop = true,
  className = "",
}: CenteredProcessingOverlayProps) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-live="polite"
      className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-200 animate-subtle-fade-up select-none ${
        hasBackdrop ? "bg-black/10 dark:bg-black/40 backdrop-blur-[1px]" : ""
      } ${className}`.trim()}
    >
      <div className="bg-white dark:bg-[#111114] border border-zinc-200/90 dark:border-zinc-800 rounded-xl px-7 py-6 sm:px-8 sm:py-7 shadow-xl dark:shadow-2xl flex flex-col items-center justify-center gap-3.5 text-center max-w-[280px] sm:max-w-xs mx-4">
        <LoadingSpinner
          size="xl"
          colorScheme="red-dark"
          label={label}
        />
        <p className="text-xs sm:text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {message}
        </p>
      </div>
    </div>
  );
}
