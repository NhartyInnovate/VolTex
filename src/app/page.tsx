import React from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { MOCK_PUBLIC_LEADERBOARD } from "@/data/mock-data";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { MotionReveal } from "@/components/MotionReveal";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-24">
      {/* 1. Hero Section with Timed Entrance and Signature Movement */}
      <section className="space-y-6">
        {/* Category Header */}
        <div className="overflow-hidden">
          <span className="inline-block font-mono text-[11px] text-zinc-500 uppercase tracking-widest animate-hero-line-1">
            TEDxGwarinpa Volunteer Operations
          </span>
        </div>

        {/* Progressive Headline Reveal (Line by Line) */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            <span className="block overflow-hidden pb-1">
              <span className="inline-block animate-hero-line-1">
                Volunteer
              </span>
            </span>
            <span className="block overflow-hidden">
              <span className="inline-block animate-hero-line-2">
                Ticket Challenge
              </span>
            </span>
          </h1>

          {/* Signature Editorial Accent Line */}
          <div className="relative w-24 sm:w-32 h-[2px] bg-zinc-800/80 overflow-hidden rounded-full my-2">
            <div className="absolute inset-y-0 left-0 w-full bg-tedx-red origin-left animate-accent-expand" />
            <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-editorial-sweep" />
          </div>

          {/* Supporting Copy */}
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed animate-hero-sub pt-1">
            Help bring more people to TEDxGwarinpa. Share tickets, track verified
            referrals, and earn recognition for your contribution.
          </p>
        </div>

        {/* Action CTAs (Staggered Entrance) */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="inline-block animate-hero-cta-1">
            <Link
              href="/auth/register"
              className="text-xs font-semibold px-4 py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.97] text-white transition-all duration-150 inline-block shadow-xs"
            >
              Join the Challenge
            </Link>
          </div>
          <div className="inline-block animate-hero-cta-2">
            <a
              href={CONFERENCE_CONFIG.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium px-4 py-2.5 rounded border border-zinc-800 hover:border-zinc-700 active:scale-[0.97] text-zinc-300 hover:text-white transition-all duration-150 inline-block"
            >
              Buy Tickets ↗
            </a>
          </div>
        </div>
      </section>

      {/* 2. Section 1: How It Works (Scroll-Triggered Reveals with Distinct Card Delays) */}
      <section id="overview" className="space-y-8 pt-6 border-t border-zinc-800/80">
        <MotionReveal className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-white">
            How It Works
          </h2>
          <p className="text-xs text-zinc-400">
            Three simple steps to participate and track your ticket referrals.
          </p>
        </MotionReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MotionReveal
            delay={100}
            className="border border-zinc-800/80 rounded p-5 bg-[#111114] space-y-2 hover:border-zinc-700/80 transition-colors"
          >
            <span className="font-mono text-xs text-zinc-500 font-semibold">01</span>
            <h3 className="text-sm font-semibold text-white">Promote Tickets</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Use pre-drafted promotional messages and your official conference link to invite your community.
            </p>
          </MotionReveal>

          <MotionReveal
            delay={260}
            className="border border-zinc-800/80 rounded p-5 bg-[#111114] space-y-2 hover:border-zinc-700/80 transition-colors"
          >
            <span className="font-mono text-xs text-zinc-500 font-semibold">02</span>
            <h3 className="text-sm font-semibold text-white">Report Referrals</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Submit buyer names, ticket counts, and order references via your dashboard. Submissions start as Pending.
            </p>
          </MotionReveal>

          <MotionReveal
            delay={420}
            className="border border-zinc-800/80 rounded p-5 bg-[#111114] space-y-2 hover:border-zinc-700/80 transition-colors"
          >
            <span className="font-mono text-xs text-zinc-500 font-semibold">03</span>
            <h3 className="text-sm font-semibold text-white">Earn Verified Points</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Admins reconcile purchases against Meeteor Hub. Points and leaderboard ranks update automatically upon verification.
            </p>
          </MotionReveal>
        </div>
      </section>

      {/* 3. Section 2: Scoring and Leaderboard */}
      <section id="leaderboard" className="space-y-8 pt-6 border-t border-zinc-800/80">
        <MotionReveal delay={100} className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Scoring & Leaderboard
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Points are calculated strictly from verified, paid ticket records under a provisional development model pending final committee ratification.
            </p>
          </div>

          {/* Direct Scoring Model Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="border border-zinc-800/80 rounded p-4 bg-[#111114] hover:border-zinc-700/80 transition-colors">
              <div className="font-semibold text-white mb-1">
                1 Point = 2 Verified Tickets (Provisional)
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Every pair of paid delegate tickets confirmed on Meeteor Hub awards one official point.
              </p>
            </div>
            <div className="border border-zinc-800/80 rounded p-4 bg-[#111114] hover:border-zinc-700/80 transition-colors">
              <div className="font-semibold text-white mb-1">
                Odd-Ticket Carryover (Provisional)
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Odd ticket balances carry over toward your next point (e.g. 3 verified tickets = 1 point and 1 carryover ticket).
              </p>
            </div>
          </div>
        </MotionReveal>

        {/* Public Leaderboard */}
        <MotionReveal delay={250} className="space-y-3">
          <div className="text-xs font-semibold text-zinc-300">
            Current Standings
          </div>
          <LeaderboardTable entries={MOCK_PUBLIC_LEADERBOARD} isDemoData={true} />
        </MotionReveal>
      </section>

      {/* 4. Section 3: Join the Challenge */}
      <section className="pt-6 border-t border-zinc-800/80 pb-6">
        <MotionReveal delay={100} className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Join the Challenge
            </h2>
            <p className="text-xs text-zinc-400 max-w-lg leading-relaxed">
              Register your volunteer profile to access your dashboard, ready-to-share promotional resources, and referral reporting tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/auth/register"
              className="text-xs font-semibold px-4 py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.97] text-white transition-all duration-150 shadow-xs"
            >
              Register as Volunteer
            </Link>
            <Link
              href="/auth/login"
              className="text-xs font-medium px-4 py-2 rounded border border-zinc-800 hover:border-zinc-700 active:scale-[0.97] text-zinc-300 hover:text-white transition-all duration-150"
            >
              Sign In to Dashboard
            </Link>
          </div>
        </MotionReveal>
      </section>
    </div>
  );
}
