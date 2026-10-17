"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, Lock, ArrowRight, Sparkles, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tedx-red/10 border border-tedx-red/30 text-xs font-bold text-tedx-lightred uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Volunteer Portal
          </div>
          <h1 className="text-3xl font-black text-white">Sign In</h1>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Access your referral submissions, track verified sales, and grab promo resources.
          </p>
        </div>

        {/* UI Preview Notice */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <strong>Phase 2 UI Preview:</strong> Live authentication connects in Phase 4. You can explore the Volunteer Dashboard and Admin Hub previews below.
          </div>
        </div>

        {/* Form Container */}
        <div className="tedx-surface rounded-2xl p-6 sm:p-8 border-zinc-800 shadow-2xl space-y-6">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <h3 className="text-lg font-bold text-white">Preview Access Ready</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                Select which preview workspace you would like to explore:
              </p>
              <div className="grid grid-cols-1 gap-2 pt-2">
                <Link
                  href="/dashboard"
                  className="w-full py-2.5 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-xs font-bold transition-all shadow-tedx flex items-center justify-center gap-2"
                >
                  Enter Volunteer Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/admin"
                  className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-all flex items-center justify-center gap-2"
                >
                  Enter Admin Hub
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="volunteer@tedxgwarinpa.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-300">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-[11px] text-zinc-400 hover:text-tedx-lightred transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-sm font-bold shadow-tedx transition-all flex items-center justify-center gap-2"
              >
                Sign In to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Direct Previews */}
          <div className="pt-2 border-t border-zinc-800/80">
            <div className="text-[11px] text-zinc-500 text-center mb-3">
              Direct Preview Portals:
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <Link
                href="/dashboard"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-emerald-400 font-medium"
              >
                Volunteer Demo →
              </Link>
              <Link
                href="/admin"
                className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-medium"
              >
                Admin Demo →
              </Link>
            </div>
          </div>

          {/* Switch to Register */}
          <div className="text-center text-xs text-zinc-400 border-t border-zinc-800 pt-4">
            Not registered yet?{" "}
            <Link
              href="/auth/register"
              className="text-tedx-lightred font-semibold hover:underline"
            >
              Sign Up for the Challenge
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
