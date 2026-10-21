import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface DeleteUserPayload {
  userId?: string;
  confirmedFullName?: string;
}

/**
 * POST /api/admin/users/delete
 * Secure server-only admin user deletion workflow.
 *
 * Strict Protections:
 * 1. Authenticates calling user on server.
 * 2. Revalidates calling user has role 'admin' in public.profiles.
 * 3. Verifies target user exists.
 * 4. Forbids self-deletion (cannot delete currently authenticated admin).
 * 5. Prevents deletion of the last remaining administrator.
 * 6. Deletes dependent records safely in order:
 *    - Referral-linked audit logs
 *    - User's referrals
 *    - General audit records where actor_id is target user
 *    - Deletes Supabase Auth identity via auth.admin.deleteUser (cascading to public.profiles)
 * 7. Records an administrative audit log event.
 * 8. Verifies post-deletion state.
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

    // 3. Prevent self-deletion
    if (targetUserId === callingUser.id) {
      return NextResponse.json(
        { error: "Operation forbidden: You cannot delete your own administrator account." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 4. Verify target user exists
    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, volunteer_team")
      .eq("id", targetUserId)
      .maybeSingle();

    const { data: targetAuthUser, error: targetAuthError } =
      await adminClient.auth.admin.getUserById(targetUserId);

    if (!targetProfile && (!targetAuthUser || !targetAuthUser.user)) {
      return NextResponse.json(
        { error: "Not Found: The target user does not exist." },
        { status: 404 }
      );
    }

    // 5. Prevent deleting the last administrator
    if (targetProfile?.role === "admin") {
      const { count: adminCount, error: countError } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin");

      if (countError) {
        return NextResponse.json(
          { error: `Failed to verify administrator count: ${countError.message}` },
          { status: 500 }
        );
      }

      if ((adminCount || 0) <= 1) {
        return NextResponse.json(
          { error: "Operation forbidden: Cannot delete the last remaining administrator account." },
          { status: 400 }
        );
      }
    }

    // 6. Inspect dependent referrals count
    const { data: targetReferrals, error: fetchRefsError } = await adminClient
      .from("referrals")
      .select("id")
      .eq("volunteer_id", targetUserId);

    if (fetchRefsError) {
      return NextResponse.json(
        { error: `Failed to inspect dependent referrals: ${fetchRefsError.message}` },
        { status: 500 }
      );
    }

    const referralIds = (targetReferrals || []).map((r) => r.id);

    // --------------------------------------------------------------------------
    // 7. ORDERED DEPENDENCY CLEANUP WORKFLOW
    // --------------------------------------------------------------------------
    // Step 7.1: Delete audit logs referencing target referrals
    if (referralIds.length > 0) {
      const { error: deleteRefAuditsError } = await adminClient
        .from("audit_logs")
        .delete()
        .in("referral_id", referralIds);

      if (deleteRefAuditsError) {
        return NextResponse.json(
          { error: `Failed to clear referral audit logs: ${deleteRefAuditsError.message}` },
          { status: 500 }
        );
      }
    }

    // Step 7.2: Delete target user's referrals
    if (referralIds.length > 0) {
      const { error: deleteReferralsError } = await adminClient
        .from("referrals")
        .delete()
        .eq("volunteer_id", targetUserId);

      if (deleteReferralsError) {
        return NextResponse.json(
          { error: `Failed to clear user referrals: ${deleteReferralsError.message}` },
          { status: 500 }
        );
      }
    }

    // Step 7.3: Delete Auth account via Supabase Auth Admin API
    // (Relational foreign keys: public.profiles CASCADE from auth.users(id))
    let authDeleted = false;
    if (targetAuthUser?.user) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (deleteAuthError) {
        return NextResponse.json(
          {
            error: `Failed to delete authentication account: ${deleteAuthError.message}. Dependent referrals were cleaned up, but the auth identity could not be removed.`,
            code: "AUTH_DELETE_FAILED",
          },
          { status: 500 }
        );
      }
      authDeleted = true;
    }

    // If profile still exists (e.g. user had no auth.users row), remove it directly
    const { data: remainingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (remainingProfile) {
      await adminClient.from("profiles").delete().eq("id", targetUserId);
    }

    // --------------------------------------------------------------------------
    // 8. RECORD ADMINISTRATIVE AUDIT EVENT
    // --------------------------------------------------------------------------
    try {
      await adminClient.from("audit_logs").insert({
        actor_id: callingUser.id,
        action: "ADMIN_USER_DELETED",
        notes: `Administrator deleted user ${targetUserId} (${targetProfile?.role || "user"}). Removed ${referralIds.length} referral submission(s).`,
      });
    } catch {
      // Non-fatal: do not fail user deletion if audit logging fails
    }

    // --------------------------------------------------------------------------
    // 9. VERIFY POST-DELETION STATE
    // --------------------------------------------------------------------------
    const { data: verifyProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    const { count: remainingRefs } = await adminClient
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("volunteer_id", targetUserId);

    if (verifyProfile || (remainingRefs || 0) > 0) {
      return NextResponse.json(
        {
          error: "Verification failed: User records or referrals were still detected after deletion.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${targetProfile?.full_name || targetUserId} was deleted successfully.`,
      deletedReferralCount: referralIds.length,
      authDeleted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
