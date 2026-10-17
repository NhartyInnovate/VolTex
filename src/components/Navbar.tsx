"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";
import {
  Menu,
  X,
  Ticket,
  Trophy,
  UserCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-black/80 border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex items-baseline font-black tracking-tighter text-2xl">
              <span className="text-tedx-red">TEDx</span>
              <span className="text-white">Gwarinpa</span>
            </div>
            <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
              VolTex
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/#overview"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              Overview
            </Link>
            <Link
              href="/#rules"
              className="text-zinc-300 hover:text-white transition-colors"
            >
              Scoring Rules
            </Link>
            <Link
              href="/#leaderboard"
              className="text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <Trophy className="w-4 h-4 text-tedx-red" />
              Leaderboard
            </Link>
            <Link
              href="/dashboard"
              className="text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <UserCheck className="w-4 h-4 text-emerald-400" />
              Volunteer Portal
            </Link>
            <Link
              href="/admin"
              className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors text-xs bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
              Admin
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={CONFERENCE_CONFIG.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-all"
            >
              <Ticket className="w-3.5 h-3.5 text-tedx-red" />
              Buy Ticket
            </a>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1 text-xs font-semibold px-4 py-2 rounded-lg bg-tedx-red hover:bg-tedx-darkred text-white shadow-tedx transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Join Challenge
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <a
              href={CONFERENCE_CONFIG.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-tedx-red text-white"
            >
              <Ticket className="w-3 h-3" />
              Tickets
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950 px-4 pt-3 pb-5 space-y-3">
          <Link
            href="/#overview"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Overview
          </Link>
          <Link
            href="/#rules"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Scoring Rules
          </Link>
          <Link
            href="/#leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-200 hover:bg-zinc-900 flex items-center gap-2"
          >
            <Trophy className="w-4 h-4 text-tedx-red" />
            Public Leaderboard
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-emerald-400 hover:bg-zinc-900 flex items-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            Volunteer Dashboard
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block px-3 py-2 rounded-md text-base font-medium text-zinc-400 hover:bg-zinc-900 flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Admin Hub (Preview)
          </Link>

          <div className="pt-2 border-t border-zinc-800 grid grid-cols-2 gap-2">
            <Link
              href="/auth/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-zinc-300 bg-zinc-900 border border-zinc-800"
            >
              Volunteer Log In
            </Link>
            <Link
              href="/auth/register"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-tedx-red shadow-tedx"
            >
              Register Now
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
