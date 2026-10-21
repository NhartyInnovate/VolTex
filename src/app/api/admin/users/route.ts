import { NextResponse } from "next/server";
import { createClient as createServerUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminManagedUser } from "@/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Returns a list of all registered users with profiles, email addresses,
 * submission counts, and creation dates.
 * Strictly protected: Authenticated Administrators Only.
 */
export async function GET() {
  try {
    // 1. Authenticate calling user using server session client
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

    // 2. Revalidate calling user's admin role from trusted public.profiles table
    const { data: callerProfile, error: callerProfileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", callingUser.id)
      .single();

    if (callerProfileError || !callerProfile || callerProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Administrator permissions required." },
        { status: 403 }
      );
    }

    // Check if service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: "Server configuration missing: SUPABASE_SERVICE_ROLE_KEY is required to manage Auth users.",
          code: "MISSING_SERVICE_ROLE_KEY"
        },
        { status: 503 }
      );
    }

    // 3. Initialize Admin Client to access auth.users
    const adminClient = createAdminClient();

    // 4. Fetch all profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, full_name, phone_number, volunteer_team, role, created_at")
      .order("created_at", { ascending: false });

    if (profilesError) {
      return NextResponse.json(
        { error: `Failed to fetch profiles: ${profilesError.message}` },
        { status: 500 }
      );
    }

    // 5. Fetch all auth users with automatic pagination loop to prevent silent omission
    const authMap = new Map<string, { email: string; createdAt: string }>();
    let page = 1;
    const perPage = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: authPageData, error: authUsersError } =
        await adminClient.auth.admin.listUsers({ page, perPage });

      if (authUsersError) {
        return NextResponse.json(
          { error: `Failed to fetch auth accounts: ${authUsersError.message}` },
          { status: 500 }
        );
      }

      const pageUsers = authPageData?.users || [];
      pageUsers.forEach((u) => {
        authMap.set(u.id, {
          email: u.email || "",
          createdAt: u.created_at,
        });
      });

      if (pageUsers.length < perPage) {
        hasMore = false;
      } else {
        page += 1;
      }
    }

    // 6. Fetch referral submission counts per user
    const { data: referrals, error: referralsError } = await adminClient
      .from("referrals")
      .select("volunteer_id, ticket_quantity, status");

    if (referralsError) {
      return NextResponse.json(
        { error: `Failed to fetch referral counts: ${referralsError.message}` },
        { status: 500 }
      );
    }

    const referralCounts = new Map<string, { count: number; approvedTickets: number }>();
    (referrals || []).forEach((r) => {
      const existing = referralCounts.get(r.volunteer_id) || { count: 0, approvedTickets: 0 };
      existing.count += 1;
      if (r.status === "approved") {
        existing.approvedTickets += r.ticket_quantity || 1;
      }
      referralCounts.set(r.volunteer_id, existing);
    });

    // 7. Combine into AdminManagedUser objects
    const managedUsers: AdminManagedUser[] = (profiles || []).map((p) => {
      const authInfo = authMap.get(p.id);
      const subInfo = referralCounts.get(p.id) || { count: 0, approvedTickets: 0 };
      return {
        id: p.id,
        email: authInfo?.email || "",
        fullName: p.full_name,
        phoneNumber: p.phone_number || undefined,
        volunteerTeam: p.volunteer_team,
        role: p.role,
        createdAt: authInfo?.createdAt || p.created_at,
        referralCount: subInfo.count,
        approvedTickets: subInfo.approvedTickets,
      };
    });

    return NextResponse.json({
      users: managedUsers,
      totalCount: managedUsers.length,
      currentAdminId: callingUser.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
