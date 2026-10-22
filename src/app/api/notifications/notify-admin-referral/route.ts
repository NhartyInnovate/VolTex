import { NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";
import { sendAdminNewReferralNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/notify-admin-referral
 * Body: { referralId: string }
 *
 * Calls the secure database fanout function to create in-app notifications
 * for all administrators when a referral is submitted, and asynchronously
 * dispatches an administrative email alert via Resend.
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

    // Inspect RPC return value for domain-level failure (e.g. referral not found)
    if (
      rpcResult &&
      typeof rpcResult === "object" &&
      "success" in rpcResult &&
      rpcResult.success === false
    ) {
      const safeMessage =
        typeof rpcResult.message === "string" && rpcResult.message.trim().length > 0
          ? rpcResult.message
          : "Unable to create admin notification for the requested referral.";

      return NextResponse.json(
        { error: safeMessage, result: rpcResult },
        { status: 422 }
      );
    }

    // Non-blocking email dispatch: retrieve referral & owning volunteer details
    let emailDispatched = false;
    try {
      const { data: referral } = await supabase
        .from("referrals")
        .select(
          "id, volunteer_id, buyer_name, ticket_type, ticket_quantity, order_reference, buyer_identifier, created_at"
        )
        .eq("id", referralId)
        .maybeSingle();

      if (referral && referral.volunteer_id) {
        const { data: volunteerProfile } = await supabase
          .from("profiles")
          .select("full_name, volunteer_team")
          .eq("id", referral.volunteer_id)
          .maybeSingle();

        const emailResult = await sendAdminNewReferralNotification({
          volunteerName: volunteerProfile?.full_name || "A volunteer",
          volunteerTeam: volunteerProfile?.volunteer_team || "Volunteer Team",
          ticketType: referral.ticket_type,
          ticketQuantity: referral.ticket_quantity,
          orderReference: referral.order_reference || referral.buyer_identifier,
          buyerName: referral.buyer_name,
          referralId: referral.id,
          submittedAt: referral.created_at,
        });
        emailDispatched = Boolean(emailResult.success && !emailResult.skipped);
      }
    } catch (emailErr: unknown) {
      // Non-blocking: log sanitized error message without failing response
      const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error";
      console.warn(`[VolTex Email] Non-blocking admin email dispatch error: ${errMsg}`);
    }

    return NextResponse.json({
      success: true,
      result: rpcResult,
      emailDispatched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
