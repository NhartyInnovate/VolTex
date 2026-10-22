"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type BeforeInstallPromptEvent,
  type InstallOutcome,
  PWA_PROMPT_READY_EVENT,
  launchNativeInstallPrompt,
  detectInstallPlatform,
} from "@/lib/pwaInstall";

export interface PwaInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  hasPrompt: boolean;
  promptInstall: () => Promise<InstallOutcome>;
  openInstallInstructions: () => void;
  closeInstallInstructions: () => void;
  showInstructionsModal: boolean;
  instructionPlatform: "ios" | "android" | null;
}

declare global {
  interface Window {
    /** Set by the early capture script in RootLayout; the single source of truth for the native prompt. */
    __voltex_pwa_prompt?: BeforeInstallPromptEvent | null;
  }
}

const STORAGE_DISMISSED_KEY = "voltex_pwa_install_dismissed_v1";

/**
 * usePwaInstall
 * Reusable client-side hook for managing PWA installation across Chrome/Edge/Android and iOS Safari.
 * Detects standalone display mode, reads the beforeinstallprompt event captured by the early
 * <head> script, and manages accessible iOS / Android manual fallback instructions.
 */
export function usePwaInstall(): PwaInstallState {
  // Always start as null so server and client initial renders match (no hydration mismatch).
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect if running in standalone display mode (already installed)
    const isStandaloneDisplay =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS Safari legacy property
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");

    if (isStandaloneDisplay) {
      setIsInstalled(true);
      return;
    }

    // 2. Detect iOS Safari / Android
    const platform = detectInstallPlatform(
      window.navigator.userAgent || "",
      navigator.platform || "",
      navigator.maxTouchPoints || 0
    );
    setIsIOS(platform.isIOS);
    setIsAndroid(platform.isAndroid);

    // 3. Pick up a prompt captured before hydration, then follow future captures.
    //    The early script owns the only beforeinstallprompt listener; we only
    //    subscribe to its notification event, so no duplicate listeners exist.
    const syncPrompt = () => setDeferredPrompt(window.__voltex_pwa_prompt ?? null);
    syncPrompt();

    const handleAppInstalled = () => {
      window.__voltex_pwa_prompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowInstructionsModal(false);
    };

    window.addEventListener(PWA_PROMPT_READY_EVENT, syncPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(PWA_PROMPT_READY_EVENT, syncPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  /**
   * Must be called directly from a click/tap handler.
   * - Native prompt available: opens Chrome's install dialog immediately (no modal first).
   * - Native prompt unavailable: opens manual platform instructions on iOS / Android.
   */
  const promptInstall = useCallback((): Promise<InstallOutcome> => {
    // Read the live global synchronously so we never use a stale or already-consumed event.
    const nativePrompt = window.__voltex_pwa_prompt ?? null;

    if (!nativePrompt) {
      if (isIOS || isAndroid) {
        setShowInstructionsModal(true);
      }
      return Promise.resolve("unavailable");
    }

    // A BeforeInstallPromptEvent can only be prompted once: discard it before launching.
    window.__voltex_pwa_prompt = null;
    setDeferredPrompt(null);

    // prompt() is invoked synchronously inside launchNativeInstallPrompt, within the user gesture.
    return launchNativeInstallPrompt(nativePrompt).then((outcome) => {
      if (outcome === "accepted") {
        setIsInstalled(true);
      } else if (outcome === "dismissed") {
        try {
          localStorage.setItem(STORAGE_DISMISSED_KEY, Date.now().toString());
        } catch {
          // Ignore localStorage errors
        }
      } else if (isIOS || isAndroid) {
        // The native dialog could not be launched; fall back to manual guidance.
        setShowInstructionsModal(true);
      }
      return outcome;
    });
  }, [isIOS, isAndroid]);

  const openInstallInstructions = useCallback(() => {
    setShowInstructionsModal(true);
  }, []);

  const closeInstallInstructions = useCallback(() => {
    setShowInstructionsModal(false);
  }, []);

  // Determine which platform instruction to display when modal opens
  const instructionPlatform: "ios" | "android" | null = isIOS
    ? "ios"
    : isAndroid
    ? "android"
    : null;

  // Can install if not already installed AND (we have a native prompt OR on iOS Safari / Android)
  const canInstall = !isInstalled && (deferredPrompt !== null || isIOS || isAndroid);

  return {
    canInstall,
    isInstalled,
    isIOS,
    isAndroid,
    hasPrompt: deferredPrompt !== null,
    promptInstall,
    openInstallInstructions,
    closeInstallInstructions,
    showInstructionsModal,
    instructionPlatform,
  };
}
