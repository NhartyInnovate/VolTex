import React from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isBotUserAgent, isPrefetchRequest } from "@/lib/referrals/telemetry";
import { BuyerCaptureForm } from "@/components/referrals/BuyerCaptureForm";
import { HeroParticleNetwork } from "@/components/HeroParticleNetwork";

export const dynamic = "force-dynamic";

interface ReferralLandingPageProps {
  params: {
    code: string;
  };
}

export default async function ReferralLandingPage({ params }: ReferralLandingPageProps) {
  const rawCode = params.code?.trim().toUpperCase() || "";

  if (!rawCode) {
    notFound();
  }

  const reqHeaders = headers();
  const isPrefetch = isPrefetchRequest(reqHeaders);
  const userAgent = reqHeaders.get("user-agent") || "";
  const isBot = isBotUserAgent(userAgent);

  let volunteerName: string | null = null;
  let isValidCode = true;

  try {
    const supabaseAdmin = createAdminClient();

    // 1. Record Top-of-Funnel Ingress (Skipped for prefetch requests)
    if (!isPrefetch) {
      await supabaseAdmin.rpc("record_raw_link_request", {
        p_referral_code: rawCode,
        p_is_bot: isBot,
      });
    }

    // 2. Resolve Volunteer Profile for Welcome Card
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .ilike("referral_code", rawCode)
      .maybeSingle();

    if (profile) {
      volunteerName = profile.full_name;
    } else {
      isValidCode = false;
    }
  } catch (err) {
    console.warn("[REFERRAL_INGRESS] Failed to resolve volunteer or log ingress:", err);
  }

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <HeroParticleNetwork />

      <div className="relative z-10 w-full max-w-lg">
        <BuyerCaptureForm
          initialCode={rawCode}
          volunteerName={volunteerName}
          isDirectLink={isValidCode}
        />
      </div>
    </div>
  );
}
