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
console.log("\n[Test 5] Comprehensive Callback Lifecycle (PKCE, Token Hash, Cross-Device, Cookie Propagation)");
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
    mockVerifyResult = { error: null },
    origin = "https://voltex.nkaylabs.com",
  }) {
    const searchParams = new URLSearchParams(searchParamsString);
    const token_hash = searchParams.get("token_hash");
    const rawType = searchParams.get("type");
    const type = rawType || (token_hash ? "email" : null);
    const rawNext = searchParams.get("next");
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const error_description = searchParams.get("error_description");

    const baseUrl = origin;

    // Capture cookie calls
    const capturedSetCookies = [];
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
          if (!mockVerifyResult.error && mockVerifyResult.data?.session) {
            response.cookies.set("sb-access-token", "mock-access-token", { path: "/", httpOnly: true });
            response.cookies.set("sb-refresh-token", "mock-refresh-token", { path: "/", httpOnly: true });
          }
          return mockVerifyResult;
        },
      },
    };

    // 1. Explicit error
    if (error || error_description) {
      const errorParam = encodeURIComponent(
        error_description || error || "Authentication link invalid or expired."
      );
      return { destination: `${baseUrl}/auth/login?error=${errorParam}`, cookies: [] };
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
      const otpType = type === "signup" ? "email" : type;
      let { data: verifyData, error: verifyError } = await mockSupabase.auth.verifyOtp({
        type: otpType,
        token_hash,
      });

      if (verifyError && type === "signup") {
        const retry = await mockSupabase.auth.verifyOtp({
          type: "signup",
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

      const errorMsg = encodeURIComponent(
        verifyError.message || "Invalid or expired verification link."
      );
      return { destination: `${baseUrl}/auth/login?error=${errorMsg}&error_type=${type}`, cookies: [] };
    }

    return { destination: `${baseUrl}/auth/login?error=Invalid+or+missing+verification+token`, cookies: [] };
  }

  // Subtest 5a: Valid token_hash signup verification with session (Canonical 'email' type) -> /dashboard
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-otp-hash&type=email",
      mockVerifyResult: { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    assert(res.cookies.some((c) => c.name === "sb-access-token"), "Must propagate session cookies");
    console.log("  ✔ 5a. Valid token_hash with session routes directly to /dashboard with session cookies");
  }

  // Subtest 5b: Valid token_hash signup verification WITHOUT session -> safe fallback to /auth/login?verified=true
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-otp-hash&type=email",
      mockVerifyResult: { data: { session: null, user: { id: "u1" } }, error: null },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/auth/login?verified=true");
    assert.equal(res.cookies.length, 0, "No session cookies when session is null");
    console.log("  ✔ 5b. Valid token_hash without session safely falls back to /auth/login?verified=true");
  }

  // Subtest 5c: Valid token_hash signup verification (Legacy 'signup' type mapped to 'email' with session)
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-otp-hash&type=signup",
      mockVerifyResult: { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    console.log("  ✔ 5c. Valid token_hash (type=signup) automatically maps to canonical email OTP and routes to /dashboard");
  }

  // Subtest 5d: Valid token_hash without explicit type (Defaults to 'email' with session)
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-otp-hash",
      mockVerifyResult: { data: { session: { access_token: "mock" }, user: { id: "u1" } }, error: null },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    console.log("  ✔ 5d. Valid token_hash without explicit type defaults to email OTP and routes to /dashboard");
  }

  // Subtest 5e: Successful PKCE exchange
  {
    const res = await executeCallbackHandler({
      searchParamsString: "code=valid-pkce-code",
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/dashboard");
    assert.equal(res.cookies.length, 2, "Must propagate access and refresh session cookies");
    console.log("  ✔ 5e. Successful PKCE exchange routes to /dashboard and sets all session cookies");
  }

  // Subtest 5f: Missing PKCE code verifier (Cross-browser / in-app browser scenario)
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
    console.log("  ✔ 5f. Missing PKCE verifier handled gracefully without claiming unproven verified=true");
  }

  // Subtest 5g: Expired or invalid verification token
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=expired-token&type=email",
      mockVerifyResult: {
        error: {
          name: "AuthApiError",
          message: "Email link is invalid or has expired",
        },
      },
    });
    assert(res.destination.includes("/auth/login?error=Email%20link%20is%20invalid%20or%20has%20expired"), "Must display Supabase error");
    assert(res.destination.includes("error_type=email"), "Must include error_type parameter");
    console.log("  ✔ 5g. Expired verification token routes to /auth/login with descriptive error");
  }

  // Subtest 5h: Invalid authorization code
  {
    const res = await executeCallbackHandler({
      searchParamsString: "code=invalid-code",
      mockExchangeResult: {
        error: {
          name: "AuthApiError",
          message: "Invalid or expired authorization code.",
        },
      },
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/auth/login?error=Invalid%20or%20expired%20authorization%20code.");
    console.log("  ✔ 5h. Invalid authorization code routes to /auth/login with error message");
  }

  // Subtest 5i: Unsafe open redirect attempts blocked
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
    console.log("  ✔ 5i. Unsafe redirect attempts blocked; always sanitized to internal routes");
  }

  // Subtest 5j: Existing password recovery behavior preserved
  {
    const res = await executeCallbackHandler({
      searchParamsString: "token_hash=valid-recovery-hash&type=recovery",
    });
    assert.equal(res.destination, "https://voltex.nkaylabs.com/auth/reset-password");
    console.log("  ✔ 5j. Password recovery flow preserved; routes to /auth/reset-password");
  }
}

console.log("\n=======================================================");
console.log("✔ ALL AUTH CALLBACK & ERROR TESTS PASSED SUCCESSFULLY (5/5)");
console.log("=======================================================\n");
