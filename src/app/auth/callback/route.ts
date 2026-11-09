import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getSafeRedirectPath } from "@/lib/utils";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = (rawType as EmailOtpType | null) || (token_hash ? "signup" : null);
  const rawNext = searchParams.get("next");
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  // Determine redirect base from request origin
  const baseUrl = origin;

  // Handle explicit error responses from Supabase Auth
  if (error || error_description) {
    const errorCode = searchParams.get("error_code");
    const errorParam = encodeURIComponent(
      error_description || error || "Authentication link invalid or expired."
    );
    const codeQuery = errorCode ? `&error_code=${encodeURIComponent(errorCode)}` : "";
    return NextResponse.redirect(`${baseUrl}/auth/login?error=${errorParam}${codeQuery}`);
  }

  // Pre-configure the response object to capture session cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Flow A: PKCE Authorization Code Exchange (Supported format for modern Supabase recovery & OAuth)
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Determine destination: sanitize next target path to prevent open redirects
      const safeNext = getSafeRedirectPath(rawNext, "/dashboard");
      const redirectResponse = NextResponse.redirect(new URL(safeNext, baseUrl));
      // Copy all updated session cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    // Check if error is specifically due to missing PKCE code verifier in storage
    const isVerifierMissing =
      Boolean(
        exchangeError.message?.toLowerCase().includes("code verifier") ||
        ("code" in exchangeError && exchangeError.code === "pkce_code_verifier_not_found")
      );

    if (isVerifierMissing) {
      // Graceful handling: The link was opened in a different browser/app than where registration started.
      // Do NOT treat a missing verifier as proof that an email has been verified.
      // Redirect to login with a clear instruction to sign in rather than a cryptic runtime error.
      const friendlyMsg = encodeURIComponent(
        "Verification was opened in a different browser or app than where registration started. Please sign in with your email and password below."
      );
      return NextResponse.redirect(`${baseUrl}/auth/login?error=${friendlyMsg}`);
    }

    const errorMsg = encodeURIComponent(
      exchangeError.message || "Invalid or expired authorization code."
    );
    return NextResponse.redirect(`${baseUrl}/auth/login?error=${errorMsg}`);
  }

  // Flow B: Token Hash OTP Verification (Magic link, email signup, token recovery)
  if (token_hash && type) {
    // In Supabase GoTrue Auth:
    // - New volunteer registration confirmations are stored under confirmation_token and verified with type: 'signup'.
    // - Magic link sign-in tokens are verified with type: 'email'.
    // - Password recovery tokens are verified with type: 'recovery'.
    // Use the explicitly provided type as primary candidate.
    // For signup or email verification, allow fallback between 'signup' and 'email' to support both
    // Supabase GoTrue configurations and legacy/custom email template formats.
    // Never retry arbitrary OTP types (e.g. recovery, invite).
    const primaryType: EmailOtpType = type as EmailOtpType;
    const alternateType: EmailOtpType | null =
      type === "signup" ? "email" : type === "email" ? "signup" : null;

    let { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      type: primaryType,
      token_hash,
    });

    // Fallback: If primary failed and an alternate candidate exists for signup/email, retry with alternate
    if (verifyError && alternateType) {
      const retry = await supabase.auth.verifyOtp({
        type: alternateType,
        token_hash,
      });
      if (!retry.error) {
        verifyError = null;
        verifyData = retry.data;
      }
    }

    if (!verifyError) {
      let defaultTarget = "/dashboard";
      if (type === "recovery") {
        defaultTarget = "/auth/reset-password";
      } else if (type === "signup" || type === "email") {
        // Direct volunteer straight to /dashboard when session is established;
        // fallback safely to /auth/login?verified=true if verification succeeded without session
        defaultTarget = verifyData?.session ? "/dashboard" : "/auth/login?verified=true";
      }

      const safeNext = getSafeRedirectPath(rawNext, defaultTarget);
      const redirectResponse = NextResponse.redirect(new URL(safeNext, baseUrl));
      // Copy all updated session cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    const errorCode =
      verifyError && "code" in verifyError && typeof verifyError.code === "string"
        ? verifyError.code
        : "";
    const errorMsg = encodeURIComponent(
      verifyError.message || "Invalid or expired verification link."
    );
    const codeQuery = errorCode ? `&error_code=${encodeURIComponent(errorCode)}` : "";
    return NextResponse.redirect(
      `${baseUrl}/auth/login?error=${errorMsg}&error_type=${type}${codeQuery}`
    );
  }

  return NextResponse.redirect(
    `${baseUrl}/auth/login?error=Invalid+or+missing+verification+token`
  );
}
