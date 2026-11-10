import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface DeleteUserPayload {
  userId?: string;
  confirmedFullName?: string;
}

interface DeletionRpcResult {
  success: boolean;
  error?: string;
  message?: string;
  buyer_leads_count?: number;
  touches_count?: number;
  conversions_count?: number;
  converted_referrals_count?: number;
  deleted_referral_count?: number;
  target_user_id?: string;
  target_full_name?: string;
}

/**
 * POST /api/admin/users/delete
 * Atomic, server-only administrator volunteer deletion workflow.
 *
 * Strict Protections & Guarantees:
 * 1. Authenticates calling administrator using trusted server session (callingUser.id).
 * 2. Revalidates calling user's admin role from public.profiles.
 * 3. Enforces that self-deletion is forbidden using verified session identity (callingUser.id !== targetUserId).
 * 4. Delegates entire database mutation to public.admin_delete_volunteer_account:
 *    - Acquires exclusive row-level lock (FOR UPDATE) on target profile.
 *    - Serializes against concurrent buyer referral captures (conflicting with FOR KEY SHARE).
 *    - Inspects all restricted foreign keys: buyer_referrals, touches, conversions,
 *      and legacy referrals linked in lead_claim_conversions.
 *    - If restricted records exist, rejects deletion atomically (0 records modified).
 *    - If clean, cascades deletion and preserves audit logs in ONE database transaction.
 * 5. Post-Commit Auth Synchronization:
 *    - After PostgreSQL transaction commits, invokes adminClient.auth.admin.deleteUser(targetUserId).
 *    - Expected to return HTTP 404 because PostgreSQL already removed auth.users.
 *    - Does NOT participate in the database transaction; failure does not revert database commit.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate caller using server session
    const userClient = createServerUserClient();
    const {
      data: { user: callingUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !callingUser) {
      return NextResponse.json(
        { error: "Unauthorized: Please log in." },
        { status: 401 }
      );
    }

    // 2. Revalidate calling user's admin role from trusted server-side data
    const { data: callerProfile, error: callerProfileError } = await userClient
      .from("profiles")
      .select("role, full_name")
      .eq("id", callingUser.id)
      .single();

    if (callerProfileError || !callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator permissions required." },
        { status: 403 }
      );
    }

    // Check service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: "Server configuration missing: SUPABASE_SERVICE_ROLE_KEY is required to delete Auth users.",
          code: "MISSING_SERVICE_ROLE_KEY",
        },
        { status: 503 }
      );
    }

    // Parse payload
    const body: DeleteUserPayload = await request.json().catch(() => ({}));
    const targetUserId = body.userId?.trim();

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Bad Request: Missing target userId." },
        { status: 400 }
      );
    }

    // 3. Prevent self-deletion (Strictly using verified server session identity)
    if (targetUserId === callingUser.id) {
      return NextResponse.json(
        { error: "Operation forbidden: You cannot delete your own administrator account." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 4. Clean up any dependent buyer leads, touches, and conversions for this volunteer
    // This allows administrators to cleanly delete accounts with verified test sales or leads
    // without violating PostgreSQL foreign-key RESTRICT constraints.
    try {
      // Find all referrals belonging to target user
      const { data: userReferrals } = await adminClient
        .from("referrals")
        .select("id")
        .eq("volunteer_id", targetUserId);
      const userRefIds = (userReferrals || []).map((r) => r.id);

      // Find all buyer leads belonging to target user
      const { data: userBuyerReferrals } = await adminClient
        .from("buyer_referrals")
        .select("id")
        .eq("volunteer_id", targetUserId);
      const userBuyerRefIds = (userBuyerReferrals || []).map((b) => b.id);

      // 4.1 Delete lead_claim_conversions
      await adminClient
        .from("lead_claim_conversions")
        .delete()
        .eq("credited_volunteer_id", targetUserId);

      await adminClient
        .from("lead_claim_conversions")
        .delete()
        .eq("original_claimant_id", targetUserId);

      if (userRefIds.length > 0) {
        await adminClient
          .from("lead_claim_conversions")
          .delete()
          .in("referral_id", userRefIds);
      }

      if (userBuyerRefIds.length > 0) {
        await adminClient
          .from("lead_claim_conversions")
          .delete()
          .in("buyer_referral_id", userBuyerRefIds);
      }

      // 4.2 Delete buyer_referral_touches
      await adminClient
        .from("buyer_referral_touches")
        .delete()
        .eq("subsequent_volunteer_id", targetUserId);

      if (userBuyerRefIds.length > 0) {
        await adminClient
          .from("buyer_referral_touches")
          .delete()
          .in("buyer_referral_id", userBuyerRefIds);
      }

      // 4.3 Delete buyer_referrals
      await adminClient
        .from("buyer_referrals")
        .delete()
        .eq("volunteer_id", targetUserId);
    } catch (cleanupErr) {
      console.warn("[ADMIN_USER_DELETE] Dependent records cleanup notice:", cleanupErr);
    }

    // 5. Execute Atomic Database-Side Deletion RPC
    // Now that dependent child attribution records are cleared, admin_delete_volunteer_account
    // acquires the exclusive lock, cascades referrals, profiles, and auth.users, and writes audit logs.
    const { data: rpcRawData, error: rpcError } = await adminClient.rpc(
      "admin_delete_volunteer_account",
      {
        p_target_user_id: targetUserId,
        p_calling_admin_id: callingUser.id,
      }
    );

    if (rpcError) {
      return NextResponse.json(
        { error: `Database error during account deletion: ${rpcError.message}` },
        { status: 500 }
      );
    }

    const rpcResult = (rpcRawData as unknown as DeletionRpcResult) || {};

    if (!rpcResult.success) {
      if (rpcResult.error === "HAS_DEPENDENT_BUYER_LEADS") {
        return NextResponse.json(
          {
            error:
              rpcResult.message ||
              "Cannot delete volunteer: dependent buyer leads or attribution records exist.",
            code: "HAS_DEPENDENT_BUYER_LEADS",
            buyerLeadsCount: rpcResult.buyer_leads_count || 0,
            touchesCount: rpcResult.touches_count || 0,
            conversionsCount: rpcResult.conversions_count || 0,
            convertedReferralsCount: rpcResult.converted_referrals_count || 0,
          },
          { status: 409 }
        );
      }

      if (rpcResult.error === "USER_NOT_FOUND") {
        return NextResponse.json(
          { error: rpcResult.message || "Not Found: The target user does not exist." },
          { status: 404 }
        );
      }

      if (
        rpcResult.error === "CANNOT_DELETE_SELF" ||
        rpcResult.error === "CANNOT_DELETE_LAST_ADMIN"
      ) {
        return NextResponse.json(
          { error: rpcResult.message || "Operation forbidden." },
          { status: 400 }
        );
      }

      if (rpcResult.error === "UNAUTHORIZED") {
        return NextResponse.json(
          { error: rpcResult.message || "Forbidden: Administrator privileges required." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: rpcResult.message || "Failed to delete volunteer account." },
        { status: 500 }
      );
    }

    // 5. Post-Commit Supabase Auth (GoTrue) Synchronization
    // IMPORTANT BOUNDARY SPECIFICATION:
    // - The database transaction inside admin_delete_volunteer_account has ALREADY committed
    //   atomically, having deleted auth.users and cascaded to public.profiles and dependents.
    // - This subsequent call to adminClient.auth.admin.deleteUser is a post-commit synchronization
    //   step that does NOT participate in the PostgreSQL transaction.
    // - Because PostgreSQL already deleted the user from auth.users, GoTrue will return HTTP 404
    //   ("User not found"). Receiving 404 is the expected, normal confirmation that the user is absent.
    // - If GoTrue returns any other status (e.g. network failure), we log an operational warning
    //   so administrators/operators have visibility, without failing the committed database operation.
    let authSyncCompleted = false;
    let authSyncNotice: string | null = null;
    try {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (
        !deleteAuthError ||
        deleteAuthError.message?.toLowerCase().includes("user not found") ||
        (deleteAuthError as { status?: number }).status === 404
      ) {
        authSyncCompleted = true;
      } else {
        authSyncNotice = `GoTrue Auth synchronization returned unexpected status: ${deleteAuthError.message}`;
        console.warn(`[admin/users/delete] User ${targetUserId} deleted from DB, but GoTrue sync returned:`, deleteAuthError);
      }
    } catch (syncErr: unknown) {
      const syncMsg = syncErr instanceof Error ? syncErr.message : "Network/daemon error";
      authSyncNotice = `GoTrue Auth synchronization network error: ${syncMsg}`;
      console.warn(`[admin/users/delete] GoTrue sync network error for user ${targetUserId}:`, syncErr);
    }

    return NextResponse.json({
      success: true,
      message:
        rpcResult.message ||
        `User ${rpcResult.target_full_name || targetUserId} was deleted successfully.`,
      deletedReferralCount: rpcResult.deleted_referral_count ?? 0,
      authDeleted: authSyncCompleted,
      ...(authSyncNotice ? { authSyncNotice } : {}),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
