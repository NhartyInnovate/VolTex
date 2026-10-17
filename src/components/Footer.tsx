import React from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { ExternalLink, Heart, Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-zinc-900 bg-black text-zinc-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-baseline font-black tracking-tighter text-xl">
              <span className="text-tedx-red">TEDx</span>
              <span className="text-white">Gwarinpa</span>
            </div>
            <p className="text-zinc-400 text-sm max-w-sm leading-relaxed">
              Empowering volunteers to champion transformative ideas across Abuja
              and beyond. Track referrals, earn recognized points, and top the
              conference leaderboard.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-zinc-500">
              <span>Built for TEDxGwarinpa Volunteers</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-tedx-red">
                <Sparkles className="w-3 h-3" />
                2026 Edition
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Navigation
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/#overview" className="hover:text-white transition-colors">
                  Challenge Overview
                </Link>
              </li>
              <li>
                <Link href="/#rules" className="hover:text-white transition-colors">
                  Scoring Model & Rules
                </Link>
              </li>
              <li>
                <Link href="/#leaderboard" className="hover:text-white transition-colors">
                  Public Leaderboard
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-emerald-400 transition-colors">
                  Volunteer Portal
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-zinc-200 transition-colors">
                  Admin Verification Hub
                </Link>
              </li>
            </ul>
          </div>

          {/* Official Ticket & Portals */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
              Official Links
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href={CONFERENCE_CONFIG.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-tedx-red flex items-center gap-1.5 transition-colors text-white"
                >
                  Meeteor Ticket Hub
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-white transition-colors">
                  Register as Volunteer
                </Link>
              </li>
              <li>
                <Link href="/auth/login" className="hover:text-white transition-colors">
                  Sign in to Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Mandatory TEDx Disclaimer */}
        <div className="border-t border-zinc-900 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-zinc-500">
          <p className="text-[11px] leading-relaxed max-w-2xl text-center md:text-left">
            This independent TEDx event is operated under license from TED.
            All ticket bookings are completed securely via the official Meeteor platform.
          </p>
          <div className="flex items-center gap-1 text-[11px]">
            <span>Crafted with</span>
            <Heart className="w-3 h-3 text-tedx-red fill-tedx-red" />
            <span>for TEDxGwarinpa</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
