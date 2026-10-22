/**
 * VolTex Transactional Email Utility (Stage B2)
 *
 * Implements server-side email notifications via the Resend REST API using native fetch.
 * Zero external packages required.
 *
 * Features:
 * - Server-only boundary guard preventing accidental execution in browser bundles
 * - Branded, mobile-responsive HTML & plain-text templates for:
 *   1. Admin: New referral submitted (including formatted submission timestamp)
 *   2. Volunteer: Referral approved (+points, cumulative score, leaderboard rank)
 *   3. Volunteer: Referral rejected (with sanitized admin rejection notes)
 * - Strict HTML escaping, subject newline sanitization, recipient validation, and URL protocol validation
 * - Resend Idempotency-Key header support (24-hour provider-level idempotency window)
 * - In-flight + sliding-TTL in-memory deduplication with status-transition invalidation
 *   and immediate retry capability after failed sends
 * - Non-blocking dispatch: failures log concise, sanitized warnings without throwing
 */

export function assertServerOnly(win: unknown = typeof window !== "undefined" ? window : undefined): void {
  if (typeof win !== "undefined") {
    throw new Error(
      "VolTex email utility (src/lib/email.ts) is strictly server-only and cannot be imported or executed in browser client code."
    );
  }
}

// Enforce server-only boundary at module evaluation time
assertServerOnly();

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

export interface AdminNewReferralEmailProps {
  volunteerName: string;
  volunteerTeam: string;
  ticketType: string;
  ticketQuantity: number;
  orderReference?: string | null;
  buyerName: string;
  referralId: string;
  submittedAt?: string | null;
  appUrl?: string;
}

export interface VolunteerApprovedEmailProps {
  volunteerName: string;
  to: string;
  ticketType: string;
  ticketQuantity: number;
  orderReference?: string | null;
  pointsEarned: number;
  cumulativePoints?: number | null;
  rank?: number | null;
  adminNotes?: string | null;
  referralId: string;
  appUrl?: string;
}

export interface VolunteerRejectedEmailProps {
  volunteerName: string;
  to: string;
  ticketType: string;
  ticketQuantity: number;
  orderReference?: string | null;
  rejectionReason?: string | null;
  referralId: string;
  appUrl?: string;
}

const DEFAULT_APP_URL = "https://voltex.nkaylabs.com";
const DEFAULT_REJECTION_REASON = "Record does not match Meeteor Hub attendee list";
const DEFAULT_APPROVAL_NOTE_PATTERN = /^(approved:\s*)?verified against meeteor hub records\.?$/i;
const DEFAULT_REJECTION_NOTE_PATTERN = /^(declined:\s*)?record does not match meeteor hub attendee list\.?$/i;
const EMAIL_ADDRESS_REGEX = /^[^\s@<>,"';]+@[^\s@<>,"';]+\.[^\s@<>,"';]+$/;

/**
 * Escapes characters that have special meaning in HTML to prevent XSS / injection.
 */
export function escapeHtml(unsafe: unknown): string {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strips CR/LF newlines and collapses whitespace in email subject lines to prevent header injection.
 */
export function sanitizeSubject(subject: unknown): string {
  if (subject === null || subject === undefined) return "";
  return String(subject)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Validates whether a string is a syntactically well-formed email address.
 */
export function isValidEmailAddress(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  return trimmed.length > 3 && trimmed.length <= 254 && EMAIL_ADDRESS_REGEX.test(trimmed);
}

/**
 * Parses, trims, validates, and deduplicates a comma/semicolon-separated string or array of email addresses.
 */
export function parseAndValidateEmailList(input: string | string[] | undefined | null): string[] {
  if (!input) return [];
  const rawList = Array.isArray(input)
    ? input.flatMap((item) => (typeof item === "string" ? item.split(/[,;]/) : []))
    : typeof input === "string"
      ? input.split(/[,;]/)
      : [];

  const seen = new Set<string>();
  const valid: string[] = [];

  for (const entry of rawList) {
    const cleaned = entry.trim().replace(/^["']+|["']+$/g, "").trim();
    if (!cleaned) continue;
    if (isValidEmailAddress(cleaned)) {
      const lower = cleaned.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        valid.push(cleaned);
      }
    }
  }

  return valid;
}

/**
 * Validates and normalizes the base application URL.
 * Enforces http:// or https:// protocol and falls back safely to https://voltex.nkaylabs.com.
 */
export function getCleanAppUrl(override?: string): string {
  const candidates = [override, process.env.NEXT_PUBLIC_APP_URL, DEFAULT_APP_URL];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        continue;
      }
      const cleanPath = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/+$/, "");
      return `${parsed.origin}${cleanPath}`;
    } catch {
      continue;
    }
  }

  return DEFAULT_APP_URL;
}

