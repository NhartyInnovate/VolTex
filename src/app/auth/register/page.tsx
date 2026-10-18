"use client";

import React, { useState } from "react";
import Link from "next/link";
import { VOLUNTEER_TEAMS } from "@/config/constants";
import { triggerConfetti } from "@/lib/confetti";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    volunteerTeam: VOLUNTEER_TEAMS[0] as string,
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form validation check
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);

    // Brief simulated dispatch to show responsive interaction
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);

      // Trigger celebration ONLY upon verified success
      triggerConfetti({ type: "registration" });
    }, 350);
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-sm w-full space-y-6 animate-subtle-fade-up">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Create your account
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Register as a TEDxGwarinpa volunteer to participate in the ticket challenge.
          </p>
        </div>

        {/* Form Container */}
        <div className="border border-zinc-800/80 rounded p-6 bg-[#111114] space-y-4">
          {submitted ? (
            <div
              role="status"
              aria-live="polite"
              className="py-4 space-y-4 text-xs animate-subtle-fade-up"
            >
              <div className="space-y-1.5">
                <h2 className="font-bold text-white text-base">
                  You&apos;re in. Welcome to the challenge.
                </h2>
                <p className="text-zinc-400 leading-relaxed text-xs">
                  You&apos;re now part of the team helping bring more people to TEDxGwarinpa.
                </p>
              </div>

              <div className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                Demo Preview: Registration simulated for team{" "}
                <span className="text-zinc-300 font-medium">{formData.volunteerTeam}</span>.
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="block text-center w-full py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.99] text-white font-semibold transition-all"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {errorMessage && (
                <div
                  role="alert"
                  className="border border-red-800/60 bg-red-950/40 text-red-300 px-3 py-2 rounded text-[11px] animate-subtle-fade-up"
                >
                  {errorMessage}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Amina Bello"
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +234 803 123 4567"
                  value={formData.phoneNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, phoneNumber: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Team */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Volunteer Team
                </label>
                <select
                  value={formData.volunteerTeam}
                  onChange={(e) =>
                    setFormData({ ...formData, volunteerTeam: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-2.5 py-2 text-zinc-200 focus:outline-none focus:border-zinc-600 transition-colors"
                >
                  {VOLUNTEER_TEAMS.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? "Creating account..." : "Create Account"}
                </button>
              </div>
            </form>
          )}

          <div className="border-t border-zinc-800/80 pt-3 text-center text-[11px] text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-zinc-300 hover:text-white underline underline-offset-4"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
