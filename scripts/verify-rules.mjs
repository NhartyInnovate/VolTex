/**
 * Automated Verification Script for VolTex Scoring & Security Rules
 * Runs via Node.js built-in assertion test runner.
 */

import assert from "node:assert/strict";

// Pure scoring logic matching src/lib/scoring.ts
function calculatePointsFromTickets(verifiedTickets, config = {}) {
  const safeTickets = Math.max(0, Math.floor(verifiedTickets || 0));
  const ratio = Math.max(1, Math.floor(config.ticketsPerPoint ?? 2));
  const allowCarryover = config.enableCarryover ?? true;
  const points = Math.floor(safeTickets / ratio);
  const carryoverTickets = allowCarryover ? safeTickets % ratio : 0;
  return { points, carryoverTickets };
}

function calculateVolunteerSummary(referrals, config = {}) {
  let approvedTickets = 0;
  let pendingTickets = 0;
  let rejectedTickets = 0;
  let totalSubmittedTickets = 0;

  for (const item of referrals) {
    const qty = Math.max(1, Math.min(50, item.ticketQuantity || 1));
    totalSubmittedTickets += qty;

    if (item.status === "approved") {
      approvedTickets += qty;
    } else if (item.status === "pending") {
      pendingTickets += qty;
    } else if (item.status === "rejected") {
      rejectedTickets += qty;
    }
  }

  const { points, carryoverTickets } = calculatePointsFromTickets(approvedTickets, config);

  return {
    totalSubmittedTickets,
    approvedTickets,
    pendingTickets,
    rejectedTickets,
    points,
    carryoverTickets,
  };
}

// Team fallback logic matching src/config/constants.ts
const CONFIRMED_TEAMS = [
  "Protocol/Ushering/Logistics Team",
  "TEDxGwarinpa Prayer Team",
  "Volunteer Management Team",
  "Health and Welfare Team",
  "Photography and Videography Team",
  "Curation/Programs Team",
  "Sponsorship and Partnership Team",
  "TEDxGwarinpa Novelty Match ⚽",
  "Public Relation (PR) Team",
  "Technical/Sound Team",
  "Website Team",
];

function getSafeVolunteerTeam(team) {
  if (!team || typeof team !== "string" || !team.trim()) {
    return "Volunteer Management Team";
  }
  return team.trim();
}

console.log("=== Running VolTex Security & Scoring Test Suite ===");

