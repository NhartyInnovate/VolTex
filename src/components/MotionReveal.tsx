"use client";

import React, { useEffect, useRef, useState } from "react";

interface MotionRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // ms delay for staggered items
  threshold?: number;
  as?: React.ElementType;
  id?: string;
}

/**
 * MotionReveal provides lightweight, scroll-triggered reveals using native
 * IntersectionObserver. Content is immediately visible on SSR, when JavaScript
 * is disabled, or when prefers-reduced-motion is active.
 */
export function MotionReveal({
  children,
  className = "",
  delay = 0,
  threshold = 0.08,
  as: Component = "div",
  id,
}: MotionRevealProps) {
  // Initialize to true if reduced motion is requested
  const [hasRevealed, setHasRevealed] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setHasRevealed(true);
      return;
    }

    // Graceful fallback if IntersectionObserver is unsupported
    if (!("IntersectionObserver" in window)) {
      setHasRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasRevealed(true);
          if (elementRef.current) {
            observer.unobserve(elementRef.current);
          }
        }
      },
      {
        root: null,
        rootMargin: "0px 0px -20px 0px",
        threshold,
      }
    );

    const current = elementRef.current;
    if (current) {
      observer.observe(current);
    }

    // Failsafe timer so content is never stuck in hidden state
    const failsafeTimer = setTimeout(() => {
      setHasRevealed(true);
    }, 2200);

    return () => {
      if (current) observer.unobserve(current);
      clearTimeout(failsafeTimer);
    };
  }, [threshold]);

  return (
    <Component
      ref={elementRef}
      id={id}
      style={{
        transitionDelay: delay > 0 ? `${delay}ms` : undefined,
      }}
      className={`${className} transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        hasRevealed
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-7 pointer-events-none"
      }`}
    >
      {children}
    </Component>
  );
}
