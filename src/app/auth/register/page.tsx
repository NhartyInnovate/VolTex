"use client";

import React, { useState } from "react";
import Link from "next/link";
import { VOLUNTEER_TEAMS } from "@/config/constants";
import { triggerConfetti } from "@/lib/confetti";
import { createClient } from "@/lib/supabase/client";
import { getAppUrl, getAuthErrorMessage } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { LoadingSpinner, CenteredProcessingOverlay } from "@/components/LoadingSpinner";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: "",
    phoneNumber: "",
    volunteerTeam: VOLUNTEER_TEAMS[0] as string,
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Form validation check
    const trimmedFullName = formData.fullName.trim();
    const trimmedPhone = formData.phoneNumber.trim();
    const trimmedEmail = formData.email.trim();

    if (!trimmedFullName) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!trimmedPhone) {
      setErrorMessage("Please enter your phone number.");
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (formData.password.length < 10) {
      setErrorMessage("Password must be at least 10 characters long.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const appUrl = getAppUrl();
      const redirectUrl = `${appUrl}/auth/callback?next=/dashboard`;

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: formData.password,
        options: {
          data: {
            full_name: trimmedFullName,
            phone_number: trimmedPhone,
            volunteer_team: formData.volunteerTeam,
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[VolTex Signup Debug] Supabase Auth error details:", {
            code: error.code,
            status: error.status,
            name: error.name,
            message: error.message,
          });
        }
        setErrorMessage(getAuthErrorMessage(error));
        setIsSubmitting(false);
        return;
      }

      // Check whether session exists immediately or email confirmation is required
      // If user is returned without a session, Supabase email confirmation is enabled
      const userRequiresConfirmation = Boolean(data.user && !data.session);
      setNeedsEmailConfirmation(userRequiresConfirmation);
      setSubmitted(true);
      setIsSubmitting(false);

      // Trigger celebration upon successful registration
      triggerConfetti({ type: "registration" });
    } catch (err: unknown) {
      if (process.env.NODE_ENV === "development") {
        console.error("[VolTex Signup Debug] Unexpected exception:", err);
      }
      setErrorMessage(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-sm w-full space-y-6 animate-subtle-fade-up">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Create your account
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Register as a TEDxGwarinpa volunteer to participate in the ticket challenge.
          </p>
        </div>

        {/* Form Container */}
        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-6 bg-white dark:bg-[#111114] shadow-xs space-y-4">
          {submitted ? (
            <div
              role="status"
              aria-live="polite"
              className="py-4 space-y-4 text-xs animate-subtle-fade-up"
            >
              <div className="space-y-1.5">
                <h2 className="font-bold text-zinc-900 dark:text-white text-base">
                  You&apos;re in. Welcome to the challenge.
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed text-xs">
                  {needsEmailConfirmation
                    ? "A verification link has been sent to your email address. Please click the link to confirm your account and sign in."
                    : "You're now registered and part of the team helping bring more people to TEDxGwarinpa."}
                </p>
                {needsEmailConfirmation && (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded border border-zinc-200 dark:border-zinc-800/60 mt-2">
                    💡 <strong>Tip:</strong> If using a mobile device, open the confirmation email in the same browser app to ensure instant automatic verification.
                  </p>
                )}
              </div>

              <div className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200 dark:border-zinc-800/60">
                Registered for:{" "}
                <span className="text-zinc-800 dark:text-zinc-300 font-medium">{formData.volunteerTeam}</span>.
              </div>

              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="block text-center w-full py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.99] text-white font-semibold transition-all shadow-xs"
                >
                  Proceed to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {errorMessage && (
                <div
                  role="alert"
                  className="border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3 py-2 rounded text-[11px] animate-subtle-fade-up"
                >
                  {errorMessage}
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Team */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Volunteer Team
                </label>
                <select
                  value={formData.volunteerTeam}
                  onChange={(e) =>
                    setFormData({ ...formData, volunteerTeam: e.target.value })
                  }
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-2.5 py-2 text-zinc-900 dark:text-zinc-200 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
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
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
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
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Password (minimum 10 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 pr-9 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={10}
                    placeholder="••••••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 pr-9 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50 shadow-xs flex items-center justify-center"
                >
                  <span>{isSubmitting ? "Creating account..." : "Create Account"}</span>
                </button>
              </div>
            </form>
          )}

          {isSubmitting && (
            <CenteredProcessingOverlay
              message="Creating your account..."
              label="Creating volunteer account"
            />
          )}

          <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-3 text-center text-[11px] text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white underline underline-offset-4"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
