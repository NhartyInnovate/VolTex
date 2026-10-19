"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // 1. Check if session already exists in storage/cookies
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasValidSession(true);
          return;
        }

        // 2. Also check URL hash fragment (in case client received tokens via hash)
        if (typeof window !== "undefined" && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const type = hashParams.get("type");

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (!error && data.session) {
              setHasValidSession(true);
              // Clean the hash from the browser URL for privacy
              window.history.replaceState(null, "", window.location.pathname);
              return;
            }
          }
          if (type === "recovery" && hashParams.get("error_description")) {
            setErrorMessage(decodeURIComponent(hashParams.get("error_description")!));
            setHasValidSession(false);
            return;
          }
        }

        // If no session found yet, wait for possible onAuthStateChange event
        const { data: authListener } = supabase.auth.onAuthStateChange(
          (event, session) => {
            if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
              setHasValidSession(true);
            }
          }
        );

        // Fallback: If after 1.5s still no session, mark as invalid
        const timeout = setTimeout(() => {
          setHasValidSession((prev) => (prev === true ? true : false));
        }, 1500);

        return () => {
          authListener?.subscription.unsubscribe();
          clearTimeout(timeout);
        };
      } catch {
        setHasValidSession(false);
      }
    };

    checkInitialSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 10) {
      setErrorMessage("New password must be at least 10 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsSubmitting(false);
        return;
      }

      setIsSuccess(true);
      setIsSubmitting(false);

      // Sign user out cleanly so they authenticate with their new password
      await supabase.auth.signOut();

      // Redirect to login after brief display
      setTimeout(() => {
        router.push("/auth/login?password_reset=true");
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setErrorMessage(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-sm w-full space-y-6 animate-subtle-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Set new password
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Choose a secure new password for your TEDxGwarinpa volunteer account.
          </p>
        </div>

        <div className="border border-zinc-800/80 rounded p-6 bg-[#111114] space-y-4">
          {isSuccess ? (
            <div className="py-2 space-y-3 text-xs animate-subtle-fade-up">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Password Updated Successfully</span>
              </div>
              <p className="text-zinc-400 leading-relaxed">
                Your password has been securely updated. Redirecting you to sign in...
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/login?password_reset=true"
                  className="block text-center w-full py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.99] text-white font-semibold transition-all shadow-xs"
                >
                  Sign In with New Password
                </Link>
              </div>
            </div>
          ) : hasValidSession === false ? (
            <div className="py-2 space-y-3 text-xs animate-subtle-fade-up">
              <div
                role="alert"
                className="border border-red-800/60 bg-red-950/40 text-red-300 p-3 rounded text-[11px] leading-relaxed"
              >
                {errorMessage || "No active password recovery session was found, or your recovery link has expired or already been consumed."}
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/auth/forgot-password"
                  className="block text-center w-full py-2.5 rounded bg-tedx-red hover:bg-tedx-darkred text-white font-semibold transition-all shadow-xs"
                >
                  Request a New Recovery Link
                </Link>
                <Link
                  href="/auth/login"
                  className="text-center text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
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
                  className="border border-red-800/60 bg-red-950/40 text-red-300 px-3 py-2 rounded text-[11px] animate-subtle-fade-up"
                >
                  {errorMessage}
                </div>
              )}

              {/* New Password */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  New Password (minimum 10 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 pr-9 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={10}
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#09090b] border border-zinc-800 rounded px-3 py-2 pr-9 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
                  className="w-full py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all disabled:opacity-50 shadow-xs"
                >
                  {isSubmitting ? "Updating password..." : "Save New Password"}
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/auth/login"
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel and Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
