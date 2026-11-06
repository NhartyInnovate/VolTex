import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Query leads with volunteer profile info
    const { data: leads, error: leadsError } = await supabase
      .from("buyer_referrals")
      .select(`
        id,
        volunteer_id,
        referral_code,
        buyer_name,
        buyer_email,
        buyer_phone,
        ticket_quantity,
        source_attribution,
        status,
        conversion_count,
        first_converted_at,
        last_converted_at,
        expires_at,
        created_at,
        profiles:profiles!volunteer_id (
          full_name,
          volunteer_team
        )
      `)
      .order("created_at", { ascending: false });

    if (leadsError) {
      console.error("[ADMIN_LEADS] Fetch error:", leadsError.message);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    // Safely normalize profiles to a single object or null
    const formattedLeads = (leads || []).map((lead: any) => ({
      ...lead,
      profiles: Array.isArray(lead.profiles)
        ? lead.profiles[0] || null
        : lead.profiles || null,
    }));

    return NextResponse.json({ leads: formattedLeads });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
