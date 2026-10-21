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
        defaultTarget = "/auth/login?verified=true";
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
  assert.equal(hashSignupResult.destination, "/auth/login?verified=true");

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

console.log("\n=======================================================");
console.log("✔ ALL AUTH CALLBACK & ERROR TESTS PASSED SUCCESSFULLY (4/4)");
console.log("=======================================================\n");
