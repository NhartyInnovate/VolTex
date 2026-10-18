"use client";

import React, { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-sm w-full space-y-6 animate-subtle-fade-up">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Reset password
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Enter your registered volunteer email address to receive password recovery instructions.
          </p>
        </div>

        <div className="border border-zinc-800/80 rounded p-6 bg-[#111114] space-y-4">
          {submitted ? (
            <div className="py-2 space-y-3 text-xs animate-subtle-fade-up">
              <h3 className="font-semibold text-white">
                Recovery Link Dispatched
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                If an account exists for <strong className="text-zinc-200">{email}</strong>, password reset instructions will arrive in your inbox.
              </p>
              <div className="pt-2">
                <Link
                  href="/auth/login"
                  className="text-zinc-300 hover:text-white active:scale-[0.98] inline-block underline underline-offset-4 transition-all"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
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

              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full py-2 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white font-semibold transition-all shadow-xs"
                >
                  Send Recovery Link
                </button>
              </div>

              <div className="text-center pt-2">
                <Link
                  href="/auth/login"
                  className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
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
