"use client";

import React, { useState } from "react";
import Link from "next/link";
import { VOLUNTEER_TEAMS } from "@/config/constants";
import {
  User,
  Phone,
  Mail,
  Lock,
  Users,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    volunteerTeam: VOLUNTEER_TEAMS[0] as string,
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In Phase 4, this invokes supabase.auth.signUp() and creates the profile record
    setSubmitted(true);
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tedx-red/10 border border-tedx-red/30 text-xs font-bold text-tedx-lightred uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Volunteer Registration
          </div>
          <h1 className="text-3xl font-black text-white">Join the Challenge</h1>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Create your official TEDxGwarinpa volunteer account to start submitting ticket referrals and earning points.
          </p>
        </div>

        {/* UI Preview Notice */}
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <strong>Phase 2 UI Preview:</strong> Full authentication backend is configured in migrations and will be connected in Phase 4 once Supabase credentials are provided.
          </div>
        </div>

        {/* Form Container */}
        <div className="tedx-surface rounded-2xl p-6 sm:p-8 border-zinc-800 shadow-2xl space-y-6">
          {submitted ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">Registration Preview Successful</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                Welcome <strong className="text-white">{formData.fullName || "Volunteer"}</strong>! Your registration payload has been validated for team <strong className="text-zinc-300">{formData.volunteerTeam}</strong>.
              </p>
              <div className="pt-2">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-xs font-bold transition-all shadow-tedx"
                >
                  Enter Volunteer Dashboard Preview
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Full Name (First & Last)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amina Bello"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Phone Number (WhatsApp Preferred)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +234 803 123 4567"
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, phoneNumber: e.target.value })
                    }
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Volunteer Team (Centrally configured) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Assigned Volunteer Team
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={formData.volunteerTeam}
                    onChange={(e) =>
                      setFormData({ ...formData, volunteerTeam: e.target.value })
                    }
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-tedx-red transition-colors"
                  >
                    {VOLUNTEER_TEAMS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="text-[10px] text-zinc-500 block mt-1">
                  Centrally configured team options for TEDxGwarinpa.
                </span>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="amina@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
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
                    className="w-full bg-black border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-tedx-red transition-colors"
                  />
                </div>
              </div>

              {/* Security Policy Reminder */}
              <div className="pt-2 text-[11px] text-zinc-500 leading-relaxed border-t border-zinc-800/80">
                <ShieldCheck className="w-3.5 h-3.5 inline text-tedx-red mr-1" />
                Public registration assigns the standard <strong className="text-zinc-400">volunteer</strong> role. Administrative permissions are restricted and provisioned by organizers.
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-sm font-bold shadow-tedx transition-all flex items-center justify-center gap-2"
              >
                Create Volunteer Account
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Switch to Login */}
          <div className="text-center text-xs text-zinc-400 border-t border-zinc-800 pt-4">
            Already registered?{" "}
            <Link
              href="/auth/login"
              className="text-tedx-lightred font-semibold hover:underline"
            >
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
