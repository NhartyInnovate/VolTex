"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, LogOut, ChevronDown, User } from "lucide-react";

interface AuthUserSession {
  id: string;
  email?: string;
  role: "volunteer" | "admin";
  fullName?: string;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUserSession | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  // Listen to auth state changes
  useEffect(() => {
    const supabase = createClient();

    const fetchSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", session.user.id)
            .single();

          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            role: profile?.role === "admin" ? "admin" : "volunteer",
            fullName: profile?.full_name || session.user.user_metadata?.full_name,
          });
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setAuthResolved(true);
      }
    };

    fetchSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", session.user.id)
          .single();

        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          role: profile?.role === "admin" ? "admin" : "volunteer",
          fullName: profile?.full_name || session.user.user_metadata?.full_name,
        });
      } else {
        setCurrentUser(null);
      }
      setAuthResolved(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAnchorClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    targetId: string
  ) => {
    if (pathname === "/") {
      e.preventDefault();
      setMobileMenuOpen(false);
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      setMobileMenuOpen(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setCurrentUser(null);
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-sm border-b border-zinc-800/80 animate-nav-in">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo: Official VolTex Image */}
          <Link
            href="/"
            className="inline-flex items-center select-none transition-opacity hover:opacity-90 active:scale-[0.99] focus:outline-none"
            aria-label="VolTex Home"
          >
            <Image
              src="/voltex-logo.png"
              alt="VolTex logo"
              width={140}
              height={32}
              priority
              className="h-7 sm:h-8 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-400">
            {/* Safe rendering: never expose links while auth is unresolved */}
            {authResolved && !currentUser && (
              <>
                <Link
                  href="/#overview"
                  onClick={(e) => handleAnchorClick(e, "overview")}
                  className="hover:text-white transition-colors duration-150"
                >
                  How It Works
                </Link>
                <Link
                  href="/#leaderboard"
                  onClick={(e) => handleAnchorClick(e, "leaderboard")}
                  className="hover:text-white transition-colors duration-150"
                >
                  Leaderboard
                </Link>
              </>
            )}

            {authResolved && currentUser && (
              <>
                <Link
                  href="/#leaderboard"
                  onClick={(e) => handleAnchorClick(e, "leaderboard")}
                  className="hover:text-white transition-colors duration-150"
                >
                  Leaderboard
                </Link>
                {currentUser.role === "admin" ? (
                  <Link
                    href="/admin"
                    className="hover:text-white transition-colors duration-150 text-zinc-200 font-semibold"
                  >
                    Admin Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/dashboard"
                    className="hover:text-white transition-colors duration-150 text-zinc-200 font-semibold"
                  >
                    Dashboard
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Desktop Auth Controls / CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {!authResolved ? (
              <div className="w-20 h-7" /> // Placeholder preventing layout shift
            ) : !currentUser ? (
              <>
                <Link
                  href="/auth/login"
                  className="text-xs font-medium text-zinc-400 hover:text-white px-2.5 py-1.5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="text-xs font-semibold px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white transition-all shadow-xs"
                >
                  Join Challenge
                </Link>
              </>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-white bg-[#111114] border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded transition-all active:scale-[0.98]"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="max-w-[120px] truncate">
                    {currentUser.fullName || currentUser.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-[#111114] border border-zinc-800 rounded shadow-xl py-1 text-xs text-zinc-300 animate-subtle-fade-up">
                    <div className="px-3 py-2 border-b border-zinc-800/80">
                      <div className="font-semibold text-white truncate">
                        {currentUser.fullName || "Volunteer"}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate font-mono">
                        {currentUser.email}
                      </div>
                      <span className="inline-block mt-1 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                        {currentUser.role}
                      </span>
                    </div>

                    <Link
                      href={currentUser.role === "admin" ? "/admin" : "/dashboard"}
                      className="block px-3 py-2 hover:bg-zinc-800/60 hover:text-white transition-colors"
                    >
                      {currentUser.role === "admin" ? "Admin Portal" : "Volunteer Dashboard"}
                    </Link>

                    <button
                      onClick={handleSignOut}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors border-t border-zinc-800/80"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-zinc-400 hover:text-white active:scale-95 transition-all focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 transition-transform duration-150" />
              ) : (
                <Menu className="w-5 h-5 transition-transform duration-150" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-[#09090b] px-4 py-4 space-y-3 text-sm animate-subtle-fade-up">
          {authResolved && !currentUser && (
            <>
              <Link
                href="/#overview"
                onClick={(e) => handleAnchorClick(e, "overview")}
                className="block text-zinc-300 hover:text-white py-1 transition-colors text-xs"
              >
                How It Works
              </Link>
              <Link
                href="/#leaderboard"
                onClick={(e) => handleAnchorClick(e, "leaderboard")}
                className="block text-zinc-300 hover:text-white py-1 transition-colors text-xs"
              >
                Leaderboard
              </Link>
              <div className="pt-3 border-t border-zinc-800/80 flex flex-col gap-2">
                <Link
                  href="/auth/register"
                  className="text-center py-2 rounded bg-tedx-red text-white text-xs font-semibold active:scale-[0.98] transition-all"
                >
                  Join Challenge
                </Link>
                <Link
                  href="/auth/login"
                  className="text-center py-2 text-zinc-400 hover:text-white text-xs active:scale-[0.98] transition-all"
                >
                  Sign In
                </Link>
              </div>
            </>
          )}

          {authResolved && currentUser && (
            <>
              <div className="pb-2 border-b border-zinc-800/80">
                <div className="font-semibold text-white text-xs truncate">
                  {currentUser.fullName || "Volunteer"}
                </div>
                <div className="text-[10px] text-zinc-500 truncate font-mono">
                  {currentUser.email}
                </div>
              </div>

              <Link
                href="/#leaderboard"
                onClick={(e) => handleAnchorClick(e, "leaderboard")}
                className="block text-zinc-300 hover:text-white py-1 transition-colors text-xs"
              >
                Leaderboard
              </Link>
              {currentUser.role === "admin" ? (
                <Link
                  href="/admin"
                  className="block text-zinc-200 hover:text-white py-1 transition-colors text-xs font-medium"
                >
                  Admin Dashboard
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="block text-zinc-200 hover:text-white py-1 transition-colors text-xs font-medium"
                >
                  Dashboard
                </Link>
              )}

              <div className="pt-3 border-t border-zinc-800/80">
                <button
                  onClick={handleSignOut}
                  className="w-full text-left flex items-center gap-2 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}
