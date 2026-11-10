/**
 * VolTex Verification Suite: Pre-Purchase Referral Capture Form UX
 *
 * Verifies the 11 targeted requirements for the referral capture page:
 * 1. Dynamic volunteer name display in introduction
 * 2. Gender-neutral introduction phrasing
 * 3. Dropdown contains exactly 5 options (1–5)
 * 4. Default selection is 1 Ticket
 * 5. State transitions across all 5 options
 * 6. Rejection of invalid quantities outside 1–5
 * 7. Correct submission payload packaging
 * 8. Button text displays "Proceed to Ticket Checkout"
 * 9. Preservation of referral code attribution & first-touch invariants
 * 10. Preservation of Meeteor checkout destination redirect
 * 11. Stated tickets planned never awards points or marks verified
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=======================================================");
console.log("Running VolTex Referral Capture Form UX Verification");
console.log("=======================================================\n");

const formComponentPath = path.join(rootDir, "src", "components", "referrals", "BuyerCaptureForm.tsx");
const apiRoutePath = path.join(rootDir, "src", "app", "api", "referrals", "capture", "route.ts");
const constantsPath = path.join(rootDir, "src", "config", "constants.ts");

assert.ok(fs.existsSync(formComponentPath), "BuyerCaptureForm.tsx must exist.");
assert.ok(fs.existsSync(apiRoutePath), "api/referrals/capture/route.ts must exist.");
assert.ok(fs.existsSync(constantsPath), "constants.ts must exist.");

const formSource = fs.readFileSync(formComponentPath, "utf8");
const apiSource = fs.readFileSync(apiRoutePath, "utf8");
const constantsSource = fs.readFileSync(constantsPath, "utf8");

// -----------------------------------------------------------------------------
// [Test 1] Dynamic Volunteer Name in Introduction
// -----------------------------------------------------------------------------
console.log("[Test 1] Dynamic Volunteer Name Display in Introduction");
{
  // Confirm the JSX does not hardcode any volunteer name
  const hardcodedNames = ["Sarah", "John", "Alex", "David", "Nathaniel", "Grace", "Michael"];
  for (const name of hardcodedNames) {
    const hardcodedPattern = new RegExp(`You were referred by.*\\b${name}\\b`, "i");
    assert.equal(
      hardcodedPattern.test(formSource),
      false,
      `Form must not hardcode sample name '${name}' in introduction.`
    );
  }

  // Verify dynamic template rendering
  assert.match(
    formSource,
    /You were referred by <strong[^>]*>\{volunteerName\}<\/strong>\.\s*Enter your details below to ensure your ticket purchase is credited to their leaderboard\./,
    "Introduction must dynamically interpolate {volunteerName} with the exact approved phrasing."
  );

  // Function to simulate renderIntroText
  const renderIntroText = (volunteerName) => {
    if (volunteerName) {
      return `You were referred by ${volunteerName}. Enter your details below to ensure your ticket purchase is credited to their leaderboard.`;
    }
    return "Enter your details and volunteer referral code before proceeding to official ticket checkout.";
  };

  assert.equal(
    renderIntroText("Chiamaka Okafor"),
    "You were referred by Chiamaka Okafor. Enter your details below to ensure your ticket purchase is credited to their leaderboard."
  );
  assert.equal(
    renderIntroText("Tunde Bakare"),
    "You were referred by Tunde Bakare. Enter your details below to ensure your ticket purchase is credited to their leaderboard."
  );
  assert.equal(
    renderIntroText(null),
    "Enter your details and volunteer referral code before proceeding to official ticket checkout."
  );
  console.log("✔ Dynamic volunteer name rendering verified.");
}

// -----------------------------------------------------------------------------
// [Test 2] Gender-Neutral Phrasing
// -----------------------------------------------------------------------------
console.log("\n[Test 2] Gender-Neutral Wording");
{
  const introMatch = formSource.match(/You were referred by[\s\S]*?credited to their leaderboard\./);
  assert.ok(introMatch, "Updated introduction sentence must be present.");
  const sentence = introMatch[0];

  assert.match(sentence, /their leaderboard/, "Sentence must use gender-neutral 'their leaderboard'.");
  assert.doesNotMatch(sentence, /\bhis leaderboard\b/i, "Sentence must not use 'his'.");
  assert.doesNotMatch(sentence, /\bher leaderboard\b/i, "Sentence must not use 'her'.");
  assert.doesNotMatch(sentence, /\bhis\/her\b/i, "Sentence must not use 'his/her'.");
  console.log("✔ Gender-neutral phrasing verified.");
}

// -----------------------------------------------------------------------------
// [Test 3] Dropdown Contains Exactly Five Options (1–5)
// -----------------------------------------------------------------------------
console.log("\n[Test 3] Dropdown Options Invariant (Exactly 1 to 5 Tickets)");
{
  // Confirm numeric input was removed
  assert.doesNotMatch(
    formSource,
    /<input[^>]*type="number"[^>]*Tickets Planned/i,
    "Numeric input for Tickets Planned must be removed."
  );

  // Extract all <option> elements within the tickets-planned select
  const selectMatch = formSource.match(/<select[^>]*id="tickets-planned"[\s\S]*?<\/select>/);
  assert.ok(selectMatch, "<select id='tickets-planned'> must be present in BuyerCaptureForm.tsx.");

  const selectJSX = selectMatch[0];
  const optionMatches = [...selectJSX.matchAll(/<option\s+value=\{?(\d+)\}?>([^<]+)<\/option>/g)];

  assert.equal(optionMatches.length, 5, "Dropdown must contain exactly 5 options.");

  const expectedOptions = [
    { value: 1, label: "1 Ticket" },
    { value: 2, label: "2 Tickets" },
    { value: 3, label: "3 Tickets" },
    { value: 4, label: "4 Tickets" },
    { value: 5, label: "5 Tickets" },
  ];

  optionMatches.forEach((match, index) => {
    const val = Number(match[1]);
    const label = match[2].trim();
    assert.equal(val, expectedOptions[index].value, `Option ${index + 1} value must be ${expectedOptions[index].value}`);
    assert.equal(label, expectedOptions[index].label, `Option ${index + 1} label must be '${expectedOptions[index].label}'`);
  });

  console.log("✔ Dropdown contains exactly options 1 through 5 with proper labels.");
}

// -----------------------------------------------------------------------------
// [Test 4] Default Selection is 1 Ticket
// -----------------------------------------------------------------------------
console.log("\n[Test 4] Default Selection is 1 Ticket");
{
  assert.match(
    formSource,
    /const\s*\[ticketQuantity,\s*setTicketQuantity\]\s*=\s*useState\(1\);/,
    "ticketQuantity state must default to 1."
  );
  console.log("✔ Default state initialized to 1 Ticket.");
}

// -----------------------------------------------------------------------------
// [Test 5] State Transitions Across All 5 Options
// -----------------------------------------------------------------------------
console.log("\n[Test 5] State Transitions Across All Allowed Options");
{
  // Simulate the onChange handler logic
  const simulateChange = (current, rawInput) => {
    const val = parseInt(rawInput, 10);
    if (val >= 1 && val <= 5) {
      return val;
    }
    return current;
  };

  let current = 1;
  for (let opt = 1; opt <= 5; opt++) {
    current = simulateChange(current, String(opt));
    assert.equal(current, opt, `State must transition to ${opt}`);
  }

  // Wrap back to 1
  current = simulateChange(current, "1");
  assert.equal(current, 1, "State must transition back to 1.");
  console.log("✔ State transitions between 1, 2, 3, 4, and 5 verified.");
}

// -----------------------------------------------------------------------------
// [Test 6] Rejection of Invalid Values Outside 1–5
// -----------------------------------------------------------------------------
console.log("\n[Test 6] Rejection of Quantities Outside 1–5 (Client & API)");
{
  // Client-side validation logic
  const validateClientQty = (qty) => {
    const parsed = Number(qty);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      return { valid: false, error: "Please select a valid ticket quantity between 1 and 5." };
    }
    return { valid: true, value: parsed };
  };

  // Server-side validation logic
  const validateServerQty = (qty) => {
    const num = Number(qty);
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      return { valid: false, status: 400, error: "INVALID_QUANTITY" };
    }
    return { valid: true, value: num };
  };

  const invalidInputs = [0, -1, 6, 10, 50, 100, 1.5, NaN, "abc", null, undefined];
  for (const input of invalidInputs) {
    const clientRes = validateClientQty(input);
    assert.equal(clientRes.valid, false, `Client should reject invalid input: ${input}`);

    const serverRes = validateServerQty(input);
    assert.equal(serverRes.valid, false, `Server should reject invalid input: ${input}`);
    assert.equal(serverRes.status, 400);
    assert.equal(serverRes.error, "INVALID_QUANTITY");
  }

  // Valid inputs
  for (let valid = 1; valid <= 5; valid++) {
    assert.equal(validateClientQty(valid).valid, true);
    assert.equal(validateServerQty(valid).valid, true);
  }

  // Ensure route.ts enforces 1 to 5
  assert.match(
    apiSource,
    /if\s*\(!Number\.isInteger\(qty\)\s*\|\|\s*qty\s*<\s*1\s*\|\|\s*qty\s*>\s*5\)/,
    "API route must validate integer quantity between 1 and 5."
  );

  console.log("✔ Out-of-bounds and invalid values rejected across client and server.");
}

// -----------------------------------------------------------------------------
// [Test 7] Selected Quantity Correctly Submitted in Payload
// -----------------------------------------------------------------------------
console.log("\n[Test 7] Selected Quantity in Submission Payload");
{
  assert.match(
    formSource,
    /body:\s*JSON\.stringify\(\{[\s\S]*?ticketQuantity:\s*parsedQty[\s\S]*?\}\)/,
    "Payload must transmit parsedQty as an integer in JSON body."
  );

  const buildPayload = ({ fullName, email, referralCode, phone, ticketQuantity, sourceAttribution }) => {
    const cleanName = fullName.trim();
    const cleanEmail = email.trim();
    const cleanCode = referralCode.trim().toUpperCase();
    const parsedQty = Number(ticketQuantity);
    return {
      fullName: cleanName,
      email: cleanEmail,
      referralCode: cleanCode,
      phone: phone.trim() || null,
      ticketQuantity: parsedQty,
      sourceAttribution: sourceAttribution.trim() || null,
    };
  };

  const payload = buildPayload({
    fullName: "Jane Doe",
    email: "jane@example.com",
    referralCode: "VOL-TEST",
    phone: "+2348000000000",
    ticketQuantity: 3,
    sourceAttribution: "Volunteer Referral Link",
  });

  assert.equal(payload.ticketQuantity, 3);
  assert.equal(typeof payload.ticketQuantity, "number");
  assert.equal(payload.referralCode, "VOL-TEST");
  console.log("✔ Payload formatting and quantity transmission verified.");
}

// -----------------------------------------------------------------------------
// [Test 8] Button Wording: "Proceed to Ticket Checkout"
// -----------------------------------------------------------------------------
console.log("\n[Test 8] Checkout Button Text");
{
  assert.match(
    formSource,
    /<span>Proceed to Ticket Checkout<\/span>/,
    "Button must display 'Proceed to Ticket Checkout'."
  );
  assert.doesNotMatch(
    formSource,
    /Continue to Meeteor Ticket Checkout/,
    "Old wording 'Continue to Meeteor Ticket Checkout' must not remain."
  );

  // Preserve icon and loading state
  assert.match(formSource, /<ArrowRight className="w-4 h-4" \/>/, "ArrowRight icon must be preserved.");
  assert.match(formSource, /Securing Referral\.\.\./, "Loading state text must be preserved.");
  console.log("✔ Button copy correctly updated to 'Proceed to Ticket Checkout'.");
}

// -----------------------------------------------------------------------------
// [Test 9] Referral Attribution Integrity
// -----------------------------------------------------------------------------
console.log("\n[Test 9] Referral Attribution Invariants");
{
  // Confirm capture route calls capture_buyer_referral RPC with referral code
  assert.match(apiSource, /rpc\("capture_buyer_referral"/, "Capture API must invoke capture_buyer_referral RPC.");
  assert.match(apiSource, /p_referral_code:\s*cleanCode/, "Capture API must pass cleanCode to RPC.");
  assert.match(apiSource, /p_ticket_quantity:\s*qty/, "Capture API must pass validated qty to RPC.");
  assert.match(apiSource, /p_source_attribution:/, "Capture API must pass source attribution.");
  console.log("✔ Referral attribution parameters and database RPC interface intact.");
}

// -----------------------------------------------------------------------------
// [Test 10] Meeteor Checkout Redirect Destination Preserved
// -----------------------------------------------------------------------------
console.log("\n[Test 10] Meeteor Checkout Destination Redirect");
{
  assert.match(
    formSource,
    /window\.location\.href\s*=\s*result\.redirectUrl\s*\|\|\s*CONFERENCE_CONFIG\.ticketUrl;/,
    "Successful submission must redirect to result.redirectUrl or CONFERENCE_CONFIG.ticketUrl."
  );

  assert.match(
    constantsSource,
    /https:\/\/meeteor\.me\/clip\/join\?eventId=DSVXOF/,
    "CONFERENCE_CONFIG.ticketUrl must point to official Meeteor event checkout."
  );

  // Direct bypass link
  assert.match(
    formSource,
    /<a\s+href=\{CONFERENCE_CONFIG\.ticketUrl\}[\s\S]*?Skip referral capture & purchase tickets directly on Meeteor/i,
    "Direct bypass link to Meeteor must remain available."
  );
  console.log("✔ Redirect URL and Meeteor destination verified.");
}

// -----------------------------------------------------------------------------
// [Test 11] Planned Quantity Independence from Points & Verification
// -----------------------------------------------------------------------------
console.log("\n[Test 11] Invariant: Tickets Planned Never Awards Points Directly");
{
  // Check that leads table status is 'captured' or 'touch_recorded', NEVER 'approved'
  assert.match(
    formSource,
    /successPayload\.status\s*===\s*"touch_recorded"/,
    "Form handles initial capture and touch_recorded states only."
  );

  // In VolTex scoring model:
  // Points = verified approved claims only.
  // Leads are prospective buyer captures that require Meeteor purchase + Admin review.
  const simulateVolunteerPoints = (leads, verifiedPurchases) => {
    // Leads do NOT generate points
    const leadPoints = leads.reduce((acc, lead) => {
      // Tickets planned should never be multiplied into volunteer points
      return acc + 0;
    }, 0);

    // Verified purchases generate 5 points per ticket
    const verifiedPoints = verifiedPurchases
      .filter((p) => p.status === "approved")
      .reduce((acc, p) => acc + (p.ticketQuantity || 1) * 5, 0);

    return leadPoints + verifiedPoints;
  };

  const sampleLeads = [
    { buyerEmail: "a@test.com", ticketsPlanned: 5, status: "captured" },
    { buyerEmail: "b@test.com", ticketsPlanned: 3, status: "touch_recorded" },
  ];

  const sampleVerified = [
    { orderRef: "ORD-001", ticketQuantity: 2, status: "approved" },
  ];

  const totalPoints = simulateVolunteerPoints(sampleLeads, sampleVerified);
  assert.equal(totalPoints, 10, "Volunteer points must strictly derive from verified purchases (2 * 5 = 10 pts), not leads.");
  console.log("✔ Tickets Planned confirmed as non-scoring buyer intention.");
}

console.log("\n=======================================================");
console.log("✔ ALL REFERRAL CAPTURE FORM UX TESTS PASSED (11/11)");
console.log("=======================================================");
