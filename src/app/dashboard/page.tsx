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
import { ReferralRecord, ScoringConfig, UserProfile, LeaderboardEntry } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { triggerConfetti } from "@/lib/confetti";
import { AnimatedLeaderboard } from "@/components/AnimatedLeaderboard";
import { LoadingSpinner, FullPageLoader } from "@/components/LoadingSpinner";
import { OnboardingTour, TourStep } from "@/components/OnboardingTour";
import {
  Copy,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Trophy,
  Ticket,
  Clock,
  Sparkles,
  Share2,
  HelpCircle,
} from "lucide-react";

export default function VolunteerDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [liveLeaderboard, setLiveLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );
  const [volunteerRank, setVolunteerRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tabs: 'referrals' | 'leaderboard' | 'templates'
  const [activeTab, setActiveTab] = useState<"referrals" | "leaderboard" | "templates">("referrals");
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

  // Guided Onboarding Tour State
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Tour Steps Configuration
  const tourSteps: TourStep[] = useMemo(
    () => [
      {
        targetId: "tour-tab-templates",
        title: "Promote with Confidence",
        message:
          "Find ready-made promotional messages you can copy and share to help drive TEDxGwarinpa ticket sales.",
        tabKey: "templates",
      },
      {
        targetId: "tour-btn-submit-referral",
        title: "Submit Your Referrals",
        message:
          "When someone you've referred purchases a ticket, use this button to submit their details for review and potential challenge credit.",
      },
      {
        targetId: "tour-tab-referrals",
        title: "Track Your Claims",
        message:
          "Check the status of your submitted referral claims and see which have been approved, rejected, or are still pending.",
        tabKey: "referrals",
      },
      {
        targetId: "tour-tab-leaderboard",
        title: "Check the Leaderboard",
        message:
          "See your current ranking and follow your progress in the ticket sales challenge.",
        tabKey: "leaderboard",
      },
    ],
    []
  );

  // Load authenticated volunteer profile, referrals, live leaderboard, and scoring policy
  const loadDashboardData = useCallback(async () => {
    try {
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

      // 4. Fetch active scoring policy from database
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

      // 5. Fetch live standings from public_leaderboard view
      setLeaderboardError(null);
      const { data: leaderboardData, error: lbError } = await supabase
        .from("public_leaderboard")
        .select("volunteer_id, full_name, volunteer_team, verified_tickets, points, carryover_tickets, rank")
        .order("rank", { ascending: true });

      if (lbError) {
        setLeaderboardError("Could not load live leaderboard standings from the database.");
      } else if (leaderboardData) {
        const mappedLeaderboard: LeaderboardEntry[] = leaderboardData.map((item) => ({
          volunteerId: item.volunteer_id,
          fullName: item.full_name,
          volunteerTeam: getSafeVolunteerTeam(item.volunteer_team),
          verifiedTickets: item.verified_tickets,
          points: item.points,
          carryoverTickets: item.carryover_tickets,
          rank: item.rank,
        }));
        setLiveLeaderboard(mappedLeaderboard);

        const currentVolunteerRow = mappedLeaderboard.find((l) => l.volunteerId === user.id);
        if (currentVolunteerRow) {
          setVolunteerRank(currentVolunteerRow.rank);
        }
      }

      // 6. Check guided onboarding tour status for volunteer
      if (profileData.role === "volunteer") {
        const localKey = `voltex_tour_completed_${user.id}`;
        const completedInLocalStorage =
          typeof window !== "undefined" && window.localStorage.getItem(localKey) === "true";
        const completedInMetadata = !!user.user_metadata?.has_completed_tour;

        if (!completedInLocalStorage && !completedInMetadata) {
          // Newly registered volunteer on first visit: launch tour
          setIsTourOpen(true);
        }
      }
    } catch {
      setFetchError("An unexpected error occurred while connecting to the database.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
  };

  // Compute live scoring from trusted database records & active scoring policy
  const summary = useMemo(() => {
    return calculateVolunteerSummary(referrals, scoringConfig);
  }, [referrals, scoringConfig]);

  // Filtered referrals list
  const filteredReferrals = useMemo(() => {
    if (statusFilter === "all") return referrals;
    return referrals.filter((r) => r.status === statusFilter);
  }, [referrals, statusFilter]);

  // Guided Onboarding Tour Completion / Dismiss Handler
  const handleDismissTour = useCallback(async () => {
    setIsTourOpen(false);

    if (!profile?.id) return;

    // 1. Immediately update local storage per-user
    const localKey = `voltex_tour_completed_${profile.id}`;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(localKey, "true");
      } catch (err) {
        console.warn("Could not save tour state to localStorage:", err);
      }
    }

    // 2. Persist completion in Supabase user_metadata asynchronously
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { has_completed_tour: true },
      });
    } catch (err) {
      // Non-blocking: failures do not impede the volunteer or restart the tour
      console.warn("Could not persist tour completion to user_metadata:", err);
    }
  }, [profile?.id]);

  // Synchronize active tab with tour step
  const handleTourStepChange = useCallback(
    (_stepIndex: number, step: TourStep) => {
      if (step.tabKey && activeTab !== step.tabKey) {
        setActiveTab(step.tabKey);
      }
    },
    [activeTab]
  );

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
    const cleanOrderRef = formIdentifier.trim();
    const cleanBuyerEmail = formBuyerEmail.trim();

    if (!trimmedBuyer) {
      setFormErrorMessage("Buyer name is required.");
      return;
    }

    const safeQty = Math.max(1, Math.min(50, formQuantity || 1));

    if (!profile) {
      setFormErrorMessage("User session profile is not ready. Please refresh.");
      return;
    }

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
      <FullPageLoader
        message="Loading your dashboard..."
        subMessage="Connecting to Supabase and retrieving live stats..."
        label="Loading volunteer dashboard"
      />
    );
  }

  if (fetchError || !profile) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 w-12 h-12 mx-auto flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-900 dark:text-white">Connection Error</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{fetchError}</p>
        </div>
        <div className="pt-2">
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8 sm:space-y-10">
      {/* 1. Page Header & Volunteer Identity */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6 animate-subtle-fade-up">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Volunteer Dashboard
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40 font-semibold">
              Live Standings
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            <span className="text-zinc-900 dark:text-zinc-200 font-medium">{profile.fullName}</span>
            <span>·</span>
            <span>{getSafeVolunteerTeam(profile.volunteerTeam)}</span>
            {volunteerRank !== null && (
              <>
                <span>·</span>
                <span className="text-tedx-red font-mono font-bold">Rank #{volunteerRank}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsTourOpen(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-2 rounded border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-[#111114] transition-all"
            title="Take the guided onboarding tour"
            aria-label="Take a tour"
          >
            <HelpCircle className="w-3.5 h-3.5 text-tedx-red" />
            <span className="hidden sm:inline">Take a Tour</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-2 rounded border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-[#111114] transition-all disabled:opacity-50"
            title="Refresh dashboard and live rankings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden xs:inline">Refresh</span>
          </button>
          <button
            id="tour-btn-submit-referral"
            onClick={() => {
              setFormSuccessState(false);
              setFormErrorMessage(null);
              setIsSubmitModalOpen(true);
            }}
            className="text-xs font-semibold px-4 py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white transition-all shadow-xs"
          >
            Submit Referral
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Cards (Responsive Stack) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Points */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-4 bg-zinc-50/70 dark:bg-[#111114] animate-subtle-fade-up delay-75 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Points Earned</span>
            <Trophy className="w-3.5 h-3.5 text-tedx-red" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-white">
            {summary.points} <span className="text-xs font-normal text-zinc-500">pts</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Official rule: {scoringConfig.pointsPerTicket} pts per verified ticket
          </div>
        </div>

        {/* Verified Tickets */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-4 bg-zinc-50/70 dark:bg-[#111114] animate-subtle-fade-up delay-150 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Verified Tickets</span>
            <Ticket className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-200">
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
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-4 bg-zinc-50/70 dark:bg-[#111114] animate-subtle-fade-up delay-200 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Review</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-200">
            {summary.pendingTickets} <span className="text-xs font-normal text-zinc-500">tickets</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Awaiting organizer reconciliation
          </div>
        </div>
      </div>

      {/* 3. Official Conference Ticket Link Banner */}
      <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-4 bg-zinc-50/70 dark:bg-[#111114] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-subtle-fade-up delay-200">
        <div>
          <div className="font-semibold text-zinc-900 dark:text-zinc-200">Official Conference Ticket Link</div>
          <div className="text-zinc-500 text-[11px] mt-0.5">
            Share this link with your network to purchase tickets on Meeteor.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-700 dark:text-zinc-400 text-[11px] truncate max-w-[200px] sm:max-w-[320px] bg-white dark:bg-[#09090b] px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-800">
            {CONFERENCE_CONFIG.ticketUrl}
          </span>
          <button
            onClick={() => handleCopy("ticket-url", CONFERENCE_CONFIG.ticketUrl)}
            aria-label="Copy official conference ticket link"
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-[0.98] text-zinc-800 dark:text-zinc-200 transition-all flex items-center gap-1"
          >
            {copiedId === "ticket-url" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-zinc-200" />
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

      {/* 4. Section Navigation Tabs: Promotional Templates | My Referral Claims | Live Challenge Standings */}
      <div className="flex justify-center w-full">
        <div className="inline-flex items-center justify-center p-1.5 rounded-xl bg-zinc-100 dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800/80 shadow-xs max-w-full overflow-x-auto no-scrollbar gap-1 sm:gap-1.5">
          <button
            id="tour-tab-templates"
            onClick={() => setActiveTab("templates")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${
              activeTab === "templates"
                ? "bg-tedx-red text-white text-xs sm:text-[13px] font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Share2 className={`w-3.5 h-3.5 ${activeTab === "templates" ? "text-white" : "text-zinc-500 dark:text-zinc-400"}`} />
            <span>Promotional Templates</span>
          </button>
          <button
            id="tour-tab-referrals"
            onClick={() => setActiveTab("referrals")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${
              activeTab === "referrals"
                ? "bg-tedx-red text-white text-xs sm:text-[13px] font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Ticket className={`w-3.5 h-3.5 ${activeTab === "referrals" ? "text-white" : "text-zinc-500 dark:text-zinc-400"}`} />
            <span>My Referral Claims ({referrals.length})</span>
          </button>
          <button
            id="tour-tab-leaderboard"
            onClick={() => setActiveTab("leaderboard")}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs transition-all flex items-center justify-center gap-2 shrink-0 ${
              activeTab === "leaderboard"
                ? "bg-tedx-red text-white text-xs sm:text-[13px] font-semibold shadow-xs"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <Trophy className={`w-3.5 h-3.5 ${activeTab === "leaderboard" ? "text-white" : "text-zinc-500 dark:text-zinc-400"}`} />
            <span>Live Challenge Standings ({liveLeaderboard.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Referral History */}
      {activeTab === "referrals" && (
        <div className="space-y-4 animate-subtle-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Referral History
              </h2>
              <p className="text-[11px] text-zinc-500">
                Submitted ticket claims and organizer verification status.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar">
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
                        ? "bg-zinc-800 text-white font-medium shadow-xs"
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    }`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table Container with Controlled Overflow */}
          <div className="border border-zinc-200 dark:border-zinc-800/80 rounded-lg bg-white dark:bg-[#111114] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-zinc-50 dark:bg-[#0e0e11]">
                    <th className="py-2.5 px-4">Buyer</th>
                    <th className="py-2.5 px-4">Ticket</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4">Order Ref / Email</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Organizer Notes</th>
                    <th className="py-2.5 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
                  {filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        {referrals.length === 0
                          ? "No referrals submitted yet. Click 'Submit Referral' above to report your first claim."
                          : "No referrals match this filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-200">
                          {r.buyerName}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          {r.ticketType}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-zinc-900 dark:text-zinc-200">
                          {r.ticketQuantity}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
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
                        <td className="py-3 px-4">
                          {r.status === "approved" && (
                            <div>
                              <span
                                title="Referral verified."
                                className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded text-[11px] font-medium"
                              >
                                Approved
                              </span>
                            </div>
                          )}
                          {r.status === "pending" && (
                            <div>
                              <span
                                title="Awaiting verification."
                                className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 px-2 py-0.5 rounded text-[11px] font-medium"
                              >
                                Pending
                              </span>
                            </div>
                          )}
                          {r.status === "rejected" && (
                            <div>
                              <span
                                title="Referral not approved."
                                className="text-rose-600 dark:text-red-400 bg-rose-50 dark:bg-red-950/40 border border-rose-200 dark:border-red-800/40 px-2 py-0.5 rounded text-[11px] font-medium"
                              >
                                Rejected
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

            <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0e0e11] text-[11px] text-zinc-500 flex justify-between items-center">
              <span>{filteredReferrals.length} referrals shown</span>
              <span>Scoring rule: {scoringConfig.pointsPerTicket} pts per approved ticket</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Authenticated Live Challenge Standings (Animated Tiles) */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4 animate-subtle-fade-up">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
              Live Volunteer Standings
            </h2>
            <p className="text-[11px] text-zinc-500">
              Official challenge ranking computed strictly from approved, verified ticket purchases on Meeteor Hub.
            </p>
          </div>

          {leaderboardError && (
            <div className="p-3 text-xs bg-red-500/10 border border-red-500/30 text-red-500 rounded-md">
              {leaderboardError}
            </div>
          )}

          <AnimatedLeaderboard
            entries={liveLeaderboard}
            isDemoData={false}
            scoringMultiplier={scoringConfig.pointsPerTicket || 5}
            enableSimulation={false}
          />
        </div>
      )}

      {/* TAB 3: Promotional Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4 animate-subtle-fade-up">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
              Promotional Templates
            </h2>
            <p className="text-[11px] text-zinc-500">
              Pre-written outreach messages customized with your volunteer referral link.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PROMOTIONAL_TEMPLATES.map((tpl) => {
              const compiledMessage = tpl.content(
                profile.fullName,
                CONFERENCE_CONFIG.ticketUrl
              );
              const isCopied = copiedId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  className="border border-zinc-200 dark:border-zinc-800/80 rounded-lg p-4 bg-white dark:bg-[#111114] space-y-3 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                        {tpl.channel}
                      </div>
                      <button
                        onClick={() => handleCopy(tpl.id, compiledMessage)}
                        aria-label={`Copy ${tpl.channel} text`}
                        className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-[0.98] text-zinc-800 dark:text-zinc-200 transition-all flex items-center gap-1 shrink-0"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-zinc-200" />
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
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-[#09090b] p-3 rounded border border-zinc-200 dark:border-zinc-800/60 font-sans whitespace-pre-wrap">
                      {compiledMessage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Referral Submission Modal (Viewport Responsive) */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full p-6 space-y-5 relative animate-modal shadow-2xl max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsSubmitModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 active:scale-95 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Submit Referral Claim
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Enter buyer details as registered on Meeteor. Claims are reviewed against organizer records.
              </p>
            </div>

            {formSuccessState ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-4 py-2 animate-subtle-fade-up text-xs"
              >
                <div className="space-y-1">
                  <h4 className="font-bold text-zinc-900 dark:text-white text-base">
                    Referral submitted.
                  </h4>
                  <p className="text-zinc-600 dark:text-zinc-300">
                    Your referral is awaiting verification.
                  </p>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-2.5 text-zinc-500 dark:text-zinc-400 text-[11px] leading-relaxed">
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
                    className="border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 px-3 py-2 rounded text-[11px] animate-subtle-fade-up"
                  >
                    {formErrorMessage}
                  </div>
                )}

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Buyer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Babatunde Lawal"
                    value={formBuyerName}
                    onChange={(e) => setFormBuyerName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Ticket Type *
                    </label>
                    <select
                      value={formTicketType}
                      onChange={(e) => setFormTicketType(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-2 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                    >
                      {TICKET_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(parseInt(e.target.value) || 1)}
                      className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Order Reference / Ticket ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MTR-TX-99014"
                    value={formIdentifier}
                    onChange={(e) => setFormIdentifier(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors font-mono"
                  />
                  <span className="text-[11px] text-zinc-500 block mt-1">
                    Unique order or ticket ID from Meeteor Hub.
                  </span>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Buyer Email
                  </label>
                  <input
                    type="email"
                    placeholder="e.g. buyer@example.com"
                    value={formBuyerEmail}
                    onChange={(e) => setFormBuyerEmail(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
                  />
                  <span className="text-[11px] text-zinc-500 block mt-1">
                    Used to reconcile ticket confirmations and flag multi-purchase claims.
                  </span>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-3.5 py-2 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50 shadow-xs flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size="sm" label="Submitting referral" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <span>Submit Referral</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 8. Guided Onboarding Tour Component */}
      <OnboardingTour
        steps={tourSteps}
        isOpen={isTourOpen}
        onFinish={handleDismissTour}
        onSkip={handleDismissTour}
        onStepChange={handleTourStepChange}
      />
    </div>
  );
}