/**
 * Formats an ISO timestamp into a readable UTC string for email display, or returns null if invalid.
 */
export function formatSubmittedAt(isoTimestamp?: string | null): string | null {
  if (!isoTimestamp || typeof isoTimestamp !== "string") return null;
  const trimmed = isoTimestamp.trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

/**
 * Filters approval notes so default approval boilerplate or stale rejection notes are not shown on approval emails.
 */
export function sanitizeApprovalNote(note?: string | null): string | null {
  if (!note || typeof note !== "string") return null;
  const trimmed = note.trim();
  if (!trimmed) return null;

  if (
    DEFAULT_APPROVAL_NOTE_PATTERN.test(trimmed) ||
    DEFAULT_REJECTION_NOTE_PATTERN.test(trimmed) ||
    /^declined:/i.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

/**
 * Normalizes rejection reasons so default approval notes cannot leak into rejection emails,
 * and strips redundant "Declined:" prefixes before display.
 */
export function sanitizeRejectionReason(reason?: string | null): string {
  if (!reason || typeof reason !== "string") return DEFAULT_REJECTION_REASON;
  const trimmed = reason.trim();
  if (!trimmed) return DEFAULT_REJECTION_REASON;

  // Prevent stale approval notes from appearing as the rejection reason
  if (DEFAULT_APPROVAL_NOTE_PATTERN.test(trimmed)) {
    return DEFAULT_REJECTION_REASON;
  }

  const withoutPrefix = trimmed.replace(/^declined:\s*/i, "").trim();
  return withoutPrefix.length > 0 ? withoutPrefix : DEFAULT_REJECTION_REASON;
}

/**
 * In-memory dispatch tracker to prevent duplicate sends from rapid concurrent or repeated requests
 * within the same serverless instance.
 * - `inFlightDispatchSet` blocks concurrent overlapping calls (solving TOCTOU races).
 * - `recentDispatchMap` blocks repeated calls within a 5-minute sliding TTL after a successful send.
 * - Failed sends remove the in-flight lock without recording in `recentDispatchMap`, allowing retries.
 */
const recentDispatchMap = new Map<string, number>();
const inFlightDispatchSet = new Set<string>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function isRecentEmailDispatch(key: string, ttlMs: number = DEDUP_TTL_MS): boolean {
  if (inFlightDispatchSet.has(key)) return true;
  const lastTime = recentDispatchMap.get(key);
  if (!lastTime) return false;
  if (Date.now() - lastTime > ttlMs) {
    recentDispatchMap.delete(key);
    return false;
  }
  return true;
}

export function recordEmailDispatch(key: string): void {
  recentDispatchMap.set(key, Date.now());
  if (recentDispatchMap.size > 500) {
    const now = Date.now();
    recentDispatchMap.forEach((time, k) => {
      if (now - time > DEDUP_TTL_MS) {
        recentDispatchMap.delete(k);
      }
    });
  }
}

export function clearEmailDispatchKey(key: string): void {
  recentDispatchMap.delete(key);
  inFlightDispatchSet.delete(key);
}

export function clearRecentEmailDispatches(): void {
  recentDispatchMap.clear();
  inFlightDispatchSet.clear();
}

/**
 * Dispatches an email via the Resend REST API using native fetch.
 * Strictly server-only. Never exposes API keys or internal credentials.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  idempotencyKey,
}: SendEmailOptions): Promise<SendEmailResult> {
  assertServerOnly();

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.warn("[VolTex Email] RESEND_API_KEY is not configured; skipping email dispatch.");
    return {
      success: false,
      skipped: true,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const defaultFrom = "VolTex <noreply@mail.nkaylabs.com>";
  const fromAddress = (from || process.env.RESEND_FROM_EMAIL || defaultFrom).trim();

  // Parse and validate recipient list
  const recipients = parseAndValidateEmailList(to);

  if (recipients.length === 0) {
    console.warn("[VolTex Email] No valid recipient addresses provided; skipping dispatch.");
    return {
      success: false,
      skipped: true,
      error: "No valid recipients provided.",
    };
  }

  const cleanSubject = sanitizeSubject(subject);

  const payload: Record<string, unknown> = {
    from: fromAddress,
    to: recipients,
    subject: cleanSubject,
    html,
    text,
  };

  if (replyTo && isValidEmailAddress(replyTo)) {
    payload.reply_to = replyTo.trim();
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  if (idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0) {
    // Resend supports Idempotency-Key up to 256 characters (retained for 24 hours)
    headers["Idempotency-Key"] = idempotencyKey.trim().slice(0, 256);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000); // 9-second timeout covering request + body

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsedBody: Record<string, unknown> | null = null;
    if (rawText && rawText.trim().length > 0) {
      try {
        const json = JSON.parse(rawText);
        if (json && typeof json === "object") {
          parsedBody = json as Record<string, unknown>;
        }
      } catch {
        parsedBody = null;
      }
    }

    if (!response.ok) {
      const errMsg =
        typeof parsedBody?.message === "string" && parsedBody.message.trim().length > 0
          ? parsedBody.message.trim()
          : `Resend HTTP error ${response.status}${response.statusText ? ` (${response.statusText})` : ""}`;

      console.warn(`[VolTex Email] Resend API returned error (status ${response.status}): ${errMsg}`);
      return {
        success: false,
        error: errMsg,
      };
    }

    const messageId = typeof parsedBody?.id === "string" ? parsedBody.id : undefined;

    return {
      success: true,
      messageId,
    };
  } catch (err: unknown) {
    const isAbort =
      (err instanceof Error && err.name === "AbortError") ||
      (typeof err === "object" &&
        err !== null &&
        "name" in err &&
        (err as { name?: unknown }).name === "AbortError");

    const errorMsg = isAbort
      ? "Request timed out after 9 seconds"
      : err instanceof Error
        ? err.message
        : "Unknown network error";

    console.warn(`[VolTex Email] Network exception during email dispatch: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// -----------------------------------------------------------------------------
// Email Template Renderers
// -----------------------------------------------------------------------------

function renderBaseLayout({
  title,
  preheader,
  contentHtml,
  appUrl,
}: {
  title: string;
  preheader: string;
  contentHtml: string;
  appUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; -webkit-font-smoothing: antialiased;">
  <!-- Preheader text for inbox preview -->
  <div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: #fff; opacity: 0;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f5; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e4e4e7; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <!-- Top Accent Bar (TEDx Red) -->
          <tr>
            <td style="height: 4px; background-color: #e62b1e; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 24px 28px 16px 28px; border-bottom: 1px solid #f4f4f5;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 16px; font-weight: 800; letter-spacing: -0.3px; color: #18181b;">
                      <span style="color: #e62b1e;">TEDx</span>Gwarinpa
                    </span>
                    <span style="font-size: 12px; font-weight: 600; color: #71717a; margin-left: 8px; padding-left: 8px; border-left: 1px solid #d4d4d8;">
                      VolTex Sales Challenge
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 24px 28px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 16px 28px 24px 28px; background-color: #fafafa; border-top: 1px solid #f4f4f5; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #71717a;">
                This is an automated notification from the TEDxGwarinpa Volunteer Referral Portal.
              </p>
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">
                <a href="${escapeHtml(appUrl)}" style="color: #e62b1e; text-decoration: none; font-weight: 500;">VolTex Portal</a> &bull; Powered by TEDxGwarinpa Volunteer Operations
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. Admin: New Referral Submission Template
 */
export function renderAdminNewReferralEmail(props: AdminNewReferralEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const appUrl = getCleanAppUrl(props.appUrl);
  const reviewUrl = `${appUrl}/admin?tab=referrals&id=${encodeURIComponent(props.referralId)}`;
  const subject = sanitizeSubject(
    `New Referral: ${props.volunteerName} submitted ${props.ticketQuantity}x ${props.ticketType}`
  );
  const preheader = `${props.volunteerName} (${props.volunteerTeam}) submitted a claim for ${props.ticketQuantity}x ${props.ticketType}.`;
  const formattedTimestamp = formatSubmittedAt(props.submittedAt);

  const contentHtml = `
    <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #09090b; letter-spacing: -0.3px;">
      New Ticket Referral Submitted
    </h1>
    <p style="margin: 0 0 20px 0; font-size: 13px; color: #52525b; line-height: 1.5;">
      A volunteer has submitted a new ticket referral claim awaiting administrator verification.
    </p>

    <!-- Details Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 12px; line-height: 1.6; color: #334155;">
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Volunteer:</strong>
            ${escapeHtml(props.volunteerName)}
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Volunteer Team:</strong>
            ${escapeHtml(props.volunteerTeam)}
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Ticket Type:</strong>
            ${escapeHtml(props.ticketType)}
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Ticket Quantity:</strong>
            ${escapeHtml(props.ticketQuantity)}
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Buyer Name:</strong>
            ${escapeHtml(props.buyerName)}
          </div>
          ${
            props.orderReference
              ? `<div style="margin-bottom: ${formattedTimestamp ? "6px" : "0"};">
                  <strong style="color: #0f172a; width: 130px; display: inline-block;">Order Reference:</strong>
                  <span style="font-family: monospace; font-size: 12px; color: #09090b; background-color: #e2e8f0; padding: 2px 5px; border-radius: 4px;">
                    ${escapeHtml(props.orderReference)}
                  </span>
                </div>`
              : ""
          }
          ${
            formattedTimestamp
              ? `<div>
                  <strong style="color: #0f172a; width: 130px; display: inline-block;">Submitted At:</strong>
                  ${escapeHtml(formattedTimestamp)}
                </div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- Call to action button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td align="left">
          <a href="${escapeHtml(reviewUrl)}" style="display: inline-block; background-color: #e62b1e; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 22px; border-radius: 5px;">
            Review in Admin Portal &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;

  const text = `
TEDxGwarinpa VolTex • New Referral Submitted

Volunteer: ${props.volunteerName} (${props.volunteerTeam})
Ticket Type: ${props.ticketType}
Quantity: ${props.ticketQuantity}
Buyer Name: ${props.buyerName}
${props.orderReference ? `Order Reference: ${props.orderReference}\n` : ""}${
    formattedTimestamp ? `Submitted At: ${formattedTimestamp}\n` : ""
  }
Review and verify this claim in the administrator portal:
${reviewUrl}
`.trim();

  return {
    subject,
    html: renderBaseLayout({ title: subject, preheader, contentHtml, appUrl }),
    text,
  };
}

/**
 * 2. Volunteer: Referral Approved Template
 */
export function renderVolunteerApprovedEmail(props: VolunteerApprovedEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const appUrl = getCleanAppUrl(props.appUrl);
  const dashboardUrl = `${appUrl}/dashboard?tab=referrals&id=${encodeURIComponent(props.referralId)}`;
  const subject = sanitizeSubject(`Referral Approved: +${props.pointsEarned} points earned! 🎉`);
  const preheader = `Your ticket claim for ${props.ticketQuantity}x ${props.ticketType} was verified. Total score: ${props.cumulativePoints ?? props.pointsEarned} pts.`;
  const cleanAdminNote = sanitizeApprovalNote(props.adminNotes);

  const contentHtml = `
    <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #09090b; letter-spacing: -0.3px;">
      Referral Claim Approved!
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #52525b; line-height: 1.5;">
      Hi ${escapeHtml(props.volunteerName)}, your ticket sales claim has been verified by the TEDxGwarinpa admin team.
    </p>

    <!-- Score Highlight Banner -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 14px 18px; text-align: center;">
          <span style="font-size: 24px; font-weight: 800; color: #059669; letter-spacing: -0.5px;">
            +${escapeHtml(props.pointsEarned)} Points
          </span>
          ${
            props.cumulativePoints !== null && props.cumulativePoints !== undefined
              ? `<div style="font-size: 12px; font-weight: 600; color: #047857; margin-top: 4px;">
                  Total Score: ${escapeHtml(props.cumulativePoints)} pts${
                  props.rank ? ` &bull; Leaderboard Rank: #${escapeHtml(props.rank)}` : ""
                }
                </div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- Claim Details Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 12px; line-height: 1.6; color: #334155;">
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Ticket Type:</strong>
            ${escapeHtml(props.ticketType)}
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Quantity:</strong>
            ${escapeHtml(props.ticketQuantity)}
          </div>
          ${
            props.orderReference
              ? `<div style="margin-bottom: ${cleanAdminNote ? "6px" : "0"};">
                  <strong style="color: #0f172a; width: 130px; display: inline-block;">Order Reference:</strong>
                  <span style="font-family: monospace; font-size: 12px; color: #09090b; background-color: #e2e8f0; padding: 2px 5px; border-radius: 4px;">
                    ${escapeHtml(props.orderReference)}
                  </span>
                </div>`
              : ""
          }
          ${
            cleanAdminNote
              ? `<div>
                  <strong style="color: #0f172a; width: 130px; display: inline-block;">Admin Notes:</strong>
                  <span style="color: #52525b; font-style: italic;">
                    ${escapeHtml(cleanAdminNote)}
                  </span>
                </div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- Call to action button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td align="left">
          <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background-color: #e62b1e; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 22px; border-radius: 5px;">
            View Leaderboard &amp; Dashboard &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;

  const text = `
TEDxGwarinpa VolTex • Referral Claim Approved

Hi ${props.volunteerName},

Great news! Your ticket sales claim has been verified.

Points Earned: +${props.pointsEarned} pts
${props.cumulativePoints !== null && props.cumulativePoints !== undefined ? `Total Score: ${props.cumulativePoints} pts\n` : ""}${
    props.rank ? `Leaderboard Rank: #${props.rank}\n` : ""
  }
Ticket: ${props.ticketQuantity}x ${props.ticketType}
${props.orderReference ? `Order Reference: ${props.orderReference}\n` : ""}${
    cleanAdminNote ? `Admin Notes: ${cleanAdminNote}\n` : ""
  }
Check your standing on the volunteer dashboard:
${dashboardUrl}
`.trim();

  return {
    subject,
    html: renderBaseLayout({ title: subject, preheader, contentHtml, appUrl }),
    text,
  };
}

/**
 * 3. Volunteer: Referral Rejected Template
 */
export function renderVolunteerRejectedEmail(props: VolunteerRejectedEmailProps): {
  subject: string;
  html: string;
  text: string;
} {
  const appUrl = getCleanAppUrl(props.appUrl);
  const dashboardUrl = `${appUrl}/dashboard?tab=referrals&id=${encodeURIComponent(props.referralId)}`;
  const subject = sanitizeSubject("Referral Update: Claim not verified");
  const reasonText = sanitizeRejectionReason(props.rejectionReason);
  const preheader = `Your ticket claim for ${props.ticketQuantity}x ${props.ticketType} could not be verified.`;

  const contentHtml = `
    <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #09090b; letter-spacing: -0.3px;">
      Referral Status Update
    </h1>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #52525b; line-height: 1.5;">
      Hi ${escapeHtml(props.volunteerName)}, your ticket referral claim could not be verified at this time.
    </p>

    <!-- Reason Box -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #b91c1c; margin-bottom: 4px;">
            Reason Provided
          </div>
          <div style="font-size: 13px; color: #991b1b; line-height: 1.5;">
            ${escapeHtml(reasonText)}
          </div>
        </td>
      </tr>
    </table>

    <!-- Claim Details Table -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 14px 18px; font-size: 12px; line-height: 1.6; color: #334155;">
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Ticket Type:</strong>
            ${escapeHtml(props.ticketType)}
          </div>
          <div style="margin-bottom: 6px;">
            <strong style="color: #0f172a; width: 130px; display: inline-block;">Quantity:</strong>
            ${escapeHtml(props.ticketQuantity)}
          </div>
          ${
            props.orderReference
              ? `<div>
                  <strong style="color: #0f172a; width: 130px; display: inline-block;">Order Reference:</strong>
                  <span style="font-family: monospace; font-size: 12px; color: #09090b; background-color: #e2e8f0; padding: 2px 5px; border-radius: 4px;">
                    ${escapeHtml(props.orderReference)}
                  </span>
                </div>`
              : ""
          }
        </td>
      </tr>
    </table>

    <!-- Helpful Next Steps -->
    <p style="margin: 0 0 20px 0; font-size: 12px; color: #71717a; line-height: 1.5;">
      If you believe this is in error, please confirm the buyer's order reference on Meeteor Hub with your attendee or contact your volunteer team lead.
    </p>

    <!-- Call to action button -->
    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td align="left">
          <a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background-color: #e62b1e; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 11px 22px; border-radius: 5px;">
            Check Your Volunteer Dashboard &rarr;
          </a>
        </td>
      </tr>
    </table>
  `;

  const text = `
TEDxGwarinpa VolTex • Referral Status Update

Hi ${props.volunteerName},

Your ticket sales claim could not be verified.

Reason: ${reasonText}

Ticket: ${props.ticketQuantity}x ${props.ticketType}
${props.orderReference ? `Order Reference: ${props.orderReference}\n` : ""}
If you believe this was an error, please verify the attendee's order reference on Meeteor or check with your team lead.

View your dashboard:
${dashboardUrl}
`.trim();

  return {
    subject,
    html: renderBaseLayout({ title: subject, preheader, contentHtml, appUrl }),
    text,
  };
}

// -----------------------------------------------------------------------------
// High-Level Dispatch Helpers
// -----------------------------------------------------------------------------

/**
 * Sends an email notification to administrators when a new referral is submitted.
 * Non-blocking: logs concise errors and returns status without throwing.
 * Skipped duplicate calls return { success: false, skipped: true } so callers never
 * misreport a suppressed duplicate as a newly dispatched email.
 */
export async function sendAdminNewReferralNotification(
  props: AdminNewReferralEmailProps,
  recipientOverride?: string[]
): Promise<SendEmailResult> {
  const configuredRecipients = parseAndValidateEmailList(
    recipientOverride ?? process.env.ADMIN_NOTIFICATION_EMAILS
  );

  if (configuredRecipients.length === 0) {
    console.warn(
      "[VolTex Email] ADMIN_NOTIFICATION_EMAILS is not configured or contains no valid emails; skipping admin referral email."
    );
    return {
      success: false,
      skipped: true,
      error: "ADMIN_NOTIFICATION_EMAILS is not configured.",
    };
  }

  const dedupKey = `admin_submission_${props.referralId}`;
  if (isRecentEmailDispatch(dedupKey)) {
    return {
      success: false,
      skipped: true,
      error: "Duplicate submission email dispatch prevented.",
    };
  }

  inFlightDispatchSet.add(dedupKey);
  try {
    const { subject, html, text } = renderAdminNewReferralEmail(props);
    const result = await sendEmail({
      to: configuredRecipients,
      subject,
      html,
      text,
      idempotencyKey: `admin-referral-submission/${props.referralId}`,
    });

    if (result.success && !result.skipped) {
      recordEmailDispatch(dedupKey);
    }

    return result;
  } finally {
    inFlightDispatchSet.delete(dedupKey);
  }
}

/**
 * Sends an approval or rejection email notification to the volunteer.
 * Non-blocking: logs concise errors and returns status without throwing.
 * Clears the opposite decision key on status transition so legitimate
 * approved -> rejected -> approved transitions within the TTL window are not suppressed.
 */
export async function sendVolunteerDecisionNotification(
  props: (
    | (VolunteerApprovedEmailProps & { decision: "approved" })
    | (VolunteerRejectedEmailProps & { decision: "rejected" })
  )
): Promise<SendEmailResult> {
  if (!props.to || !isValidEmailAddress(props.to)) {
    console.warn(
      `[VolTex Email] Missing or invalid volunteer email for referral ${props.referralId}; skipping decision email.`
    );
    return {
      success: false,
      skipped: true,
      error: "Volunteer email address is missing or invalid.",
    };
  }

  // Clear opposite decision key so status transitions (e.g. approved -> rejected -> approved) are allowed
  const oppositeDecision = props.decision === "approved" ? "rejected" : "approved";
  clearEmailDispatchKey(`volunteer_decision_${props.referralId}_${oppositeDecision}`);

  const dedupKey = `volunteer_decision_${props.referralId}_${props.decision}`;
  if (isRecentEmailDispatch(dedupKey)) {
    return {
      success: false,
      skipped: true,
      error: "Duplicate decision email dispatch prevented.",
    };
  }

  inFlightDispatchSet.add(dedupKey);
  try {
    const rendered =
      props.decision === "approved"
        ? renderVolunteerApprovedEmail(props)
        : renderVolunteerRejectedEmail(props);

    const result = await sendEmail({
      to: props.to.trim(),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: `volunteer-decision/${props.referralId}/${props.decision}`,
    });

    if (result.success && !result.skipped) {
      recordEmailDispatch(dedupKey);
    }

    return result;
  } finally {
    inFlightDispatchSet.delete(dedupKey);
  }
}
