"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-sm w-full space-y-6 animate-subtle-fade-up">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sign in
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Access your volunteer referral dashboard or administrator verification queue.
          </p>
        </div>

        {/* Demo Mode Notice */}
        <div className="border border-zinc-800 bg-[#111114] p-3 rounded text-[11px] text-zinc-400 leading-relaxed">
          <strong className="text-zinc-200">Demo Preview:</strong> Authentication is simulated. You can explore the volunteer or admin interfaces directly using the buttons below.
        </div>

        {/* Form Container */}
        <div className="border border-zinc-800/80 rounded p-6 bg-[#111114] space-y-4">
          {submitted ? (
            <div className="py-3 space-y-3 text-xs animate-subtle-fade-up">
              <h3 className="font-semibold text-white">
                Select Preview Workspace
              </h3>
              <p className="text-zinc-400">
                Choose a portal to view the interface demonstration:
              </p>
              <div className="space-y-2 pt-1">
                <Link
                  href="/dashboard"
                  className="block text-center py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-medium transition-all shadow-xs"
                >
                  Enter Volunteer Dashboard
                </Link>
                <Link
                  href="/admin"
                  className="block text-center py-2 rounded border border-zinc-800 hover:border-zinc-700 active:scale-[0.98] text-zinc-300 hover:text-white transition-all"
                >
                  Enter Admin Verification
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {/* Email */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="volunteer@tedxgwarinpa.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-zinc-300">
                    Password
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all shadow-xs"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* Quick Demo Links */}
          <div className="border-t border-zinc-800/80 pt-3 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Direct demo links:</span>
            <div className="space-x-2">
              <Link href="/dashboard" className="text-zinc-400 hover:text-white underline underline-offset-4">
                Volunteer
              </Link>
              <span>·</span>
              <Link href="/admin" className="text-zinc-400 hover:text-white underline underline-offset-4">
                Admin
              </Link>
            </div>
          </div>

          <div className="border-t border-zinc-800/80 pt-3 text-center text-[11px] text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/register"
              className="text-zinc-300 hover:text-white underline underline-offset-4"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
