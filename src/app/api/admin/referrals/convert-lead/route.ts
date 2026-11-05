import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Authorize admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "FORBIDDEN", message: "Admin privilege required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      buyerReferralId,
      referralId,
      attributionResolution = "match",
      forceEmailOverride = false,
      adminNotes = null,
    } = body;

    if (!buyerReferralId || !referralId) {
      return NextResponse.json(
        { success: false, error: "MISSING_PARAMETERS", message: "buyerReferralId and referralId are required" },
        { status: 400 }
      );
    }

    // 3. Call database RPC
    const { data, error } = await supabase.rpc("convert_buyer_lead", {
      p_buyer_referral_id: buyerReferralId,
      p_referral_id: referralId,
      p_attribution_resolution: attributionResolution,
      p_force_email_override: Boolean(forceEmailOverride),
      p_admin_notes: typeof adminNotes === "string" ? adminNotes.trim() : null,
    });

    if (error) {
      console.error("[ADMIN_CONVERT_LEAD] RPC error:", error.message);
      return NextResponse.json(
        { success: false, error: "CONVERSION_FAILED", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      conversionId: data?.conversion_id,
      creditedVolunteerId: data?.credited_volunteer_id,
      conversionCount: data?.conversion_count,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[ADMIN_CONVERT_LEAD] Unexpected error:", message);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}