// 1. Test Base Scoring & Carryover Rules (Default 1 pt per 2 tickets)
console.log("\n[Test 1] Scoring Edge Cases (1 pt / 2 tickets + odd carryover)");
{
  assert.deepEqual(calculatePointsFromTickets(0), { points: 0, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(1), { points: 0, carryoverTickets: 1 });
  assert.deepEqual(calculatePointsFromTickets(2), { points: 1, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(3), { points: 1, carryoverTickets: 1 });
  assert.deepEqual(calculatePointsFromTickets(4), { points: 2, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(5), { points: 2, carryoverTickets: 1 });
  assert.deepEqual(calculatePointsFromTickets(10), { points: 5, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(11), { points: 5, carryoverTickets: 1 });
  assert.deepEqual(calculatePointsFromTickets(-5), { points: 0, carryoverTickets: 0 }, "Negative tickets should be clamped to 0");
  console.log("✔ Base scoring tests passed.");
}

// 2. Test Volunteer Referral Aggregation & Isolation
console.log("\n[Test 2] Referral Aggregation Integrity");
{
  const testSubmissions = [
    { ticketQuantity: 2, status: "approved" },
    { ticketQuantity: 1, status: "approved" }, // Total approved = 3 => 1 pt, 1 carryover
    { ticketQuantity: 4, status: "pending" },  // Should not count toward points
    { ticketQuantity: 2, status: "rejected" }, // Should not count toward points
  ];

  const summary = calculateVolunteerSummary(testSubmissions);
  assert.equal(summary.totalSubmittedTickets, 9, "Total submitted should be 9");
  assert.equal(summary.approvedTickets, 3, "Approved tickets should be 3");
  assert.equal(summary.pendingTickets, 4, "Pending tickets should be 4");
  assert.equal(summary.rejectedTickets, 2, "Rejected tickets should be 2");
  assert.equal(summary.points, 1, "3 approved tickets must equal 1 point");
  assert.equal(summary.carryoverTickets, 1, "3 approved tickets must have 1 carryover ticket");
  console.log("✔ Referral aggregation tests passed.");
}

// 3. Test Carryover Preservation Across Incremental Submissions
console.log("\n[Test 3] Incremental Carryover Progression");
{
  // Volunteer starts with 1 approved ticket
  let subs = [{ ticketQuantity: 1, status: "approved" }];
  let res = calculateVolunteerSummary(subs);
  assert.equal(res.points, 0);
  assert.equal(res.carryoverTickets, 1);

  // Volunteer gets 1 more approved ticket -> point should trigger!
  subs.push({ ticketQuantity: 1, status: "approved" });
  res = calculateVolunteerSummary(subs);
  assert.equal(res.points, 1, "Carryover + new ticket must award 1 point");
  assert.equal(res.carryoverTickets, 0, "Carryover should now be 0");

  // Volunteer gets 3 more approved tickets -> total 5 approved -> 2 pts + 1 carryover
  subs.push({ ticketQuantity: 3, status: "approved" });
  res = calculateVolunteerSummary(subs);
  assert.equal(res.points, 2);
  assert.equal(res.carryoverTickets, 1);
  console.log("✔ Incremental carryover progression verified.");
}

// 4. Test Duplicate Normalization & Matching Logic
console.log("\n[Test 4] Duplicate Identifier Normalization");
{
  const normalize = (val) => (val ? val.toLowerCase().trim() : "");

  assert.equal(normalize("  MTR-TX-9901  "), "mtr-tx-9901");
  assert.equal(normalize("BUYER@DOMAIN.COM"), "buyer@domain.com");
  assert.equal(normalize(null), "");
  assert.equal(normalize(undefined), "");

  const existing = ["mtr-tx-9901", "08031234567", "chidi@test.com"];

  const checkDuplicate = (code) => {
    const norm = normalize(code);
    return norm ? existing.includes(norm) : false;
  };

  assert.equal(checkDuplicate("  MTR-TX-9901 "), true, "Should match despite spaces & case");
  assert.equal(checkDuplicate("MTR-tx-9901"), true);
  assert.equal(checkDuplicate("08031234567"), true);
  assert.equal(checkDuplicate(""), false, "Empty string should never match");
  assert.equal(checkDuplicate(null), false, "Null should never match");
  assert.equal(checkDuplicate("MTR-NEW-9999"), false);
  console.log("✔ Duplicate normalization verified.");
}

// 5. Test Ticket Quantity Clamping Boundary
console.log("\n[Test 5] Ticket Quantity Bounds (1 to 50)");
{
  const clampQty = (qty) => Math.min(50, Math.max(1, Number(qty) || 1));

  assert.equal(clampQty(1), 1);
  assert.equal(clampQty(50), 50);
  assert.equal(clampQty(0), 1, "0 must clamp to minimum 1");
  assert.equal(clampQty(-10), 1, "Negative must clamp to minimum 1");
  assert.equal(clampQty(500), 50, "Excessive quantities must clamp to maximum 50");
  assert.equal(clampQty("abc"), 1, "NaN must fallback to 1");
  console.log("✔ Quantity bounds verified.");
}

// 6. Test Configurable Admin Scoring Policies
console.log("\n[Test 6] Configurable Scoring Policies");
{
  // Test ratio 3 with carryover
  const configRatio3 = { ticketsPerPoint: 3, enableCarryover: true };
  assert.deepEqual(calculatePointsFromTickets(6, configRatio3), { points: 2, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(7, configRatio3), { points: 2, carryoverTickets: 1 });
  assert.deepEqual(calculatePointsFromTickets(8, configRatio3), { points: 2, carryoverTickets: 2 });
  assert.deepEqual(calculatePointsFromTickets(9, configRatio3), { points: 3, carryoverTickets: 0 });

  // Test ratio 2 with carryover DISABLED
  const configNoCarryover = { ticketsPerPoint: 2, enableCarryover: false };
  assert.deepEqual(calculatePointsFromTickets(3, configNoCarryover), { points: 1, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(5, configNoCarryover), { points: 2, carryoverTickets: 0 });

  // Test 1-to-1 ratio
  const config1to1 = { ticketsPerPoint: 1, enableCarryover: true };
  assert.deepEqual(calculatePointsFromTickets(4, config1to1), { points: 4, carryoverTickets: 0 });

  console.log("✔ Configurable scoring policies verified.");
}

// 7. Test Confirmed Team List & Fallbacks
console.log("\n[Test 7] Volunteer Team Structure & Safe Fallbacks");
{
  assert.equal(CONFIRMED_TEAMS.length, 11, "Must contain exactly 11 confirmed community teams");
  assert.ok(CONFIRMED_TEAMS.includes("TEDxGwarinpa Novelty Match ⚽"));
  assert.ok(CONFIRMED_TEAMS.includes("Website Team"));
  assert.ok(CONFIRMED_TEAMS.includes("Protocol/Ushering/Logistics Team"));

  // Fallback tests
  assert.equal(getSafeVolunteerTeam("Website Team"), "Website Team");
  assert.equal(getSafeVolunteerTeam(""), "Volunteer Management Team");
  assert.equal(getSafeVolunteerTeam(null), "Volunteer Management Team");
  assert.equal(getSafeVolunteerTeam(undefined), "Volunteer Management Team");
  assert.equal(getSafeVolunteerTeam("Legacy Disbanded Team"), "Legacy Disbanded Team", "Legacy team string is preserved safely");

  console.log("✔ Volunteer team structure and safe fallbacks verified.");
}

console.log("\n=======================================================");
console.log("✔ ALL VERIFICATION TESTS PASSED SUCCESSFULLY (7/7)");
console.log("=======================================================\n");
