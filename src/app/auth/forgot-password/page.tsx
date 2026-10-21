"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAppUrl, getAuthErrorMessage } from "@/lib/utils";
import { LoadingSpinner, CenteredProcessingOverlay } from "@/components/LoadingSpinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const appUrl = getAppUrl();
      // Directs user to /auth/callback with recovery type, which then navigates to /auth/reset-password
      const redirectUrl = `${appUrl}/auth/callback?next=/auth/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: redirectUrl,
      });

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[VolTex Password Reset Debug] Supabase Auth error details:", {
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

      setIsSubmitting(false);
      setSubmitted(true);
    } catch (err: unknown) {
      if (process.env.NODE_ENV === "development") {
        console.error("[VolTex Password Reset Debug] Unexpected exception:", err);
      }
      setErrorMessage(getAuthErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-sm w-full space-y-6 animate-subtle-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Reset password
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Enter your registered volunteer email address to receive a secure recovery link.
          </p>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800/80 rounded p-6 bg-white dark:bg-[#111114] shadow-xs space-y-4">
          {submitted ? (
            <div className="py-2 space-y-3 text-xs animate-subtle-fade-up">
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Recovery Link Dispatched
              </h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
                If an account exists for <strong className="text-zinc-900 dark:text-zinc-200">{email}</strong>, you will receive an email with instructions to securely choose a new password.
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded border border-zinc-200 dark:border-zinc-800/60">
                💡 <strong>Tip:</strong> If accessing email on a mobile device, open the recovery link in the same browser app where you initiated the reset.
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white active:scale-[0.98] inline-block underline underline-offset-4 transition-all"
                >
                  Return to Sign In
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

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="volunteer@tedxgwarinpa.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50 shadow-xs flex items-center justify-center"
                >
                  <span>{isSubmitting ? "Sending instructions..." : "Send Recovery Link"}</span>
                </button>
              </div>

              {isSubmitting && (
                <CenteredProcessingOverlay
                  message="Sending recovery link..."
                  label="Sending password reset instructions"
                />
              )}

              <div className="text-center pt-2">
                <Link
                  href="/auth/login"
                  className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
