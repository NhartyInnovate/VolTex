import crypto from "crypto";

const BOT_REGEX =
  /bot|crawler|spider|crawling|facebookexternalhit|whatsapp|slackbot|telegrambot|twitterbot|linkedinbot|embedly|quora link preview|pinterest|applebot|bingbot|googlebot/i;

/**
 * Returns true if the user agent matches known automated crawlers or link-preview fetchers.
 */
export function isBotUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_REGEX.test(userAgent);
}

/**
 * Returns true if request headers indicate a browser or Next.js router prefetch.
 */
export function isPrefetchRequest(headers: Headers): boolean {
  return (
    headers.get("purpose") === "prefetch" ||
    headers.get("x-purpose") === "prefetch" ||
    headers.get("sec-purpose") === "prefetch" ||
    headers.get("next-router-prefetch") === "1"
  );
}

/**
 * Extracts best-effort client IP from proxy and forwarding headers.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

/**
 * Computes a secure HMAC-SHA256 hash using the server-only REFERRAL_CAPTURE_SECRET.
 */
export function computeHmacSha256(value: string, salt: string = ""): string {
  const secret = process.env.REFERRAL_CAPTURE_SECRET || "voltex_fallback_capture_secret_key";
  return crypto
    .createHmac("sha256", secret)
    .update(value + (salt ? `:${salt}` : ""))
    .digest("hex");
}

/**
 * Derives the daily rotating anonymous visitor hash: HMAC(SECRET, IP + UA + UTC_DATE).
 */
export function deriveVisitorHash(ip: string, userAgent: string, utcDateStr?: string): string {
  const today = utcDateStr || new Date().toISOString().slice(0, 10);
  const rawInput = `${ip}::${userAgent.slice(0, 150)}::${today}`;
  return computeHmacSha256(rawInput);
}

/**
 * Computes deterministic HMAC hash of a normalized buyer email.
 */
export function deriveEmailHash(email: string): string {
  const normalized = email.trim().toLowerCase();
  return computeHmacSha256(normalized, "email_lead");
}

/**
 * Computes deterministic HMAC hash of client IP for rolling rate limits.
 */
export function deriveIpHash(ip: string): string {
  return computeHmacSha256(ip.trim(), "ip_rate_limit");
}
