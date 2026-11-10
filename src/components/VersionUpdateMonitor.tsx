"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Sparkles } from "lucide-react";

/**
 * Checks whether the user is actively focused on a form input or typing.
 * Used to ensure we never disrupt active user input.
 */
function isUserActivelyTyping(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toUpperCase();
  if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return true;
  if (el.getAttribute("contenteditable") === "true") return true;
  return false;
}

export function VersionUpdateMonitor() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const clientBuildIdRef = useRef<string | null>(
    process.env.NEXT_PUBLIC_APP_BUILD_ID || null
  );
  const isCheckingRef = useRef(false);

  const forceReload = useCallback(() => {
    setIsReloading(true);
    if (typeof window === "undefined") return;

    const doReload = () => {
      window.location.reload();
    };

    try {
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((names) => {
            return Promise.all(
              names
                .filter((name) => name.startsWith("voltex-"))
                .map((name) => caches.delete(name))
            );
          })
          .catch(() => {})
          .finally(doReload);
      } else {
        doReload();
      }
    } catch {
      doReload();
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (typeof window === "undefined" || isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const res = await fetch(`/api/version?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });

      if (!res.ok) return;

      const data = await res.json();
      const serverBuildId = data?.buildId;

      if (!serverBuildId) return;

      // If this is the first check and we didn't have clientBuildIdRef, initialize it
      if (!clientBuildIdRef.current) {
        clientBuildIdRef.current = serverBuildId;
        return;
      }

      // If server build ID differs from client build ID, an update was deployed
      if (serverBuildId !== clientBuildIdRef.current) {
        setUpdateAvailable(true);

        // Safe auto-reload: If user is idle (not typing in an input) and hasn't reloaded for this build yet
        const reloadSessionKey = `voltex_reloaded_${serverBuildId}`;
        const hasReloadedForThisBuild = sessionStorage.getItem(reloadSessionKey);

        if (!hasReloadedForThisBuild && !isUserActivelyTyping()) {
          sessionStorage.setItem(reloadSessionKey, "1");
          forceReload();
        }
      }
    } catch {
      // Fail silently; version check is background telemetry
    } finally {
      isCheckingRef.current = false;
    }
  }, [forceReload]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Initial check shortly after page load
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, 5000);

    // 2. Tab Visibility Change (user switches back to tab or unlocks device)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkForUpdate();
      }
    };

    // 3. Window Focus
    const handleFocus = () => {
      checkForUpdate();
    };

    // 4. Periodic background polling (every 5 minutes)
    const intervalTimer = setInterval(() => {
      checkForUpdate();
    }, 5 * 60 * 1000);

    // 5. Service Worker controller change (new SW activated)
    const handleControllerChange = () => {
      if (!isUserActivelyTyping()) {
        forceReload();
      } else {
        setUpdateAvailable(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    }

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      }
    };
  }, [checkForUpdate, forceReload]);

  if (!updateAvailable) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900/95 dark:bg-zinc-800/95 text-white shadow-2xl border border-zinc-700/80 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 max-w-sm"
    >
      <div className="w-8 h-8 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 animate-pulse" />
      </div>
      <div className="flex-1 text-xs">
        <p className="font-semibold text-zinc-100">Update Available</p>
        <p className="text-zinc-400 text-[11px]">A new version of VolTex is ready.</p>
      </div>
      <button
        type="button"
        onClick={forceReload}
        disabled={isReloading}
        className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold text-xs tracking-wide transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-75"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
        <span>{isReloading ? "Updating..." : "Update"}</span>
      </button>
    </aside>
  );
}
