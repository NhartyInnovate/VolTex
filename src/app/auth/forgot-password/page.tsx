"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tedx-red/10 border border-tedx-red/30 text-xs font-bold text-tedx-lightred uppercase tracking-wider">
            <KeyRound className="w-3.5 h-3.5" />
            Account Recovery
          </div>
          <h1 className="text-3xl font-black text-white">Reset Password</h1>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Enter your registered volunteer email address. We will send you a secure password reset link.
          </p>
        </div>

        <div className="tedx-surface rounded-2xl p-6 sm:p-8 border-zinc-800 shadow-2xl space-y-6">
          {submitted ? (
            <div className="text-center py-4 space-y-3">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Reset Link Dispatched</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                If an account exists for <strong className="text-white">{email}</strong>, a recovery link will arrive in your inbox shortly.
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="text-xs text-tedx-lightred font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Volunteer Email Address
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

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-tedx-red hover:bg-tedx-darkred text-white text-sm font-bold shadow-tedx transition-all flex items-center justify-center gap-2"
              >
                Send Password Reset Email
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/auth/login"
                  className="text-xs text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
