"use client";

import React, { useState, useEffect } from "react";
import { Ticket, CheckCircle2, AlertCircle, ArrowRight, Sparkles, Loader2, User, Mail, Phone, Tag } from "lucide-react";
import { CONFERENCE_CONFIG } from "@/config/constants";

interface BuyerCaptureFormProps {
  initialCode?: string;
  volunteerName?: string | null;
  isDirectLink?: boolean;
}

export function BuyerCaptureForm({
  initialCode = "",
  volunteerName = null,
  isDirectLink = false,
}: BuyerCaptureFormProps) {
  const [referralCode, setReferralCode] = useState(initialCode);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [sourceAttribution, setSourceAttribution] = useState("Volunteer Referral Link");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successPayload, setSuccessPayload] = useState<{
    status: string;
    redirectUrl: string;
    leadId: string;
    creditedVolunteerName?: string | null;
  } | null>(null);

  // Background beacon for human visit tracking
  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      fetch("/api/referrals/track-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode: initialCode.trim() }),
      }).catch((err) => {
        // Silent failure for background telemetry
        console.warn("[TELEMETRY] Beacon failed:", err);
      });
    }
  }, [initialCode]);

  // Synchronize referralCode whenever initialCode prop changes or from client URL fallback
  useEffect(() => {
    if (initialCode && initialCode.trim()) {
      setReferralCode(initialCode.trim().toUpperCase());
    } else if (typeof window !== "undefined") {
      // Fallback: extract code from URL pathname (/r/[code]) or search query (?code= / ?ref=)
      const pathname = window.location.pathname;
      const match = pathname.match(/^\/r\/([^/?#]+)/i);
      if (match && match[1]) {
        setReferralCode(decodeURIComponent(match[1]).trim().toUpperCase());
      } else {
        const sp = new URLSearchParams(window.location.search);
        const qCode = sp.get("code") || sp.get("ref") || sp.get("referralCode");
        if (qCode && qCode.trim()) {
          setReferralCode(qCode.trim().toUpperCase());
        }
      }
    }
  }, [initialCode]);

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanCode = referralCode.trim().toUpperCase();

    if (!cleanName || cleanName.length < 2) {
      setErrorMessage("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!cleanCode) {
      setErrorMessage("A volunteer referral code is required.");
      return;
    }

    const parsedQty = Number(ticketQuantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 1 || parsedQty > 5) {
      setErrorMessage("Please select a valid ticket quantity between 1 and 5.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/referrals/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          referralCode: cleanCode,
          phone: phone.trim() || null,
          ticketQuantity: parsedQty,
          sourceAttribution: sourceAttribution.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setErrorMessage(
          result.message || "Failed to record your referral. Please check your information and try again."
        );
        setLoading(false);
        return;
      }

      // Success: display confirmation and trigger redirect
      setSuccessPayload(result);

      // Auto redirect to ticket provider after 1.5s
      setTimeout(() => {
        window.location.href = result.redirectUrl || CONFERENCE_CONFIG.ticketUrl;
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setErrorMessage(`Connection failed (${message}). Please try again.`);
      setLoading(false);
    }
  };

  // Render Confirmation State
  if (successPayload) {
    const isTouchRecorded = successPayload.status === "touch_recorded";
    // Never show the URL's volunteer if it was recorded as a subsequent touch for another volunteer
    const confirmedVolunteer =
      successPayload.creditedVolunteerName ||
      (!isTouchRecorded && volunteerName ? volunteerName : null);

    return (
      <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-6 sm:p-8 shadow-xl max-w-lg mx-auto text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Referral Secured!
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {confirmedVolunteer
              ? `Your ticket purchase will support volunteer ${confirmedVolunteer}.`
              : isTouchRecorded
              ? "Your ticket purchase remains attributed to your initial volunteer referrer."
              : "Your referral attribution has been successfully recorded."}
          </p>
          {isTouchRecorded && (
            <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg p-2.5 mt-2">
              We recognized your previous referral registration. Under TEDx challenge rules, first-touch attribution is locked to ensure fair volunteer credit.
            </p>
          )}
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-4 text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
          <p>Redirecting you to the official ticket checkout on Meeteor...</p>
          <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="bg-emerald-500 h-full w-full animate-pulse" />
          </div>
        </div>

        <div className="pt-2">
          <a
            href={successPayload.redirectUrl || CONFERENCE_CONFIG.ticketUrl}
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors shadow-sm"
          >
            <span>Proceed to Tickets Now</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-xl max-w-lg mx-auto space-y-6">
      {/* Header Banner */}
      <div className="space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-semibold tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Volunteer Support Program</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
          Join {CONFERENCE_CONFIG.name}
        </h1>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {volunteerName ? (
            <span>
              You were referred by <strong className="text-zinc-900 dark:text-white">{volunteerName}</strong>. Enter your details below to ensure your ticket purchase is credited to their leaderboard.
            </span>
          ) : (
            <span>
              Enter your details and volunteer referral code before proceeding to official ticket checkout.
            </span>
          )}
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div>
            <p className="font-medium">Referral submission error</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Capture Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Referral Code Field */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
            Referral Code <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Tag className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              disabled={isDirectLink && Boolean(initialCode)}
              placeholder="e.g. SARAH-7X2K"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono text-sm tracking-wider focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-75 disabled:cursor-not-allowed"
              required
            />
          </div>
          {isDirectLink && Boolean(referralCode) ? (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              Referral code applied from invite link.
            </p>
          ) : (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
              No referral code supplied. Enter your volunteer&apos;s code if you have one.
            </p>
          )}
        </div>

        {/* Full Name Field */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Alex Johnson"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
            Email Address <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              required
            />
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
            Please use the same email you will use when purchasing on Meeteor.
          </p>
        </div>

        {/* Optional Phone & Ticket Quantity in Two Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Phone <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="tickets-planned" className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
              Tickets Planned
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Ticket className="w-4 h-4" />
              </div>
              <select
                id="tickets-planned"
                value={ticketQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (val >= 1 && val <= 5) {
                    setTicketQuantity(val);
                  }
                }}
                className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value={1}>1 Ticket</option>
                <option value={2}>2 Tickets</option>
                <option value={3}>3 Tickets</option>
                <option value={4}>4 Tickets</option>
                <option value={5}>5 Tickets</option>
              </select>
            </div>
          </div>
        </div>

        {/* Optional Source Attribution */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-1.5">
            How did you hear about this event? <span className="text-zinc-400 font-normal">(Optional)</span>
          </label>
          <select
            value={sourceAttribution}
            onChange={(e) => setSourceAttribution(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="Volunteer Referral Link">Volunteer Direct Referral</option>
            <option value="WhatsApp Community / Chat">WhatsApp Community / Chat</option>
            <option value="Instagram / TikTok">Instagram / TikTok</option>
            <option value="LinkedIn / Professional Network">LinkedIn / Professional Network</option>
            <option value="Word of Mouth / Colleague">Word of Mouth / Colleague</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-5 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 text-white font-bold text-sm tracking-wide shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Securing Referral...</span>
              </>
            ) : (
              <>
                <span>Proceed to Ticket Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Direct Bypass Link */}
      <div className="text-center pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        <a
          href={CONFERENCE_CONFIG.ticketUrl}
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline transition-colors"
        >
          Skip referral capture & purchase tickets directly on Meeteor
        </a>
      </div>
    </div>
  );
}
