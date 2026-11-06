import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "UNAUTHORIZED", message: "Authentication required" },
        { status: 401 }
      );
    }

    // 2. Authorize admin privilege
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
      extensionHours = 48,
      adminNotes = null,
    } = body;

    if (!buyerReferralId || typeof buyerReferralId !== "string") {
      return NextResponse.json(
        { success: false, error: "MISSING_PARAMETERS", message: "buyerReferralId is required." },
        { status: 400 }
      );
    }

    const safeHours = Number(extensionHours);
    if (!Number.isInteger(safeHours) || safeHours < 1 || safeHours > 720) {
      return NextResponse.json(
        { success: false, error: "INVALID_EXTENSION_HOURS", message: "Extension hours must be an integer between 1 and 720 (max 30 days)." },
        { status: 400 }
      );
    }

    // 3. Call database RPC
    const { data, error } = await supabase.rpc("reopen_expired_buyer_lead", {
      p_buyer_referral_id: buyerReferralId.trim(),
      p_extension_hours: safeHours,
      p_admin_notes: typeof adminNotes === "string" && adminNotes.trim() ? adminNotes.trim() : null,
    });

    if (error) {
      console.error("[ADMIN_REOPEN_LEAD] RPC error:", error.message);
      return NextResponse.json(
        { success: false, error: "REOPEN_FAILED", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      leadId: data?.lead_id,
      status: data?.status,
      expiresAt: data?.expires_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[ADMIN_REOPEN_LEAD] Unexpected error:", message);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}
