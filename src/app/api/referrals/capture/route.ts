import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { getClientIp, deriveIpHash, deriveEmailHash } from "@/lib/referrals/telemetry";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      fullName,
      email,
      referralCode,
      ticketQuantity = 1,
      phone = null,
      sourceAttribution = null,
    } = body;

    // 1. Rigorous Input Validation
    const cleanName = typeof fullName === "string" ? fullName.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";
    const qty = ticketQuantity === undefined ? 1 : Number(ticketQuantity);

    if (!cleanName || cleanName.length < 2) {
      return NextResponse.json(
        { success: false, error: "INVALID_NAME", message: "Please provide a valid full name (min 2 characters)." },
        { status: 400 }
      );
    }

    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      return NextResponse.json(
        { success: false, error: "INVALID_EMAIL", message: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 36) {
      return NextResponse.json(
        { success: false, error: "INVALID_REFERRAL_CODE", message: "Please enter a valid referral code." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(qty) || qty < 1 || qty > 5) {
      return NextResponse.json(
        { success: false, error: "INVALID_QUANTITY", message: "Ticket quantity must be between 1 and 5." },
        { status: 400 }
      );
    }

    // 2. Compute Privacy-Preserving Hashes
    const clientIp = getClientIp(request.headers);
    const ipHash = deriveIpHash(clientIp);
    const emailHash = deriveEmailHash(cleanEmail);

    // 3. Invoke Privileged Capture RPC
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.rpc("capture_buyer_referral", {
      p_buyer_name: cleanName,
      p_buyer_email: cleanEmail,
      p_referral_code: cleanCode,
      p_ticket_quantity: qty,
      p_buyer_phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      p_source_attribution:
        typeof sourceAttribution === "string" && sourceAttribution.trim()
          ? sourceAttribution.trim()
          : null,
      p_ip_hash: ipHash,
      p_email_hash: emailHash,
    });

    if (error) {
      console.error("[CAPTURE_API] Database error:", error.message);
      return NextResponse.json(
        { success: false, error: "DATABASE_ERROR", message: "Failed to record referral. Please try again." },
        { status: 500 }
      );
    }

    if (!data || !data.success) {
      const errCode = data?.error || "CAPTURE_FAILED";
      const statusMap: Record<string, number> = {
        IP_RATE_LIMIT_EXCEEDED: 429,
        EMAIL_RATE_LIMIT_EXCEEDED: 429,
        INVALID_REFERRAL_CODE: 400,
        INVALID_EMAIL: 400,
        INVALID_NAME: 400,
      };
      const statusCode = statusMap[errCode] || 400;

      const userMessages: Record<string, string> = {
        IP_RATE_LIMIT_EXCEEDED: "Too many submission attempts from your network. Please wait a bit before trying again.",
        EMAIL_RATE_LIMIT_EXCEEDED: "Too many attempts for this email address. Please try again in an hour.",
        INVALID_REFERRAL_CODE: "The specified volunteer referral code could not be found.",
        INVALID_EMAIL: "The provided email address is invalid.",
        INVALID_NAME: "The provided name is invalid.",
      };

      return NextResponse.json(
        {
          success: false,
          error: errCode,
          message: userMessages[errCode] || "Referral submission could not be completed.",
        },
        { status: statusCode }
      );
    }

    // 4. Resolve Canonical Credited Volunteer Name for Safe Confirmation
    let creditedVolunteerName: string | null = null;
    if (data.volunteer_id) {
      try {
        const { data: creditedProfile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", data.volunteer_id)
          .maybeSingle();

        if (creditedProfile?.full_name) {
          creditedVolunteerName = creditedProfile.full_name;
        }
      } catch (profErr) {
        console.warn("[CAPTURE_API] Could not resolve credited volunteer name:", profErr);
      }
    }

    // 5. Return Success Payload with Safe Official Ticket Destination
    return NextResponse.json({
      success: true,
      status: data.status,
      leadId: data.lead_id,
      volunteerId: data.volunteer_id,
      referralCode: data.referral_code,
      creditedVolunteerName,
      redirectUrl: CONFERENCE_CONFIG.ticketUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (message.includes("REFERRAL_CAPTURE_SECRET")) {
      console.error("[CAPTURE_API] Configuration error:", message);
      return NextResponse.json(
        { success: false, error: "SERVER_CONFIG_ERROR", message: "Server security configuration error. Please contact support." },
        { status: 500 }
      );
    }
    console.error("[CAPTURE_API] Unexpected error:", message);
    return NextResponse.json(
      { success: false, error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
