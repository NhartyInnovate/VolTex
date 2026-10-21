import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-NG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}


/**
 * Returns the base application URL configured via NEXT_PUBLIC_APP_URL,
 * with trailing slash removed.
 * In production browser environments, window.location.origin is preferred
 * to prevent accidental localhost fallbacks.
 */
export function getAppUrl(): string {
  // If in browser and not on localhost, use current origin
  if (typeof window !== "undefined" && window.location.origin && !window.location.origin.includes("localhost")) {
    return window.location.origin.replace(/\/+$/, "");
  }

  // Next, use explicitly configured environment variable
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // In browser on localhost or fallback
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

