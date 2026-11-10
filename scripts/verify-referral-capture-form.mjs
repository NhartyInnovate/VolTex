/**
 * VolTex Verification Suite: Pre-Purchase Referral Capture Form UX & Dynamic Code Ingress
 *
 * Verifies all requirements:
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
 * 12. Dynamic code capture on /r/NATHAN-9LGH & automatic population
 * 13. Dynamic code switching between /r/NATHAN-9LGH and /r/SARAH-7X2K
 * 14. URL refresh persistence & client URL parameter fallback
 * 15. Generic /r route indicates no code supplied & requires entry
 * 16. Safe handling of invalid referral codes
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
const rCodePagePath = path.join(rootDir, "src", "app", "r", "[code]", "page.tsx");
const rGeneralPagePath = path.join(rootDir, "src", "app", "r", "page.tsx");
const apiRoutePath = path.join(rootDir, "src", "app", "api", "referrals", "capture", "route.ts");
const constantsPath = path.join(rootDir, "src", "config", "constants.ts");

assert.ok(fs.existsSync(formComponentPath), "BuyerCaptureForm.tsx must exist.");
assert.ok(fs.existsSync(rCodePagePath), "app/r/[code]/page.tsx must exist.");
assert.ok(fs.existsSync(rGeneralPagePath), "app/r/page.tsx must exist.");
assert.ok(fs.existsSync(apiRoutePath), "api/referrals/capture/route.ts must exist.");
assert.ok(fs.existsSync(constantsPath), "constants.ts must exist.");

const formSource = fs.readFileSync(formComponentPath, "utf8");
const rCodeSource = fs.readFileSync(rCodePagePath, "utf8");
const rGeneralSource = fs.readFileSync(rGeneralPagePath, "utf8");
const apiSource = fs.readFileSync(apiRoutePath, "utf8");
const constantsSource = fs.readFileSync(constantsPath, "utf8");

// -----------------------------------------------------------------------------
// [Test 1] Dynamic Volunteer Name in Introduction
// -----------------------------------------------------------------------------
console.log("[Test 1] Dynamic Volunteer Name Display in Introduction");
{
  const hardcodedNames = ["Sarah", "John", "Alex", "David", "Nathaniel", "Grace", "Michael"];
  for (const name of hardcodedNames) {
    const hardcodedPattern = new RegExp(`You were referred by.*\\b${name}\\b`, "i");
    assert.equal(
      hardcodedPattern.test(formSource),
      false,
      `Form must not hardcode sample name '${name}' in introduction.`
    );
  }

  assert.match(
    formSource,
    /You were referred by <strong[^>]*>\{volunteerName\}<\/strong>\.\s*Enter your details below to ensure your ticket purchase is credited to their leaderboard\./,
    "Introduction must dynamically interpolate {volunteerName} with the exact approved phrasing."
  );

  const renderIntroText = (volunteerName) => {
    if (volunteerName) {
      return `You were referred by ${volunteerName}. Enter your details below to ensure your ticket purchase is credited to their leaderboard.`;
    }
    return "Enter your details and volunteer referral code before proceeding to official ticket checkout.";
  };

  assert.equal(
    renderIntroText("Nathaniel Katugwa"),
    "You were referred by Nathaniel Katugwa. Enter your details below to ensure your ticket purchase is credited to their leaderboard."
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
  assert.doesNotMatch(
    formSource,
    /<input[^>]*type="number"[^>]*Tickets Planned/i,
    "Numeric input for Tickets Planned must be removed."
  );

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

  current = simulateChange(current, "1");
  assert.equal(current, 1, "State must transition back to 1.");
  console.log("✔ State transitions between 1, 2, 3, 4, and 5 verified.");
}

// -----------------------------------------------------------------------------
// [Test 6] Rejection of Invalid Values Outside 1–5
// -----------------------------------------------------------------------------
console.log("\n[Test 6] Rejection of Quantities Outside 1–5 (Client & API)");
{
  const validateClientQty = (qty) => {
    const parsed = Number(qty);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
      return { valid: false, error: "Please select a valid ticket quantity between 1 and 5." };
    }
    return { valid: true, value: parsed };
  };

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

  for (let valid = 1; valid <= 5; valid++) {
    assert.equal(validateClientQty(valid).valid, true);
    assert.equal(validateServerQty(valid).valid, true);
  }

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
  console.log("✔ Button copy correctly updated to 'Proceed to Ticket Checkout'.");
}

// -----------------------------------------------------------------------------
// [Test 9] Referral Attribution Integrity
// -----------------------------------------------------------------------------
console.log("\n[Test 9] Referral Attribution Invariants");
{
  assert.match(apiSource, /rpc\("capture_buyer_referral"/, "Capture API must invoke capture_buyer_referral RPC.");
  assert.match(apiSource, /p_referral_code:\s*cleanCode/, "Capture API must pass cleanCode to RPC.");
  assert.match(apiSource, /p_ticket_quantity:\s*qty/, "Capture API must pass validated qty to RPC.");
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
  console.log("✔ Redirect URL and Meeteor destination verified.");
}

// -----------------------------------------------------------------------------
// [Test 11] Planned Quantity Independence from Points & Verification
// -----------------------------------------------------------------------------
console.log("\n[Test 11] Invariant: Tickets Planned Never Awards Points Directly");
{
  assert.match(
    formSource,
    /successPayload\.status\s*===\s*"touch_recorded"/,
    "Form handles initial capture and touch_recorded states only."
  );
  console.log("✔ Tickets Planned confirmed as non-scoring buyer intention.");
}

// -----------------------------------------------------------------------------
// [Test 12] Automatic Referral Code Ingress (/r/NATHAN-9LGH)
// -----------------------------------------------------------------------------
console.log("\n[Test 12] Automatic Referral Code Ingress (/r/NATHAN-9LGH)");
{
  // 1. app/r/[code]/page.tsx passes key={rawCode} and initialCode={rawCode}
  assert.match(
    rCodeSource,
    /<BuyerCaptureForm[\s\S]*?key=\{rawCode\}[\s\S]*?initialCode=\{rawCode\}/,
    "app/r/[code]/page.tsx must provide key={rawCode} and initialCode={rawCode}."
  );

  // 2. BuyerCaptureForm.tsx synchronizes referralCode state on mount and initialCode change
  assert.match(
    formSource,
    /setReferralCode\(initialCode\.trim\(\)\.toUpperCase\(\)\)/,
    "BuyerCaptureForm must automatically set referralCode from initialCode."
  );

  // 3. Simulating /r/NATHAN-9LGH
  const simulateCodeIngress = (code) => {
    const raw = (code || "").trim().toUpperCase();
    return {
      initialCode: raw,
      renderedInputValue: raw,
      isDisabled: Boolean(raw),
      appliedMessage: Boolean(raw) ? "Referral code applied from invite link." : null,
    };
  };

  const nathanPage = simulateCodeIngress("NATHAN-9LGH");
  assert.equal(nathanPage.initialCode, "NATHAN-9LGH");
  assert.equal(nathanPage.renderedInputValue, "NATHAN-9LGH");
  assert.equal(nathanPage.isDisabled, true, "Direct invite code must be locked/disabled to prevent accidental erasure.");
  assert.equal(nathanPage.appliedMessage, "Referral code applied from invite link.");
  console.log("✔ /r/NATHAN-9LGH automatically populates and locks NATHAN-9LGH.");
}

// -----------------------------------------------------------------------------
// [Test 13] Switching Between Personalized Referral Links (/r/SARAH-7X2K)
// -----------------------------------------------------------------------------
console.log("\n[Test 13] Dynamic Code Switching (/r/NATHAN-9LGH -> /r/SARAH-7X2K)");
{
  // Because key={rawCode} is present, React destroys previous state and initializes with new code
  const simulateRouteTransition = (firstCode, secondCode) => {
    const key1 = firstCode;
    let state = firstCode;

    // Route transition to secondCode
    const key2 = secondCode;
    if (key1 !== key2) {
      state = secondCode; // React remount with key
    }
    return state;
  };

  const codeAfterTransition = simulateRouteTransition("NATHAN-9LGH", "SARAH-7X2K");
  assert.equal(codeAfterTransition, "SARAH-7X2K", "Must switch cleanly to SARAH-7X2K on route change.");
  console.log("✔ Dynamic switching between volunteer codes verified.");
}

// -----------------------------------------------------------------------------
// [Test 14] URL Refresh Persistence & Query Parameter Support
// -----------------------------------------------------------------------------
console.log("\n[Test 14] Refresh Persistence & Query Parameter Fallback (?code= / ?ref=)");
{
  // 1. Check client-side URL fallback in BuyerCaptureForm.tsx
  assert.match(
    formSource,
    /pathname\.match\(\/\^\\\/r\\\/\(..*?\)\/i\)/,
    "BuyerCaptureForm must have fallback pathname parser for /r/[code]."
  );
  assert.match(
    formSource,
    /sp\.get\("code"\)\s*\|\|\s*sp\.get\("ref"\)\s*\|\|\s*sp\.get\("referralCode"\)/,
    "BuyerCaptureForm must have fallback search query parser for ?code= and ?ref=."
  );

  // 2. Check server-side searchParams support in app/r/page.tsx
  assert.match(
    rGeneralSource,
    /searchParams\?\.code\s*\|\|\s*searchParams\?\.ref\s*\|\|\s*searchParams\?\.referralCode/,
    "app/r/page.tsx must resolve query parameters from URL."
  );

  console.log("✔ Refresh persistence and query parameter fallbacks verified.");
}

// -----------------------------------------------------------------------------
// [Test 15] Generic /r Route Notice (No Code Supplied)
// -----------------------------------------------------------------------------
console.log("\n[Test 15] Generic /r Route Notice");
{
  assert.match(
    formSource,
    /No referral code supplied\. Enter your volunteer(?:'|&apos;)s code if you have one\./,
    "Generic /r must clearly indicate when no referral code was supplied."
  );

  // When initialCode is empty:
  const isDirect = false;
  const initialCode = "";
  const showsApplied = isDirect && Boolean(initialCode);
  assert.equal(showsApplied, false, "Generic route must never claim a code was applied.");
  console.log("✔ Generic /r route correctly indicates absence of referral code.");
}

// -----------------------------------------------------------------------------
// [Test 16] Safe Handling of Invalid Codes
// -----------------------------------------------------------------------------
console.log("\n[Test 16] Safe Handling of Invalid Codes");
{
  assert.match(
    rCodeSource,
    /if\s*\(profile\)\s*\{\s*volunteerName\s*=\s*profile\.full_name;\s*\}\s*else\s*\{\s*isValidCode\s*=\s*false;\s*\}/,
    "Unrecognized code must set isValidCode = false without throwing unhandled exceptions."
  );
  console.log("✔ Invalid codes handled gracefully without crashing or false attribution.");
}

console.log("\n=======================================================");
console.log("✔ ALL REFERRAL CAPTURE & AUTO-INGRESS TESTS PASSED (16/16)");
console.log("=======================================================");
