import React from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { BuyerCaptureForm } from "@/components/referrals/BuyerCaptureForm";
import { HeroParticleNetwork } from "@/components/HeroParticleNetwork";

export const dynamic = "force-dynamic";

interface GeneralReferralPageProps {
  searchParams?: {
    code?: string;
    ref?: string;
    referralCode?: string;
  };
}

export default async function GeneralReferralEntryPage({ searchParams }: GeneralReferralPageProps) {
  const queryCode = (
    searchParams?.code ||
    searchParams?.ref ||
    searchParams?.referralCode ||
    ""
  ).trim().toUpperCase();

  let volunteerName: string | null = null;
  let isDirectLink = false;

  if (queryCode) {
    try {
      const supabaseAdmin = createAdminClient();
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .ilike("referral_code", queryCode)
        .maybeSingle();

      if (profile) {
        volunteerName = profile.full_name;
        isDirectLink = true;
      }
    } catch (err) {
      console.warn("[REFERRAL_QUERY] Failed to resolve volunteer from query param:", err);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <HeroParticleNetwork />

      <div className="relative z-10 w-full max-w-lg">
        <BuyerCaptureForm
          key={queryCode || "general-referral"}
          initialCode={queryCode}
          volunteerName={volunteerName}
          isDirectLink={isDirectLink}
        />
      </div>
    </div>
  );
}
