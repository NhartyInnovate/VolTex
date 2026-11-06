import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("get_volunteer_referral_stats");

    if (error) {
      console.error("[VOLUNTEER_STATS] RPC error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

    if (!row) {
      return NextResponse.json({
        stats: {
          totalRawRequests: 0,
          totalTrackedVisits: 0,
          totalUniqueVisitorDays: 0,
          cohortLeadsCaptured: 0,
          cohortLeadsConverted: 0,
          cohortConversionRate: 0,
        },
      });
    }

    return NextResponse.json({
      stats: {
        totalRawRequests: Number(row.total_raw_requests) || 0,
        totalTrackedVisits: Number(row.total_tracked_visits) || 0,
        totalUniqueVisitorDays: Number(row.total_unique_visitor_days) || 0,
        cohortLeadsCaptured: Number(row.cohort_leads_captured) || 0,
        cohortLeadsConverted: Number(row.cohort_leads_converted) || 0,
        cohortConversionRate: Number(row.cohort_conversion_rate) || 0,
        allTimeVerifiedTickets: Number(row.all_time_verified_tickets) || 0,
        allTimeOfficialPoints: Number(row.all_time_official_points) || 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
