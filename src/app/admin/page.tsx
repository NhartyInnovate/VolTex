"use client";

import React, { useState, useMemo } from "react";
import {
  MOCK_ADMIN_USER,
  MOCK_ADMIN_ALL_REFERRALS,
} from "@/data/mock-data";
import {
  CONFERENCE_CONFIG,
  DEFAULT_SCORING_CONFIG,
  getSafeVolunteerTeam,
} from "@/config/constants";
import { calculatePointsFromTickets } from "@/lib/scoring";
import { ReferralRecord, ReferralStatus, ScoringConfig } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { Search, X, Settings2, AlertCircle } from "lucide-react";

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

  // Configurable Scoring Policy State
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );
  const [draftConfig, setDraftConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );
  const [isEditingScoring, setIsEditingScoring] = useState(false);
  const [isConfirmingPolicyChange, setIsConfirmingPolicyChange] = useState(false);
  const [scoringConfigError, setScoringConfigError] = useState<string | null>(
    null
  );

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

  // Overall Statistics calculated dynamically using active scoring policy
  const stats = useMemo(() => {
    const total = referrals.length;
    const pending = referrals.filter((r) => r.status === "pending").length;
    const approved = referrals.filter((r) => r.status === "approved").length;
    const rejected = referrals.filter((r) => r.status === "rejected").length;
    const duplicates = referrals.filter((r) => r.flaggedDuplicate).length;

    const totalApprovedTickets = referrals
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.ticketQuantity, 0);

    const { points: totalPointsAwarded, carryoverTickets: totalCarryover } =
      calculatePointsFromTickets(totalApprovedTickets, scoringConfig);

    return {
      total,
      pending,
      approved,
      rejected,
      duplicates,
      totalApprovedTickets,
      totalPointsAwarded,
      totalCarryover,
    };
  }, [referrals, scoringConfig]);

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
                ? "Verified against Meeteor Hub records"
                : "Not matched on Meeteor"),
            verifiedAt: new Date().toISOString(),
            verifiedBy: MOCK_ADMIN_USER.fullName,
          };
        }
        return item;
      })
    );

    setActionSuccess(`Referral marked as ${newStatus.toUpperCase()}`);
    setActiveReferral(null);
    setDecisionNotes("");
    setTimeout(() => setActionSuccess(null), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-zinc-800/80 pb-6 animate-subtle-fade-up">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Referral Verification
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Reconcile submitted volunteer claims against official Meeteor Hub attendee records.
          </p>
        </div>

        <div>
          <a
            href={CONFERENCE_CONFIG.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-300 hover:text-white underline underline-offset-4 active:scale-[0.98] transition-all"
          >
            Open Meeteor Hub ↗
          </a>
        </div>
      </div>

      {/* 2. Concise Summary Line with Staggered Entrance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="border border-zinc-800/80 rounded p-3 bg-[#111114] animate-subtle-fade-up delay-75 hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">
            Pending Review
          </span>
          <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
            {stats.pending}
          </span>
        </div>
        <div className="border border-zinc-800/80 rounded p-3 bg-[#111114] animate-subtle-fade-up delay-150 hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">
            Duplicate Flags
          </span>
          <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
            {stats.duplicates}
          </span>
        </div>
        <div className="border border-zinc-800/80 rounded p-3 bg-[#111114] animate-subtle-fade-up delay-200 hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">
            Verified Tickets
          </span>
          <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
            {stats.totalApprovedTickets}
          </span>
        </div>
        <div className="border border-zinc-800/80 rounded p-3 bg-[#111114] animate-subtle-fade-up delay-300 hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider">
            Points Awarded
          </span>
          <span className="text-xl font-bold font-mono text-zinc-100 mt-1 block">
            {stats.totalPointsAwarded}{" "}
            <span className="text-[10px] font-normal text-zinc-500">pts</span>
          </span>
        </div>
      </div>

      {/* 3. Scoring Settings Section */}
      <div className="border border-zinc-800/80 rounded bg-[#111114] p-5 space-y-4 animate-subtle-fade-up delay-150">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <Settings2 className="w-4 h-4 text-zinc-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">
                Scoring Settings
              </h2>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  scoringConfig.status === "active"
                    ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/40"
                    : "bg-amber-950/40 text-amber-400 border-amber-800/40"
                }`}
              >
                {scoringConfig.status === "active"
                  ? "Active Policy (Demo)"
                  : "Draft Awaiting Committee Approval"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Configure point ratios and carryovers. The TEDxGwarinpa team has not yet finalized official point rules; current ratios are provisional.
            </p>
          </div>

          {!isEditingScoring && (
            <button
              onClick={() => {
                setDraftConfig(scoringConfig);
                setScoringConfigError(null);
                setIsEditingScoring(true);
              }}
              className="text-xs font-medium px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 transition-all self-start sm:self-auto"
            >
              Configure Scoring
            </button>
          )}
        </div>

        {isEditingScoring ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setScoringConfigError(null);
              const qty = Number(draftConfig.ticketsPerPoint);
              if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
                setScoringConfigError(
                  "Tickets required per point must be an integer between 1 and 50."
                );
                return;
              }
              setIsConfirmingPolicyChange(true);
            }}
            className="space-y-4 text-xs pt-1"
          >
            {scoringConfigError && (
              <div
                role="alert"
                className="p-2.5 rounded border border-red-800/60 bg-red-950/40 text-red-300 text-[11px] flex items-center gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{scoringConfigError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Tickets required per point */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Tickets Required per Point *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={draftConfig.ticketsPerPoint}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      ticketsPerPoint: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  e.g. 2 means 1 point awarded per 2 verified tickets.
                </span>
              </div>

              {/* Odd-ticket carryover */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Odd-Ticket Carryover
                </label>
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-zinc-300">
                    <input
                      type="checkbox"
                      checked={draftConfig.enableCarryover}
                      onChange={(e) =>
                        setDraftConfig({
                          ...draftConfig,
                          enableCarryover: e.target.checked,
                        })
                      }
                      className="rounded border-zinc-800 text-tedx-red bg-[#09090b] focus:ring-0"
                    />
                    <span>Enable odd-ticket carryover</span>
                  </label>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Carries remainder ticket towards the volunteer&apos;s next point.
                  </span>
                </div>
              </div>

              {/* Policy Status */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Scoring Policy Status *
                </label>
                <select
                  value={draftConfig.status}
                  onChange={(e) =>
                    setDraftConfig({
                      ...draftConfig,
                      status: e.target.value as "draft" | "active",
                    })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                >
                  <option value="draft">Draft Awaiting Committee Approval</option>
                  <option value="active">Active Policy (Live Calculations)</option>
                </select>
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Select Draft until leadership agrees on point formulas.
                </span>
              </div>
            </div>

            {/* Policy Notes */}
            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Policy Notes / Rationale
              </label>
              <input
                type="text"
                placeholder="e.g. Early promo phase: 1 pt per 2 tickets (provisional)"
                value={draftConfig.notes || ""}
                onChange={(e) =>
                  setDraftConfig({
                    ...draftConfig,
                    notes: e.target.value,
                  })
                }
                className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800/60">
              <span className="text-[11px] text-zinc-500">
                Demo Mode: Policy updates are held in browser state and do not overwrite historical records.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDraftConfig(scoringConfig);
                    setIsEditingScoring(false);
                    setScoringConfigError(null);
                  }}
                  className="px-3 py-1.5 rounded text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all shadow-xs"
                >
                  Review & Save Policy
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="bg-[#09090b] border border-zinc-800/60 rounded p-3">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                Point Formula
              </span>
              <span className="font-semibold text-zinc-200 mt-0.5 block font-mono">
                1 Point = {scoringConfig.ticketsPerPoint} Verified Tickets
              </span>
            </div>
            <div className="bg-[#09090b] border border-zinc-800/60 rounded p-3">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                Carryover Rule
              </span>
              <span className="font-semibold text-zinc-200 mt-0.5 block">
                {scoringConfig.enableCarryover
                  ? "Odd-ticket carryover enabled"
                  : "Carryover disabled"}
              </span>
            </div>
            <div className="bg-[#09090b] border border-zinc-800/60 rounded p-3">
              <span className="text-zinc-500 text-[10px] uppercase tracking-wider block">
                Committee Status
              </span>
              <span className="font-semibold text-zinc-200 mt-0.5 block">
                {scoringConfig.status === "active"
                  ? "Active Policy (Demo)"
                  : "Draft (Provisional)"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="border border-emerald-800/60 bg-emerald-950/40 text-emerald-300 px-3 py-2 rounded text-xs animate-subtle-fade-up">
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="border border-red-800/60 bg-red-950/40 text-red-300 px-3 py-2 rounded text-xs flex items-center justify-between animate-subtle-fade-up">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-white ml-2 text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4. Verification Queue */}
      <div className="space-y-4 animate-subtle-fade-up delay-200">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Status Tabs */}
          <div className="flex items-center gap-1">
            {["pending", "all", "approved", "rejected"].map((st) => {
              const count =
                st === "all"
                  ? referrals.length
                  : referrals.filter((r) => r.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded capitalize transition-colors ${
                    selectedStatus === st
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {st} ({count})
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search buyer, volunteer, ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111114] border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        </div>

        {/* Verification Table */}
        <div className="border border-zinc-800/80 rounded bg-[#111114] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-[#0e0e11]">
                  <th className="py-2.5 px-4">Volunteer</th>
                  <th className="py-2.5 px-4">Buyer Name</th>
                  <th className="py-2.5 px-4">Ticket</th>
                  <th className="py-2.5 px-4">Identifier / Ref</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {filteredReferrals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No records found in this queue.
                    </td>
                  </tr>
                ) : (
                  filteredReferrals.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-zinc-800/20 transition-colors"
                    >
                      {/* Volunteer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-200">
                          {r.volunteerName}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {getSafeVolunteerTeam(r.volunteerTeam)}
                        </div>
                      </td>

                      {/* Buyer */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-200">
                          {r.buyerName}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {formatDateTime(r.createdAt)}
                        </div>
                      </td>

                      {/* Ticket */}
                      <td className="py-3 px-4">
                        <span className="font-mono font-medium text-zinc-200 mr-1.5">
                          x{r.ticketQuantity}
                        </span>
                        <span className="text-zinc-400">{r.ticketType}</span>
                      </td>

                      {/* Identifier */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-400">
                        <div>{r.buyerIdentifier || "—"}</div>
                        {r.flaggedDuplicate && (
                          <div className="text-[10px] text-amber-500 mt-0.5">
                            Duplicate flag: {r.duplicateReason || "Match detected"}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {r.status === "approved" && (
                          <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded text-[11px]">
                            Approved
                          </span>
                        )}
                        {r.status === "pending" && (
                          <span className="text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded text-[11px]">
                            Pending
                          </span>
                        )}
                        {r.status === "rejected" && (
                          <span className="text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded text-[11px]">
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setActiveReferral(r);
                            setDecisionNotes(r.adminNotes || "");
                          }}
                          className="px-2.5 py-1 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Review / Reconcile Modal */}
      {activeReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-backdrop">
          <div className="bg-[#111114] border border-zinc-800 rounded max-w-md w-full p-6 space-y-4 relative text-xs animate-modal shadow-2xl">
            <button
              onClick={() => setActiveReferral(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 active:scale-95 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-white">
                Review Referral
              </h3>
              <p className="text-zinc-400 mt-0.5">
                Reconcile details against Meeteor Hub before approving.
              </p>
            </div>

            <div className="border border-zinc-800/80 rounded p-3 bg-[#09090b] space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Claimant:</span>
                <span className="text-zinc-200 font-medium">
                  {activeReferral.volunteerName} (
                  {getSafeVolunteerTeam(activeReferral.volunteerTeam)})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Buyer:</span>
                <span className="text-zinc-200 font-medium">{activeReferral.buyerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Tickets:</span>
                <span className="text-zinc-200 font-mono font-medium">
                  {activeReferral.ticketQuantity}x {activeReferral.ticketType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Identifier:</span>
                <span className="font-mono text-zinc-200">{activeReferral.buyerIdentifier || "None"}</span>
              </div>
              {activeReferral.flaggedDuplicate && (
                <div className="pt-1 text-[11px] text-amber-500">
                  Duplicate flag: {activeReferral.duplicateReason || "Match detected in records."}
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-zinc-300 mb-1">
                Verification Notes (Saved to Audit Trail)
              </label>
              <textarea
                rows={2}
                placeholder="Reason or Meeteor order reference..."
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full bg-[#09090b] border border-zinc-800 rounded p-2.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveReferral(null)}
                className="px-3 py-1.5 rounded text-zinc-400 hover:text-white active:scale-[0.98] transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(activeReferral.id, "rejected", decisionNotes)}
                className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-300 hover:text-red-400 font-medium transition-all"
              >
                Reject Claim
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(activeReferral.id, "approved", decisionNotes)}
                className="px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all shadow-xs"
              >
                Approve & Credit Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Policy Change Confirmation Modal */}
      {isConfirmingPolicyChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-backdrop">
          <div className="bg-[#111114] border border-zinc-800 rounded max-w-md w-full p-6 space-y-4 relative text-xs animate-modal shadow-2xl">
            <h3 className="text-base font-bold text-white">
              Confirm Scoring Policy Update
            </h3>
            <p className="text-zinc-300 leading-relaxed">
              You are proposing to configure the scoring rule to:{" "}
              <strong className="text-white">
                1 point per {draftConfig.ticketsPerPoint} verified tickets
              </strong>{" "}
              with odd-ticket carryover{" "}
              <strong className="text-white">
                {draftConfig.enableCarryover ? "enabled" : "disabled"}
              </strong>{" "}
              under policy status{" "}
              <strong className="text-white capitalize">
                {draftConfig.status}
              </strong>.
            </p>

            <div className="border border-amber-800/40 bg-amber-950/20 text-amber-300 p-3 rounded text-[11px] leading-relaxed">
              <strong>Notice:</strong> This change dynamically recalculates points for approved tickets in the demo interface. It does not rewrite historical transaction records or past Meeteor verifications. In production, live rule changes require multi-organizer authorization.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmingPolicyChange(false)}
                className="px-3 py-1.5 rounded text-zinc-400 hover:text-white active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setScoringConfig(draftConfig);
                  setIsConfirmingPolicyChange(false);
                  setIsEditingScoring(false);
                  setActionSuccess(
                    `Scoring policy updated: 1 pt per ${draftConfig.ticketsPerPoint} tickets (${draftConfig.status}). Displayed points dynamically recalculated.`
                  );
                  setTimeout(() => setActionSuccess(null), 4000);
                }}
                className="px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all shadow-xs"
              >
                Confirm & Apply (Demo)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
