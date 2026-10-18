import React from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { MOCK_PUBLIC_LEADERBOARD } from "@/data/mock-data";
import { LeaderboardTable } from "@/components/LeaderboardTable";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-24">
      {/* 1. Hero Section */}
      <section className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Volunteer Ticket Challenge
          </h1>
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
            Help bring more people to TEDxGwarinpa. Share tickets, track verified
            referrals, and earn recognition for your contribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/auth/register"
            className="text-xs font-semibold px-4 py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred text-white transition-colors"
          >
            Join the Challenge
          </Link>
          <a
            href={CONFERENCE_CONFIG.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-4 py-2.5 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            Buy Tickets ↗
          </a>
        </div>
      </section>

      {/* 2. Section 1: How It Works */}
      <section id="overview" className="space-y-8 pt-6 border-t border-zinc-800/80">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            How It Works
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Three simple steps to participate and track your ticket referrals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-zinc-800/80 rounded p-5 bg-[#111114] space-y-2">
            <span className="font-mono text-xs text-zinc-500 font-semibold">01</span>
            <h3 className="text-sm font-semibold text-white">Promote Tickets</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Use pre-drafted promotional messages and your official conference link to invite your community.
            </p>
          </div>

          <div className="border border-zinc-800/80 rounded p-5 bg-[#111114] space-y-2">
            <span className="font-mono text-xs text-zinc-500 font-semibold">02</span>
            <h3 className="text-sm font-semibold text-white">Report Referrals</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Submit buyer names, ticket counts, and order references via your dashboard. Submissions start as Pending.
            </p>
          </div>

          <div className="border border-zinc-800/80 rounded p-5 bg-[#111114] space-y-2">
            <span className="font-mono text-xs text-zinc-500 font-semibold">03</span>
            <h3 className="text-sm font-semibold text-white">Earn Verified Points</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Admins reconcile purchases against Meeteor Hub. Points and leaderboard ranks update automatically upon verification.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Section 2: Scoring and Leaderboard */}
      <section id="leaderboard" className="space-y-8 pt-6 border-t border-zinc-800/80">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Scoring & Leaderboard
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Points are calculated strictly from verified, paid ticket records.
            </p>
          </div>

          {/* Direct Scoring Model Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="border border-zinc-800/80 rounded p-4 bg-[#111114]">
              <div className="font-semibold text-white mb-1">
                1 Point = 2 Verified Tickets
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Every pair of paid delegate tickets confirmed on Meeteor Hub awards one official point.
              </p>
            </div>
            <div className="border border-zinc-800/80 rounded p-4 bg-[#111114]">
              <div className="font-semibold text-white mb-1">
                Odd-Ticket Carryover
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Odd ticket balances carry over toward your next point (e.g. 3 verified tickets = 1 point and 1 carryover ticket).
              </p>
            </div>
          </div>
        </div>

        {/* Public Leaderboard */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-zinc-300">
            Current Standings
          </div>
          <LeaderboardTable entries={MOCK_PUBLIC_LEADERBOARD} isDemoData={true} />
        </div>
      </section>

      {/* 4. Section 3: Join the Challenge */}
      <section className="space-y-6 pt-6 border-t border-zinc-800/80 pb-6">
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
            className="text-xs font-semibold px-4 py-2 rounded bg-tedx-red hover:bg-tedx-darkred text-white transition-colors"
          >
            Register as Volunteer
          </Link>
          <Link
            href="/auth/login"
            className="text-xs font-medium px-4 py-2 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            Sign In to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
