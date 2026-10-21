import { NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/notify-admin-referral
 * Body: { referralId: string }
 *
 * Calls the secure database fanout function to create in-app notifications
 * for all administrators when a referral is submitted.
 *
 * Non-blocking guarantee:
 * Even if this endpoint encounters an error, the referral submission itself
 * has already succeeded at the database level and is not rolled back.
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerUserClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { referralId } = body;

    if (!referralId || typeof referralId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid referralId." },
        { status: 400 }
      );
    }

    // Call database fanout function (SECURITY DEFINER with caller authorization check)
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_admin_notifications_for_referral",
      { p_referral_id: referralId }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: rpcError.message || "Failed to dispatch admin notification." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: rpcResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
