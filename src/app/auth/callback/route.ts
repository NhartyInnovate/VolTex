import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

interface CookieToSet {
  name: string;
  value: string;
  options: CookieOptions;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const error_description = searchParams.get("error_description");

  // Determine redirect base from request origin
  const baseUrl = origin;

  // Handle explicit error responses from Supabase Auth
  if (error || error_description) {
    const errorParam = encodeURIComponent(
      error_description || error || "Authentication link invalid or expired."
    );
    return NextResponse.redirect(`${baseUrl}/auth/login?error=${errorParam}`);
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
      // Determine destination: if next is explicitly reset-password, navigate there
      const targetPath = next.startsWith("/") ? next : `/${next}`;
      const redirectResponse = NextResponse.redirect(new URL(targetPath, baseUrl));
      // Copy all updated session cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    const errorMsg = encodeURIComponent(
      exchangeError.message || "Invalid or expired authorization code."
    );
    return NextResponse.redirect(`${baseUrl}/auth/login?error=${errorMsg}`);
  }

  // Flow B: Token Hash OTP Verification (Magic link, email signup, token recovery)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!verifyError) {
      let targetPath = next.startsWith("/") ? next : `/${next}`;
      if (type === "recovery") {
        targetPath = "/auth/reset-password";
      } else if (type === "signup" || type === "email") {
        targetPath = "/auth/login?verified=true";
      }

      const redirectResponse = NextResponse.redirect(new URL(targetPath, baseUrl));
      // Copy all updated session cookies to the redirect response
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      return redirectResponse;
    }

    const errorMsg = encodeURIComponent(
      verifyError.message || "Invalid or expired verification link."
    );
    return NextResponse.redirect(
      `${baseUrl}/auth/login?error=${errorMsg}&error_type=${type}`
    );
  }

  return NextResponse.redirect(
    `${baseUrl}/auth/login?error=Invalid+or+missing+verification+token`
  );
}
