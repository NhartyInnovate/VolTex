"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  CONFERENCE_CONFIG,
  DEFAULT_SCORING_CONFIG,
  getSafeVolunteerTeam,
} from "@/config/constants";
import { calculatePointsFromTickets } from "@/lib/scoring";
import {
  ReferralRecord,
  ReferralStatus,
  ScoringConfig,
  UserProfile,
  LeaderboardEntry,
} from "@/types";
import { formatDateTime } from "@/lib/utils";
import { LoadingSpinner, FullPageLoader } from "@/components/LoadingSpinner";
import {
  Search,
  X,
  Settings2,
  AlertCircle,
  RefreshCw,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Ticket,
  Trophy,
  Filter,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

interface VolunteerProfileSummary {
  id: string;
  fullName: string;
  volunteerTeam: string;
  phoneNumber?: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();

  // Admin user & permission state
  const [adminProfile, setAdminProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Live Database State
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerProfileSummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );

  // Referral UI State
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [duplicateFilter, setDuplicateFilter] = useState<"all" | "flagged" | "clean">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeReferral, setActiveReferral] = useState<ReferralRecord | null>(null);
  const [decisionNotes, setDecisionNotes] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"referrals" | "volunteers" | "teams" | "settings">("referrals");

  // Configurable Scoring Policy Form State
  const [draftConfig, setDraftConfig] = useState<ScoringConfig>(
    DEFAULT_SCORING_CONFIG
  );
  const [isEditingScoring, setIsEditingScoring] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [isConfirmingPolicyChange, setIsConfirmingPolicyChange] = useState(false);
  const [scoringConfigError, setScoringConfigError] = useState<string | null>(null);

  // Fetch all live admin data from Supabase
  const loadAdminData = useCallback(async () => {
    try {
      setFetchError(null);
      const supabase = createClient();

      // 1. Verify user session via auth.getUser()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/auth/login?error=Please+sign+in+to+access+administrator+verification.");
        return;
      }

      // 2. Verify admin role on public.profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, volunteer_team, role, created_at")
        .eq("id", user.id)
        .single();

      if (profileError || !profileData || profileData.role !== "admin") {
        setFetchError("Access denied: You do not have administrator permissions.");
        return;
      }

      setAdminProfile({
        id: profileData.id,
        email: user.email || "",
        fullName: profileData.full_name,
        phoneNumber: profileData.phone_number,
        volunteerTeam: getSafeVolunteerTeam(profileData.volunteer_team),
        role: profileData.role,
        createdAt: profileData.created_at,
      });

      // 3. Fetch active scoring policy from public.scoring_settings
      const { data: scoringData } = await supabase
        .from("scoring_settings")
        .select("id, points_per_ticket, status, label, notes, updated_at, updated_by")
        .eq("id", "current_policy")
        .single();

      if (scoringData) {
        const loadedConfig: ScoringConfig = {
          id: scoringData.id,
          pointsPerTicket: scoringData.points_per_ticket,
          status: scoringData.status,
          label: scoringData.label,
          notes: scoringData.notes,
          updatedAt: scoringData.updated_at,
          updatedBy: scoringData.updated_by,
        };
        setScoringConfig(loadedConfig);
        setDraftConfig(loadedConfig);
      }

      // 4. Fetch all volunteer profiles (RLS: public.is_admin() grants full SELECT)
      const { data: allProfiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, volunteer_team, phone_number, role, created_at")
        .order("created_at", { ascending: false });

      if (profilesError) {
        throw new Error(`Failed to load volunteer profiles: ${profilesError.message}`);
      }

      const volunteerProfiles = (allProfiles || [])
        .filter((p) => p.role === "volunteer")
        .map((p) => ({
          id: p.id,
          fullName: p.full_name,
          volunteerTeam: getSafeVolunteerTeam(p.volunteer_team),
          phoneNumber: p.phone_number,
          role: p.role,
          createdAt: p.created_at,
        }));
      setVolunteers(volunteerProfiles);

      // Create lookup dictionary for volunteer metadata
      const profileMap = new Map<string, { fullName: string; volunteerTeam: string }>();
      (allProfiles || []).forEach((p) => {
        profileMap.set(p.id, {
          fullName: p.full_name,
          volunteerTeam: getSafeVolunteerTeam(p.volunteer_team),
        });
      });

      // 5. Fetch all referrals across the challenge (RLS: public.is_admin() grants all rows)
      const { data: allReferrals, error: referralsError } = await supabase
        .from("referrals")
        .select(
          "id, volunteer_id, buyer_name, ticket_type, ticket_quantity, buyer_identifier, order_reference, buyer_email, status, admin_notes, flagged_duplicate, duplicate_reason, duplicate_source_id, verified_at, verified_by, created_at"
        )
        .order("created_at", { ascending: false });

      if (referralsError) {
        throw new Error(`Failed to load referral claims: ${referralsError.message}`);
      }

      const formattedReferrals: ReferralRecord[] = (allReferrals || []).map((r) => {
        const volInfo = profileMap.get(r.volunteer_id);
        const verifierInfo = r.verified_by ? profileMap.get(r.verified_by) : undefined;
        return {
          id: r.id,
          volunteerId: r.volunteer_id,
          volunteerName: volInfo?.fullName || "Unknown Volunteer",
          volunteerTeam: volInfo?.volunteerTeam || "General Volunteer Pool",
          buyerName: r.buyer_name,
          ticketType: r.ticket_type,
          ticketQuantity: r.ticket_quantity,
          buyerIdentifier: r.buyer_identifier || undefined,
          orderReference: r.order_reference || undefined,
          buyerEmail: r.buyer_email || undefined,
          status: r.status,
          adminNotes: r.admin_notes ?? undefined,
          flaggedDuplicate: r.flagged_duplicate ?? false,
          duplicateReason: r.duplicate_reason ?? undefined,
          duplicateSourceId: r.duplicate_source_id ?? undefined,
          verifiedAt: r.verified_at ?? undefined,
          verifiedBy: verifierInfo?.fullName || r.verified_by || undefined,
          createdAt: r.created_at,
        };
      });
      setReferrals(formattedReferrals);

      // 6. Fetch live public leaderboard standings
      const { data: leaderboardData } = await supabase
        .from("public_leaderboard")
        .select("volunteer_id, full_name, volunteer_team, verified_tickets, points, carryover_tickets, rank")
        .order("rank", { ascending: true });

      if (leaderboardData) {
        setLeaderboard(
          leaderboardData.map((item) => ({
            volunteerId: item.volunteer_id,
            fullName: item.full_name,
            volunteerTeam: getSafeVolunteerTeam(item.volunteer_team),
            verifiedTickets: item.verified_tickets,
            points: item.points,
            carryoverTickets: item.carryover_tickets,
            rank: item.rank,
          }))
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred loading admin data.";
      setFetchError(msg);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAdminData();
  };

  // Filter referrals for admin queue
  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      const matchesStatus =
        selectedStatus === "all" || r.status === selectedStatus;

      const matchesDuplicate =
        duplicateFilter === "all" ||
        (duplicateFilter === "flagged" && r.flaggedDuplicate) ||
        (duplicateFilter === "clean" && !r.flaggedDuplicate);

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.buyerName.toLowerCase().includes(q) ||
        (r.volunteerName && r.volunteerName.toLowerCase().includes(q)) ||
        (r.orderReference && r.orderReference.toLowerCase().includes(q)) ||
        (r.buyerEmail && r.buyerEmail.toLowerCase().includes(q)) ||
        (r.buyerIdentifier && r.buyerIdentifier.toLowerCase().includes(q));

      return matchesStatus && matchesDuplicate && matchesSearch;
    });
  }, [referrals, selectedStatus, duplicateFilter, searchQuery]);

  // Overall Statistics calculated dynamically from live data
  const stats = useMemo(() => {
    const totalVolunteers = volunteers.length;
    const totalReferrals = referrals.length;
    const pending = referrals.filter((r) => r.status === "pending").length;
    const approved = referrals.filter((r) => r.status === "approved").length;
    const rejected = referrals.filter((r) => r.status === "rejected").length;
    const duplicates = referrals.filter((r) => r.flaggedDuplicate).length;

    const totalApprovedTickets = referrals
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.ticketQuantity, 0);

    const totalSubmittedTickets = referrals.reduce(
      (sum, r) => sum + r.ticketQuantity,
      0
    );

    const { points: totalPointsAwarded, carryoverTickets: totalCarryover } =
      calculatePointsFromTickets(totalApprovedTickets, scoringConfig);

    return {
      totalVolunteers,
      totalReferrals,
      pending,
      approved,
      rejected,
      duplicates,
      totalSubmittedTickets,
      totalApprovedTickets,
      totalPointsAwarded,
      totalCarryover,
    };
  }, [referrals, volunteers, scoringConfig]);

  // Aggregate Team Performance from live referrals & volunteers
  const teamPerformance = useMemo(() => {
    const teamMap = new Map<
      string,
      {
        teamName: string;
        volunteerCount: number;
        submittedTickets: number;
        approvedTickets: number;
        points: number;
        approvedReferrals: number;
      }
    >();

    // Seed teams from registered volunteers
    volunteers.forEach((v) => {
      const team = v.volunteerTeam;
      if (!teamMap.has(team)) {
        teamMap.set(team, {
          teamName: team,
          volunteerCount: 0,
          submittedTickets: 0,
          approvedTickets: 0,
          points: 0,
          approvedReferrals: 0,
        });
      }
      teamMap.get(team)!.volunteerCount += 1;
    });

    // Aggregate referral metrics per team
    referrals.forEach((r) => {
      const team = getSafeVolunteerTeam(r.volunteerTeam || "General Volunteer Pool");
      if (!teamMap.has(team)) {
        teamMap.set(team, {
          teamName: team,
          volunteerCount: 0,
          submittedTickets: 0,
          approvedTickets: 0,
          points: 0,
          approvedReferrals: 0,
        });
      }
      const entry = teamMap.get(team)!;
      entry.submittedTickets += r.ticketQuantity;
      if (r.status === "approved") {
        entry.approvedTickets += r.ticketQuantity;
        entry.approvedReferrals += 1;
        entry.points += r.ticketQuantity * (scoringConfig.pointsPerTicket || 5);
      }
    });

    return Array.from(teamMap.values()).sort(
      (a, b) => b.approvedTickets - a.approvedTickets || b.volunteerCount - a.volunteerCount
    );
  }, [volunteers, referrals, scoringConfig]);

  // Handle Approve or Reject using live Supabase UPDATE
  const handleUpdateStatus = async (
    referralId: string,
    newStatus: ReferralStatus,
    notes?: string
  ) => {
    setActionError(null);
    setActionSuccess(null);
    setIsUpdatingStatus(true);

    try {
      const supabase = createClient();
      const target = referrals.find((r) => r.id === referralId);

      if (!target) {
        throw new Error("Target referral not found in active records.");
      }

      // Safeguard 1: Block approving duplicate order references
      if (newStatus === "approved" && target.orderReference) {
        const normRef = target.orderReference.toLowerCase().trim();
        const conflictingApproved = referrals.find(
          (r) =>
            r.id !== referralId &&
            r.status === "approved" &&
            r.orderReference &&
            r.orderReference.toLowerCase().trim() === normRef
        );
        if (conflictingApproved) {
          throw new Error(
            `Double-Crediting Blocked: Order reference "${target.orderReference}" has already been approved for another claim (Claim ID: ${conflictingApproved.id.slice(0, 8)}). A single ticket order cannot be credited twice.`
          );
        }
      }

      // Safeguard 2: Require explicit confirmation note for duplicate-flagged claims
      if (newStatus === "approved" && target.flaggedDuplicate) {
        if (!notes || notes.trim().length < 5) {
          throw new Error(
            "Organizer Review Required: This claim is flagged as a duplicate. You must provide a verification note explaining why it is legitimate (e.g. verified distinct transaction on Meeteor Hub) before approving."
          );
        }
      }

      const defaultNote =
        newStatus === "approved"
          ? "Verified against Meeteor Hub records"
          : "Declined: Record does not match Meeteor Hub attendee list";

      const finalNote = notes?.trim() || defaultNote;
      const nowIso = new Date().toISOString();

      // Update referral in Supabase (enforced by RLS: public.is_admin())
      const { data: updatedData, error: updateError } = await supabase
        .from("referrals")
        .update({
          status: newStatus,
          admin_notes: finalNote,
          verified_at: newStatus === "approved" ? nowIso : null,
          verified_by: newStatus === "approved" ? adminProfile?.id : null,
          updated_at: nowIso,
        })
        .eq("id", referralId)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Update local state smoothly
      setReferrals((prev) =>
        prev.map((item) => {
          if (item.id === referralId) {
            return {
              ...item,
              status: newStatus,
              adminNotes: finalNote,
              verifiedAt: updatedData.verified_at ?? undefined,
              verifiedBy: adminProfile?.fullName ?? undefined,
            };
          }
          return item;
        })
      );

      setActionSuccess(
        `Referral successfully marked as ${newStatus.toUpperCase()}.`
      );
      setActiveReferral(null);
      setDecisionNotes("");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update referral status.";
      setActionError(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Save Scoring Policy to Supabase
  const handleSaveScoringPolicy = async () => {
    setScoringConfigError(null);
    setIsSavingPolicy(true);

    try {
      const supabase = createClient();
      const pts = Number(draftConfig.pointsPerTicket);

      if (!Number.isInteger(pts) || pts < 1 || pts > 100) {
        throw new Error("Points awarded per verified ticket must be an integer between 1 and 100.");
      }

      const { error: saveError } = await supabase
        .from("scoring_settings")
        .upsert({
          id: "current_policy",
          points_per_ticket: pts,
          status: draftConfig.status,
          label: `Official Scoring Policy (${pts} Points per Verified Ticket)`,
          notes: draftConfig.notes || "Configured by authorized administrator.",
          updated_by: adminProfile?.id,
          updated_at: new Date().toISOString(),
        });

      if (saveError) {
        throw new Error(saveError.message);
      }

      setScoringConfig(draftConfig);
      setIsConfirmingPolicyChange(false);
      setIsEditingScoring(false);
      setActionSuccess(
        `Scoring policy updated: ${pts} points per verified ticket saved to database.`
      );
      setTimeout(() => setActionSuccess(null), 4000);

      // Refresh leaderboard view data with new multiplier
      loadAdminData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save scoring policy.";
      setScoringConfigError(msg);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <FullPageLoader
        message="Loading admin command center..."
        label="Loading admin command center"
      />
    );
  }

  // Error State
  if (fetchError) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <h2 className="text-base font-bold">Admin Data Access Error</h2>
          </div>
          <p className="text-xs text-red-700 dark:text-red-200/80 leading-relaxed">{fetchError}</p>
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={() => loadAdminData()}
              className="px-3.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold transition-all flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-3.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
            >
              Return to Volunteer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
      {/* 1. Header with Live Status & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6 animate-subtle-fade-up">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Admin Command Center
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/40 font-medium">
              Live Database
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Reconcile submitted claims, audit duplicates, configure scoring policy, and monitor live challenge operations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-[#111114] shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <a
            href={CONFERENCE_CONFIG.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white underline underline-offset-4 transition-all"
          >
            Meeteor Hub ↗
          </a>
        </div>
      </div>

      {/* 2. Top-Level Genuine Platform Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        {/* Total Volunteers */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3 bg-white dark:bg-[#111114] shadow-xs animate-subtle-fade-up delay-75 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider flex items-center justify-between font-medium">
            Volunteers <Users className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
          </span>
          <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">
            {stats.totalVolunteers}
          </span>
        </div>

        {/* Total Referrals */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3 bg-white dark:bg-[#111114] shadow-xs animate-subtle-fade-up delay-100 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider flex items-center justify-between font-medium">
            Claims <Ticket className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
          </span>
          <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">
            {stats.totalReferrals}
          </span>
        </div>

        {/* Pending Review */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3 bg-white dark:bg-[#111114] shadow-xs animate-subtle-fade-up delay-150 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider flex items-center justify-between font-medium">
            Pending <Clock className="w-3 h-3 text-amber-500" />
          </span>
          <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">
            {stats.pending}
          </span>
        </div>

        {/* Duplicate Flags */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3 bg-white dark:bg-[#111114] shadow-xs animate-subtle-fade-up delay-200 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider flex items-center justify-between font-medium">
            Duplicates <ShieldAlert className="w-3 h-3 text-amber-500" />
          </span>
          <span className={`text-xl font-bold font-mono mt-1 block ${stats.duplicates > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>
            {stats.duplicates}
          </span>
        </div>

        {/* Verified Tickets */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3 bg-white dark:bg-[#111114] shadow-xs animate-subtle-fade-up delay-250 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider flex items-center justify-between font-medium">
            Approved Tix <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          </span>
          <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
            {stats.totalApprovedTickets}
          </span>
        </div>

        {/* Points Awarded */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3 bg-white dark:bg-[#111114] shadow-xs animate-subtle-fade-up delay-300 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-colors">
          <span className="text-zinc-500 block text-[10px] uppercase tracking-wider flex items-center justify-between font-medium">
            Points Awarded <Trophy className="w-3 h-3 text-tedx-red" />
          </span>
          <span className="text-xl font-bold font-mono text-zinc-900 dark:text-zinc-100 mt-1 block">
            {stats.totalPointsAwarded} <span className="text-[10px] font-normal text-zinc-500">pts</span>
          </span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab("referrals")}
          className={`px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "referrals"
              ? "border-tedx-red text-tedx-red dark:text-white"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Ticket className="w-3.5 h-3.5" />
          Referral Queue ({referrals.length})
        </button>
        <button
          onClick={() => setActiveTab("volunteers")}
          className={`px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "volunteers"
              ? "border-tedx-red text-tedx-red dark:text-white"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Volunteers ({volunteers.length})
        </button>
        <button
          onClick={() => setActiveTab("teams")}
          className={`px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "teams"
              ? "border-tedx-red text-tedx-red dark:text-white"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Team Performance ({teamPerformance.length})
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === "settings"
              ? "border-tedx-red text-tedx-red dark:text-white"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Scoring Policy
        </button>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="border border-emerald-800/60 bg-emerald-950/40 text-emerald-300 px-3 py-2 rounded text-xs flex items-center justify-between animate-subtle-fade-up">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {actionSuccess}
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {actionError && (
        <div className="border border-red-800/60 bg-red-950/40 text-red-300 px-3 py-2 rounded text-xs flex items-center justify-between animate-subtle-fade-up">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4. TAB 1: Referrals Verification Queue */}
      {activeTab === "referrals" && (
        <div className="space-y-4 animate-subtle-fade-up">
          {/* Controls: Status tabs, duplicate filter, and search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Status Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: "all", label: "All", count: referrals.length },
                { key: "pending", label: "Pending", count: referrals.filter((r) => r.status === "pending").length },
                { key: "approved", label: "Approved", count: referrals.filter((r) => r.status === "approved").length },
                { key: "rejected", label: "Rejected", count: referrals.filter((r) => r.status === "rejected").length },
              ].map((st) => (
                <button
                  key={st.key}
                  onClick={() => setSelectedStatus(st.key)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    selectedStatus === st.key
                      ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-white font-medium shadow-xs"
                      : "text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  }`}
                >
                  {st.label} ({st.count})
                </button>
              ))}

              <span className="text-zinc-300 dark:text-zinc-700 mx-1">|</span>

              {/* Duplicate Filter */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDuplicateFilter(duplicateFilter === "flagged" ? "all" : "flagged")}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                    duplicateFilter === "flagged"
                      ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/60 font-medium"
                      : "text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
                  }`}
                >
                  <ShieldAlert className="w-3 h-3 text-amber-500" />
                  Flagged Duplicates ({stats.duplicates})
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search buyer, email, ref, volunteer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded pl-8 pr-3 py-1.5 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors text-xs"
              />
            </div>
          </div>

          {/* Referral Table */}
          <div className="border border-zinc-200 dark:border-zinc-800/80 rounded bg-white dark:bg-[#111114] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-zinc-50 dark:bg-[#0e0e11]">
                    <th className="py-2.5 px-4">Volunteer</th>
                    <th className="py-2.5 px-4">Buyer Details</th>
                    <th className="py-2.5 px-4">Ticket</th>
                    <th className="py-2.5 px-4">Order Ref / Email</th>
                    <th className="py-2.5 px-4">Status & Flags</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
                  {filteredReferrals.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        {referrals.length === 0
                          ? "No referrals submitted yet. New claims submitted by volunteers will appear here automatically."
                          : "No claims match the active filters or search query."}
                      </td>
                    </tr>
                  ) : (
                    filteredReferrals.map((r) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors ${
                          r.flaggedDuplicate ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
                        }`}
                      >
                        {/* Volunteer */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-200">
                            {r.volunteerName}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {r.volunteerTeam}
                          </div>
                        </td>

                        {/* Buyer */}
                        <td className="py-3 px-4">
                          <div className="font-medium text-zinc-900 dark:text-zinc-200">
                            {r.buyerName}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {formatDateTime(r.createdAt)}
                          </div>
                        </td>

                        {/* Ticket */}
                        <td className="py-3 px-4">
                          <span className="font-mono font-medium text-zinc-900 dark:text-zinc-200 mr-1.5">
                            {r.ticketQuantity}x
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-400">{r.ticketType}</span>
                        </td>

                        {/* Order Ref & Buyer Email */}
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {r.orderReference ? (
                            <div className="text-zinc-900 dark:text-zinc-200 font-semibold">
                              {r.orderReference}
                            </div>
                          ) : (
                            <div className="text-zinc-400 dark:text-zinc-500 italic">No order ref</div>
                          )}
                          {r.buyerEmail && (
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
                              {r.buyerEmail}
                            </div>
                          )}
                          {!r.orderReference && !r.buyerEmail && r.buyerIdentifier && (
                            <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                              {r.buyerIdentifier}
                            </div>
                          )}
                        </td>

                        {/* Status & Flags */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            {r.status === "approved" && (
                              <span className="text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/40 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Approved
                              </span>
                            )}
                            {r.status === "pending" && (
                              <span className="text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/40 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            )}
                            {r.status === "rejected" && (
                              <span className="text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800/40 px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Rejected
                              </span>
                            )}
                          </div>

                          {/* Duplicate Warning Badge */}
                          {r.flaggedDuplicate && (
                            <div className="mt-1 text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 bg-amber-100 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/40 px-1.5 py-0.5 rounded">
                              <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{r.duplicateReason || "Duplicate Flag"}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setActiveReferral(r);
                              setDecisionNotes(r.adminNotes || "");
                            }}
                            className="px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors text-xs font-medium"
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

            <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0e0e11] text-[11px] text-zinc-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1">
              <span>Showing {filteredReferrals.length} of {referrals.length} total claims from Supabase database.</span>
              <span className="text-zinc-600 dark:text-zinc-400">Scoring: {scoringConfig.pointsPerTicket} pts per approved ticket</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: Volunteer Registry */}
      {activeTab === "volunteers" && (
        <div className="space-y-4 animate-subtle-fade-up">
          <div className="border border-zinc-200 dark:border-zinc-800/80 rounded bg-white dark:bg-[#111114] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-zinc-50 dark:bg-[#0e0e11]">
                    <th className="py-2.5 px-4">Volunteer</th>
                    <th className="py-2.5 px-4">Team</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4">Submitted Claims</th>
                    <th className="py-2.5 px-4">Approved Tickets</th>
                    <th className="py-2.5 px-4 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
                  {volunteers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-zinc-500">
                        No registered volunteers found in public.profiles.
                      </td>
                    </tr>
                  ) : (
                    volunteers.map((vol) => {
                      const volReferrals = referrals.filter((r) => r.volunteerId === vol.id);
                      const approvedTickets = volReferrals
                        .filter((r) => r.status === "approved")
                        .reduce((sum, r) => sum + r.ticketQuantity, 0);

                      return (
                        <tr key={vol.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                          <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-200">
                            {vol.fullName}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                            {vol.volunteerTeam}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                            {vol.phoneNumber || "—"}
                          </td>
                          <td className="py-3 px-4 font-mono text-zinc-700 dark:text-zinc-300">
                            {volReferrals.length} claims
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {approvedTickets} tickets ({approvedTickets * (scoringConfig.pointsPerTicket || 5)} pts)
                          </td>
                          <td className="py-3 px-4 text-right text-[11px] text-zinc-500 font-mono">
                            {formatDateTime(vol.createdAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0e0e11] text-[11px] text-zinc-500">
              {volunteers.length} verified volunteers registered on platform.
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 3: Team Performance Breakdown */}
      {activeTab === "teams" && (
        <div className="space-y-4 animate-subtle-fade-up">
          <div className="border border-zinc-200 dark:border-zinc-800/80 rounded bg-white dark:bg-[#111114] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-zinc-50 dark:bg-[#0e0e11]">
                    <th className="py-2.5 px-4">Team</th>
                    <th className="py-2.5 px-4">Volunteers</th>
                    <th className="py-2.5 px-4">Submitted Tickets</th>
                    <th className="py-2.5 px-4">Verified Tickets</th>
                    <th className="py-2.5 px-4 text-right">Points Earned</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-sans">
                  {teamPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-zinc-500">
                        No team activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    teamPerformance.map((tp) => (
                      <tr key={tp.teamName} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-200">
                          {tp.teamName}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-700 dark:text-zinc-300">
                          {tp.volunteerCount} members
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                          {tp.submittedTickets} tix
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {tp.approvedTickets} tix ({tp.approvedReferrals} approved claims)
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                          {tp.points} <span className="text-[10px] font-normal text-zinc-500">pts</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#0e0e11] text-[11px] text-zinc-500">
              Aggregated directly from registered volunteer profiles and approved referrals.
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB 4: Scoring Settings Section */}
      {activeTab === "settings" && (
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded bg-white dark:bg-[#111114] shadow-xs p-5 space-y-4 animate-subtle-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/60 pb-3">
            <div>
              <div className="flex items-center gap-2.5">
                <Settings2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">
                  Scoring Policy Configuration
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    scoringConfig.status === "active"
                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/40 font-medium"
                      : "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-800/40 font-medium"
                  }`}
                >
                  {scoringConfig.status === "active"
                    ? "Active Database Policy"
                    : "Draft Status"}
                </span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1">
                Governs points awarded to volunteers per verified ticket. Changes update the database in real time.
              </p>
            </div>

            {!isEditingScoring && (
              <button
                onClick={() => {
                  setDraftConfig(scoringConfig);
                  setScoringConfigError(null);
                  setIsEditingScoring(true);
                }}
                className="text-xs font-medium px-3 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 transition-all border border-zinc-300 dark:border-transparent"
              >
                Configure Policy
              </button>
            )}
          </div>

          {isEditingScoring ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setScoringConfigError(null);
                const pts = Number(draftConfig.pointsPerTicket);
                if (!Number.isInteger(pts) || pts < 1 || pts > 100) {
                  setScoringConfigError(
                    "Points awarded per verified ticket must be an integer between 1 and 100."
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
                  className="p-2.5 rounded border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-[11px] flex items-center gap-2"
                >
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{scoringConfigError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Points awarded per verified ticket */}
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Points per Verified Ticket *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={draftConfig.pointsPerTicket}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        pointsPerTicket: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors font-mono"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Official conference challenge standard is 5 points per ticket.
                  </span>
                </div>

                {/* Policy Status */}
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-2.5 py-2 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  >
                    <option value="active">Active (Live Calculations across all portals)</option>
                    <option value="draft">Draft (Held in Review)</option>
                  </select>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Active policy governs official point totals.
                  </span>
                </div>

                {/* Policy Notes */}
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Policy Notes / Rationale
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Official challenge: 5 pts per ticket"
                    value={draftConfig.notes || ""}
                    onChange={(e) =>
                      setDraftConfig({
                        ...draftConfig,
                        notes: e.target.value,
                      })
                    }
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800/60">
                <span className="text-[11px] text-zinc-500">
                  Updates write directly to public.scoring_settings in Supabase.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftConfig(scoringConfig);
                      setIsEditingScoring(false);
                      setScoringConfigError(null);
                    }}
                    className="px-3 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors border border-zinc-300 dark:border-transparent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred text-white font-semibold transition-all shadow-xs"
                  >
                    Review & Save Policy
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800/60 rounded p-3">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block font-medium">
                  Point Formula
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 mt-0.5 block font-mono">
                  {scoringConfig.pointsPerTicket} Points per Verified Ticket
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800/60 rounded p-3">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block font-medium">
                  Verification Requirement
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 mt-0.5 block">
                  Admin approval against Meeteor Hub
                </span>
              </div>
              <div className="bg-zinc-50 dark:bg-[#09090b] border border-zinc-200 dark:border-zinc-800/60 rounded p-3">
                <span className="text-zinc-500 text-[10px] uppercase tracking-wider block font-medium">
                  Database Record
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 mt-0.5 block">
                  Last updated: {formatDateTime(scoringConfig.updatedAt)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 8. Reconcile / Review Modal */}
      {activeReferral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 relative text-xs animate-modal shadow-2xl">
            <button
              onClick={() => setActiveReferral(null)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Review Referral Claim
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">
                Reconcile ticket claim against official Meeteor Hub transactions before crediting points.
              </p>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-3.5 bg-zinc-50 dark:bg-[#09090b] space-y-2.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Claimant Volunteer:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">
                  {activeReferral.volunteerName} ({activeReferral.volunteerTeam})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Buyer Name:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-medium">{activeReferral.buyerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Ticket Type & Qty:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-mono font-medium">
                  {activeReferral.ticketQuantity}x {activeReferral.ticketType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Order Reference:</span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200">
                  {activeReferral.orderReference || activeReferral.buyerIdentifier || "None"}
                </span>
              </div>
              {activeReferral.buyerEmail && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Buyer Email:</span>
                  <span className="font-mono text-zinc-700 dark:text-zinc-300">{activeReferral.buyerEmail}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Submitted At:</span>
                <span className="font-mono text-zinc-600 dark:text-zinc-400">{formatDateTime(activeReferral.createdAt)}</span>
              </div>

              {/* DUPLICATE FLAG ALERT BOX */}
              {activeReferral.flaggedDuplicate && (
                <div className="mt-2 p-2.5 rounded border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] text-amber-900 dark:text-amber-400">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    DUPLICATE FLAG DETECTED
                  </div>
                  <div className="text-[11px] leading-relaxed">
                    {activeReferral.duplicateReason || "This claim matched existing records in the database."}
                  </div>
                  {activeReferral.duplicateSourceId && (
                    <div className="text-[10px] text-amber-700 dark:text-amber-400/80 font-mono">
                      Matched Source Claim ID: {activeReferral.duplicateSourceId}
                    </div>
                  )}
                  <div className="text-[10px] text-amber-800 dark:text-amber-400/90 pt-1 font-semibold">
                    Policy Rule: Duplicate-flagged claims CANNOT be approved without an organizer verification note confirming a legitimate distinct purchase.
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Verification Notes (Logged to Permanent Audit Trail)
                {activeReferral.flaggedDuplicate && (
                  <span className="text-amber-600 dark:text-amber-400 ml-1 font-semibold">* Required for flagged claims</span>
                )}
              </label>
              <textarea
                rows={2}
                placeholder={
                  activeReferral.flaggedDuplicate
                    ? "Explain why this flagged claim is verified as legitimate on Meeteor..."
                    : "e.g. Verified attendee payment on Meeteor Hub"
                }
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded p-2.5 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveReferral(null)}
                disabled={isUpdatingStatus}
                className="px-3 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all text-xs"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus(activeReferral.id, "rejected", decisionNotes)}
                className="px-3 py-1.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 font-medium transition-all text-xs disabled:opacity-50 border border-zinc-300 dark:border-transparent flex items-center gap-1.5"
              >
                {isUpdatingStatus ? (
                  <>
                    <LoadingSpinner size="xs" colorScheme="red-dark" label="Rejecting claim" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Reject Claim</span>
                )}
              </button>
              <button
                type="button"
                disabled={isUpdatingStatus}
                onClick={() => handleUpdateStatus(activeReferral.id, "approved", decisionNotes)}
                className="px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred text-white font-semibold transition-all shadow-xs text-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isUpdatingStatus ? (
                  <>
                    <LoadingSpinner size="xs" label="Processing approval" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>{`Approve & Award ${activeReferral.ticketQuantity * (scoringConfig.pointsPerTicket || 5)} Pts`}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Policy Confirmation Modal */}
      {isConfirmingPolicyChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-backdrop">
          <div className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded max-w-md w-full max-h-[90vh] overflow-y-auto p-6 space-y-4 relative text-xs animate-modal shadow-2xl">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">
              Confirm Database Policy Update
            </h3>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
              You are updating the active scoring policy in Supabase to:{" "}
              <strong className="text-zinc-900 dark:text-white">
                {draftConfig.pointsPerTicket} points per verified ticket
              </strong>{" "}
              under policy status{" "}
              <strong className="text-zinc-900 dark:text-white capitalize">
                {draftConfig.status}
              </strong>.
            </p>

            <div className="border border-amber-300 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-3 rounded text-[11px] leading-relaxed">
              <strong>Notice:</strong> This change will update public standings across all volunteer dashboards and the live leaderboard.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSavingPolicy}
                onClick={() => setIsConfirmingPolicyChange(false)}
                className="px-3 py-1.5 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPolicy}
                onClick={handleSaveScoringPolicy}
                className="px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred text-white font-semibold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingPolicy ? (
                  <>
                    <LoadingSpinner size="xs" label="Saving to Supabase" />
                    <span>Saving to Supabase...</span>
                  </>
                ) : (
                  <span>Confirm & Save to Supabase</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
