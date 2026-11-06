/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode, Share2, Sparkles, Download, Eye, Users, CheckCircle2, TrendingUp, Info } from "lucide-react";

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

  useEffect(() => {
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
            onClick={() => setQrModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-colors"
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
          <div className="flex items-center justify-between">
            <span className="font-mono text-xl font-black text-red-600 dark:text-red-400 tracking-wider">
              {referralCode || "PENDING"}
            </span>
            <button
              onClick={() => copyToClipboard(referralCode, false)}
              className="p-2 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
              title="Copy Referral Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Shareable Link Box */}
        <div className="md:col-span-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-750 rounded-xl p-4 flex flex-col justify-between space-y-3">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Direct Buyer Landing Link
          </span>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate">
              {referralUrl || `/r/${referralCode}`}
            </span>
            <button
              onClick={() => copyToClipboard(referralUrl, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors flex-shrink-0"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry & Lead Funnel Stats */}
      {stats && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              Referral Activity (Last 30 Days)
            </h3>
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Clicks do not award points; points derive from verified approved tickets.
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Raw Clicks</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{stats.totalRawRequests}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Verified Visits</span>
              <p className="text-lg font-bold text-zinc-900 dark:text-white mt-0.5">{stats.totalTrackedVisits}</p>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-850 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase font-semibold">Captured Leads</span>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">{stats.cohortLeadsCaptured}</p>
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

      {/* QR Code Modal */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-sm w-full p-6 text-center space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Scan to Register Referral
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Attendees can scan this QR code with their mobile phone camera before purchasing.
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl shadow-inner inline-block mx-auto border border-zinc-200">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Referral QR Code" className="w-56 h-56 mx-auto" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-zinc-400 text-xs">
                  Generating QR code...
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-zinc-600 dark:text-zinc-300">
              Code: <strong className="text-red-600 dark:text-red-400">{referralCode}</strong>
            </div>

            <div className="flex gap-2">
              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`VolTex-QR-${referralCode}.png`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download QR</span>
                </a>
              )}
              <button
                onClick={() => setQrModalOpen(false)}
                className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
