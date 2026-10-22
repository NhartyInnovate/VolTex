"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister
 * Lightweight client component that registers the service worker (/sw.js)
 * after the window load event in supported production HTTPS or localhost environments.
 * Non-blocking, fails gracefully, and creates no UI or hydration disruption.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Only register on HTTPS or localhost
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";

    if (window.location.protocol !== "https:" && !isLocalhost) {
      return;
    }

    const registerSW = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Gracefully suppress or softly log without breaking UI
          if (process.env.NODE_ENV === "development") {
            console.warn("ServiceWorker registration notice:", err);
          }
        });
    };

    if (document.readyState === "complete") {
      registerSW();
    } else {
      window.addEventListener("load", registerSW, { once: true });
      return () => window.removeEventListener("load", registerSW);
    }
  }, []);

  return null;
}
