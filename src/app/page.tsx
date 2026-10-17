import React from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { MOCK_PUBLIC_LEADERBOARD } from "@/data/mock-data";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import {
  Ticket,
  Trophy,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Share2,
  CheckCircle2,
  TrendingUp,
  Award,
  Users,
  Flame,
  ExternalLink,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="space-y-24 pb-20 overflow-hidden">
      {/* 1. Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-tedx-red/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300">
            <span className="flex h-2 w-2 rounded-full bg-tedx-red animate-pulse" />
            <span>{CONFERENCE_CONFIG.name} • {CONFERENCE_CONFIG.edition}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-tedx-lightred flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              Volunteer Ticket Challenge
            </span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]">
            Spread Big Ideas. <br />
            <span className="tedx-gradient-text">Top the Leaderboard.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Every ticket sold brings a passionate mind into the room. Promote conference tickets, report your verified buyer referrals, earn points, and win stage recognition at TEDxGwarinpa.
          </p>

          {/* CTAs */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white font-bold text-base shadow-tedx hover:shadow-tedx-lg transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Register as Volunteer
              <ArrowRight className="w-4 h-4" />
            </Link>

            <a
              href={CONFERENCE_CONFIG.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-base border border-zinc-800 hover:border-zinc-700 transition-all"
            >
              <Ticket className="w-4 h-4 text-tedx-red" />
              Buy Ticket on Meeteor
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </a>
          </div>

          {/* Quick Metrics Strip */}
          <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="tedx-surface rounded-xl p-4 text-center border-zinc-800">
              <span className="block text-2xl sm:text-3xl font-black text-white">
                1 pt
              </span>
              <span className="text-xs text-zinc-400 uppercase font-semibold">
                Per 2 Paid Tickets
              </span>
            </div>
            <div className="tedx-surface rounded-xl p-4 text-center border-zinc-800">
              <span className="block text-2xl sm:text-3xl font-black text-emerald-400">
                100%
              </span>
              <span className="text-xs text-zinc-400 uppercase font-semibold">
                Odd Ticket Carryover
              </span>
            </div>
            <div className="tedx-surface rounded-xl p-4 text-center border-zinc-800">
              <span className="block text-2xl sm:text-3xl font-black text-tedx-lightred">
                Live
              </span>
              <span className="text-xs text-zinc-400 uppercase font-semibold">
                Public Leaderboard
              </span>
            </div>
            <div className="tedx-surface rounded-xl p-4 text-center border-zinc-800">
              <span className="block text-2xl sm:text-3xl font-black text-amber-400">
                Meeteor
              </span>
              <span className="text-xs text-zinc-400 uppercase font-semibold">
                Verified Tracking
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Challenge Overview & How It Works */}
      <section id="overview" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <span className="text-xs uppercase tracking-widest font-black text-tedx-red">
            Four Simple Steps
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            How The Challenge Works
          </h2>
          <p className="text-zinc-400 text-sm">
            Designed for busy volunteers. Share your promo messaging, track who bought, and watch your rank climb.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Step 1 */}
          <div className="tedx-surface rounded-2xl p-6 border-zinc-800 space-y-4 relative group hover:border-tedx-red/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-lightred font-black text-lg">
              01
            </div>
            <h3 className="text-lg font-bold text-white">Get Outreach Kit</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Log into your volunteer portal to access ready-made WhatsApp blurbs, Instagram captions, and official ticket links.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-tedx-lightred font-semibold pt-2">
              <Share2 className="w-3.5 h-3.5" /> Ready-to-share copy
            </div>
          </div>

          {/* Step 2 */}
          <div className="tedx-surface rounded-2xl p-6 border-zinc-800 space-y-4 relative group hover:border-tedx-red/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-lightred font-black text-lg">
              02
            </div>
            <h3 className="text-lg font-bold text-white">Direct Buyers</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Share the official Meeteor ticket link with friends, colleagues, and community groups. Encourage them to secure their seat early.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-tedx-lightred font-semibold pt-2">
              <Ticket className="w-3.5 h-3.5" /> Official Meeteor Hub
            </div>
          </div>

          {/* Step 3 */}
          <div className="tedx-surface rounded-2xl p-6 border-zinc-800 space-y-4 relative group hover:border-tedx-red/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-lightred font-black text-lg">
              03
            </div>
            <h3 className="text-lg font-bold text-white">Report Referrals</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Submit buyer names, ticket type, and reference code. Submissions start as <span className="text-amber-400 font-semibold">Pending</span> until confirmed.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-tedx-lightred font-semibold pt-2">
              <TrendingUp className="w-3.5 h-3.5" /> Instant tracking
            </div>
          </div>

          {/* Step 4 */}
          <div className="tedx-surface rounded-2xl p-6 border-zinc-800 space-y-4 relative group hover:border-tedx-red/40 transition-all">
            <div className="w-12 h-12 rounded-xl bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-lightred font-black text-lg">
              04
            </div>
            <h3 className="text-lg font-bold text-white">Verified & Scored</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Admins reconcile payments with Meeteor records. Points are automatically calculated and your leaderboard rank updates.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-2">
              <CheckCircle2 className="w-3.5 h-3.5" /> Automatic scoring
            </div>
          </div>
        </div>
      </section>

      {/* 3. Scoring Rules Explainer */}
      <section id="rules" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="tedx-surface rounded-3xl p-8 sm:p-12 border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-tedx-red/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tedx-red/10 border border-tedx-red/30 text-xs font-bold text-tedx-lightred uppercase tracking-wider">
              Scoring Model
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Transparent, Fair, and Verified
            </h2>
            <p className="text-zinc-300 leading-relaxed text-sm sm:text-base">
              To reward consistent contribution and handle group purchases fairly, our scoring engine runs on an exact mathematical rule:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-black/60 border border-zinc-800 rounded-xl p-5 space-y-2">
                <div className="text-tedx-lightred font-black text-xl">
                  1 Point = 2 Verified Tickets
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every two paid tickets verified against Meeteor Hub award 1 official leaderboard point.
                </p>
              </div>

              <div className="bg-black/60 border border-zinc-800 rounded-xl p-5 space-y-2">
                <div className="text-emerald-400 font-black text-xl">
                  Zero Lost Tickets (Carryover)
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  If you have 1 verified ticket, it stays safely in your tally. As soon as your 2nd ticket is verified, you immediately get your next point!
                </p>
              </div>
            </div>

            {/* Visual Example Breakdown */}
            <div className="pt-4 border-t border-zinc-800/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Scoring Examples in Action:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">1 Ticket</span>
                  <span className="text-white font-bold block text-sm mt-1">
                    0 pts <span className="text-zinc-500 font-normal">(+1 carryover)</span>
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">2 Tickets</span>
                  <span className="text-tedx-lightred font-bold block text-sm mt-1">
                    1 pt <span className="text-zinc-500 font-normal">(0 carryover)</span>
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">3 Tickets</span>
                  <span className="text-tedx-lightred font-bold block text-sm mt-1">
                    1 pt <span className="text-zinc-500 font-normal">(+1 carryover)</span>
                  </span>
                </div>
                <div className="bg-zinc-900/80 p-3 rounded-lg border border-zinc-800">
                  <span className="text-zinc-400 block">10 Tickets</span>
                  <span className="text-tedx-lightred font-bold block text-sm mt-1">
                    5 pts <span className="text-emerald-400 font-normal">Superstar</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Anti Fraud Note */}
            <div className="flex items-start gap-3 bg-red-950/20 border border-red-900/40 rounded-xl p-4 text-xs text-zinc-300">
              <ShieldCheck className="w-5 h-5 text-tedx-red shrink-0 mt-0.5" />
              <div>
                <strong className="text-white font-semibold">Integrity Policy:</strong> Duplicate buyer claims or reference codes are automatically flagged for administrator review before any points can be awarded. Volunteers cannot verify or award points to their own submissions.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Live Public Leaderboard */}
      <section id="leaderboard" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest font-black text-tedx-red flex items-center gap-1.5">
              <Trophy className="w-4 h-4" />
              Real-Time Standings
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              Public Volunteer Leaderboard
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl">
              Rankings reflect verified ticket sales confirmed against the official Meeteor attendee register. Zero private buyer data is displayed publicly.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold border border-zinc-800 transition-all"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              View Your Personal Rank
            </Link>
          </div>
        </div>

        {/* Mounted Leaderboard Component */}
        <LeaderboardTable entries={MOCK_PUBLIC_LEADERBOARD} showPodium={true} />
      </section>

      {/* 5. Volunteer Rewards & Recognition */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="tedx-surface rounded-3xl p-8 sm:p-10 border-zinc-800 space-y-8">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs uppercase tracking-widest font-black text-tedx-red">
              Why Participate?
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-white">
              Volunteer Honors & Perks
            </h3>
            <p className="text-zinc-400 text-xs sm:text-sm">
              We value the dedication it takes to fill the conference hall. Top performers will receive:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/60 border border-zinc-800/80 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-red">
                <Trophy className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">
                Mainstage Recognition
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The top 3 volunteer sales leaders will be formally recognized during the TEDxGwarinpa main plenary session in front of hundreds of attendees.
              </p>
            </div>

            <div className="bg-black/60 border border-zinc-800/80 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">
                VIP Speaker Networking Access
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Exclusive invitation to the closed-door TEDxGwarinpa speakers and partners networking lounge and post-conference reception.
              </p>
            </div>

            <div className="bg-black/60 border border-zinc-800/80 rounded-2xl p-6 space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-white">
                Official Leadership Certificate
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Personalized TEDx Certificate of Outstanding Leadership and Impact endorsed by the TEDxGwarinpa Lead Organizer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Call to Action Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl p-10 sm:p-14 bg-gradient-to-r from-tedx-darkred via-tedx-red to-red-600 text-center text-white space-y-6 shadow-tedx-lg relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Ready to Represent TEDxGwarinpa?
            </h2>
            <p className="text-red-100 text-sm sm:text-base">
              Create your volunteer profile in 30 seconds. Start sharing ticket links with your friends and climb the ranks today.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/register"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-tedx-red font-bold text-sm hover:bg-zinc-100 shadow-lg transition-all"
              >
                Sign Up as a Volunteer
              </Link>
              <Link
                href="/auth/login"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-black/30 hover:bg-black/50 text-white font-semibold text-sm border border-white/20 transition-all"
              >
                Sign In to Your Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
