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
 * with trailing slash removed. Falls back to window.location.origin in browser,
 * or localhost:3000 during SSR.
 */
export function getAppUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  // Trim trailing slash
  url = url.replace(/\/+$/, "");
  return url;
}

