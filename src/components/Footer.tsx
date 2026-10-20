import React from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-[#09090b] text-zinc-500 text-xs transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {/* Brand Info */}
          <div className="space-y-2">
            <div className="flex items-baseline font-bold tracking-tight text-base">
              <span className="text-tedx-red">TEDx</span>
              <span className="text-zinc-900 dark:text-white">Gwarinpa</span>
              <span className="ml-1.5 text-zinc-500 font-normal">VolTex</span>
            </div>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs leading-relaxed max-w-sm">
              Volunteer ticket promotion, referral reporting, and points tracking platform.
            </p>
          </div>

          {/* Platform Navigation */}
          <div>
            <div className="text-zinc-800 dark:text-zinc-300 font-medium text-xs mb-3">Navigation</div>
            <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
              <li>
                <Link href="/#overview" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#leaderboard" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Scoring & Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Volunteer Portal
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
                  Admin Verification
                </Link>
              </li>
            </ul>
          </div>

          {/* External Links & Access */}
          <div>
            <div className="text-zinc-300 font-medium text-xs mb-3">Registration & Tickets</div>
            <ul className="space-y-2 text-zinc-400">
              <li>
                <a
                  href={CONFERENCE_CONFIG.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors text-zinc-300 underline underline-offset-4"
                >
                  Official Ticket Portal (Meeteor) ↗
                </a>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-white transition-colors">
                  Register as Volunteer
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="hover:text-white transition-colors">
                  Volunteer Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* License & Disclaimer */}
        <div className="border-t border-zinc-800/80 pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-[11px] text-zinc-500">
          <p>
            This independent TEDx event is operated under license from TED. Official attendee ticket registrations are processed via Meeteor.
          </p>
          <p className="shrink-0 text-zinc-600">
            TEDxGwarinpa © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
