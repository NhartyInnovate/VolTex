import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // 1. Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Authorize admin role
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
      referralId,
      ticketQuantity,
      adminNotes = null,
      attributionResolution = "award_to_referrer",
      forceEmailOverride = false,
    } = body;

    if (!buyerReferralId) {
      return NextResponse.json(
        { success: false, error: "MISSING_PARAMETERS", message: "buyerReferralId is required" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // -------------------------------------------------------------------------
    // DIRECT LEAD CONVERSION (No referralId / UUID required)
    // Directly verifies the attendee against Meeteor roster and awards points
    // -------------------------------------------------------------------------
    if (!referralId) {
      // 1. Fetch Lead Record
      const { data: lead, error: leadError } = await adminClient
        .from("buyer_referrals")
        .select(`
          id,
          volunteer_id,
          referral_code,
          buyer_name,
          buyer_email,
          buyer_phone,
          ticket_quantity,
          status,
          conversion_count,
          first_converted_at
        `)
        .eq("id", buyerReferralId)
        .single();

      if (leadError || !lead) {
        return NextResponse.json(
          { success: false, error: "LEAD_NOT_FOUND", message: "Buyer lead not found" },
          { status: 404 }
        );
      }

      if (lead.status === "expired") {
        return NextResponse.json(
          { success: false, error: "LEAD_EXPIRED", message: "Cannot convert an expired lead. Please reopen it first." },
          { status: 400 }
        );
      }

      const qty = Math.max(1, Math.min(50, Number(ticketQuantity) || Number(lead.ticket_quantity) || 1));
      const noteText = typeof adminNotes === "string" && adminNotes.trim()
        ? adminNotes.trim()
        : "Verified attendee payment on Meeteor Hub";

      // 2. Insert Approved Referral into public.referrals
      const { data: newReferral, error: refError } = await adminClient
        .from("referrals")
        .insert({
          volunteer_id: lead.volunteer_id,
          buyer_name: lead.buyer_name,
          buyer_identifier: lead.buyer_email,
          ticket_type: "Regular / Delegate Ticket",
          ticket_quantity: qty,
          status: "approved",
          verified_at: new Date().toISOString(),
          verified_by: user.id,
          admin_notes: noteText,
        })
        .select("id")
        .single();

      if (refError || !newReferral) {
        console.error("[ADMIN_DIRECT_CONVERT] Referral creation error:", refError?.message);
        return NextResponse.json(
          { success: false, error: "REFERRAL_CREATION_FAILED", message: refError?.message || "Failed to create ticket claim" },
          { status: 400 }
        );
      }

      // 3. Link Conversion in public.lead_claim_conversions
      const { data: conversion, error: convError } = await adminClient
        .from("lead_claim_conversions")
        .insert({
          buyer_referral_id: lead.id,
          referral_id: newReferral.id,
          original_claimant_id: lead.volunteer_id,
          credited_volunteer_id: lead.volunteer_id,
          attribution_resolution: "award_to_referrer",
          email_override_applied: false,
          admin_notes: noteText,
          converted_by: user.id,
        })
        .select("id")
        .single();

      if (convError) {
        console.warn("[ADMIN_DIRECT_CONVERT] Conversion link notice:", convError.message);
      }

      // 4. Update buyer_referrals status & conversion counters
      const newCount = (lead.conversion_count || 0) + 1;
      await adminClient
        .from("buyer_referrals")
        .update({
          status: "converted",
          conversion_count: newCount,
          first_converted_at: lead.first_converted_at || new Date().toISOString(),
          last_converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      // 5. Audit Log
      await adminClient
        .from("audit_logs")
        .insert({
          actor_id: user.id,
          referral_id: newReferral.id,
          action: "DIRECT_LEAD_CONVERSION",
          previous_status: null,
          new_status: "approved",
          notes: `Direct Meeteor roster approval for lead ${lead.id} (${lead.buyer_email}). Credited ${qty} ticket(s) to volunteer ${lead.volunteer_id}. Note: ${noteText}`,
        });

      return NextResponse.json({
        success: true,
        conversionId: conversion?.id || null,
        referralId: newReferral.id,
        creditedVolunteerId: lead.volunteer_id,
        conversionCount: newCount,
        ticketsCredited: qty,
        pointsAwarded: qty * 5,
      });
    }

    // -------------------------------------------------------------------------
    // LEGACY MATCH (When referralId is explicitly provided)
    // -------------------------------------------------------------------------
    const { data, error } = await supabase.rpc("convert_buyer_lead", {
      p_buyer_referral_id: buyerReferralId,
      p_referral_id: referralId,
      p_attribution_resolution: attributionResolution,
      p_force_email_override: Boolean(forceEmailOverride),
      p_admin_notes: typeof adminNotes === "string" ? adminNotes.trim() : null,
    });

    if (error) {
      console.error("[ADMIN_CONVERT_LEAD] RPC error:", error.message);
      return NextResponse.json(
        { success: false, error: "CONVERSION_FAILED", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      conversionId: data?.conversion_id,
      creditedVolunteerId: data?.credited_volunteer_id,
      conversionCount: data?.conversion_count,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[ADMIN_CONVERT_LEAD] Unexpected error:", message);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message },
      { status: 500 }
    );
  }
}
