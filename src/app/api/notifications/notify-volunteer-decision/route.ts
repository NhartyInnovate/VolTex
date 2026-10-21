import { NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/notify-volunteer-decision
 * Body: { referralId: string }
 *
 * Calls the secure database function create_volunteer_decision_notification
 * to create an in-app notification for the volunteer when an admin approves or rejects a referral.
 *
 * Requirements:
 * - Caller must be an authenticated administrator.
 * - Non-blocking: Even if notification dispatch fails, the referral status update has already
 *   succeeded and is not rolled back.
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

    // Call database decision notification function (SECURITY DEFINER, checks caller is admin)
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "create_volunteer_decision_notification",
      { p_referral_id: referralId }
    );

    if (rpcError) {
      // Map authorization errors to 403 Forbidden
      const msg = rpcError.message || "";
      if (msg.includes("FORBIDDEN") || msg.toLowerCase().includes("only administrators")) {
        return NextResponse.json(
          { error: "Forbidden: Only administrators can dispatch volunteer decision notifications." },
          { status: 403 }
        );
      }

      if (msg.includes("AUTHENTICATION_REQUIRED")) {
        return NextResponse.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to dispatch volunteer notification." },
        { status: 500 }
      );
    }

    // Inspect RPC return value for domain-level failure (e.g. referral not found or not yet decided)
    if (
      rpcResult &&
      typeof rpcResult === "object" &&
      "success" in rpcResult &&
      rpcResult.success === false
    ) {
      const safeMessage =
        typeof rpcResult.message === "string" && rpcResult.message.trim().length > 0
          ? rpcResult.message
          : "Unable to create notification for the requested referral.";

      return NextResponse.json(
        { error: safeMessage, result: rpcResult },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      result: rpcResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
