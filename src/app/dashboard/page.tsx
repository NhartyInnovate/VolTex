"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  MOCK_VOLUNTEER_USER,
  MOCK_VOLUNTEER_REFERRALS,
} from "@/data/mock-data";
import {
  CONFERENCE_CONFIG,
  PROMOTIONAL_TEMPLATES,
  TICKET_TYPES,
} from "@/config/constants";
import { calculateVolunteerSummary } from "@/lib/scoring";
import { ReferralRecord } from "@/types";
import { formatDateTime } from "@/lib/utils";
import {
  Trophy,
  Ticket,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlusCircle,
  Copy,
  Check,
  Share2,
  ExternalLink,
  Users,
  Sparkles,
  Info,
  Layers,
  Phone,
  Mail,
  X,
} from "lucide-react";

export default function VolunteerDashboardPage() {
  const [referrals, setReferrals] = useState<ReferralRecord[]>(
    MOCK_VOLUNTEER_REFERRALS
  );
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formBuyerName, setFormBuyerName] = useState("");
  const [formTicketType, setFormTicketType] = useState<string>(TICKET_TYPES[0]);
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formSuccessMessage, setFormSuccessMessage] = useState<string | null>(
    null
  );

  // Compute live scoring from current submissions
  const summary = useMemo(() => {
    return calculateVolunteerSummary(referrals);
  }, [referrals]);

  // Filtered referrals list
  const filteredReferrals = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter((r) => r.status === statusFilter);
  }, [referrals, statusFilter]);

  // Handle Copy link or template
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Handle submission of new referral claim
  const handleCreateReferral = (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedIdentifier = formIdentifier.toLowerCase().trim();
    const normalizedBuyerName = formBuyerName.toLowerCase().trim();

    // Check 1: Reliable identifier match
    const matchedByIdentifier = Boolean(
      normalizedIdentifier &&
        referrals.some(
          (r) =>
            r.buyerIdentifier &&
            r.buyerIdentifier.toLowerCase().trim() === normalizedIdentifier
        )
    );

    // Check 2: Buyer name match (flagged for manual review only)
    const matchedByName = Boolean(
      normalizedBuyerName &&
        referrals.some(
          (r) => r.buyerName.toLowerCase().trim() === normalizedBuyerName
        )
    );

    const isDuplicate = matchedByIdentifier || matchedByName;
    const duplicateReason = matchedByIdentifier
      ? "Purchase identifier matches existing referral claim"
      : matchedByName
      ? "Matching buyer name detected; requires organizer reconciliation"
      : undefined;

    const newRecord: ReferralRecord = {
      id: `ref-local-${Date.now()}`,
      volunteerId: MOCK_VOLUNTEER_USER.id,
      volunteerName: MOCK_VOLUNTEER_USER.fullName,
      volunteerTeam: MOCK_VOLUNTEER_USER.volunteerTeam,
      buyerName: formBuyerName,
      ticketType: formTicketType,
      ticketQuantity: Math.min(50, Math.max(1, Number(formQuantity))),
      buyerIdentifier: formIdentifier,
      status: "pending",
      flaggedDuplicate: isDuplicate,
      duplicateReason,
      adminNotes: isDuplicate ? `Flagged: ${duplicateReason}` : undefined,
      createdAt: new Date().toISOString(),
    };

    setReferrals([newRecord, ...referrals]);
    setFormSuccessMessage(
      isDuplicate
        ? `Referral claim submitted! Note: ${duplicateReason}. Flagged for organizer review.`
        : "Referral claim submitted successfully! Status is now Pending verification against Meeteor Hub."
    );

    // Reset fields
    setFormBuyerName("");
    setFormIdentifier("");
    setFormQuantity(1);

    setTimeout(() => {
      setFormSuccessMessage(null);
      setIsSubmitModalOpen(false);
    }, 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner & Volunteer Identity */}
      <div className="tedx-surface rounded-2xl p-6 sm:p-8 border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-40 bg-tedx-red/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tedx-red/15 border border-tedx-red/30 text-xs font-bold text-tedx-lightred uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Volunteer Portal Preview
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
              {MOCK_VOLUNTEER_USER.volunteerTeam}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white">
            Welcome, {MOCK_VOLUNTEER_USER.fullName}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-zinc-500" />
              {MOCK_VOLUNTEER_USER.email}
            </span>
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-zinc-500" />
              {MOCK_VOLUNTEER_USER.phoneNumber}
            </span>
            <span className="flex items-center gap-1 text-tedx-lightred">
              <Trophy className="w-3.5 h-3.5" />
              Leaderboard Rank: #5
            </span>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="relative z-10 shrink-0 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsSubmitModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-sm font-bold shadow-tedx transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Report Ticket Referral
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Points */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800 relative overflow-hidden group hover:border-tedx-red/40 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Points Earned</span>
            <Trophy className="w-4 h-4 text-tedx-red" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-white">
              {summary.points}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">pts</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            1 point awarded per 2 verified tickets
          </p>
        </div>

        {/* Verified Tickets */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Verified Paid Tickets</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-emerald-400">
              {summary.approvedTickets}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">tickets</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Confirmed with Meeteor records
          </p>
        </div>

        {/* Carryover Ticket */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800 relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Odd Carryover</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-amber-400">
              +{summary.carryoverTickets}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">
              carryover
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            {summary.carryoverTickets === 1
              ? "Next verified ticket awards 1 point!"
              : "Even count, ready for next pair"}
          </p>
        </div>

        {/* Pending Tickets */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800 relative overflow-hidden group hover:border-zinc-700 transition-all">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-zinc-300">
              {summary.pendingTickets}
            </span>
            <span className="text-xs text-zinc-400 font-semibold">tickets</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Awaiting administrator verification
          </p>
        </div>
      </div>

      {/* 3. Promotional Resources & Ready-to-Share Outreach Kit */}
      <div className="tedx-surface rounded-2xl p-6 sm:p-8 border-zinc-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-tedx-red mb-1">
              <Share2 className="w-3.5 h-3.5" />
              Volunteer Outreach Kit
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Ready-to-Share Promotional Resources
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Copy pre-drafted invite messages or send them directly to WhatsApp groups and contacts.
            </p>
          </div>

          {/* Quick Copy Link Box */}
          <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-xl p-2 shrink-0">
            <div className="text-xs text-zinc-400 font-mono truncate max-w-[200px] sm:max-w-[260px] pl-2">
              {CONFERENCE_CONFIG.ticketUrl}
            </div>
            <button
              onClick={() =>
                handleCopy("official-ticket-url", CONFERENCE_CONFIG.ticketUrl)
              }
              className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
            >
              {copiedId === "official-ticket-url" ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROMOTIONAL_TEMPLATES.map((tpl) => {
            const compiledMessage = tpl.content(
              MOCK_VOLUNTEER_USER.fullName,
              CONFERENCE_CONFIG.ticketUrl
            );
            const isCopied = copiedId === tpl.id;
            const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
              compiledMessage
            )}`;

            return (
              <div
                key={tpl.id}
                className="bg-black/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-tedx-lightred">
                      {tpl.channel}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      {tpl.title}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans line-clamp-4 bg-zinc-950/80 p-3 rounded-lg border border-zinc-900">
                    &ldquo;{compiledMessage}&rdquo;
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share on WhatsApp
                  </a>

                  <button
                    onClick={() => handleCopy(tpl.id, compiledMessage)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        Copied Text
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Referral Submissions History Table */}
      <div className="tedx-surface rounded-2xl border-zinc-800 overflow-hidden shadow-xl space-y-4 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Your Referral Submissions
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Keep track of buyer reports and review verification decisions from event admins.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-black p-1 rounded-xl border border-zinc-800 self-start sm:self-auto text-xs">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "all"
                  ? "bg-zinc-800 text-white font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              All ({referrals.length})
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "approved"
                  ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/50"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Approved ({referrals.filter((r) => r.status === "approved").length})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "pending"
                  ? "bg-amber-950 text-amber-300 font-bold border border-amber-800/50"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Pending ({referrals.filter((r) => r.status === "pending").length})
            </button>
            <button
              onClick={() => setStatusFilter("rejected")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "rejected"
                  ? "bg-red-950 text-red-300 font-bold border border-red-800/50"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Rejected ({referrals.filter((r) => r.status === "rejected").length})
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[11px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Buyer Name</th>
                <th className="py-3.5 px-4 sm:px-6">Ticket Type</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">Quantity</th>
                <th className="py-3.5 px-4 sm:px-6">Identifier / Ref</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
                <th className="py-3.5 px-4 sm:px-6">Admin Note</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
              {filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-zinc-500 text-xs">
                    No referrals found for this filter.
                  </td>
                </tr>
              ) : (
                filteredReferrals.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-white">
                      {r.buyerName}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-zinc-300 text-xs">
                      {r.ticketType}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-center font-mono font-bold text-white">
                      {r.ticketQuantity}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-xs text-zinc-400 font-mono">
                      {r.buyerIdentifier || "—"}
                      {r.flaggedDuplicate && (
                        <span className="block mt-1 text-[10px] text-amber-400 font-sans font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Duplicate Flagged
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6">
                      {r.status === "approved" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {r.status === "pending" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-400 border border-amber-800/60">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                      {r.status === "rejected" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-400 border border-red-800/60">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-xs text-zinc-400 max-w-xs truncate">
                      {r.adminNotes || "—"}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right text-xs text-zinc-500 font-mono">
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Referral Submission Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="tedx-surface rounded-2xl max-w-lg w-full p-6 sm:p-8 border-zinc-700 shadow-2xl relative space-y-6">
            <button
              onClick={() => setIsSubmitModalOpen(false)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-tedx-red mb-1">
                <Ticket className="w-3.5 h-3.5" />
                Referral Reporting Form
              </div>
              <h3 className="text-xl font-black text-white">
                Submit Buyer Referral Claim
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Submit the buyer&apos;s details. Once approved against Meeteor records, points will be credited to your standing.
              </p>
            </div>

            {formSuccessMessage && (
              <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 p-3 rounded-xl text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{formSuccessMessage}</div>
              </div>
            )}

            <form onSubmit={handleCreateReferral} className="space-y-4">
              {/* Buyer Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Buyer&apos;s Full Name (as registered on Meeteor) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Babatunde Lawal"
                  value={formBuyerName}
                  onChange={(e) => setFormBuyerName(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                />
              </div>

              {/* Ticket Type & Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Ticket Type *
                  </label>
                  <select
                    value={formTicketType}
                    onChange={(e) => setFormTicketType(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-tedx-red transition-colors"
                  >
                    {TICKET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Ticket Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Additional Identifier */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Additional Identifier (Order #, Email, or Buyer Phone)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MTR-TX-10294 or buyer@company.com"
                  value={formIdentifier}
                  onChange={(e) => setFormIdentifier(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                />
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Helps event admins rapidly reconcile your claim with Meeteor Hub. Duplicate codes are flagged for review.
                </span>
              </div>

              {/* Duplicate Protection Note */}
              <div className="p-3 bg-zinc-900/60 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-tedx-red shrink-0 mt-0.5" />
                <span>
                  All submissions are initially marked as <strong className="text-amber-400">Pending</strong>. Points are calculated only after administrator approval.
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-xs font-bold shadow-tedx transition-all"
                >
                  Submit for Verification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
