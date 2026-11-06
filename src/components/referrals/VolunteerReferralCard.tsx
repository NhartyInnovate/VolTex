/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Copy, Check, QrCode, Share2, Sparkles, Download, Eye, Users, CheckCircle2, TrendingUp, Info, X } from "lucide-react";

interface VolunteerReferralCardProps {
  referralCode: string;
  volunteerName: string;
}

interface StatsData {
  totalRawRequests: number;
  totalTrackedVisits: number;
  totalUniqueVisitorDays: number;
  cohortLeadsCaptured: number;
  cohortLeadsConverted: number;
  cohortConversionRate: number;
}

export function VolunteerReferralCard({
  referralCode,
  volunteerName,
}: VolunteerReferralCardProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [origin, setOrigin] = useState("");
  const [mounted, setMounted] = useState(false);

  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prevQrModalOpenRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const referralUrl = `${origin}/r/${referralCode}`;

  // Generate QR code data URL when modal opens
  useEffect(() => {
    if (qrModalOpen && referralUrl) {
      QRCode.toDataURL(referralUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("QR generation error:", err));
    }
  }, [qrModalOpen, referralUrl]);

  // Background scroll locking on mobile (Android/iOS) and desktop
  useEffect(() => {
    if (!qrModalOpen) return;

    // Capture current scroll offset
    const scrollY = window.scrollY;

    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalTouchAction = document.body.style.touchAction;

    // Fixed position and overflow lock prevent underlying page scrolling on Android Chrome & iOS Safari
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.touchAction = originalTouchAction;
      window.scrollTo(0, scrollY);
    };
  }, [qrModalOpen]);

  // Handle Escape key and trap focus within modal dialog
  useEffect(() => {
    if (!qrModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQrModalOpen(false);
        return;
      }

      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [qrModalOpen]);

  // Focus management: initial focus on open and return to trigger button on close
  useEffect(() => {
    if (qrModalOpen) {
      const timer = setTimeout(() => {
        if (closeButtonRef.current) {
          closeButtonRef.current.focus();
        } else if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 50);
      prevQrModalOpenRef.current = true;
      return () => clearTimeout(timer);
    } else {
      // Only restore focus if the modal transitioned from open to closed (prevent initial mount auto-focus)
      if (prevQrModalOpenRef.current && triggerButtonRef.current) {
        triggerButtonRef.current.focus();
      }
      prevQrModalOpenRef.current = false;
    }
  }, [qrModalOpen]);

  // Fetch volunteer stats via API or RPC
  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/referrals/stats");
        if (res.ok) {
          const data = await res.json();
          if (data.stats) {
            setStats(data.stats);
          }
        }
      } catch (err) {
        console.warn("Could not load stats:", err);
      }
    }
    loadStats();
  }, [referralCode]);

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Your Personal Referral Hub</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
            Pre-Purchase Ticket Link & QR
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Share this link or QR code with prospective buyers. When they register before buying tickets on Meeteor, your attribution is locked in.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            ref={triggerButtonRef}
            onClick={() => setQrModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40"
          >
            <QrCode className="w-4 h-4" />
            <span>Show QR Code</span>
          </button>
        </div>
      </div>

      {/* Code & Link Display Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Referral Code Box */}
        <div className="bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Your Referral Code
          </span>
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-2xl font-black text-red-600 dark:text-red-400 tracking-wider">
              {referralCode}
            </span>
            <button
              onClick={() => copyToClipboard(referralCode, false)}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Copy Referral Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <span className="text-[10px] text-zinc-400">Unique identifier linked to your volunteer profile</span>
        </div>

        {/* Full Link Box */}
        <div className="md:col-span-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Pre-Purchase Landing Link
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={referralUrl}
              className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-700 dark:text-zinc-300 select-all"
            />
            <button
              onClick={() => copyToClipboard(referralUrl, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-medium transition-colors"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? "Copied" : "Copy Link"}</span>
            </button>
          </div>
          <span className="text-[10px] text-zinc-400">Direct buyers to register here before completing their ticket order on Meeteor</span>
        </div>
      </div>

      {/* Referral Engagement Telemetry Section */}
      {stats && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
              Engagement & Conversion Telemetry
            </span>
            <span className="text-[10px] text-zinc-400">
              Direct Link & QR Visits
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Total Requests</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{stats.totalRawRequests}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Tracked Visits</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{stats.totalTrackedVisits}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Buyer Leads</span>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">{stats.cohortLeadsCaptured}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Converted Leads</span>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.cohortLeadsConverted}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Conversion Rate</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{stats.cohortConversionRate}%</p>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal (Portaled directly to document.body, responsive with backdrop scroll locking) */}
      {qrModalOpen && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          aria-describedby="qr-modal-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setQrModalOpen(false);
            }
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 dark:bg-black/80 backdrop-blur-sm overscroll-contain animate-in fade-in duration-150 touch-none"
          style={{
            paddingTop: "max(0.75rem, env(safe-area-inset-top, 0.75rem))",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
            paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0.75rem))",
            paddingRight: "max(0.75rem, env(safe-area-inset-right, 0.75rem))",
          }}
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-4 sm:p-6 text-center space-y-4 sm:space-y-5 shadow-2xl relative max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain animate-in zoom-in-95 duration-150 focus:outline-none"
          >
            {/* Top-right close button */}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/40"
              aria-label="Close QR code dialog"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1 pt-1 sm:pt-0 pr-6 sm:pr-0">
              <h3 id="qr-modal-title" className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white">
                Scan to Register Referral
              </h3>
              <p id="qr-modal-desc" className="text-xs text-zinc-500 dark:text-zinc-400">
                Attendees can scan this QR code with their mobile phone camera before purchasing.
              </p>
            </div>

            <div className="p-3 sm:p-4 bg-white rounded-xl shadow-inner inline-block mx-auto border border-zinc-200">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`Referral QR Code for ${referralCode}`}
                  className="w-44 h-44 xs:w-48 xs:h-48 sm:w-56 sm:h-56 max-w-full aspect-square mx-auto object-contain"
                />
              ) : (
                <div className="w-44 h-44 sm:w-56 sm:h-56 flex items-center justify-center text-zinc-400 text-xs">
                  Generating QR code...
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-zinc-600 dark:text-zinc-300">
              Code: <strong className="text-red-600 dark:text-red-400 text-sm font-bold tracking-wider">{referralCode}</strong>
            </div>

            <div className="flex gap-2 pt-1">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`VolTex-QR-${referralCode}.png`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 sm:px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold transition-colors shadow-sm active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
