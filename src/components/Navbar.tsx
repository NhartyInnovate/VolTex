"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, X, LogOut, ChevronDown, User, Smartphone } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { LoadingSpinner } from "./LoadingSpinner";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { PwaInstallModal } from "./PwaInstallModal";

interface AuthUserSession {
  id: string;
  email?: string;
  role: "volunteer" | "admin";
  fullName?: string;
  volunteerTeam?: string;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUserSession | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    canInstall,
    isInstalled,
    promptInstall,
    openInstallInstructions,
    closeInstallInstructions,
    showInstructionsModal,
    instructionPlatform,
  } = usePwaInstall();

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
            .select("role, full_name, volunteer_team")
            .eq("id", session.user.id)
            .single();

          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            role: profile?.role === "admin" ? "admin" : "volunteer",
            fullName: profile?.full_name || session.user.user_metadata?.full_name,
            volunteerTeam: profile?.volunteer_team || undefined,
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
          .select("role, full_name, volunteer_team")
          .eq("id", session.user.id)
          .single();

        setCurrentUser({
          id: session.user.id,
          email: session.user.email,
          role: profile?.role === "admin" ? "admin" : "volunteer",
          fullName: profile?.full_name || session.user.user_metadata?.full_name,
          volunteerTeam: profile?.volunteer_team || undefined,
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
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setCurrentUser(null);
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#09090b]/95 backdrop-blur-sm border-b border-zinc-800/80 transition-colors animate-nav-in">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Brand Logo: Official VolTex Image */}
          <Link
            href="/"
            className="inline-flex items-center select-none transition-opacity hover:opacity-90 active:scale-[0.99] focus:outline-none focus:ring-1 focus:ring-tedx-red rounded"
            aria-label="VolTex Home"
          >
            <Image
              src="/voltex-logo.png"
              alt="VolTex logo"
              width={140}
              height={32}
              priority
              className="h-7 sm:h-8 w-auto object-contain brightness-100"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-300">
            {/* Safe rendering: never expose links while auth is unresolved */}
            {authResolved && !currentUser && (
              <>
                <Link
                  href="/#overview"
                  onClick={(e) => handleAnchorClick(e, "overview")}
                  className="hover:text-white transition-colors duration-150 focus:outline-none focus:text-white focus:underline"
                >
                  How It Works
                </Link>
                <Link
                  href="/#leaderboard"
                  onClick={(e) => handleAnchorClick(e, "leaderboard")}
                  className="hover:text-white transition-colors duration-150 focus:outline-none focus:text-white focus:underline"
                >
                  Sample Leaderboard
                </Link>
              </>
            )}

            {authResolved && currentUser && (
              <>
                {currentUser.role === "admin" ? (
                  <>
                    <Link
                      href="/admin"
                      className={`hover:text-white transition-colors duration-150 font-semibold focus:outline-none focus:underline ${
                        pathname === "/admin" ? "text-white underline underline-offset-4" : "text-zinc-300"
                      }`}
                    >
                      Command Center
                    </Link>
                    <Link
                      href="/admin/users"
                      className={`hover:text-white transition-colors duration-150 font-semibold focus:outline-none focus:underline ${
                        pathname === "/admin/users" ? "text-white underline underline-offset-4" : "text-zinc-300"
                      }`}
                    >
                      User Management
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/dashboard"
                    className="hover:text-white transition-colors duration-150 text-white font-semibold focus:outline-none focus:underline"
                  >
                    Dashboard
                  </Link>
                )}
              </>
            )}
          </nav>

          {/* Desktop Auth Controls / CTAs & Theme Toggle */}
          <div className="hidden md:flex items-center gap-2.5">
            <ThemeToggle />

            {!authResolved ? (
              <div className="w-20 h-7" /> // Placeholder preventing layout shift
            ) : !currentUser ? (
              <>
                <Link
                  href="/auth/login"
                  className="text-xs font-medium text-zinc-300 hover:text-white px-2.5 py-1.5 transition-colors focus:outline-none focus:text-white"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className="text-xs font-semibold px-3.5 py-1.5 rounded bg-tedx-red hover:bg-tedx-darkred active:scale-[0.98] text-white transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-tedx-red"
                >
                  Join Challenge
                </Link>
              </>
            ) : (
              <>
                <NotificationBell />
                <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 text-xs font-medium text-zinc-200 hover:text-white bg-zinc-900 border border-zinc-700/80 hover:border-zinc-600 px-3 py-1.5 rounded transition-all active:scale-[0.98] focus:outline-none focus:ring-1 focus:ring-tedx-red"
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                >
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="max-w-[120px] truncate">
                    {currentUser.fullName || currentUser.email}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                </button>

                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-[#111114] border border-zinc-800 rounded-lg shadow-xl py-1 text-xs text-zinc-200 animate-subtle-fade-up">
                    <div className="px-3 py-2 border-b border-zinc-800/80">
                      <div className="font-semibold text-white truncate">
                        {currentUser.fullName || "Volunteer"}
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate font-mono">
                        {currentUser.email}
                      </div>
                      {currentUser.volunteerTeam && (
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {currentUser.volunteerTeam}
                        </div>
                      )}
                      <span className="inline-block mt-1 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {currentUser.role}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setProfileModalOpen(true);
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Profile Details</span>
                    </button>

                    {/* Only show navigation link if not already on the destination page */}
                    {currentUser.role === "admin" && (
                      <>
                        {pathname !== "/admin" && (
                          <Link
                            href="/admin"
                            className="block px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors border-t border-zinc-800/50"
                          >
                            Admin Command Center
                          </Link>
                        )}
                        <Link
                          href="/admin/users"
                          className="block px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors border-t border-zinc-800/50"
                        >
                          User Management
                        </Link>
                      </>
                    )}
                    {currentUser.role !== "admin" && pathname !== "/dashboard" && (
                      <Link
                        href="/dashboard"
                        className="block px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors border-t border-zinc-800/50"
                      >
                        Volunteer Dashboard
                      </Link>
                    )}

                    {canInstall && (
                      <button
                        type="button"
                        onClick={async () => {
                          setUserDropdownOpen(false);
                          await promptInstall();
                        }}
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors border-t border-zinc-800/50"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-tedx-red" />
                        <span>Install App</span>
                      </button>
                    )}

                    <button
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors border-t border-zinc-800/80 disabled:opacity-50"
                    >
                      {isSigningOut ? (
                        <>
                          <LoadingSpinner size="xs" colorScheme="red-dark" label="Signing out" />
                          <span>Signing out...</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

          {/* Mobile Right Controls: Notification Bell + Theme Toggle + Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            {currentUser && <NotificationBell />}
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-zinc-300 hover:text-white active:scale-95 transition-all focus:outline-none focus:ring-1 focus:ring-tedx-red rounded"
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-[#0c0c0f] px-4 py-4 space-y-3 animate-subtle-fade-up shadow-xl">
          {!authResolved ? (
            <div className="h-6 w-32 bg-zinc-800/60 animate-pulse rounded" />
          ) : !currentUser ? (
            <>
              <Link
                href="/#overview"
                onClick={(e) => handleAnchorClick(e, "overview")}
                className="block text-zinc-300 hover:text-white py-1.5 transition-colors text-xs font-medium"
              >
                How It Works
              </Link>
              <Link
                href="/#leaderboard"
                onClick={(e) => handleAnchorClick(e, "leaderboard")}
                className="block text-zinc-300 hover:text-white py-1.5 transition-colors text-xs font-medium"
              >
                Sample Leaderboard
              </Link>
              <div className="pt-3 border-t border-zinc-800/80 flex flex-col gap-2">
                <Link
                  href="/auth/register"
                  className="text-center py-2.5 rounded bg-tedx-red text-white text-xs font-semibold active:scale-[0.98] transition-all shadow-xs"
                >
                  Join Challenge
                </Link>
                <Link
                  href="/auth/login"
                  className="text-center py-2.5 rounded border border-zinc-800 text-zinc-300 hover:text-white text-xs active:scale-[0.98] transition-all font-medium bg-zinc-900/60"
                >
                  Sign In
                </Link>
                {canInstall && (
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false);
                      await promptInstall();
                    }}
                    className="w-full text-center flex items-center justify-center gap-2 py-2.5 rounded border border-zinc-800 text-zinc-300 hover:text-white text-xs active:scale-[0.98] transition-all font-medium bg-zinc-900/40"
                  >
                    <Smartphone className="w-3.5 h-3.5 text-tedx-red" />
                    <span>Install App</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="pb-2 border-b border-zinc-800/80">
                <div className="font-semibold text-white text-xs truncate">
                  {currentUser.fullName || "Volunteer"}
                </div>
                <div className="text-[10px] text-zinc-400 truncate font-mono">
                  {currentUser.email}
                </div>
                {currentUser.volunteerTeam && (
                  <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {currentUser.volunteerTeam}
                  </div>
                )}
                <span className="inline-block mt-1 text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {currentUser.role}
                </span>
              </div>

              {currentUser.role === "admin" ? (
                <>
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-zinc-200 hover:text-white py-1.5 transition-colors text-xs font-medium"
                  >
                    Admin Command Center
                  </Link>
                  <Link
                    href="/admin/users"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-zinc-200 hover:text-white py-1.5 transition-colors text-xs font-medium"
                  >
                    User Management
                  </Link>
                </>
              ) : (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-zinc-200 hover:text-white py-1.5 transition-colors text-xs font-medium"
                >
                  Dashboard
                </Link>
              )}

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="w-full text-left flex items-center gap-2 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors font-medium"
              >
                <User className="w-3.5 h-3.5 text-zinc-400" />
                <span>Profile Details</span>
              </button>

              {canInstall && (
                <button
                  type="button"
                  onClick={async () => {
                    setMobileMenuOpen(false);
                    await promptInstall();
                  }}
                  className="w-full text-left flex items-center gap-2 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors font-medium"
                >
                  <Smartphone className="w-3.5 h-3.5 text-tedx-red" />
                  <span>Install App</span>
                </button>
              )}

              <div className="pt-3 border-t border-zinc-800/80">
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full text-left flex items-center gap-2 py-2 text-xs text-red-400 hover:text-red-300 transition-colors font-medium disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <>
                      <LoadingSpinner size="xs" colorScheme="red-dark" label="Signing out" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Profile Details Modal */}
      {profileModalOpen && currentUser && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-subtle-fade-up"
        >
          <div className="bg-[#111114] border border-zinc-800 rounded-lg max-w-sm w-full p-5 space-y-4 shadow-2xl text-zinc-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-tedx-red/10 border border-tedx-red/20 flex items-center justify-center text-tedx-red font-bold text-xs">
                  {(currentUser.fullName || currentUser.email || "U")[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Volunteer Profile</h3>
                  <p className="text-[10px] text-zinc-400">VolTex Challenge Participant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors"
                aria-label="Close Profile Dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Full Name</span>
                <span className="font-medium text-white truncate max-w-[180px]">
                  {currentUser.fullName || "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Email</span>
                <span className="font-mono text-zinc-300 truncate max-w-[180px]">
                  {currentUser.email || "—"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-zinc-800/60">
                <span className="text-zinc-400">Assigned Team</span>
                <span className="font-medium text-zinc-200 truncate max-w-[180px]">
                  {currentUser.volunteerTeam || "Unassigned"}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-zinc-400">Role</span>
                <span className="font-mono uppercase text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  {currentUser.role}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="px-3.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Add to Home Screen Instructions Modal */}
      <PwaInstallModal
        isOpen={showInstructionsModal}
        onClose={closeInstallInstructions}
        platform={instructionPlatform}
      />
    </header>
  );
}
