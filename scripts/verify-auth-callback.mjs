/**
 * Automated Verification Script for VolTex Auth Redirects, Cookie Protocols,
 * and Safe Callback Handling
 */

import assert from "node:assert/strict";

console.log("=== Running VolTex Auth Callback & Safe Redirect Verification Suite ===");

// 1. Test getSafeRedirectPath Logic
function getSafeRedirectPath(rawPath, defaultFallback = "/dashboard") {
  if (!rawPath || typeof rawPath !== "string") {
    return defaultFallback;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(rawPath.trim());
  } catch {
    return defaultFallback;
  }

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

console.log("\n[Test 1] Safe Redirect Path Sanitization (Open Redirect Defense)");
{
  // Valid relative internal paths
  assert.equal(getSafeRedirectPath("/dashboard"), "/dashboard");
  assert.equal(getSafeRedirectPath("/auth/reset-password"), "/auth/reset-password");
  assert.equal(getSafeRedirectPath("/admin/users"), "/admin/users");
  assert.equal(getSafeRedirectPath("/admin?tab=pending"), "/admin?tab=pending");

  // Open redirect attack vectors blocked
  assert.equal(getSafeRedirectPath("https://evil.com"), "/dashboard", "External URL with scheme must be rejected");
  assert.equal(getSafeRedirectPath("http://evil.com"), "/dashboard", "External HTTP URL must be rejected");
  assert.equal(getSafeRedirectPath("//evil.com"), "/dashboard", "Protocol-relative URL must be rejected");
  assert.equal(getSafeRedirectPath("/\\evil.com"), "/dashboard", "Backslash bypass must be rejected");
  assert.equal(getSafeRedirectPath("javascript:alert(1)"), "/dashboard", "JavaScript scheme must be rejected");
  assert.equal(getSafeRedirectPath("data:text/html,attack"), "/dashboard", "Data scheme must be rejected");
  assert.equal(getSafeRedirectPath(""), "/dashboard", "Empty path falls back to default");
  assert.equal(getSafeRedirectPath(null), "/dashboard", "Null falls back to default");
  assert.equal(getSafeRedirectPath(undefined), "/dashboard", "Undefined falls back to default");
  assert.equal(getSafeRedirectPath("/relative/path", "/custom-fallback"), "/relative/path");
  assert.equal(getSafeRedirectPath("https://attacker.com", "/custom-fallback"), "/custom-fallback");

  console.log("✔ Safe redirect sanitization tests passed.");
}

// 2. Test getAppUrl Logic Across Environments
function getAppUrlSimulated({ origin, envAppUrl }) {
  if (origin && !origin.includes("localhost")) {
    return origin.replace(/\/+$/, "");
  }

  if (envAppUrl && envAppUrl.trim() !== "") {
    return envAppUrl.trim().replace(/\/+$/, "");
  }

  if (origin) {
    return origin.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

console.log("\n[Test 2] App URL Origin-First Resolution");
{
  // Production custom domain
  assert.equal(
    getAppUrlSimulated({ origin: "https://voltex.nkaylabs.com", envAppUrl: "" }),
    "https://voltex.nkaylabs.com",
    "Should resolve to custom production domain"
  );

  // Vercel preview / staging domain
  assert.equal(
    getAppUrlSimulated({ origin: "https://voltex-murex.vercel.app", envAppUrl: "https://voltex.nkaylabs.com" }),
    "https://voltex-murex.vercel.app",
    "Browser origin on Vercel preview should take precedence over build-time env"
  );

  // Local development
  assert.equal(
    getAppUrlSimulated({ origin: "http://localhost:3000", envAppUrl: "" }),
    "http://localhost:3000",
    "Localhost browser origin should stay on localhost"
  );

  // Server-side fallback with env
  assert.equal(
    getAppUrlSimulated({ origin: null, envAppUrl: "https://voltex.nkaylabs.com/" }),
    "https://voltex.nkaylabs.com",
    "Server-side fallback should use trimmed env variable"
  );

  console.log("✔ App URL resolution tests passed.");
}

// 3. Test Callback Route Handlers for Code vs Token Hash vs Errors
console.log("\n[Test 3] Callback Flow Routing Invariants");
{
  function simulateCallbackRouting({ searchParams, origin = "https://voltex.nkaylabs.com" }) {
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");
    const code = searchParams.get("code");
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");
    const next = searchParams.get("next");

    if (error || error_description) {
      return { flow: "error", destination: `/auth/login?error=${encodeURIComponent(error_description || error)}` };
    }

    if (code) {
      const safeNext = getSafeRedirectPath(next, "/dashboard");
      return { flow: "code", destination: safeNext };
    }

    if (token_hash && type) {
      let defaultTarget = "/dashboard";
      if (type === "recovery") {
        defaultTarget = "/auth/reset-password";
      } else if (type === "signup" || type === "email") {
        defaultTarget = "/dashboard";
      }
      const safeNext = getSafeRedirectPath(next, defaultTarget);
      return { flow: "token_hash", destination: safeNext, type };
    }

    return { flow: "invalid", destination: "/auth/login?error=Invalid+or+missing+verification+token" };
  }

  // Case A: PKCE code flow
  const codeResult = simulateCallbackRouting({
    searchParams: new URLSearchParams("code=sample-auth-code&next=/dashboard"),
  });
  assert.equal(codeResult.flow, "code");
  assert.equal(codeResult.destination, "/dashboard");

  // Case B: Token Hash signup flow (Cross-device email verification)
  const hashSignupResult = simulateCallbackRouting({
    searchParams: new URLSearchParams("token_hash=sample-hash&type=email"),
  });
  assert.equal(hashSignupResult.flow, "token_hash");
  assert.equal(hashSignupResult.destination, "/dashboard");

  // Case C: Token Hash recovery flow (Password reset)
  const hashRecoveryResult = simulateCallbackRouting({
    searchParams: new URLSearchParams("token_hash=sample-hash&type=recovery"),
  });
  assert.equal(hashRecoveryResult.flow, "token_hash");
  assert.equal(hashRecoveryResult.destination, "/auth/reset-password");

  // Case D: Explicit error from Supabase
  const errorResult = simulateCallbackRouting({
    searchParams: new URLSearchParams("error=access_denied&error_description=User%20declined"),
  });
  assert.equal(errorResult.flow, "error");
  assert(errorResult.destination.includes("User%20declined"));

  // Case E: Malicious next parameter during code flow
  const maliciousResult = simulateCallbackRouting({
    searchParams: new URLSearchParams("code=sample-code&next=https://evil.com"),
  });
  assert.equal(maliciousResult.destination, "/dashboard", "Open redirect must fall back to /dashboard");

  console.log("✔ Callback flow routing invariants verified.");
}

// 4. Test getAuthErrorMessage Diagnostic & Safety Invariants
console.log("\n[Test 4] Supabase Auth Error Mapping & Sanitization");
{
  function getAuthErrorMessage(error) {
    if (!error) {
      return "An unexpected authentication error occurred. Please try again.";
    }

    const rawMsg = typeof error === "object" && error !== null && "message" in error
      ? String(error.message || "")
      : typeof error === "string"
      ? error
      : "";

    const code = typeof error === "object" && error !== null && "code" in error
      ? String(error.code || "")
      : "";

    const status = typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : 0;

    const lowerMsg = rawMsg.toLowerCase();
    const lowerCode = code.toLowerCase();

    // 1. Rate Limiting
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

    return rawMsg.trim() ? rawMsg : "An unexpected authentication error occurred. Please try again.";
  }

  // Case 1: Supabase "Error sending confirmation email"
  const smtpErr = getAuthErrorMessage({
    message: "Error sending confirmation email",
    status: 500,
    code: "email_send_failed",
  });
  assert(smtpErr.includes("encountered an issue sending your confirmation email"), "Should map to user-friendly mail service explanation");
  assert(!smtpErr.includes("500"), "Should not expose raw status code");

  // Case 2: Supabase rate limit error (HTTP 429)
  const rateLimitErr = getAuthErrorMessage({
    message: "over_email_send_rate_limit",
    status: 429,
    code: "over_email_send_rate_limit",
  });
  assert(rateLimitErr.includes("Email delivery limit reached"), "Should detect rate limit error");

  // Case 3: Unauthorized recipient domain
  const unauthRecipientErr = getAuthErrorMessage({
    message: "Email address is not authorized",
    code: "email_address_not_authorized",
    status: 422,
  });
  assert(unauthRecipientErr.includes("current mail configuration"), "Should explain recipient restriction");

  // Case 4: Existing user
  const emailExistsErr = getAuthErrorMessage({
    message: "User already registered",
    code: "email_exists",
    status: 422,
  });
  assert(emailExistsErr.includes("already exists"), "Should suggest signing in");

  // Case 5: Unconfirmed email on login
  const notConfirmedErr = getAuthErrorMessage({
    message: "Email not confirmed",
    code: "email_not_confirmed",
    status: 400,
  });
  assert(notConfirmedErr.includes("has not been confirmed yet"), "Should instruct user to check inbox");

  // Case 6: Fallback for generic unexpected error
  assert.equal(
    getAuthErrorMessage(null),
    "An unexpected authentication error occurred. Please try again."
  );

  console.log("✔ Supabase Auth error mapping & sanitization tests passed.");
}

// 5. Test Extended Auth Callback Handler Lifecycle & Verification Invariants
console.log("\n[Test 5] Comprehensive Callback Lifecycle (Signup OTP, Email Magic Link, Alternate Fallback, PKCE, Cookie Propagation)");
{
  // Simulated Next.js Response Cookie Store
  class MockResponseCookies {
    constructor() {
      this._cookies = new Map();
    }
    set(name, value, options = {}) {
      this._cookies.set(name, { name, value, ...options });
    }
    getAll() {
      return Array.from(this._cookies.values());
    }
  }

  class MockResponse {
    constructor(destinationUrl) {
      this.destinationUrl = destinationUrl;
      this.cookies = new MockResponseCookies();
    }
  }

  // Full simulation matching src/app/auth/callback/route.ts
  async function executeCallbackHandler({
    searchParamsString,
    mockExchangeResult = { error: null },
    // mockVerifyResult can be a function (type, token_hash) => ({ data, error }) or static object
    mockVerifyResult = { error: null },
    origin = "https://voltex.nkaylabs.com",
  }) {
    const searchParams = new URLSearchParams(searchParamsString);
    const token_hash = searchParams.get("token_hash");
    const rawType = searchParams.get("type");
    const type = rawType || (token_hash ? "signup" : null);
    const rawNext = searchParams.get("next");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    const baseUrl = origin;
    const response = new MockResponse();

    const mockSupabase = {
      auth: {
        exchangeCodeForSession: async (authCode) => {
          if (!mockExchangeResult.error) {
            response.cookies.set("sb-access-token", "mock-access-token", { path: "/", httpOnly: true });
            response.cookies.set("sb-refresh-token", "mock-refresh-token", { path: "/", httpOnly: true });
          }
          return mockExchangeResult;
        },
        verifyOtp: async ({ type: otpType, token_hash: th }) => {
          const result = typeof mockVerifyResult === "function"
            ? mockVerifyResult(otpType, th)
            : mockVerifyResult;

          if (!result.error && result.data?.session) {
            response.cookies.set("sb-access-token", "mock-access-token", { path: "/", httpOnly: true });
            response.cookies.set("sb-refresh-token", "mock-refresh-token", { path: "/", httpOnly: true });
          }
          return result;
        },
      },
    };

    // 1. Explicit error
    if (error || error_description) {
      const errorCode = searchParams.get("error_code");
      const errorParam = encodeURIComponent(
        error_description || error || "Authentication link invalid or expired."
      );
      const codeQuery = errorCode ? `&error_code=${encodeURIComponent(errorCode)}` : "";
      return { destination: `${baseUrl}/auth/login?error=${errorParam}${codeQuery}`, cookies: [] };
    }

    // 2. Flow A: PKCE
    if (code) {
      const { error: exchangeError } = await mockSupabase.auth.exchangeCodeForSession(code);
      if (!exchangeError) {
        const safeNext = getSafeRedirectPath(rawNext, "/dashboard");
        const redir = new MockResponse(new URL(safeNext, baseUrl).toString());
        response.cookies.getAll().forEach((c) => redir.cookies.set(c.name, c.value, c));
        return { destination: redir.destinationUrl, cookies: redir.cookies.getAll() };
      }

      const isVerifierMissing = Boolean(
        exchangeError.message?.toLowerCase().includes("code verifier") ||
        (exchangeError.code && exchangeError.code === "pkce_code_verifier_not_found")
      );

      if (isVerifierMissing) {
        const friendlyMsg = encodeURIComponent(
          "Verification was opened in a different browser or app than where registration started. Please sign in with your email and password below."
        );
        return { destination: `${baseUrl}/auth/login?error=${friendlyMsg}`, cookies: [] };
      }

      const errorMsg = encodeURIComponent(
        exchangeError.message || "Invalid or expired authorization code."
      );
      return { destination: `${baseUrl}/auth/login?error=${errorMsg}`, cookies: [] };
    }

    // 3. Flow B: Token Hash
    if (token_hash && type) {
      const primaryType = type;
      const alternateType =
        type === "signup" ? "email" : type === "email" ? "signup" : null;

      let { data: verifyData, error: verifyError } = await mockSupabase.auth.verifyOtp({
        type: primaryType,
        token_hash,
      });

      if (verifyError && alternateType) {
        const retry = await mockSupabase.auth.verifyOtp({
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
          defaultTarget = verifyData?.session ? "/dashboard" : "/auth/login?verified=true";
        }

        const safeNext = getSafeRedirectPath(rawNext, defaultTarget);
        const redir = new MockResponse(new URL(safeNext, baseUrl).toString());
        response.cookies.getAll().forEach((c) => redir.cookies.set(c.name, c.value, c));
        return { destination: redir.destinationUrl, cookies: redir.cookies.getAll() };
      }

      const errorCode =
        verifyError && "code" in verifyError && typeof verifyError.code === "string"
          ? verifyError.code
          : "";
      const errorMsg = encodeURIComponent(
        verifyError.message || "Invalid or expired verification link."
      );
      const codeQuery = errorCode ? `&error_code=${encodeURIComponent(errorCode)}` : "";
      return {
        destination: `${baseUrl}/auth/login?error=${errorMsg}&error_type=${type}${codeQuery}`,
        cookies: [],
      };
    }

    return { destination: `${baseUrl}/auth/login?error=Invalid+or+missing+verification+token`, cookies: [] };
  }

  // Subtest 5a: Direct signup OTP verification (type=signup) with session -> /dashboard
  {
    let invokedType = null;
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-otp-hash&type=signup",
      mockVerifyResult: (type) => {
        invokedType = type;
        return { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null };
      },
    });
    assert.equal(invokedType, "signup", "Must invoke primary type=signup first");
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    assert(res.cookies.some((c) => c.name === "sb-access-token"), "Must propagate session cookies");
    console.log("  ✔ 5a. Direct signup OTP verification (type=signup) invokes 'signup' and routes to /dashboard with session cookies");
  }

  // Subtest 5b: Email magic link verification (type=email) with session -> /dashboard
  {
    let invokedType = null;
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=magic-link-hash&type=email",
      mockVerifyResult: (type) => {
        invokedType = type;
        return { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null };
      },
    });
    assert.equal(invokedType, "email", "Must invoke primary type=email first");
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    assert(res.cookies.some((c) => c.name === "sb-access-token"), "Must propagate session cookies");
    console.log("  ✔ 5b. Email magic link verification (type=email) invokes 'email' and routes to /dashboard with session cookies");
  }

  // Subtest 5c: Alternate OTP fallback: type=email in URL, but token is GoTrue signup token
  {
    const calls = [];
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=signup-hash-in-email-template&type=email",
      mockVerifyResult: (type) => {
        calls.push(type);
        if (type === "email") {
          return {
            data: { user: null, session: null },
            error: { name: "AuthApiError", message: "Email link is invalid or has expired", code: "otp_expired" },
          };
        }
        if (type === "signup") {
          return { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null };
        }
        return { data: null, error: new Error("Unexpected type") };
      },
    });
    assert.deepEqual(calls, ["email", "signup"], "Must try 'email' first, fail, and retry 'signup'");
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    assert(res.cookies.some((c) => c.name === "sb-access-token"), "Must set cookies after successful retry");
    console.log("  ✔ 5c. Alternate OTP fallback (type=email -> signup) recovers from template type mismatch");
  }

  // Subtest 5d: Alternate OTP fallback: type=signup in URL, but token is magic link
  {
    const calls = [];
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=magic-hash-in-signup-template&type=signup",
      mockVerifyResult: (type) => {
        calls.push(type);
        if (type === "signup") {
          return {
            data: { user: null, session: null },
            error: { name: "AuthApiError", message: "Email link is invalid or has expired", code: "otp_expired" },
          };
        }
        if (type === "email") {
          return { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null };
        }
        return { data: null, error: new Error("Unexpected type") };
      },
    });
    assert.deepEqual(calls, ["signup", "email"], "Must try 'signup' first, fail, and retry 'email'");
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    console.log("  ✔ 5d. Alternate OTP fallback (type=signup -> email) recovers from token mismatch");
  }

  // Subtest 5e: Strict boundary: Never retry arbitrary types like password recovery
  {
    const calls = [];
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=expired-recovery&type=recovery",
      mockVerifyResult: (type) => {
        calls.push(type);
        return {
          data: { user: null, session: null },
          error: { name: "AuthApiError", message: "Email link is invalid or has expired", code: "otp_expired" },
        };
      },
    });
    assert.deepEqual(calls, ["recovery"], "Recovery MUST NOT retry alternate types");
    assert(res.destination.includes("/auth/login?error="));
    assert(res.destination.includes("error_code=otp_expired"));
    assert.equal(res.cookies.length, 0, "No cookies on failure");
    console.log("  ✔ 5e. Strict boundary: recovery does not attempt alternate retries; no session created");
  }

  // Subtest 5f: Valid token_hash signup verification WITHOUT session -> safe fallback to /auth/login?verified=true
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-otp-hash&type=signup",
      mockVerifyResult: { data: { session: null, user: { id: "u1" } }, error: null },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/auth/login?verified=true");
    assert.equal(res.cookies.length, 0, "No session cookies when session is null");
    console.log("  ✔ 5f. Valid token_hash without session safely falls back to /auth/login?verified=true");
  }

  // Subtest 5g: Successful PKCE exchange
  {
    const res = await executeCallbackHandler({
      searchParamsString: "code=valid-pkce-code",
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    assert.equal(res.cookies.length, 2, "Must propagate access and refresh session cookies");
    console.log("  ✔ 5g. Successful PKCE exchange routes to /dashboard and sets all session cookies");
  }

  // Subtest 5h: Missing PKCE code verifier (Cross-browser / in-app browser scenario)
  {
    const res = await executeCallbackHandler({
      searchParamsString: "code=cross-device-code",
      mockExchangeResult: {
        error: {
          name: "AuthPKCECodeVerifierMissingError",
          code: "pkce_code_verifier_not_found",
          message: "PKCE code verifier not found in storage.",
        },
      },
    });
    assert(res.destination.includes("/auth/login?error="), "Must redirect to login with error explanation");
    assert(res.destination.includes("different%20browser%20or%20app"), "Must explain cross-device condition");
    assert(!res.destination.includes("verified=true"), "MUST NOT treat missing verifier as proof of verification");
    assert.equal(res.cookies.length, 0, "Must not set session cookies when exchange failed");
    console.log("  ✔ 5h. Missing PKCE verifier handled gracefully without claiming unproven verified=true");
  }

  // Subtest 5i: Expired or already-consumed verification token (Both attempts fail)
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=expired-token&type=signup",
      mockVerifyResult: {
        error: {
          name: "AuthApiError",
          message: "Email link is invalid or has expired",
          code: "otp_expired",
        },
      },
    });
    assert(res.destination.includes("error=Email%20link%20is%20invalid%20or%20has%20expired"), "Must pass error");
    assert(res.destination.includes("error_code=otp_expired"), "Must include error_code parameter");
    assert.equal(res.cookies.length, 0, "Failed verification must NEVER set session cookies");
    console.log("  ✔ 5i. Expired/consumed token routes to /auth/login with otp_expired and NO session cookies");
  }

  // Subtest 5j: Password recovery flow preserved
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-recovery-hash&type=recovery",
      mockVerifyResult: { data: { session: { access_token: "recov" }, user: { id: "u2" } }, error: null },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/auth/reset-password");
    console.log("  ✔ 5j. Password recovery flow preserved; routes to /auth/reset-password");
  }

  // Subtest 5k: Unsafe open redirect attempts blocked
  {
    const maliciousCodes = [
      "https://attacker.com",
      "http://attacker.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
    ];
    for (const evilUrl of maliciousCodes) {
      const res = await executeCallbackHandler({
        searchParamsString: `code=valid-code&next=${encodeURIComponent(evilUrl)}`,
      });
      assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard", `Must reject evil URL ${evilUrl}`);
    }
    console.log("  ✔ 5k. Unsafe redirect attempts blocked; always sanitized to internal routes");
  }
}

