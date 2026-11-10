"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Tag,
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface LeadItem {
  id: string;
  volunteer_id: string;
  referral_code: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string | null;
  ticket_quantity: number;
  source_attribution?: string | null;
  status: "pending_purchase" | "converted" | "expired";
  conversion_count: number;
  first_converted_at?: string | null;
  last_converted_at?: string | null;
  expires_at: string;
  created_at: string;
  profiles?: {
    full_name: string;
    volunteer_team: string;
  } | null;
}

interface AnalyticsItem {
  volunteer_id: string;
  full_name: string;
  referral_code: string;
  total_raw_requests: number;
  total_tracked_visits: number;
  total_unique_visitor_days: number;
  period_leads_captured: number;
  period_credited_conversions: number;
  period_credited_tickets: number;
  cohort_leads_captured: number;
  cohort_leads_converted: number;
  cohort_conversion_rate: number;
  cohort_verified_tickets: number;
  all_time_verified_tickets: number;
  all_time_official_points: number;
}

export function AdminLeadsManagement() {
  const [activeSubTab, setActiveSubTab] = useState<"leads" | "analytics">("leads");
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Direct Verification & Conversion Modal State
  const [selectedLead, setSelectedLead] = useState<LeadItem | null>(null);
  const [ticketQuantity, setTicketQuantity] = useState(1);
  const [adminNotes, setAdminNotes] = useState("Verified on Meeteor attendee roster");
  const [submittingConversion, setSubmittingConversion] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [conversionSuccess, setConversionSuccess] = useState<string | null>(null);

  // Reopen Modal State
  const [reopenTargetLead, setReopenTargetLead] = useState<LeadItem | null>(null);
  const [reopenHours, setReopenHours] = useState(48);
  const [reopenNotes, setReopenNotes] = useState("");
  const [submittingReopen, setSubmittingReopen] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [reopenSuccess, setReopenSuccess] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/referrals/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error("Failed to load leads:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/referrals/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || []);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "leads") {
      fetchLeads();
    } else {
      fetchAnalytics();
    }
  }, [activeSubTab]);

  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setSubmittingConversion(true);
    setConversionError(null);
    setConversionSuccess(null);

    try {
      const res = await fetch("/api/admin/referrals/convert-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerReferralId: selectedLead.id,
          ticketQuantity,
          adminNotes: adminNotes.trim() || "Verified on Meeteor attendee roster",
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setConversionError(result.message || "Approval and credit failed");
        setSubmittingConversion(false);
        return;
      }

      setConversionSuccess(
        `Successfully verified! Credited ${result.ticketsCredited || ticketQuantity} ticket(s) (+${result.pointsAwarded || ticketQuantity * 5} pts) to volunteer.`
      );
      fetchLeads();
      setTimeout(() => {
        setSelectedLead(null);
        setAdminNotes("Verified on Meeteor attendee roster");
        setConversionSuccess(null);
      }, 1800);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setConversionError(message);
    } finally {
      setSubmittingConversion(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTargetLead) return;

    setSubmittingReopen(true);
    setReopenError(null);
    setReopenSuccess(null);

    try {
      const res = await fetch("/api/admin/referrals/reopen-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerReferralId: reopenTargetLead.id,
          extensionHours: Number(reopenHours),
          adminNotes: reopenNotes.trim() || null,
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setReopenError(result.message || "Failed to reopen expired lead.");
        setSubmittingReopen(false);
        return;
      }

      setReopenSuccess("Lead reopened successfully! Expiration extended.");
      fetchLeads();
      setTimeout(() => {
        setReopenTargetLead(null);
        setReopenNotes("");
        setReopenSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setReopenError(message);
    } finally {
      setSubmittingReopen(false);
    }
  };

  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.buyer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.buyer_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.referral_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.profiles?.full_name || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSubTab("leads")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeSubTab === "leads"
                ? "bg-red-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Buyer Leads & Conversions ({leads.length})
          </button>
          <button
            onClick={() => setActiveSubTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeSubTab === "analytics"
                ? "bg-red-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            Referral Telemetry Analytics
          </button>
        </div>

        <button
          onClick={() => (activeSubTab === "leads" ? fetchLeads() : fetchAnalytics())}
          className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs flex items-center gap-1.5"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {activeSubTab === "leads" ? (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
              <input
                type="text"
                placeholder="Search leads by buyer name, email, code, volunteer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white"
            >
              <option value="all">All Statuses</option>
              <option value="pending_purchase">Pending Purchase</option>
              <option value="converted">Converted</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Leads Table */}
          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-xs">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
              No buyer leads matching your filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
                <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="py-3 px-4">Buyer Name & Email</th>
                    <th className="py-3 px-4">Attributed Volunteer</th>
                    <th className="py-3 px-4">Referral Code</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Conversions</th>
                    <th className="py-3 px-4">Captured At</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">
                        <div>{lead.buyer_name}</div>
                        <div className="text-[11px] text-zinc-500 font-normal">{lead.buyer_email}</div>
                        {lead.buyer_phone && (
                          <div className="text-[10px] text-zinc-400 font-mono">{lead.buyer_phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {lead.profiles?.full_name || "Volunteer"}
                        </div>
                        <div className="text-[10px] text-zinc-500">{lead.profiles?.volunteer_team}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-600 dark:text-red-400">
                        {lead.referral_code}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            lead.status === "converted"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                              : lead.status === "expired"
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                              : "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                        {lead.conversion_count} claim{lead.conversion_count === 1 ? "" : "s"}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 text-[11px]">
                        {formatDateTime(lead.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        {lead.status === "expired" && (
                          <button
                            onClick={() => {
                              setReopenTargetLead(lead);
                              setReopenHours(48);
                              setReopenNotes("");
                              setReopenError(null);
                              setReopenSuccess(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition-colors inline-flex items-center gap-1 shadow-xs"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Reopen</span>
                          </button>
                        )}
                        {lead.status === "converted" ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800/60">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Paid & Credited</span>
                            </span>
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                setTicketQuantity(1);
                                setAdminNotes("Verified on Meeteor attendee roster");
                                setConversionError(null);
                                setConversionSuccess(null);
                              }}
                              className="px-2 py-1 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-[10px] underline"
                              title="Credit additional ticket purchase"
                            >
                              + Credit More
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setTicketQuantity(lead.ticket_quantity || 1);
                              setAdminNotes("Verified on Meeteor attendee roster");
                              setConversionError(null);
                              setConversionSuccess(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] transition-colors inline-flex items-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm Paid & Credit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Analytics View */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300">
            <strong>Points Attribution Invariant:</strong> Points derive dynamically and exclusively from approved ticket claims (<code>public.get_active_points_per_ticket()</code>). Link clicks, visits, and captured leads do NOT award points.
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
              <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Volunteer</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Raw Clicks</th>
                  <th className="py-3 px-4">Human Visits</th>
                  <th className="py-3 px-4">Captured Leads</th>
                  <th className="py-3 px-4">Converted Leads</th>
                  <th className="py-3 px-4">Conversion Rate</th>
                  <th className="py-3 px-4">Verified Tickets</th>
                  <th className="py-3 px-4 font-bold text-red-600 dark:text-red-400">Official Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {analytics.map((row) => (
                  <tr key={row.volunteer_id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50">
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      {row.full_name}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                      {row.referral_code}
                    </td>
                    <td className="py-3 px-4">{row.total_raw_requests}</td>
                    <td className="py-3 px-4">{row.total_tracked_visits}</td>
                    <td className="py-3 px-4 font-medium text-blue-600 dark:text-blue-400">
                      {row.cohort_leads_captured}
                    </td>
                    <td className="py-3 px-4 font-medium text-emerald-600 dark:text-emerald-400">
                      {row.cohort_leads_converted}
                    </td>
                    <td className="py-3 px-4 font-bold">
                      {row.cohort_conversion_rate}%
                    </td>
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      {row.all_time_verified_tickets}
                    </td>
                    <td className="py-3 px-4 font-black text-red-600 dark:text-red-400">
                      {row.all_time_official_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Paid & Credit Points Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Confirm Paid & Credit Points</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Verify this attendee on your Meeteor roster to immediately approve the referral and credit volunteer leaderboard points.
              </p>
            </div>

            {conversionError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs">
                {conversionError}
              </div>
            )}

            {conversionSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                {conversionSuccess}
              </div>
            )}

            {/* Attendee & Volunteer Summary Card */}
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-3 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Attendee</div>
                  <div className="font-bold text-sm text-zinc-900 dark:text-white">{selectedLead.buyer_name}</div>
                  <div className="text-zinc-600 dark:text-zinc-300 font-mono text-[11px]">{selectedLead.buyer_email}</div>
                  {selectedLead.buyer_phone && (
                    <div className="text-zinc-400 text-[11px]">{selectedLead.buyer_phone}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Credited Volunteer</div>
                  <div className="font-bold text-sm text-red-600 dark:text-red-400">
                    {selectedLead.profiles?.full_name || selectedLead.referral_code}
                  </div>
                  <div className="text-zinc-500 dark:text-zinc-400 text-[11px] font-mono">
                    Code: {selectedLead.referral_code}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500 dark:text-zinc-400">Lead Status:</span>
                <span className="font-semibold uppercase text-amber-600 dark:text-amber-400">
                  {selectedLead.status === "converted" ? `Converted (${selectedLead.conversion_count}x)` : selectedLead.status}
                </span>
              </div>
            </div>

            <form onSubmit={handleConvertSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Number of Tickets Paid on Meeteor
                </label>
                <select
                  value={ticketQuantity}
                  onChange={(e) => setTicketQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value={1}>1 Ticket (+5 Points)</option>
                  <option value={2}>2 Tickets (+10 Points)</option>
                  <option value={3}>3 Tickets (+15 Points)</option>
                  <option value={4}>4 Tickets (+20 Points)</option>
                  <option value={5}>5 Tickets (+25 Points)</option>
                  <option value={6}>6 Tickets (+30 Points)</option>
                  <option value={10}>10 Tickets (+50 Points)</option>
                </select>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Awards <strong>+{ticketQuantity * 5} points</strong> directly to {selectedLead.profiles?.full_name || selectedLead.referral_code} on the volunteer leaderboard.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Verification Audit Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified on Meeteor attendee roster"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={submittingConversion}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-400 active:scale-95"
                >
                  {submittingConversion ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Crediting...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Award +{ticketQuantity * 5} Pts</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Expired Lead Modal */}
      {reopenTargetLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reopen Expired Buyer Lead</span>
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                Extend Expiration & Restore Active Lead
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Buyer <strong className="text-zinc-900 dark:text-white">{reopenTargetLead.buyer_name}</strong> ({reopenTargetLead.buyer_email}) &middot; Referrer: {reopenTargetLead.profiles?.full_name || reopenTargetLead.referral_code}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <p className="font-semibold">Security & Scoring Integrity Notice:</p>
              <p>Reopening restores the lead to <code>pending_purchase</code> status with a fresh expiration window. Under official scoring rules, this action preserves original first-touch attribution and <strong>does NOT award points</strong> or create a ticket claim.</p>
            </div>

            {reopenError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs">
                {reopenError}
              </div>
            )}

            {reopenSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs">
                {reopenSuccess}
              </div>
            )}

            <form onSubmit={handleReopenSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Extension Window (Hours) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 mb-2">
                  {[24, 48, 72, 168].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setReopenHours(h)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                        reopenHours === h
                          ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                          : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {h === 168 ? "7 Days" : `${h}h`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={reopenHours}
                  onChange={(e) => setReopenHours(Math.max(1, Math.min(720, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  required
                />
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Integer between 1 and 720 hours (up to 30 days). Default is 48 hours.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Admin Audit Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Reason for reopening (e.g. buyer contacted organizer regarding pending payment on Meeteor)..."
                  value={reopenNotes}
                  onChange={(e) => setReopenNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingReopen}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors flex items-center justify-center gap-2 disabled:bg-zinc-400 shadow-sm"
                >
                  {submittingReopen ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Reopening Lead...</span>
                    </>
                  ) : (
                    <span>Confirm & Reopen Lead</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setReopenTargetLead(null)}
                  className="py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
