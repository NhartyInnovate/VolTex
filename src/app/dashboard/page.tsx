"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CONFERENCE_CONFIG,
  DEFAULT_SCORING_CONFIG,
  PROMOTIONAL_TEMPLATES,
  TICKET_TYPES,
  getSafeVolunteerTeam,
} from "@/config/constants";
import { calculateVolunteerSummary } from "@/lib/scoring";
import { ReferralRecord, ScoringConfig, UserProfile } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { triggerConfetti } from "@/lib/confetti";
import { Copy, Check, X, AlertCircle, RefreshCw } from "lucide-react";

export default function VolunteerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );
  const [volunteerRank, setVolunteerRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form State
  const [formBuyerName, setFormBuyerName] = useState("");
  const [formTicketType, setFormTicketType] = useState<string>(TICKET_TYPES[0]);
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formBuyerEmail, setFormBuyerEmail] = useState("");
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [formSuccessState, setFormSuccessState] = useState(false);

  // Load authenticated volunteer profile, referrals, and trusted scoring policy
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const supabase = createClient();

      // 1. Verify user session via auth.getUser()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login?error=Please+sign+in+to+access+your+volunteer+portal.");
        return;
      }

      // 2. Fetch authenticated user profile (enforced by RLS auth.uid() = id)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, volunteer_team, role, created_at")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData) {
        setFetchError("Unable to load your volunteer profile. Please try again.");
        return;
      }

      setProfile({
        id: profileData.id,
        email: user.email || "",
        fullName: profileData.full_name,
        phoneNumber: profileData.phone_number,
        volunteerTeam: getSafeVolunteerTeam(profileData.volunteer_team),
        role: profileData.role,
        createdAt: profileData.created_at,
      });

      // 3. Fetch referrals for authenticated user (RLS: auth.uid() = volunteer_id)
      const { data: referralsData, error: referralsError } = await supabase
        .from("referrals")
        .select(
          "id, volunteer_id, buyer_name, ticket_type, ticket_quantity, buyer_identifier, order_reference, buyer_email, status, admin_notes, flagged_duplicate, duplicate_reason, duplicate_source_id, verified_at, verified_by, created_at"
        )
        .eq("volunteer_id", user.id)
        .order("created_at", { ascending: false });

      if (referralsError) {
        setFetchError("Unable to load referral records. Please try again.");
        return;
      }

      const formattedReferrals: ReferralRecord[] = (referralsData || []).map((r) => ({
        id: r.id,
        volunteerId: r.volunteer_id,
        volunteerName: profileData.full_name,
        volunteerTeam: profileData.volunteer_team,
        buyerName: r.buyer_name,
        ticketType: r.ticket_type,
        ticketQuantity: r.ticket_quantity,
        buyerIdentifier: r.order_reference || r.buyer_identifier || undefined,
        orderReference: r.order_reference || r.buyer_identifier || undefined,
        buyerEmail: r.buyer_email || undefined,
        status: r.status,
        adminNotes: r.admin_notes ?? undefined,
        flaggedDuplicate: r.flagged_duplicate ?? false,
        duplicateReason: r.duplicate_reason ?? undefined,
        duplicateSourceId: r.duplicate_source_id ?? undefined,
        verifiedAt: r.verified_at ?? undefined,
        verifiedBy: r.verified_by ?? undefined,
        createdAt: r.created_at,
      }));

      setReferrals(formattedReferrals);

      // 4. Fetch active scoring policy from database (RLS: select is allowed for everyone)
      const { data: scoringData } = await supabase
        .from("scoring_settings")
        .select("id, points_per_ticket, status, label, notes, updated_at, updated_by")
        .eq("id", "current_policy")
        .single();

      if (scoringData) {
        setScoringConfig({
          id: scoringData.id,
          pointsPerTicket: scoringData.points_per_ticket,
          status: scoringData.status,
          label: scoringData.label,
          notes: scoringData.notes,
          updatedAt: scoringData.updated_at,
          updatedBy: scoringData.updated_by ?? undefined,
        });
      }

      // 5. Fetch leaderboard rank from public_leaderboard view
      const { data: leaderboardData } = await supabase
        .from("public_leaderboard")
        .select("volunteer_id, rank")
        .eq("volunteer_id", user.id)
        .single();

      if (leaderboardData?.rank) {
        setVolunteerRank(leaderboardData.rank);
      }
    } catch {
      setFetchError("An unexpected error occurred while connecting to the database.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Compute live scoring from trusted database records & active scoring policy
  const summary = useMemo(() => {
    return calculateVolunteerSummary(referrals, scoringConfig);
  }, [referrals, scoringConfig]);

  // Filtered referrals list
  const filteredReferrals = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter((r) => r.status === statusFilter);
  }, [referrals, statusFilter]);

  // Handle Copy link or template
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Handle submission of new referral claim directly to Supabase
  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMessage(null);

    const trimmedBuyer = formBuyerName.trim();
    if (!trimmedBuyer) {
      setFormErrorMessage("Buyer name is required.");
      return;
    }

    if (!profile?.id) {
      setFormErrorMessage("Session expired. Please refresh the page.");
      return;
    }

    const safeQty = Math.min(50, Math.max(1, Number(formQuantity) || 1));
    const cleanOrderRef = formIdentifier.trim();
    const cleanBuyerEmail = formBuyerEmail.trim();

    try {
      setIsSubmitting(true);
      const supabase = createClient();

      // Authoritative submission via public.submit_referral RPC
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "submit_referral",
        {
          p_buyer_name: trimmedBuyer,
          p_ticket_type: formTicketType,
          p_ticket_quantity: safeQty,
          p_order_reference: cleanOrderRef || null,
          p_buyer_email: cleanBuyerEmail || null,
        }
      );

      if (rpcError) {
        if (
          rpcError.code === "23505" ||
          rpcError.message?.includes("DUPLICATE_ORDER_REFERENCE") ||
          rpcError.message?.includes("idx_unique_all_order_reference")
        ) {
          setFormErrorMessage(
            "This order reference has already been submitted by another claim and cannot be credited again."
          );
        } else {
          setFormErrorMessage(rpcError.message || "Failed to submit referral. Please try again.");
        }
        return;
      }

      // Check explicit RPC success flag
      if (!rpcResult?.success) {
        setFormErrorMessage(
          rpcResult?.message ||
            "This order reference has already been submitted by another claim and cannot be credited again."
        );
        return;
      }

      const inserted = rpcResult.referral;
      const newRecord: ReferralRecord = {
        id: inserted.id,
        volunteerId: inserted.volunteer_id,
        volunteerName: profile.fullName,
        volunteerTeam: profile.volunteerTeam,
        buyerName: inserted.buyer_name,
        ticketType: inserted.ticket_type,
        ticketQuantity: inserted.ticket_quantity,
        buyerIdentifier: inserted.order_reference || inserted.buyer_identifier || undefined,
        orderReference: inserted.order_reference || inserted.buyer_identifier || undefined,
        buyerEmail: inserted.buyer_email || undefined,
        status: inserted.status,
        flaggedDuplicate: inserted.flagged_duplicate ?? false,
        duplicateReason: inserted.duplicate_reason ?? undefined,
        duplicateSourceId: inserted.duplicate_source_id ?? undefined,
        adminNotes: inserted.admin_notes ?? undefined,
        createdAt: inserted.created_at,
      };

      setReferrals((prev) => [newRecord, ...prev]);
      setFormSuccessState(true);
      triggerConfetti({ type: "referral" });

      // Reset form inputs
      setFormBuyerName("");
      setFormIdentifier("");
      setFormBuyerEmail("");
      setFormQuantity(1);
    } catch {
      setFormErrorMessage("An unexpected error occurred during submission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Skeleton Header */}
        <div className="border-b border-zinc-800/80 pb-6 space-y-3 animate-pulse">
          <div className="h-8 w-64 bg-zinc-800/60 rounded" />
          <div className="h-4 w-48 bg-zinc-800/40 rounded" />
        </div>

        {/* Skeleton Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-zinc-800/80 rounded p-4 bg-[#111114] animate-pulse space-y-3"
            >
              <div className="h-3 w-24 bg-zinc-800/60 rounded" />
              <div className="h-8 w-16 bg-zinc-800/40 rounded" />
              <div className="h-3 w-32 bg-zinc-800/40 rounded" />
            </div>
          ))}
        </div>

        {/* Skeleton Table */}
        <div className="border border-zinc-800/80 rounded bg-[#111114] p-6 animate-pulse space-y-4">
          <div className="h-5 w-40 bg-zinc-800/60 rounded" />
          <div className="h-32 bg-zinc-800/20 rounded" />
        </div>
      </div>
    );
  }

  if (fetchError || !profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="border border-red-800/50 bg-red-950/20 rounded p-6 text-center space-y-4 max-w-md mx-auto">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">
              Unable to Load Volunteer Data
            </h3>
            <p className="text-xs text-zinc-400">
              {fetchError || "Could not retrieve your profile. Please check your connection."}
            </p>
          </div>
          <button
            onClick={() => loadDashboardData()}
            className="inline-flex items-center gap-2 text-xs font-medium px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      {/* 1. Page Header & Volunteer Identity */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-zinc-800/80 pb-6 animate-subtle-fade-up">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Volunteer Dashboard
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-1">
            <span className="text-zinc-200 font-medium">{profile.fullName}</span>
            <span>·</span>
            <span>{getSafeVolunteerTeam(profile.volunteerTeam)}</span>
            {volunteerRank !== null && (
              <>
                <span>·</span>
                <span className="text-zinc-500 font-mono">Rank #{volunteerRank}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setFormSuccessState(false);
              setFormErrorMessage(null);
              setIsSubmitModalOpen(true);
            }}
            className="text-xs font-semibold px-3.5 py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white transition-all shadow-xs"
          >
            Submit Referral
          </button>
        </div>
      </div>

      {/* 2. Essential Metrics Only with Staggered Entrance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Points */}
        <div className="border border-zinc-800/80 rounded p-4 bg-[#111114] animate-subtle-fade-up delay-75 hover:border-zinc-700/80 transition-colors">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Points Earned
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {summary.points} <span className="text-xs font-normal text-zinc-500">pts</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Official rule: {scoringConfig.pointsPerTicket} pts per verified ticket
          </div>
        </div>

        {/* Verified Tickets */}
        <div className="border border-zinc-800/80 rounded p-4 bg-[#111114] animate-subtle-fade-up delay-150 hover:border-zinc-700/80 transition-colors">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Verified Tickets
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-200">
            {summary.approvedTickets}
            {summary.carryoverTickets > 0 && (
              <span className="text-xs font-normal text-zinc-400 ml-2">
                (+{summary.carryoverTickets} carryover)
              </span>
            )}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Confirmed with Meeteor records
          </div>
        </div>

        {/* Pending Referrals */}
        <div className="border border-zinc-800/80 rounded p-4 bg-[#111114] animate-subtle-fade-up delay-200 hover:border-zinc-700/80 transition-colors">
          <div className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
            Pending Review
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-200">
            {summary.pendingTickets} <span className="text-xs font-normal text-zinc-500">tickets</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Awaiting admin reconciliation
          </div>
        </div>
      </div>

      {/* 3. Official Conference Ticket Link */}
      <div className="border border-zinc-800/80 rounded p-4 bg-[#111114] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-subtle-fade-up delay-200">
        <div>
          <div className="font-semibold text-zinc-200">Official Conference Ticket Link</div>
          <div className="text-zinc-500 text-[11px] mt-0.5">
            Share this link with your network to purchase tickets on Meeteor.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-400 text-[11px] truncate max-w-[240px] sm:max-w-[320px] bg-[#09090b] px-2.5 py-1.5 rounded border border-zinc-800">
            {CONFERENCE_CONFIG.ticketUrl}
          </span>
          <button
            onClick={() => handleCopy("ticket-url", CONFERENCE_CONFIG.ticketUrl)}
            aria-label="Copy official conference ticket link"
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 transition-all flex items-center gap-1"
          >
            {copiedId === "ticket-url" ? (
              <>
                <Check className="w-3.5 h-3.5 text-zinc-200" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4. Referral History Table */}
      <div className="space-y-4 animate-subtle-fade-up delay-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Referral History
            </h2>
            <p className="text-[11px] text-zinc-500">
              Submitted ticket claims and admin verification status.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 text-xs">
            {["all", "approved", "pending", "rejected"].map((tab) => {
              const count =
                tab === "all"
                  ? referrals.length
                  : referrals.filter((r) => r.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-2.5 py-1 rounded capitalize transition-colors ${
                    statusFilter === tab
                      ? "bg-zinc-800 text-white font-medium"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Table */}
        <div className="border border-zinc-800/80 rounded bg-[#111114] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-[#0e0e11]">
                  <th className="py-2.5 px-4">Buyer Name</th>
                  <th className="py-2.5 px-4">Ticket Type</th>
                  <th className="py-2.5 px-4 text-center">Qty</th>
                  <th className="py-2.5 px-4">Identifier / Ref</th>
                  <th className="py-2.5 px-4">Status & Feedback</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {filteredReferrals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      No referrals found.
                    </td>
                  </tr>
                ) : (
                  filteredReferrals.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="py-3 px-4 font-medium text-zinc-200">
                        {r.buyerName}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {r.ticketType}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-medium text-zinc-200">
                        {r.ticketQuantity}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400 text-[11px]">
                        <div>
                          {r.orderReference || (r.buyerIdentifier && !r.buyerIdentifier.includes("@") ? r.buyerIdentifier : "—")}
                        </div>
                        {(r.buyerEmail || (r.buyerIdentifier && r.buyerIdentifier.includes("@"))) && (
                          <div className="text-[10px] text-zinc-500 font-sans truncate max-w-[140px]">
                            {r.buyerEmail || r.buyerIdentifier}
                          </div>
                        )}
                        {r.flaggedDuplicate && (
                          <div className="text-[10px] text-amber-500 mt-0.5">
                            Duplicate flagged
                          </div>
                        )}
                      </td>
                      {/* Status with verified feedback */}
                      <td className="py-3 px-4">
                        {r.status === "approved" && (
                          <div>
                            <span
                              title="Referral verified."
                              className="text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded text-[11px] font-medium"
                            >
                              Approved
                            </span>
                            <span className="block text-[10px] text-zinc-500 font-sans mt-0.5">
                              Referral verified.
                            </span>
                          </div>
                        )}
                        {r.status === "pending" && (
                          <div>
                            <span
                              title="Awaiting verification."
                              className="text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded text-[11px] font-medium"
                            >
                              Pending
                            </span>
                            <span className="block text-[10px] text-zinc-500 font-sans mt-0.5">
                              Awaiting verification.
                            </span>
                          </div>
                        )}
                        {r.status === "rejected" && (
                          <div>
                            <span
                              title="Referral not approved."
                              className="text-red-400 bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded text-[11px] font-medium"
                            >
                              Rejected
                            </span>
                            <span className="block text-[10px] text-zinc-500 font-sans mt-0.5">
                              Referral not approved.
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 text-[11px] max-w-xs truncate">
                        {r.adminNotes || "—"}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-zinc-500 text-[11px]">
                        {formatDateTime(r.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 5. Promotional Templates */}
      <div className="space-y-4 pt-4 border-t border-zinc-800/80">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Promotional Templates
          </h2>
          <p className="text-[11px] text-zinc-500">
            Pre-written messages tailored for direct outreach and group sharing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROMOTIONAL_TEMPLATES.map((tpl) => {
            const compiledMessage = tpl.content(
              profile.fullName,
              CONFERENCE_CONFIG.ticketUrl
            );
            const isCopied = copiedId === tpl.id;
            const whatsappShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(
              compiledMessage
            )}`;

            return (
              <div
                key={tpl.id}
                className="border border-zinc-800/80 rounded p-4 bg-[#111114] space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-zinc-200">
                    {tpl.channel}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed bg-[#09090b] p-3 rounded border border-zinc-800/60 font-sans">
                    {compiledMessage}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/60 text-xs">
                  <a
                    href={whatsappShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-300 hover:text-white active:scale-[0.98] transition-all underline underline-offset-4"
                  >
                    Share on WhatsApp ↗
                  </a>

                  <button
                    onClick={() => handleCopy(tpl.id, compiledMessage)}
                    aria-label={`Copy ${tpl.channel} text`}
                    className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-zinc-200 transition-all flex items-center gap-1"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-zinc-200" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy text
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Referral Submission Modal */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-backdrop">
          <div className="bg-[#111114] border border-zinc-800 rounded max-w-md w-full p-6 space-y-5 relative animate-modal shadow-2xl">
            <button
              onClick={() => setIsSubmitModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 active:scale-95 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-white">
                Submit Referral
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Enter buyer details as registered on Meeteor. Submissions are reviewed by event organizers.
              </p>
            </div>

            {formSuccessState ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-4 py-2 animate-subtle-fade-up text-xs"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base">
                    Referral submitted.
                  </h4>
                  <p className="text-zinc-300">
                    Your referral is awaiting verification.
                  </p>
                </div>

                <div className="border-t border-zinc-800/80 pt-2.5 text-zinc-400 text-[11px] leading-relaxed">
                  Submissions do not award points immediately. Points will be automatically credited once verified against Meeteor Hub records.
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setFormSuccessState(false);
                      setIsSubmitModalOpen(false);
                    }}
                    className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white text-xs font-semibold transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateReferral} className="space-y-4 text-xs">
                {formErrorMessage && (
                  <div
                    role="alert"
                    className="border border-red-800/60 bg-red-950/40 text-red-300 px-3 py-2 rounded text-[11px] animate-subtle-fade-up"
                  >
                    {formErrorMessage}
                  </div>
                )}

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    Buyer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Babatunde Lawal"
                    value={formBuyerName}
                    onChange={(e) => setFormBuyerName(e.target.value)}
                    className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      Ticket Type *
                    </label>
                    <select
                      value={formTicketType}
                      onChange={(e) => setFormTicketType(e.target.value)}
                      className="w-full bg-[#09090b] border border-zinc-800 rounded px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                    >
                      {TICKET_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-300 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    Order Reference / Ticket ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTR-TX-99014"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <span className="text-[11px] text-zinc-500 block mt-1">
                    Unique order or ticket ID from Meeteor Hub.
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-zinc-300 mb-1">
                    Buyer Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. buyer@example.com"
                    value={formBuyerEmail}
                    onChange={(e) => setFormBuyerEmail(e.target.value)}
                    className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <span className="text-[11px] text-zinc-500 block mt-1">
                    Used to reconcile ticket confirmations and flag multi-purchase claims.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-3.5 py-2 rounded text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Submitting..." : "Submit Referral"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
