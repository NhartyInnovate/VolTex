"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { VOLUNTEER_TEAMS } from "@/config/constants";
import { triggerConfetti } from "@/lib/confetti";
import { createClient } from "@/lib/supabase/client";
import { getAppUrl, getAuthErrorMessage } from "@/lib/utils";
import { Eye, EyeOff, ChevronDown, Check } from "lucide-react";
import { LoadingSpinner, CenteredProcessingOverlay } from "@/components/LoadingSpinner";

interface TeamSelectDropdownProps {
  value: string;
  onChange: (team: string) => void;
  options: readonly string[];
  disabled?: boolean;
}

function TeamSelectDropdown({
  value,
  onChange,
  options,
  disabled = false,
}: TeamSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedIndex = options.indexOf(value);
  const [focusedIndex, setFocusedIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : 0
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Synchronize focusedIndex whenever dropdown opens or value changes
  useEffect(() => {
    if (isOpen) {
      const idx = options.indexOf(value);
      setFocusedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, value, options]);

  // Scroll focused option into view smoothly
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen, focusedIndex]);

  // Close when tapping / clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, {
      passive: true,
    });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (team: string) => {
    onChange(team);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (isOpen && e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleListKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < options.length) {
        handleSelect(options[focusedIndex]);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocusedIndex(options.length - 1);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        id="volunteer-team-select"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="volunteer-team-label volunteer-team-select"
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        onKeyDown={handleTriggerKeyDown}
        className="w-full bg-white dark:bg-[#09090b] border border-zinc-300 dark:border-zinc-800 rounded px-3 py-2 text-zinc-900 dark:text-zinc-200 text-left flex items-center justify-between focus:outline-none focus:border-zinc-500 dark:focus:border-zinc-600 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate pr-2 font-medium">{value}</span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${
            isOpen ? "rotate-180 text-tedx-red dark:text-tedx-red" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          ref={listRef}
          role="listbox"
          aria-labelledby="volunteer-team-label"
          aria-activedescendant={`team-option-${focusedIndex}`}
          tabIndex={0}
          onKeyDown={handleListKeyDown}
          className="absolute z-50 left-0 right-0 mt-1 max-h-56 sm:max-h-60 overflow-y-auto overscroll-contain bg-white dark:bg-[#0c0c0e] border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg shadow-black/10 dark:shadow-black/50 py-1 focus:outline-none"
        >
          {options.map((team, index) => {
            const isSelected = team === value;
            const isFocused = index === focusedIndex;

            return (
              <div
                key={team}
                id={`team-option-${index}`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(team)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`w-full px-3 py-2.5 flex items-center justify-between text-xs cursor-pointer select-none transition-colors ${
                  isSelected
                    ? "bg-red-50 text-tedx-red dark:bg-tedx-red/10 dark:text-red-400 font-semibold"
                    : isFocused
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-100"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                }`}
              >
                <span className="truncate pr-2">{team}</span>
                {isSelected && (
                  <Check
                    className="w-3.5 h-3.5 text-tedx-red dark:text-red-400 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
      const redirectUrl = `${appUrl}/auth/callback`;

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
                    ? "We've sent a verification link to your email address. Please check your inbox (and spam folder) and click the link to verify your account before signing in."
                    : "You're now registered and part of the team helping bring more people to TEDxGwarinpa."}
                </p>
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
                <label
                  id="volunteer-team-label"
                  className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                >
                  Volunteer Team
                </label>
                <TeamSelectDropdown
                  value={formData.volunteerTeam}
                  onChange={(team) =>
                    setFormData({ ...formData, volunteerTeam: team })
                  }
                  options={VOLUNTEER_TEAMS}
                  disabled={isSubmitting}
                />
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
