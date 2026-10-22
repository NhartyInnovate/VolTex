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
  isAndroid: boolean;
  hasPrompt: boolean;
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  openInstallInstructions: () => void;
  closeInstallInstructions: () => void;
  showInstructionsModal: boolean;
  instructionPlatform: "ios" | "android" | null;
}

declare global {
  interface Window {
    __voltex_pwa_prompt?: BeforeInstallPromptEvent | null;
  }
}

const STORAGE_DISMISSED_KEY = "voltex_pwa_install_dismissed_v1";

/**
 * usePwaInstall
 * Reusable client-side hook for managing PWA installation across Chrome/Edge/Android and iOS Safari.
 * Detects standalone display mode, captures beforeinstallprompt, and manages accessible iOS fallback.
 */
export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window !== "undefined" && window.__voltex_pwa_prompt) {
      return window.__voltex_pwa_prompt;
    }
    return null;
  });
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

    const userAgent = window.navigator.userAgent || "";

    // 2. Detect iOS Safari
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

    // 3. Detect Android browser
    const isAndroidDevice = /Android/i.test(userAgent);
    if (isAndroidDevice) {
      setIsAndroid(true);
    }

    // 4. Capture beforeinstallprompt on Chromium / Android
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__voltex_pwa_prompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };

    // 5. Listen to appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      window.__voltex_pwa_prompt = null;
      setDeferredPrompt(null);
      setShowInstructionsModal(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // If an early script already captured the prompt, pick it up
    if (window.__voltex_pwa_prompt && !deferredPrompt) {
      setDeferredPrompt(window.__voltex_pwa_prompt);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [deferredPrompt]);

  // Trigger installation prompt or show manual fallback instructions
  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    // Check local deferredPrompt state or window global cache
    const activePrompt = deferredPrompt || (typeof window !== "undefined" ? window.__voltex_pwa_prompt : null);

    if (!activePrompt) {
      // If native deferred prompt is not available, show platform instructions modal
      if (isIOS || isAndroid) {
        setShowInstructionsModal(true);
        return "unavailable";
      }
      return "unavailable";
    }

    try {
      await activePrompt.prompt();
      const choice = await activePrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      } else {
        try {
          localStorage.setItem(STORAGE_DISMISSED_KEY, Date.now().toString());
        } catch {
          // Ignore localStorage errors
        }
      }
      window.__voltex_pwa_prompt = null;
      setDeferredPrompt(null);
      return choice.outcome;
    } catch {
      window.__voltex_pwa_prompt = null;
      setDeferredPrompt(null);
      return "unavailable";
    }
  }, [deferredPrompt, isIOS, isAndroid]);

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

  // Can install if not already installed AND (we have deferred prompt OR on mobile platform iOS/Android)
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
