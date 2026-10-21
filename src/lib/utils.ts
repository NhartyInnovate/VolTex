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

/**
 * Maps Supabase Auth errors to safe, user-friendly, and actionable messages.
 * Prevents raw cryptic errors from leaking internal implementation details
 * while clearly diagnosing common operational issues like SMTP dispatch failures,
 * email rate limits, and unconfirmed credentials.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (!error) {
    return "An unexpected authentication error occurred. Please try again.";
  }

  // Extract error properties safely
  const rawMsg = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message || "")
    : typeof error === "string"
    ? error
    : "";

  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code || "")
    : "";

  const status = typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status: unknown }).status)
    : 0;

  const lowerMsg = rawMsg.toLowerCase();
  const lowerCode = code.toLowerCase();

  // 1. Rate Limiting (HTTP 429 or over_email_send_rate_limit)
  if (
    status === 429 ||
    lowerCode.includes("rate_limit") ||
    lowerCode.includes("over_email_send_rate_limit") ||
    lowerMsg.includes("rate limit") ||
    lowerMsg.includes("too many requests")
  ) {
    return "Email delivery limit reached. The verification email could not be sent right now. Please wait a few minutes before trying again or contact the event organizers.";
  }

  // 2. SMTP / Confirmation Email Dispatch Failure
  if (
    lowerMsg.includes("error sending confirmation email") ||
    lowerCode === "email_send_failed" ||
    lowerMsg.includes("failed to send confirmation") ||
    lowerMsg.includes("error sending email")
  ) {
    return "The system encountered an issue sending your confirmation email. Your account may have been created, but confirmation is pending delivery. Please verify that your email address is correct and try again shortly, or contact the organizers if this persists.";
  }

  // 3. Unauthorized recipient / restricted domain
  if (
    lowerCode.includes("email_address_not_authorized") ||
    lowerMsg.includes("email address not authorized") ||
    lowerMsg.includes("not authorized")
  ) {
    return "This email address cannot receive confirmation emails under the current mail configuration. Please use your standard email address or contact support.";
  }

  // 4. Invalid email format
  if (
    lowerCode.includes("email_address_invalid") ||
    lowerMsg.includes("invalid email") ||
    lowerMsg.includes("unable to validate email")
  ) {
    return "Please enter a valid email address.";
  }

  // 5. Existing user registration conflict
  if (
    lowerCode.includes("email_exists") ||
    lowerCode.includes("user_already_exists") ||
    lowerMsg.includes("user already registered") ||
    lowerMsg.includes("already registered")
  ) {
    return "An account with this email address already exists. Please sign in instead.";
  }

  // 6. Unconfirmed email during sign-in
  if (
    lowerCode.includes("email_not_confirmed") ||
    lowerMsg.includes("email not confirmed")
  ) {
    return "Your email address has not been confirmed yet. Please check your inbox for the confirmation link before signing in.";
  }

  // 7. Invalid credentials
  if (
    lowerCode.includes("invalid_credentials") ||
    lowerMsg.includes("invalid login credentials")
  ) {
    return "Invalid email or password. Please verify your credentials and try again.";
  }

  // 8. Password requirements
  if (lowerMsg.includes("password should be at least")) {
    return "Password should be at least 6 characters.";
  }

  // Fallback to cleaned message if non-empty, otherwise standard generic message
  return rawMsg.trim() ? rawMsg : "An unexpected authentication error occurred. Please try again.";
}

/**
 * Validates and sanitizes a target redirect path to prevent open redirect vulnerabilities.
 * Enforces strictly relative paths starting with a single '/' and rejects protocol-relative ('//')
 * or backslash ('\') paths.
 */
export function getSafeRedirectPath(rawPath?: string | null, defaultFallback: string = "/dashboard"): string {
  if (!rawPath || typeof rawPath !== "string") {
    return defaultFallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath.trim());
  } catch {
    return defaultFallback;
  }

  // Reject protocol-relative '//', backslashes, or control schemes
  if (
    !decoded.startsWith("/") ||
    decoded.startsWith("//") ||
    decoded.startsWith("/\\") ||
    decoded.includes(":") ||
    decoded.includes("\\")
  ) {
    return defaultFallback;
  }

  return decoded;
}

