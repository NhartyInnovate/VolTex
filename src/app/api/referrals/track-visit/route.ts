import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getClientIp,
  deriveVisitorHash,
  isBotUserAgent,
  isPrefetchRequest,
} from "@/lib/referrals/telemetry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Ignore Prefetch and Automated Link Previews
    if (isPrefetchRequest(request.headers)) {
      return NextResponse.json({ success: true, ignored: "prefetch" });
    }

    const userAgent = request.headers.get("user-agent") || "";
    if (isBotUserAgent(userAgent)) {
      return NextResponse.json({ success: true, ignored: "bot" });
    }

    const body = await request.json();
    const { referralCode } = body;

    const cleanCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";
    if (!cleanCode) {
      return NextResponse.json(
        { success: false, error: "MISSING_REFERRAL_CODE" },
        { status: 400 }
      );
    }

    // 2. Derive Daily Anonymous Visitor Hash
    const clientIp = getClientIp(request.headers);
    const visitorHash = deriveVisitorHash(clientIp, userAgent);

    // 3. Record Deduplicated Human Visit
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.rpc("track_landing_page_visit", {
      p_referral_code: cleanCode,
      p_visitor_hash: visitorHash,
    });

    if (error) {
      console.error("[TRACK_VISIT_API] RPC error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      rateLimitPassed: data?.rate_limit_passed ?? false,
      newDailyUnique: data?.new_daily_unique ?? false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[TRACK_VISIT_API] Unexpected error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
