"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CONFERENCE_CONFIG } from "@/config/constants";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-sm border-b border-zinc-800/80 animate-nav-in">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo */}
          <Link href="/" className="flex items-baseline gap-2 transition-opacity hover:opacity-90 active:scale-[0.99]">
            <span className="font-black tracking-tight text-xl">
              <span className="text-tedx-red">TEDx</span>
              <span className="text-white">Gwarinpa</span>
            </span>
            <span className="text-xs text-zinc-500 font-medium">VolTex</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-zinc-400">
            <Link
              href="/#overview"
              className="hover:text-white transition-colors duration-150"
            >
              How It Works
            </Link>
            <Link
              href="/#leaderboard"
              className="hover:text-white transition-colors duration-150"
            >
              Leaderboard & Scoring
            </Link>
            <Link
              href="/dashboard"
              className="hover:text-white transition-colors duration-150"
            >
              Volunteer Portal
            </Link>
            <Link
              href="/admin"
              className="hover:text-white transition-colors duration-150 text-zinc-500"
            >
              Admin
            </Link>
          </nav>

          {/* Action CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href={CONFERENCE_CONFIG.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-zinc-300 hover:text-white px-3 py-1.5 active:scale-[0.98] transition-all"
            >
              Buy Tickets
            </a>
            <Link
              href="/auth/register"
              className="text-xs font-semibold px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white transition-all shadow-xs"
            >
              Join Challenge
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <a
              href={CONFERENCE_CONFIG.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-zinc-300 px-2 py-1 active:scale-[0.98] transition-all"
            >
              Tickets
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white active:scale-95 transition-all focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 transition-transform duration-150" />
              ) : (
                <Menu className="w-5 h-5 transition-transform duration-150" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-[#09090b] px-4 py-4 space-y-3 text-sm animate-subtle-fade-up">
          <Link
            href="/#overview"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-zinc-300 hover:text-white py-1 transition-colors"
          >
            How It Works
          </Link>
          <Link
            href="/#leaderboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-zinc-300 hover:text-white py-1 transition-colors"
          >
            Leaderboard & Scoring
          </Link>
          <Link
            href="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-zinc-300 hover:text-white py-1 transition-colors"
          >
            Volunteer Portal
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
          >
            Admin Verification
          </Link>

          <div className="pt-3 border-t border-zinc-800/80 flex flex-col gap-2">
            <Link
              href="/auth/register"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-2 rounded bg-tedx-red text-white text-xs font-semibold active:scale-[0.98] transition-all"
            >
              Join the Challenge
            </Link>
            <Link
              href="/auth/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-2 text-zinc-400 hover:text-white text-xs active:scale-[0.98] transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
