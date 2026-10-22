"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Share, PlusSquare, Smartphone, MoreVertical } from "lucide-react";

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: "ios" | "android" | null;
}

/**
 * PwaInstallModal
 * Accessible dialog explaining manual "Add to Home Screen" instructions for iOS Safari and Android Chrome.
 * Portals directly to document.body and respects mobile viewport constraints.
 */
export function PwaInstallModal({ isOpen, onClose, platform = "ios" }: PwaInstallModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const isAndroid = platform === "android";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-backdrop"
    >
      <div className="bg-[#111114] border border-zinc-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-zinc-200 animate-modal relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
          aria-label="Close Install Dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 pb-2 border-b border-zinc-800/80">
          <div className="w-9 h-9 rounded-lg bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-red">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 id="pwa-install-title" className="text-sm font-bold text-white">
              Install VolTex
            </h3>
            <p className="text-[11px] text-zinc-400">
              {isAndroid ? "Android Chrome Setup" : "iOS Safari Setup"}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
          <p>
            Add VolTex to your home screen for full-screen access, instant ticket logging, and faster live standings:
          </p>

          {isAndroid ? (
            <ol className="space-y-2.5 list-none pl-0">
              <li className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-lg">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 font-mono font-bold text-[10px] text-zinc-300 shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white font-medium">Menu</strong> (three dots){" "}
                  <MoreVertical className="w-3.5 h-3.5 inline-block text-tedx-red mx-0.5 align-text-bottom" /> in Chrome&apos;s top-right corner.
                </span>
              </li>

              <li className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-lg">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 font-mono font-bold text-[10px] text-zinc-300 shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Select <strong className="text-white font-medium">Install app</strong> (or <strong className="text-white font-medium">Add to Home screen</strong>).
                </span>
              </li>

              <li className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-lg">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 font-mono font-bold text-[10px] text-zinc-300 shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Tap <strong className="text-white font-medium">Install</strong> in the confirmation popup.
                </span>
              </li>
              <li className="text-[11px] text-zinc-400 px-1">
                Don&apos;t see this option? If you opened VolTex inside another app (such as WhatsApp or
                Instagram), open the link in Chrome first. If VolTex is already installed, open it from your
                home screen.
              </li>
            </ol>
          ) : (
            <ol className="space-y-2.5 list-none pl-0">
              <li className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-lg">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 font-mono font-bold text-[10px] text-zinc-300 shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white font-medium">Share</strong> button{" "}
                  <Share className="w-3.5 h-3.5 inline-block text-tedx-red mx-0.5 align-text-bottom" /> in Safari&apos;s bottom toolbar.
                </span>
              </li>

              <li className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-lg">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 font-mono font-bold text-[10px] text-zinc-300 shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Scroll down and tap{" "}
                  <strong className="text-white font-medium">Add to Home Screen</strong>{" "}
                  <PlusSquare className="w-3.5 h-3.5 inline-block text-zinc-400 mx-0.5 align-text-bottom" />.
                </span>
              </li>

              <li className="flex items-start gap-2.5 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-lg">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800 font-mono font-bold text-[10px] text-zinc-300 shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Confirm by tapping <strong className="text-white font-medium">Add</strong> in the top-right corner.
                </span>
              </li>
            </ol>
          )}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-xs font-semibold transition-all"
          >
            Got It
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
