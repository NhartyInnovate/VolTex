"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AdminManagedUser } from "@/types";
import { getSafeVolunteerTeam } from "@/config/constants";
import { formatDate } from "@/lib/utils";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  Users,
  Search,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  RefreshCw,
  ArrowLeft,
  Ticket,
} from "lucide-react";

export default function AdminUsersPage() {
  const router = useRouter();

  // State
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingServiceKey, setMissingServiceKey] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<"all" | "admin" | "volunteer">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Deletion Modal State
  const [userToDelete, setUserToDelete] = useState<AdminManagedUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState("");

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    setMissingServiceKey(false);

    try {
      const res = await fetch("/api/admin/users", {
        method: "GET",
        headers: { "Cache-Control": "no-cache" },
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "MISSING_SERVICE_ROLE_KEY") {
          setMissingServiceKey(true);
        }
        throw new Error(data.error || "Failed to load users list.");
      }

      setUsers(data.users || []);
      setCurrentAdminId(data.currentAdminId || null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load users.";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Initial verification via Supabase client
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/auth/login?error=Please+sign+in+to+access+administrator+portal.");
        return;
      }
      loadUsers();
    });
  }, [router, loadUsers]);

  // Filtered & Paginated Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.volunteerTeam.toLowerCase().includes(q);

      const matchesRole = selectedRole === "all" || u.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, selectedRole]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage]);

  // Handle User Deletion
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: userToDelete.id,
          confirmedFullName: confirmNameInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete user.");
      }

      setActionSuccess(data.message || `User ${userToDelete.fullName} deleted successfully.`);
      setUserToDelete(null);
      setConfirmNameInput("");
      // Refresh user list
      await loadUsers(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete user.";
      setActionError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6 min-w-0">
      {/* 1. Breadcrumb / Back Link */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Link
          href="/admin"
          className="hover:text-zinc-900 dark:hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Admin Command Center</span>
        </Link>
      </div>

      {/* 2. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              User Management
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 font-medium">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
            View registered volunteers and administrators, monitor submission activity, and remove test accounts securely.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadUsers(true)}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white px-2.5 py-1.5 rounded border border-zinc-300 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 bg-white dark:bg-[#111114] shadow-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* 3. Alerts */}
      {missingServiceKey && (
        <div className="border border-amber-800/60 bg-amber-950/40 text-amber-200 px-4 py-3 rounded text-xs space-y-1">
          <div className="font-semibold flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Missing Supabase Service Role Key</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed">
            The <code className="bg-amber-900/50 px-1 py-0.5 rounded font-mono text-[11px]">SUPABASE_SERVICE_ROLE_KEY</code> environment variable is not configured on this server. This key is required to list verified auth emails and execute administrative account deletions via the Supabase Auth Admin API.
          </p>
        </div>
      )}

      {actionSuccess && (
        <div className="border border-emerald-800/60 bg-emerald-950/40 text-emerald-300 px-3 py-2 rounded text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {actionSuccess}
          </span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="border border-red-800/60 bg-red-950/40 text-red-300 px-3 py-2 rounded text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            {actionError}
          </span>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && !missingServiceKey && (
        <div className="border border-red-800/60 bg-red-950/40 text-red-300 px-4 py-3 rounded text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            {error}
          </span>
          <button
            onClick={() => loadUsers(false)}
            className="px-2 py-1 rounded bg-red-900/60 hover:bg-red-800 text-white font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. Controls: Search & Role Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, or team..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded px-8 py-2 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value as "all" | "admin" | "volunteer");
              setCurrentPage(1);
            }}
            className="bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-2 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors shadow-xs"
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="volunteer">Volunteers ({users.filter((u) => u.role === "volunteer").length})</option>
            <option value="admin">Administrators ({users.filter((u) => u.role === "admin").length})</option>
          </select>
        </div>
      </div>

      {/* 5. Users Table */}
      <div className="border border-zinc-200 dark:border-zinc-800/80 rounded bg-white dark:bg-[#111114] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <LoadingSpinner size="md" colorScheme="red-dark" label="Loading users" />
            <span className="text-xs text-zinc-500">Loading user records...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-500 space-y-1">
            <Users className="w-8 h-8 text-zinc-400 mx-auto opacity-50 mb-2" />
            <div className="font-semibold text-zinc-700 dark:text-zinc-300">No users found</div>
            <p className="text-[11px] text-zinc-500">
              {searchQuery ? "No registered users match your search criteria." : "No registered user accounts found in the database."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-[10px] font-medium bg-zinc-50 dark:bg-[#0e0e11]">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 hidden md:table-cell">Team</th>
                  <th className="py-3 px-4 text-center">Submissions</th>
                  <th className="py-3 px-4 hidden sm:table-cell">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
                {paginatedUsers.map((u) => {
                  const isCurrentAdmin = currentAdminId === u.id;
                  const isOnlyAdmin = u.role === "admin" && users.filter((x) => x.role === "admin").length <= 1;
                  const canDelete = !isCurrentAdmin && !isOnlyAdmin;

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* User Info */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <span>{u.fullName || "Unnamed User"}</span>
                          {isCurrentAdmin && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate mt-0.5">
                          {u.email || "No email available"}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3 px-4">
                        {u.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                            <Shield className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                            <UserCheck className="w-2.5 h-2.5" />
                            Volunteer
                          </span>
                        )}
                      </td>

                      {/* Team */}
                      <td className="py-3 px-4 hidden md:table-cell text-zinc-600 dark:text-zinc-400">
                        {getSafeVolunteerTeam(u.volunteerTeam)}
                      </td>

                      {/* Submissions */}
                      <td className="py-3 px-4 text-center font-mono">
                        <div className="text-zinc-900 dark:text-zinc-200 font-semibold flex items-center justify-center gap-1">
                          <Ticket className="w-3 h-3 text-zinc-400" />
                          <span>{u.referralCount}</span>
                        </div>
                        {u.approvedTickets > 0 && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            ({u.approvedTickets} approved)
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 hidden sm:table-cell text-zinc-500 dark:text-zinc-400 text-[11px] font-mono">
                        {formatDate(u.createdAt)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => {
                              setUserToDelete(u);
                              setConfirmNameInput("");
                            }}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-xs font-medium"
                            title="Delete this user and all associated ticket claims"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        ) : (
                          <span
                            className="text-[10px] text-zinc-400 font-mono italic"
                            title={isCurrentAdmin ? "Cannot delete your own active administrator account" : "Cannot delete the last remaining administrator"}
                          >
                            Protected
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Pagination Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#0e0e11] flex items-center justify-between text-xs text-zinc-500">
          <div>
            Showing <span className="font-semibold text-zinc-700 dark:text-zinc-300">{filteredUsers.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{Math.min(currentPage * pageSize, filteredUsers.length)}</span> of{" "}
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{filteredUsers.length}</span> user accounts
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono text-[11px] px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-700 dark:text-zinc-300"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7. Deletion Confirmation Modal */}
      {userToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-subtle-fade-up"
        >
          <div className="w-full max-w-md bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl p-5 sm:p-6 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                  Confirm User Deletion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <p>
                You are about to permanently delete the user account for{" "}
                <strong className="text-zinc-900 dark:text-white font-semibold">
                  {userToDelete.fullName || userToDelete.email}
                </strong>{" "}
                (<span className="font-mono text-[11px] text-zinc-500">{userToDelete.email}</span>).
              </p>

              <div className="p-3 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-[11px] text-red-800 dark:text-red-300 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Irreversible Consequences:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-red-700 dark:text-red-200/90">
                  <li>
                    The Supabase Auth account and login credentials will be removed.
                  </li>
                  <li>
                    The volunteer profile record will be deleted.
                  </li>
                  <li>
                    <strong>{userToDelete.referralCount} ticket claim(s)</strong> submitted by this user will be deleted immediately.
                  </li>
                  <li>
                    Any points earned on the live leaderboard will be removed.
                  </li>
                </ul>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> to confirm:
                </label>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={confirmNameInput}
                  onChange={(e) => setConfirmNameInput(e.target.value)}
                  disabled={isDeleting}
                  className="w-full bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded px-3 py-1.5 text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-red-500 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800/80">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={isDeleting || confirmNameInput.trim().toUpperCase() !== "DELETE"}
                className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-700 active:scale-98 text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <LoadingSpinner size="xs" colorScheme="red-dark" label="Deleting user" />
                    <span>Deleting User...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm & Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
