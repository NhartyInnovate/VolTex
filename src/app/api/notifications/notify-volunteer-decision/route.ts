import { NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmailAddress, sendVolunteerDecisionNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/notify-volunteer-decision
 * Body: { referralId: string }
 *
 * Calls the secure database function create_volunteer_decision_notification
 * to create an in-app notification for the volunteer when an admin approves or rejects a referral,
 * and asynchronously dispatches a decision email to the volunteer via Resend.
 *
 * Requirements & Idempotency Trade-off:
 * - Caller must be an authenticated administrator.
 * - Non-blocking: Even if notification dispatch fails, the referral status update has already
 *   succeeded and is not rolled back.
 * - Note on `rpcResult.notification_created`: We intentionally do NOT permanently suppress email
 *   delivery solely because `notification_created === false`. If an initial email attempt failed
 *   due to a transient Resend/network error after the DB RPC committed the in-app notification row
 *   (or if an admin transitioned a referral `approved -> rejected -> approved`), `notification_created`
 *   will be `false` on the subsequent call. Instead, duplicate suppression uses:
 *   1. In-instance in-flight + 5-minute TTL cache (which clears the opposite status key on transitions
 *      and never caches failed sends, preserving immediate retryability).
 *   2. Resend's `Idempotency-Key` header (`volunteer-decision/<referralId>/<decision>`), providing
 *      24-hour cross-instance deduplication on successful sends at the email provider level.
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

    // Non-blocking email dispatch to the volunteer
    let emailDispatched = false;
    try {
      const volunteerId = rpcResult?.volunteer_id;
      const decision = rpcResult?.decision; // "approved" | "rejected"

      if (volunteerId && (decision === "approved" || decision === "rejected")) {
        // 1. Resolve volunteer email address from Supabase Auth first to avoid unnecessary DB queries
        let volunteerEmail: string | null = null;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          try {
            const adminClient = createAdminClient();
            const { data: authUser, error: authUserError } =
              await adminClient.auth.admin.getUserById(volunteerId);
            if (!authUserError && authUser?.user?.email && isValidEmailAddress(authUser.user.email)) {
              volunteerEmail = authUser.user.email.trim();
            }
          } catch (adminErr: unknown) {
            const errMsg = adminErr instanceof Error ? adminErr.message : "Unknown error";
            console.warn(`[VolTex Email] Could not lookup volunteer email via admin client: ${errMsg}`);
          }
        } else {
          console.warn("[VolTex Email] SUPABASE_SERVICE_ROLE_KEY not configured; skipping volunteer email lookup.");
        }

        // 2. Only fetch referral, profile, and leaderboard details when a valid recipient email exists
        if (volunteerEmail) {
          const { data: referral } = await supabase
            .from("referrals")
            .select("id, ticket_type, ticket_quantity, order_reference, buyer_identifier, admin_notes")
            .eq("id", referralId)
            .maybeSingle();

          const { data: volunteerProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", volunteerId)
            .maybeSingle();

          if (referral) {
            const orderRef = referral.order_reference || referral.buyer_identifier;

            if (decision === "approved") {
              interface LeaderboardRow {
                points?: number;
                rank?: number;
              }
              const { data: leaderboardData } = await supabase
                .from("public_leaderboard")
                .select("points, rank")
                .eq("volunteer_id", volunteerId)
                .maybeSingle();
              const leaderboard = leaderboardData as LeaderboardRow | null;

              const emailResult = await sendVolunteerDecisionNotification({
                decision: "approved",
                volunteerName: volunteerProfile?.full_name || "Volunteer",
                to: volunteerEmail,
                ticketType: referral.ticket_type,
                ticketQuantity: referral.ticket_quantity,
                orderReference: orderRef,
                pointsEarned: typeof rpcResult.points_earned === "number" ? rpcResult.points_earned : 0,
                cumulativePoints: leaderboard?.points ?? null,
                rank: leaderboard?.rank ?? null,
                adminNotes: referral.admin_notes,
                referralId,
              });
              emailDispatched = Boolean(emailResult.success && !emailResult.skipped);
            } else {
              const emailResult = await sendVolunteerDecisionNotification({
                decision: "rejected",
                volunteerName: volunteerProfile?.full_name || "Volunteer",
                to: volunteerEmail,
                ticketType: referral.ticket_type,
                ticketQuantity: referral.ticket_quantity,
                orderReference: orderRef,
                rejectionReason: referral.admin_notes,
                referralId,
              });
              emailDispatched = Boolean(emailResult.success && !emailResult.skipped);
            }
          }
        }
      }
    } catch (emailErr: unknown) {
      // Non-blocking: log sanitized warning without failing the committed decision response
      const errMsg = emailErr instanceof Error ? emailErr.message : "Unknown error";
      console.warn(`[VolTex Email] Non-blocking volunteer email dispatch error: ${errMsg}`);
    }

    return NextResponse.json({
      success: true,
      result: rpcResult,
      emailDispatched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
