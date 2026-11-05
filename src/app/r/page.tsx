import React from "react";
import { BuyerCaptureForm } from "@/components/referrals/BuyerCaptureForm";
import { HeroParticleNetwork } from "@/components/HeroParticleNetwork";

export const dynamic = "force-dynamic";

export default function GeneralReferralEntryPage() {
  return (
    <div className="relative min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <HeroParticleNetwork />

      <div className="relative z-10 w-full max-w-lg">
        <BuyerCaptureForm
          initialCode=""
          volunteerName={null}
          isDirectLink={false}
        />
      </div>
    </div>
  );
}
