"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, ExternalLink, RefreshCw } from "lucide-react";
import { AppNotification } from "@/types";
import { formatDateTime } from "@/lib/utils";

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (data && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
      }
    } catch {
      // Non-intrusive fallback on network failure
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Poll periodically every 60 seconds when tab is active
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click or touch
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleMarkAsRead = async (id: string, linkUrl?: string | null) => {
    try {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });

      if (linkUrl) {
        setIsOpen(false);
        router.push(linkUrl);
      }
    } catch {
      // Retain optimistic state
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setIsMarkingAll(true);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
    } catch {
      // Non-critical error
    } finally {
      setIsMarkingAll(false);
    }
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors focus:outline-none focus:ring-1 focus:ring-tedx-red"
        title="Notifications"
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
      >
        <Bell className="w-4 h-4 text-zinc-300 hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-tedx-red text-[10px] font-bold text-white font-mono shadow-xs animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 max-w-[calc(100vw-24px)] sm:max-w-none sm:w-96 rounded-lg border border-zinc-800 bg-[#09090b] shadow-2xl z-50 text-xs overflow-hidden animate-subtle-fade-up">
          {/* Header */}
          <div className="px-3.5 py-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-bold text-white truncate">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-tedx-red/20 text-tedx-red border border-tedx-red/30 font-semibold shrink-0">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={isMarkingAll}
                  className="text-[11px] text-zinc-400 hover:text-white underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={fetchNotifications}
                disabled={isLoading}
                title="Refresh notifications"
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[min(65vh,420px)] sm:max-h-[380px] overflow-y-auto divide-y divide-zinc-800/60">
            {notifications.length === 0 ? (
              <div className="py-8 px-4 text-center text-zinc-500">
                <Bell className="w-6 h-6 mx-auto mb-2 text-zinc-700 opacity-60" />
                <p className="font-medium text-zinc-400">No notifications yet</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Updates on referral claims and ticket status will appear here.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 transition-colors flex gap-2.5 items-start ${
                    n.isRead
                      ? "bg-transparent text-zinc-400"
                      : "bg-zinc-900/60 text-zinc-200 border-l-2 border-tedx-red"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1.5 sm:gap-2">
                      <p className={`font-semibold text-xs truncate ${n.isRead ? "text-zinc-300" : "text-white"}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                        {formatDateTime(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug break-words">
                      {n.message}
                    </p>

                    {n.linkUrl && (
                      <button
                        onClick={() => handleMarkAsRead(n.id, n.linkUrl)}
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-tedx-red hover:underline"
                      >
                        <span>View details</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>

                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(n.id)}
                      className="text-zinc-500 hover:text-white p-1 rounded transition-colors shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
