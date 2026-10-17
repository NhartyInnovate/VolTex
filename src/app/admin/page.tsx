"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  MOCK_ADMIN_USER,
  MOCK_ADMIN_ALL_REFERRALS,
} from "@/data/mock-data";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { calculatePointsFromTickets } from "@/lib/scoring";
import { ReferralRecord, ReferralStatus } from "@/types";
import { formatDateTime } from "@/lib/utils";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Search,
  Filter,
  Check,
  X,
  FileText,
  User,
  Users,
  Trophy,
  Ticket,
  Sparkles,
} from "lucide-react";

export default function AdminDashboardPage() {
  const [referrals, setReferrals] = useState<ReferralRecord[]>(
    MOCK_ADMIN_ALL_REFERRALS
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReferral, setActiveReferral] = useState<ReferralRecord | null>(
    null
  );
  const [decisionNotes, setDecisionNotes] = useState("");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filter referrals for admin queue
  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      const matchesStatus =
        selectedStatus === "all" || r.status === selectedStatus;
      const matchesSearch =
        r.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.volunteerName &&
          r.volunteerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.buyerIdentifier &&
          r.buyerIdentifier.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [referrals, selectedStatus, searchQuery]);

  // Overall Statistics
  const stats = useMemo(() => {
    const total = referrals.length;
    const pending = referrals.filter((r) => r.status === "pending").length;
    const approved = referrals.filter((r) => r.status === "approved").length;
    const rejected = referrals.filter((r) => r.status === "rejected").length;
    const duplicates = referrals.filter((r) => r.flaggedDuplicate).length;

    const totalApprovedTickets = referrals
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.ticketQuantity, 0);

    const { points: totalPointsAwarded } =
      calculatePointsFromTickets(totalApprovedTickets);

    return {
      total,
      pending,
      approved,
      rejected,
      duplicates,
      totalApprovedTickets,
      totalPointsAwarded,
    };
  }, [referrals]);

  // Handle Approve or Reject
  const handleUpdateStatus = (
    referralId: string,
    newStatus: ReferralStatus,
    notes?: string
  ) => {
    setActionError(null);

    // Safeguard: Check if reliable purchase identifier is already approved
    if (newStatus === "approved") {
      const target = referrals.find((r) => r.id === referralId);
      const targetIdentifier = target?.buyerIdentifier?.toLowerCase().trim();
      if (
        targetIdentifier &&
        referrals.some(
          (r) =>
            r.id !== referralId &&
            r.status === "approved" &&
            r.buyerIdentifier &&
            r.buyerIdentifier.toLowerCase().trim() === targetIdentifier
        )
      ) {
        setActionError(
          `Double-Crediting Blocked: Purchase identifier "${target?.buyerIdentifier}" has already been approved for another claim. A single purchase cannot be credited multiple times.`
        );
        return;
      }
    }

    setReferrals((prev) =>
      prev.map((item) => {
        if (item.id === referralId) {
          return {
            ...item,
            status: newStatus,
            adminNotes:
              notes ||
              (newStatus === "approved"
                ? "Manually verified with Meeteor Hub records"
                : "Record not matched on Meeteor"),
            verifiedAt: new Date().toISOString(),
            verifiedBy: MOCK_ADMIN_USER.fullName,
          };
        }
        return item;
      })
    );

    setActionSuccess(
      `Referral successfully marked as ${newStatus.toUpperCase()}`
    );
    setActiveReferral(null);
    setDecisionNotes("");
    setTimeout(() => setActionSuccess(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header Banner & Admin Security Notice */}
      <div className="tedx-surface rounded-2xl p-6 sm:p-8 border-zinc-800 bg-gradient-to-r from-zinc-950 via-zinc-900 to-black relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-40 bg-zinc-700/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-3 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-200 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-tedx-red" />
              Admin Verification Hub Preview
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-950/60 text-tedx-lightred border border-red-800/40 font-semibold">
              Restricted Role: Administrator
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white">
            Referral Verification & Scoring
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Reconcile volunteer ticket claims against the official Meeteor Hub attendee register. Approving referrals immediately updates volunteer scores and public leaderboard standings.
          </p>
        </div>

        {/* External Meeteor Reference Link */}
        <div className="relative z-10 shrink-0">
          <a
            href={CONFERENCE_CONFIG.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-all shadow-md"
          >
            Open Meeteor Event Hub
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
          </a>
        </div>
      </div>

      {/* 2. Admin Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pending Claims */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-black text-amber-400">
            {stats.pending}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">Requires verification</p>
        </div>

        {/* Flagged Duplicates */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Duplicate Claims</span>
            <AlertTriangle className="w-4 h-4 text-tedx-red" />
          </div>
          <div className="text-3xl font-black text-tedx-lightred">
            {stats.duplicates}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Shared buyer identifiers
          </p>
        </div>

        {/* Approved Tickets */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Verified Tickets</span>
            <Ticket className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">
            {stats.totalApprovedTickets}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Confirmed attendee purchases
          </p>
        </div>

        {/* Points Awarded */}
        <div className="tedx-surface rounded-2xl p-5 border-zinc-800">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2 uppercase tracking-wider">
            <span>Total Points</span>
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div className="text-3xl font-black text-white">
            {stats.totalPointsAwarded}
          </div>
          <p className="text-[11px] text-zinc-500 mt-2">
            Awarded across all volunteers
          </p>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="bg-emerald-950/70 border border-emerald-800 text-emerald-300 p-4 rounded-xl text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        </div>
      )}

      {/* Action Error Notification */}
      {actionError && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 p-4 rounded-xl text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-tedx-red" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-xs text-red-400 hover:text-white ml-2 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Verification Queue */}
      <div className="tedx-surface rounded-2xl border-zinc-800 overflow-hidden shadow-xl space-y-4 p-6 sm:p-8">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              Referral Review Queue
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                {filteredReferrals.length}
              </span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select any claim to reconcile with Meeteor and issue approval.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search */}
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search buyer, volunteer, ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-black p-1 rounded-lg border border-zinc-800 text-xs w-full sm:w-auto">
              {["all", "pending", "approved", "rejected"].map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3 py-1 rounded capitalize font-medium transition-all ${
                    selectedStatus === st
                      ? "bg-zinc-800 text-white font-bold"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Verification Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900/80 text-zinc-400 uppercase text-[11px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Volunteer</th>
                <th className="py-3.5 px-4 sm:px-6">Buyer Name</th>
                <th className="py-3.5 px-4 sm:px-6">Ticket & Qty</th>
                <th className="py-3.5 px-4 sm:px-6">Identifier / Code</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 bg-zinc-950/40">
              {filteredReferrals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-zinc-500 text-xs">
                    No records found in this queue.
                  </td>
                </tr>
              ) : (
                filteredReferrals.map((r) => (
                  <tr
                    key={r.id}
                    className={`hover:bg-zinc-900/40 transition-colors ${
                      r.flaggedDuplicate ? "bg-amber-950/15" : ""
                    }`}
                  >
                    {/* Volunteer */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-white">
                        {r.volunteerName || "Unknown Volunteer"}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {r.volunteerTeam}
                      </div>
                    </td>

                    {/* Buyer */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-medium text-zinc-200">
                        {r.buyerName}
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        Submitted: {formatDateTime(r.createdAt)}
                      </div>
                    </td>

                    {/* Ticket & Qty */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <span className="font-mono font-bold text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800 mr-2">
                        x{r.ticketQuantity}
                      </span>
                      <span className="text-xs text-zinc-300">
                        {r.ticketType}
                      </span>
                    </td>

                    {/* Identifier */}
                    <td className="py-3.5 px-4 sm:px-6 text-xs font-mono text-zinc-300">
                      <div>{r.buyerIdentifier || "—"}</div>
                      {r.flaggedDuplicate && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-sans font-bold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60 mt-1">
                          <AlertTriangle className="w-3 h-3" /> Duplicate Alert
                        </span>
                      )}
                    </td>

                    {/* Status */}
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

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {r.status === "pending" ? (
                          <>
                            <button
                              onClick={() =>
                                handleUpdateStatus(r.id, "approved")
                              }
                              title="Quick Approve"
                              className="p-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/50 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleUpdateStatus(r.id, "rejected")
                              }
                              title="Quick Reject"
                              className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-800/50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setActiveReferral(r);
                                setDecisionNotes(r.adminNotes || "");
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium"
                            >
                              Review
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setActiveReferral(r);
                              setDecisionNotes(r.adminNotes || "");
                            }}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800"
                          >
                            Details
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Detailed Decision Modal */}
      {activeReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="tedx-surface rounded-2xl max-w-lg w-full p-6 sm:p-8 border-zinc-700 shadow-2xl relative space-y-6">
            <button
              onClick={() => setActiveReferral(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-zinc-400 mb-1">
                <FileText className="w-3.5 h-3.5 text-tedx-red" />
                Referral Verification Modal
              </div>
              <h3 className="text-xl font-black text-white">
                Reconcile & Audit Decision
              </h3>
            </div>

            {/* Referral Metadata Card */}
            <div className="bg-black/60 rounded-xl p-4 border border-zinc-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Claimant Volunteer:</span>
                <span className="text-white font-semibold">
                  {activeReferral.volunteerName} ({activeReferral.volunteerTeam})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Buyer Name:</span>
                <span className="text-white font-semibold">
                  {activeReferral.buyerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ticket Type & Qty:</span>
                <span className="text-white font-semibold">
                  {activeReferral.ticketQuantity}x {activeReferral.ticketType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Identifier / Reference:</span>
                <span className="text-amber-400 font-mono font-bold">
                  {activeReferral.buyerIdentifier || "None Provided"}
                </span>
              </div>
              {activeReferral.flaggedDuplicate && (
                <div className="p-2.5 bg-amber-950/40 rounded-lg border border-amber-800/40 text-amber-300">
                  <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-400" />
                  <strong>Duplicate Flagged:</strong> Another submission exists with this buyer identifier. Verify who initiated the contact before awarding points.
                </div>
              )}
            </div>

            {/* Admin Verification Notes */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Verification Notes (Saved to Audit Log)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Verified against Meeteor order #88902 or reason for rejection..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveReferral(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(
                    activeReferral.id,
                    "rejected",
                    decisionNotes
                  )
                }
                className="px-4 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-400 text-xs font-bold border border-red-800/60 transition-all"
              >
                Reject Claim
              </button>
              <button
                type="button"
                onClick={() =>
                  handleUpdateStatus(
                    activeReferral.id,
                    "approved",
                    decisionNotes
                  )
                }
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Approve & Credit Points
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
