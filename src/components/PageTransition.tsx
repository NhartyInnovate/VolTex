"use client";

import React, { useId } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition provides a subtle upward slide and fade-in
 * transition when navigating between App Router pages.
 * Respects prefers-reduced-motion via CSS.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="animate-page-enter flex-1 flex flex-col w-full"
    >
      {children}
    </div>
  );
}