// 6. Test Login Page Error Message Resolution (resolveLoginErrorMessage)
console.log("\n[Test 6] Login Page Error Message Resolution & Volunteer Guidance");
{
  function resolveLoginErrorMessage(queryError, errorCode) {
    if (!queryError) return null;

    const decoded = decodeURIComponent(queryError);
    const lowerDecoded = decoded.toLowerCase();
    const lowerCode = (errorCode || "").toLowerCase();

    // Expired, already consumed, or invalid verification links
    if (
      lowerCode === "otp_expired" ||
      lowerDecoded.includes("email link is invalid or has expired") ||
      lowerDecoded.includes("token has expired or is invalid") ||
      lowerDecoded.includes("invalid or expired verification link") ||
      lowerDecoded.includes("otp_expired")
    ) {
      return "This verification link may have expired or has already been used. If you recently registered, please try signing in with your email and password below.";
    }

    // Cross-browser or cross-device registration flow (missing PKCE verifier)
    if (
      lowerDecoded.includes("pkce code verifier not found in storage") ||
      lowerDecoded.includes("code verifier") ||
      lowerDecoded.includes("different browser or app")
    ) {
      return "Verification link was opened in a different browser or app than where registration started. Please sign in with your email and password below.";
    }

    return decoded;
  }

  // Case 6a: Exact GoTrue error "Email link is invalid or has expired"
  const msgA = resolveLoginErrorMessage("Email link is invalid or has expired");
  assert.equal(
    msgA,
    "This verification link may have expired or has already been used. If you recently registered, please try signing in with your email and password below.",
    "Must guide user to sign in without falsely claiming account is verified"
  );
  console.log("  ✔ 6a. 'Email link is invalid or has expired' resolves to reassuring sign-in guidance");

  // Case 6b: error_code=otp_expired with custom description
  const msgB = resolveLoginErrorMessage("Access denied", "otp_expired");
  assert.equal(
    msgB,
    "This verification link may have expired or has already been used. If you recently registered, please try signing in with your email and password below."
  );
  console.log("  ✔ 6b. error_code='otp_expired' resolves to reassuring sign-in guidance");

  // Case 6c: Cross-browser PKCE missing verifier error
  const msgC = resolveLoginErrorMessage("PKCE code verifier not found in storage");
  assert.equal(
    msgC,
    "Verification link was opened in a different browser or app than where registration started. Please sign in with your email and password below."
  );
  console.log("  ✔ 6c. Missing PKCE verifier resolves to cross-browser sign-in guidance");

  // Case 6d: Standard unexpected error preserved
  const msgD = resolveLoginErrorMessage("Invalid credentials");
  assert.equal(msgD, "Invalid credentials", "Standard error should pass through cleanly");
  console.log("  ✔ 6d. Standard credentials errors preserved without alteration");

  // Case 6e: Null error returns null
  assert.equal(resolveLoginErrorMessage(null), null);
  console.log("  ✔ 6e. Null queryError returns null");
}

console.log("\n=======================================================");
console.log("✔ ALL AUTH CALLBACK, ERROR & LOGIN TESTS PASSED (6/6)");
console.log("=======================================================\n");
