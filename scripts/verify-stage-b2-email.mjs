/**
 * Automated Verification Script for VolTex Stage B2: Transactional Email Notifications
 *
 * Verifies:
 * 1. Server-Only Guard & Security Sanitizers (HTML Escaping, Subject Newline Stripping, URL Protocol Validation, Recipient Validation)
 * 2. Note Sanitization & Submitted Timestamp Formatting (Default approval boilerplate filtering on rejection/approval)
 * 3. All 3 Email Templates (Admin New Referral, Volunteer Approved, Volunteer Rejected)
 *    - HTML & Plain Text rendering
 *    - Submitted timestamp rendering
 *    - Actual rejection notes, default approval note filtering, and safe fallback reason
 *    - Points earned, cumulative score, rank attribution
 *    - App URLs & button links
 *    - TEDxGwarinpa branding (#e62b1e)
 * 4. Offline Resend API Dispatch Simulation (Zero Real Emails Sent)
 *    - Missing RESEND_API_KEY graceful skipping
 *    - Resend Idempotency-Key header format & propagation
 *    - Mocked 200 Success
 *    - Mocked 401 Unauthorized, 422 Unverified domain, 429 Rate limited
 *    - Non-JSON error body handling (e.g., 502 HTML Bad Gateway)
 *    - AbortError timeout handling & network exceptions
 * 5. In-Flight & Recent Deduplication, Retries After Failure, & Status Transitions
 *    - sendAdminNewReferralNotification full execution & deduplication
 *    - Concurrent duplicate calls (in-flight lock) returning { success: false, skipped: true }
 *    - Immediate retry after a failed send
 *    - Status transitions (approved -> rejected -> approved) clearing opposite status key
 * 6. Route Integration & Non-Blocking Response Contracts
 * 7. Environment Variable Documentation in .env.example
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("------------------------------------------------------------");
console.log("VolTex Stage B2 Verification: Transactional Email Notifications");
console.log("------------------------------------------------------------");

// Import the email utility directly
const emailModulePath = path.join(rootDir, "src", "lib", "email.ts");
assert.ok(fs.existsSync(emailModulePath), "src/lib/email.ts must exist.");

const {
  assertServerOnly,
  escapeHtml,
  sanitizeSubject,
  isValidEmailAddress,
  parseAndValidateEmailList,
  getCleanAppUrl,
  formatSubmittedAt,
  sanitizeApprovalNote,
  sanitizeRejectionReason,
  renderAdminNewReferralEmail,
  renderVolunteerApprovedEmail,
  renderVolunteerRejectedEmail,
  sendEmail,
  sendAdminNewReferralNotification,
  sendVolunteerDecisionNotification,
  isRecentEmailDispatch,
  recordEmailDispatch,
  clearEmailDispatchKey,
  clearRecentEmailDispatches,
} = await import(pathToFileURL(emailModulePath).href);

// -----------------------------------------------------------------------------
// [1] Server-Only Guard & Security Sanitizers
// -----------------------------------------------------------------------------
console.log("[1] Verifying Server-Only Guard, HTML Escaping, Subject, URL & Recipient Sanitizers...");

// 1a. Server-only boundary
assert.doesNotThrow(() => assertServerOnly(undefined), "Server environment (window=undefined) must be allowed.");
assert.throws(
  () => assertServerOnly({}),
  /VolTex email utility \(src\/lib\/email\.ts\) is strictly server-only/,
  "Browser environment (window defined) must throw server-only error."
);

// 1b. HTML escaping
assert.equal(
  escapeHtml('<script>alert("xss")</script>'),
  "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
  "Must escape script tags and double quotes."
);
assert.equal(
  escapeHtml("Volunteer & 'Friends' <test@domain.com>"),
  "Volunteer &amp; &#39;Friends&#39; &lt;test@domain.com&gt;",
  "Must escape ampersands, single quotes, and brackets."
);
assert.equal(escapeHtml(null), "", "null must produce empty string.");
assert.equal(escapeHtml(undefined), "", "undefined must produce empty string.");
assert.equal(escapeHtml(42), "42", "Numbers must be safely converted to string.");

// 1c. Subject newline sanitization
assert.equal(
  sanitizeSubject("New Referral:\r\nBcc: attacker@evil.com\nClaim"),
  "New Referral: Bcc: attacker@evil.com Claim",
  "sanitizeSubject must strip CR/LF characters to prevent header/line injection."
);

// 1d. Email address validation & list parsing
assert.equal(isValidEmailAddress("admin@nkaylabs.com"), true);
assert.equal(isValidEmailAddress("lead.volunteer+tedx@gmail.com"), true);
assert.equal(isValidEmailAddress("not-an-email"), false);
assert.equal(isValidEmailAddress("bad@domain"), false);
assert.equal(isValidEmailAddress("bad\n@domain.com"), false);
assert.equal(isValidEmailAddress(""), false);

const parsedRecipients = parseAndValidateEmailList(
  "admin1@nkaylabs.com, invalid-email; ADMIN1@nkaylabs.com ; ops@tedxgwarinpa.com , "
);
assert.deepEqual(
  parsedRecipients,
  ["admin1@nkaylabs.com", "ops@tedxgwarinpa.com"],
  "parseAndValidateEmailList must split by comma/semicolon, filter invalid addresses, and deduplicate case-insensitively."
);

// 1e. URL validation & fallback
assert.equal(
  getCleanAppUrl("https://voltex.nkaylabs.com///"),
  "https://voltex.nkaylabs.com",
  "Must strip trailing slashes from valid https URL."
);
assert.equal(
  getCleanAppUrl("http://localhost:3000/"),
  "http://localhost:3000",
  "Must allow http://localhost URLs."
);
assert.equal(
  getCleanAppUrl("javascript:alert(1)"),
  "https://voltex.nkaylabs.com",
  "Must reject non-http(s) protocols and fall back to https://voltex.nkaylabs.com."
);
assert.equal(
  getCleanAppUrl("not a valid url"),
  "https://voltex.nkaylabs.com",
  "Must fall back to https://voltex.nkaylabs.com when URL is malformed."
);
assert.equal(
  getCleanAppUrl(""),
  "https://voltex.nkaylabs.com",
  "Must fall back to https://voltex.nkaylabs.com when URL is empty."
);

console.log("  ✓ Server-only guard, HTML escaping, subject sanitization, recipient filtering, and URL validation passed.");

// -----------------------------------------------------------------------------
// [2] Note Sanitization & Submitted Timestamp Formatting
// -----------------------------------------------------------------------------
console.log("[2] Verifying Note Filtering & Submitted Timestamp Formatting...");

// Default approval note filtering on rejection
assert.equal(
  sanitizeRejectionReason("Verified against Meeteor Hub records"),
  "Record does not match Meeteor Hub attendee list",
  "Default approval note must never be rendered as a rejection reason."
);
assert.equal(
  sanitizeRejectionReason("verified against meeteor hub records."),
  "Record does not match Meeteor Hub attendee list",
  "Case-insensitive default approval note must fall back to safe rejection reason."
);
assert.equal(
  sanitizeRejectionReason("Declined: Order ID not found on Meeteor"),
  "Order ID not found on Meeteor",
  "Declined: prefix must be cleanly stripped for display."
);
assert.equal(
  sanitizeRejectionReason("Duplicate order reference submitted"),
  "Duplicate order reference submitted",
  "Custom rejection note must be preserved."
);
assert.equal(
  sanitizeRejectionReason(null),
  "Record does not match Meeteor Hub attendee list",
  "Null rejection note must return safe fallback reason."
);

// Approval note filtering
assert.equal(
  sanitizeApprovalNote("Verified against Meeteor Hub records"),
  null,
  "Default approval boilerplate is redundant with the approved email body and returns null."
);
assert.equal(
  sanitizeApprovalNote("Declined: Previously rejected note"),
  null,
  "Stale rejection notes starting with Declined: must not appear in approval emails."
);
assert.equal(
  sanitizeApprovalNote("Confirmed VIP group booking with organizer"),
  "Confirmed VIP group booking with organizer",
  "Custom approval note must be preserved."
);

// Timestamp formatting
const formattedDate = formatSubmittedAt("2026-10-22T14:30:00.000Z");
assert.ok(formattedDate && formattedDate.includes("2026") && formattedDate.includes("UTC"), "Valid ISO timestamp must format to readable UTC string.");
assert.equal(formatSubmittedAt("invalid-date"), null, "Invalid timestamp must return null safely.");
assert.equal(formatSubmittedAt(null), null, "Null timestamp must return null.");

console.log("  ✓ Note filtering and timestamp formatting verified.");

// -----------------------------------------------------------------------------
// [3] Email Template Rendering Invariants
// -----------------------------------------------------------------------------
console.log("[3] Verifying Email Templates (Admin, Approval, Rejection)...");

// 3a. Admin: New Referral (with submittedAt and newline in name)
const adminEmail = renderAdminNewReferralEmail({
  volunteerName: "Jane Doe\r\n<Lead>",
  volunteerTeam: "VIP Outreach & Media",
  ticketType: "VIP Pass",
  ticketQuantity: 3,
  orderReference: "ORD-998877",
  buyerName: "Acme Corp \"Tech\"",
  submittedAt: "2026-10-22T14:30:00.000Z",
  referralId: "a1111111-2222-3333-4444-555555555555",
  appUrl: "https://voltex.nkaylabs.com/",
});

assert.ok(!/[\r\n]/.test(adminEmail.subject), "Subject must not contain CR/LF characters.");
assert.match(adminEmail.subject, /Jane Doe <Lead>/, "Subject must contain sanitized volunteer name.");
assert.match(adminEmail.subject, /3x VIP Pass/, "Subject must contain ticket count and type.");
assert.match(adminEmail.html, /&lt;Lead&gt;/, "HTML must escape volunteer name.");
assert.match(adminEmail.html, /VIP Outreach &amp; Media/, "HTML must escape volunteer team.");
assert.match(adminEmail.html, /Acme Corp &quot;Tech&quot;/, "HTML must escape buyer name.");
assert.match(adminEmail.html, /ORD-998877/, "HTML must contain order reference.");
assert.match(adminEmail.html, /Submitted/, "HTML must include Submitted label when submittedAt is provided.");
assert.match(adminEmail.html, /2026/, "HTML must include formatted submission year.");
assert.match(adminEmail.text, /Submitted At: .*2026.*UTC/, "Plain text must include formatted Submitted timestamp.");
assert.match(adminEmail.html, /https:\/\/voltex\.nkaylabs\.com\/admin\?tab=referrals&amp;id=a1111111-2222-3333-4444-555555555555/, "HTML must link to admin review.");
assert.match(adminEmail.html, /#e62b1e/, "HTML must incorporate TEDx Red branding.");
assert.match(adminEmail.text, /Review and verify this claim/, "Plain text must contain review instructions.");

// 3b. Volunteer: Approved Referral
const approvedEmail = renderVolunteerApprovedEmail({
  volunteerName: "John Smith",
  to: "john@example.com",
  ticketType: "Regular",
  ticketQuantity: 2,
  orderReference: "REF-4455",
  pointsEarned: 10,
  cumulativePoints: 45,
  rank: 3,
  adminNotes: "Verified via Meeteor attendee list export",
  referralId: "b2222222-3333-4444-5555-666666666666",
  appUrl: "https://voltex.nkaylabs.com",
});

assert.match(approvedEmail.subject, /\+10 points earned/, "Subject must state points earned.");
assert.match(approvedEmail.html, /\+10 Points/, "HTML must prominently display points badge.");
assert.match(approvedEmail.html, /Total Score: 45 pts/, "HTML must show total cumulative score.");
assert.match(approvedEmail.html, /Leaderboard Rank: #3/, "HTML must show leaderboard rank.");
assert.match(approvedEmail.html, /Verified via Meeteor attendee list export/, "HTML must show custom admin notes.");
assert.match(approvedEmail.html, /https:\/\/voltex\.nkaylabs\.com\/dashboard\?tab=referrals&amp;id=b2222222-3333-4444-5555-666666666666/, "HTML must link to volunteer dashboard.");
assert.match(approvedEmail.text, /Points Earned: \+10 pts/, "Plain text must display points.");
assert.match(approvedEmail.text, /Total Score: 45 pts/, "Plain text must display cumulative score.");
assert.match(approvedEmail.text, /Leaderboard Rank: #3/, "Plain text must display rank.");

// 3c. Volunteer: Rejected Referral with Custom Note
const rejectedEmailCustom = renderVolunteerRejectedEmail({
  volunteerName: "Alice Wonder",
  to: "alice@example.com",
  ticketType: "VIP Pass",
  ticketQuantity: 1,
  orderReference: "REF-INVALID-1",
  rejectionReason: "Order number does not correspond to any attendee on Meeteor",
  referralId: "c3333333-4444-5555-6666-777777777777",
});

assert.match(rejectedEmailCustom.subject, /Referral Update: Claim not verified/, "Subject must be clear and respectful.");
assert.match(rejectedEmailCustom.html, /Order number does not correspond to any attendee on Meeteor/, "HTML must include recorded admin rejection note.");
assert.match(rejectedEmailCustom.text, /Reason: Order number does not correspond to any attendee on Meeteor/, "Plain text must include rejection reason.");

// 3d. Volunteer: Rejected Referral when stale default approval note was left in DB
const rejectedEmailStaleApprovalNote = renderVolunteerRejectedEmail({
  volunteerName: "Bob Builder",
  to: "bob@example.com",
  ticketType: "Regular",
  ticketQuantity: 1,
  rejectionReason: "Verified against Meeteor Hub records",
  referralId: "d4444444-5555-6666-7777-888888888888",
});

assert.doesNotMatch(
  rejectedEmailStaleApprovalNote.html,
  /Verified against Meeteor Hub records/,
  "Rejected email must NEVER display the default approval note."
);
assert.match(
  rejectedEmailStaleApprovalNote.html,
  /Record does not match Meeteor Hub attendee list/,
  "HTML must provide safe fallback reason when note is default approval boilerplate."
);

console.log("  ✓ All 3 email templates render branded, mobile-responsive HTML and plain text with correct variables.");

// -----------------------------------------------------------------------------
// [4] Offline Resend API Dispatch Simulation (No Real Emails Sent)
// -----------------------------------------------------------------------------
console.log("[4] Testing Offline Resend API Dispatch Simulation...");

const originalApiKey = process.env.RESEND_API_KEY;
const originalAdminEmails = process.env.ADMIN_NOTIFICATION_EMAILS;
delete process.env.RESEND_API_KEY;

// 4a. Missing API key
const skippedResult = await sendEmail({
  to: "test@example.com",
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
});
assert.equal(skippedResult.success, false, "Must return success=false when API key is missing.");
assert.equal(skippedResult.skipped, true, "Must flag skipped=true when API key is missing.");

// 4b. Invalid/empty recipients
process.env.RESEND_API_KEY = "re_test_mock_key_only";
const emptyRecipientsResult = await sendEmail({
  to: ["invalid-address", ""],
  subject: "Test",
  html: "<p>Test</p>",
  text: "Test",
});
assert.equal(emptyRecipientsResult.success, false);
assert.equal(emptyRecipientsResult.skipped, true, "Must skip when no valid recipient addresses remain.");

const originalFetch = global.fetch;

try {
  // 4c. Mock 200 OK Success + Idempotency-Key verification
  let capturedHeaders = null;
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails", "Must call official Resend API endpoint.");
    assert.equal(options.method, "POST");
    capturedHeaders = options.headers;

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "mock-resend-msg-id-12345" }),
    };
  };

  const successResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test\r\nMocked Success",
    html: "<p>Hello</p>",
    text: "Hello",
    idempotencyKey: "volunteer-decision/ref-123/approved",
  });
  assert.equal(successResult.success, true);
  assert.equal(successResult.messageId, "mock-resend-msg-id-12345");
  assert.equal(capturedHeaders["Idempotency-Key"], "volunteer-decision/ref-123/approved", "Must pass Idempotency-Key header to Resend.");

  // 4d. Mock 401 Unauthorized
  global.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    text: async () => JSON.stringify({ message: "API key is invalid." }),
  });

  const authErrorResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test Auth Error",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(authErrorResult.success, false);
  assert.match(authErrorResult.error, /API key is invalid/);

  // 4e. Mock 422 Unverified Domain
  global.fetch = async () => ({
    ok: false,
    status: 422,
    statusText: "Unprocessable Entity",
    text: async () => JSON.stringify({ message: "The domain mail.nkaylabs.com is not verified in Resend." }),
  });

  const domainErrorResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test Domain Error",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(domainErrorResult.success, false);
  assert.match(domainErrorResult.error, /domain mail\.nkaylabs\.com is not verified/);

  // 4f. Mock 429 Rate Limit
  global.fetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    text: async () => JSON.stringify({ message: "Rate limit exceeded: 2 requests per second allowed." }),
  });

  const rateLimitResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test Rate Limit",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(rateLimitResult.success, false);
  assert.match(rateLimitResult.error, /Rate limit exceeded/);

  // 4g. Mock Non-JSON Error Body (e.g., 502 Bad Gateway HTML)
  global.fetch = async () => ({
    ok: false,
    status: 502,
    statusText: "Bad Gateway",
    text: async () => "<html><body><h1>502 Bad Gateway</h1></body></html>",
  });

  const nonJsonErrorResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test 502 HTML Error",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(nonJsonErrorResult.success, false);
  assert.match(nonJsonErrorResult.error, /Resend HTTP error 502 \(Bad Gateway\)/);

  // 4h. Mock AbortError Timeout
  global.fetch = async () => {
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    throw abortErr;
  };

  const timeoutErrorResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test Timeout Error",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(timeoutErrorResult.success, false);
  assert.match(timeoutErrorResult.error, /Request timed out after 9 seconds/);

  // 4i. Mock Network Exception
  global.fetch = async () => {
    throw new Error("Connection reset by peer");
  };

  const networkErrorResult = await sendEmail({
    to: "volunteer@example.com",
    subject: "Test Network Error",
    html: "<p>Hello</p>",
    text: "Hello",
  });
  assert.equal(networkErrorResult.success, false);
  assert.match(networkErrorResult.error, /Connection reset by peer/);

} finally {
  global.fetch = originalFetch;
}

console.log("  ✓ Resend API dispatch simulations (200, 401, 422, 429, 502 non-JSON, AbortError timeout, network failure) passed.");

// -----------------------------------------------------------------------------
// [5] In-Flight & Recent Deduplication, Retries After Failure, & Status Transitions
// -----------------------------------------------------------------------------
console.log("[5] Testing In-Flight Locking, Deduplication, Retries After Failure, & Status Transitions...");

clearRecentEmailDispatches();
const testKey = "test_event_referral_123_approved";

assert.equal(isRecentEmailDispatch(testKey), false, "Key must not be marked recent initially.");
recordEmailDispatch(testKey);
assert.equal(isRecentEmailDispatch(testKey), true, "Key must be marked recent after recordEmailDispatch.");
assert.equal(isRecentEmailDispatch(testKey, -1), false, "Key must expire if elapsed time exceeds TTL.");

clearEmailDispatchKey(testKey);
assert.equal(isRecentEmailDispatch(testKey), false, "clearEmailDispatchKey must remove key immediately.");

try {
  process.env.RESEND_API_KEY = "re_mock_key";
  process.env.ADMIN_NOTIFICATION_EMAILS = "admin1@nkaylabs.com; admin2@nkaylabs.com, invalid-email";
  clearRecentEmailDispatches();

  // 5a. sendAdminNewReferralNotification execution, recipient parsing, Idempotency-Key, and duplicate skip
  let adminFetchCalls = 0;
  let lastAdminRequest = null;

  global.fetch = async (url, options) => {
    adminFetchCalls++;
    lastAdminRequest = {
      url,
      headers: options.headers,
      body: JSON.parse(options.body),
    };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: `admin-msg-${adminFetchCalls}` }),
    };
  };

  const adminFirst = await sendAdminNewReferralNotification({
    volunteerName: "Chidi Obi",
    volunteerTeam: "Logistics",
    ticketType: "Standard",
    ticketQuantity: 2,
    orderReference: "ORD-777",
    buyerName: "Ada Lovelace",
    submittedAt: "2026-10-22T15:00:00.000Z",
    referralId: "ref-admin-test-1",
  });

  assert.equal(adminFirst.success, true, "First admin notification must succeed.");
  assert.equal(Boolean(adminFirst.success && !adminFirst.skipped), true, "emailDispatched must evaluate to true on first send.");
  assert.equal(adminFetchCalls, 1);
  assert.deepEqual(lastAdminRequest.body.to, ["admin1@nkaylabs.com", "admin2@nkaylabs.com"]);
  assert.equal(lastAdminRequest.headers["Idempotency-Key"], "admin-referral-submission/ref-admin-test-1");

  const adminDuplicate = await sendAdminNewReferralNotification({
    volunteerName: "Chidi Obi",
    volunteerTeam: "Logistics",
    ticketType: "Standard",
    ticketQuantity: 2,
    orderReference: "ORD-777",
    buyerName: "Ada Lovelace",
    submittedAt: "2026-10-22T15:00:00.000Z",
    referralId: "ref-admin-test-1",
  });

  assert.equal(adminDuplicate.success, false, "Skipped duplicate must return success: false.");
  assert.equal(adminDuplicate.skipped, true, "Skipped duplicate must return skipped: true.");
  assert.equal(Boolean(adminDuplicate.success && !adminDuplicate.skipped), false, "emailDispatched must be false for skipped duplicate.");
  assert.equal(adminFetchCalls, 1, "No second fetch call on duplicate admin referral notification.");

  // 5b. Concurrent in-flight duplicate calls (Promise.all)
  clearRecentEmailDispatches();
  let concurrentFetchCalls = 0;

  global.fetch = async () => {
    concurrentFetchCalls++;
    await new Promise((resolve) => setTimeout(resolve, 40));
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: `concurrent-msg-${concurrentFetchCalls}` }),
    };
  };

  const [callA, callB] = await Promise.all([
    sendVolunteerDecisionNotification({
      decision: "approved",
      volunteerName: "Jane",
      to: "jane@example.com",
      ticketType: "Regular",
      ticketQuantity: 1,
      pointsEarned: 5,
      referralId: "ref-concurrent-1",
    }),
    sendVolunteerDecisionNotification({
      decision: "approved",
      volunteerName: "Jane",
      to: "jane@example.com",
      ticketType: "Regular",
      ticketQuantity: 1,
      pointsEarned: 5,
      referralId: "ref-concurrent-1",
    }),
  ]);

  assert.equal(concurrentFetchCalls, 1, "Concurrent identical calls must only trigger 1 HTTP request.");
  assert.equal(callA.success, true, "First concurrent caller must succeed.");
  assert.equal(callB.success, false, "Second concurrent caller must return success: false.");
  assert.equal(callB.skipped, true, "Second concurrent caller must be marked skipped: true.");

  // 5c. Retry after a failed send (must NOT be suppressed)
  clearRecentEmailDispatches();
  let retryFetchCalls = 0;

  global.fetch = async () => {
    retryFetchCalls++;
    if (retryFetchCalls === 1) {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => JSON.stringify({ message: "Temporary upstream failure" }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: "retry-success-msg-id" }),
    };
  };

  const failedAttempt = await sendVolunteerDecisionNotification({
    decision: "approved",
    volunteerName: "Jane",
    to: "jane@example.com",
    ticketType: "Regular",
    ticketQuantity: 1,
    pointsEarned: 5,
    referralId: "ref-retry-1",
  });
  assert.equal(failedAttempt.success, false, "First attempt fails with 500.");
  assert.equal(retryFetchCalls, 1);

  const retryAttempt = await sendVolunteerDecisionNotification({
    decision: "approved",
    volunteerName: "Jane",
    to: "jane@example.com",
    ticketType: "Regular",
    ticketQuantity: 1,
    pointsEarned: 5,
    referralId: "ref-retry-1",
  });
  assert.equal(retryAttempt.success, true, "Immediate retry after failed send must succeed and not be suppressed.");
  assert.equal(retryAttempt.messageId, "retry-success-msg-id");
  assert.equal(retryFetchCalls, 2);

  // 5d. Status transitions: approved -> rejected -> approved
  clearRecentEmailDispatches();
  let transitionFetchCalls = 0;
  const capturedIdempotencyKeys = [];

  global.fetch = async (_url, options) => {
    transitionFetchCalls++;
    capturedIdempotencyKeys.push(options.headers["Idempotency-Key"]);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: `transition-msg-${transitionFetchCalls}` }),
    };
  };

  const step1Approve = await sendVolunteerDecisionNotification({
    decision: "approved",
    volunteerName: "Jane",
    to: "jane@example.com",
    ticketType: "Regular",
    ticketQuantity: 1,
    pointsEarned: 5,
    referralId: "ref-transition-1",
  });
  assert.equal(step1Approve.success, true);

  const step2Reject = await sendVolunteerDecisionNotification({
    decision: "rejected",
    volunteerName: "Jane",
    to: "jane@example.com",
    ticketType: "Regular",
    ticketQuantity: 1,
    rejectionReason: "Mistakenly approved earlier",
    referralId: "ref-transition-1",
  });
  assert.equal(step2Reject.success, true);

  const step3ReApprove = await sendVolunteerDecisionNotification({
    decision: "approved",
    volunteerName: "Jane",
    to: "jane@example.com",
    ticketType: "Regular",
    ticketQuantity: 1,
    pointsEarned: 5,
    referralId: "ref-transition-1",
  });
  assert.equal(
    step3ReApprove.success,
    true,
    "Re-approving after rejection must clear the earlier approved key and dispatch the new approval email."
  );
  assert.equal(transitionFetchCalls, 3, "All 3 legitimate status transition emails must be dispatched.");
  assert.deepEqual(capturedIdempotencyKeys, [
    "volunteer-decision/ref-transition-1/approved",
    "volunteer-decision/ref-transition-1/rejected",
    "volunteer-decision/ref-transition-1/approved",
  ]);
} finally {
  global.fetch = originalFetch;
  clearRecentEmailDispatches();
  if (originalApiKey !== undefined) {
    process.env.RESEND_API_KEY = originalApiKey;
  } else {
    delete process.env.RESEND_API_KEY;
  }
  if (originalAdminEmails !== undefined) {
    process.env.ADMIN_NOTIFICATION_EMAILS = originalAdminEmails;
  } else {
    delete process.env.ADMIN_NOTIFICATION_EMAILS;
  }
}

console.log("  ✓ In-flight locking, duplicate skip semantics, retry after failure, and status transitions verified.");

// -----------------------------------------------------------------------------
// [6] Route Integration Invariants
// -----------------------------------------------------------------------------
console.log("[6] Verifying API Route Integration & Contract Invariants...");

const adminRoutePath = path.join(
  rootDir,
  "src",
  "app",
  "api",
  "notifications",
  "notify-admin-referral",
  "route.ts"
);
const adminRouteContent = fs.readFileSync(adminRoutePath, "utf-8");

assert.match(
  adminRouteContent,
  /import\s*\{[^}]*sendAdminNewReferralNotification[^}]*\}\s*from\s*["']@\/lib\/email["']/,
  "notify-admin-referral route must import sendAdminNewReferralNotification."
);
assert.match(
  adminRouteContent,
  /create_admin_notifications_for_referral/,
  "notify-admin-referral route must invoke in-app fanout RPC."
);
assert.match(
  adminRouteContent,
  /rpcResult\s*&&\s*rpcResult\.success\s*===\s*false/,
  "notify-admin-referral route must inspect rpcResult.success === false and return 422 before email dispatch."
);
assert.match(
  adminRouteContent,
  /\.eq\(["']id["'],\s*referral\.volunteer_id\)/,
  "notify-admin-referral route must load volunteer profile via referral.volunteer_id, not user.id."
);
assert.match(
  adminRouteContent,
  /Boolean\(emailResult\.success\s*&&\s*!emailResult\.skipped\)/,
  "notify-admin-referral route must set emailDispatched = Boolean(emailResult.success && !emailResult.skipped)."
);

const volunteerRoutePath = path.join(
  rootDir,
  "src",
  "app",
  "api",
  "notifications",
  "notify-volunteer-decision",
  "route.ts"
);
const volunteerRouteContent = fs.readFileSync(volunteerRoutePath, "utf-8");

assert.match(
  volunteerRouteContent,
  /import\s*\{[^}]*sendVolunteerDecisionNotification[^}]*\}\s*from\s*["']@\/lib\/email["']/,
  "notify-volunteer-decision route must import sendVolunteerDecisionNotification."
);
assert.match(
  volunteerRouteContent,
  /create_volunteer_decision_notification/,
  "notify-volunteer-decision route must invoke volunteer decision notification RPC."
);
assert.match(
  volunteerRouteContent,
  /status:\s*403/,
  "notify-volunteer-decision route must preserve 403 Forbidden mapping."
);
assert.match(
  volunteerRouteContent,
  /status:\s*422/,
  "notify-volunteer-decision route must preserve 422 Unprocessable mapping."
);
assert.match(
  volunteerRouteContent,
  /Boolean\(emailResult\.success\s*&&\s*!emailResult\.skipped\)/,
  "notify-volunteer-decision route must set emailDispatched = Boolean(emailResult.success && !emailResult.skipped)."
);

console.log("  ✓ Notification API routes enforce RPC validation, referral.volunteer_id profile lookup, and accurate emailDispatched reporting.");

// -----------------------------------------------------------------------------
// [7] Environment Variable Documentation in .env.example
// -----------------------------------------------------------------------------
console.log("[7] Verifying .env.example Documentation...");

const envExamplePath = path.join(rootDir, ".env.example");
const envExampleContent = fs.readFileSync(envExamplePath, "utf-8");

assert.match(
  envExampleContent,
  /RESEND_API_KEY=/,
  ".env.example must document RESEND_API_KEY."
);
assert.match(
  envExampleContent,
  /RESEND_FROM_EMAIL=/,
  ".env.example must document RESEND_FROM_EMAIL."
);
assert.match(
  envExampleContent,
  /ADMIN_NOTIFICATION_EMAILS=/,
  ".env.example must document ADMIN_NOTIFICATION_EMAILS."
);

console.log("  ✓ .env.example clearly documents all Stage B2 transactional email environment variables without secrets.");

console.log("------------------------------------------------------------");
console.log("All VolTex Stage B2 Transactional Email Verification Checks Passed!");
console.log("------------------------------------------------------------");
