"use client";

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  openIOSInstructions: () => void;
  closeIOSInstructions: () => void;
  showIOSModal: boolean;
}

const STORAGE_DISMISSED_KEY = "voltex_pwa_install_dismissed_v1";

/**
 * usePwaInstall
 * Reusable client-side hook for managing PWA installation across Chrome/Edge/Android and iOS Safari.
 * Detects standalone display mode, captures beforeinstallprompt, and manages accessible iOS fallback.
 */
export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

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

    // 2. Detect iOS Safari (does not support beforeinstallprompt)
    const userAgent = window.navigator.userAgent || "";
    const isIOSDevice =
      (/iPad|iPhone|iPod/.test(userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
      // @ts-expect-error - MSStream check
      !window.MSStream;

    const isSafari =
      /Safari/.test(userAgent) &&
      !/CriOS|FxiOS|OPiOS|mercury|EdgiOS/.test(userAgent) &&
      !/Chrome|Android/.test(userAgent);

    if (isIOSDevice && isSafari) {
      setIsIOS(true);
    }

    // 3. Capture beforeinstallprompt on Chromium / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Listen to appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowIOSModal(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Trigger standard installation prompt
  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowIOSModal(true);
        return "unavailable";
      }
      return "unavailable";
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      } else {
        try {
          localStorage.setItem(STORAGE_DISMISSED_KEY, Date.now().toString());
        } catch {
          // Ignore localStorage errors
        }
      }
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      setDeferredPrompt(null);
      return "unavailable";
    }
  }, [deferredPrompt, isIOS]);

  const openIOSInstructions = useCallback(() => {
    setShowIOSModal(true);
  }, []);

  const closeIOSInstructions = useCallback(() => {
    setShowIOSModal(false);
  }, []);

  // Can install if not already installed AND (we have deferred prompt OR on iOS Safari)
  const canInstall = !isInstalled && (deferredPrompt !== null || isIOS);

  return {
    canInstall,
    isInstalled,
    isIOS,
    promptInstall,
    openIOSInstructions,
    closeIOSInstructions,
    showIOSModal,
  };
}
