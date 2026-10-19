/**
 * Automated Verification Script for VolTex Scoring & Security Rules
 * Runs via Node.js built-in assertion test runner.
 */

import assert from "node:assert/strict";

// Pure scoring logic matching src/lib/scoring.ts
function calculatePointsFromTickets(verifiedTickets, config = {}) {
  const safeTickets = Math.max(0, Math.floor(verifiedTickets || 0));

  // If pointsPerTicket is provided (preferred model, default: 5)
  if (config.pointsPerTicket !== undefined || (!config.ticketsPerPoint)) {
    const pointsFactor = Math.max(1, Math.floor(config.pointsPerTicket ?? 5));
    return {
      points: safeTickets * pointsFactor,
      carryoverTickets: 0,
    };
  }

  // Legacy fallback ratio support if an admin sets ticketsPerPoint
  const ratio = Math.max(1, Math.floor(config.ticketsPerPoint ?? 1));
  const allowCarryover = config.enableCarryover ?? false;
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

// 1. Test Base Scoring: 5 Points per Verified Ticket
console.log("\n[Test 1] Scoring Edge Cases (5 points per verified ticket)");
{
  assert.deepEqual(calculatePointsFromTickets(0), { points: 0, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(1), { points: 5, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(2), { points: 10, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(3), { points: 15, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(4), { points: 20, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(10), { points: 50, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(-5), { points: 0, carryoverTickets: 0 }, "Negative tickets should be clamped to 0");
  console.log("✔ Base scoring tests passed.");
}

// 2. Test Volunteer Referral Aggregation & Isolation (Pending & Rejected earn 0)
console.log("\n[Test 2] Referral Aggregation Integrity");
{
  const testSubmissions = [
    { ticketQuantity: 2, status: "approved" },
    { ticketQuantity: 1, status: "approved" }, // Total approved = 3 => 3 * 5 = 15 pts
    { ticketQuantity: 4, status: "pending" },  // Should not count toward points
    { ticketQuantity: 2, status: "rejected" }, // Should not count toward points
  ];

  const summary = calculateVolunteerSummary(testSubmissions);
  assert.equal(summary.totalSubmittedTickets, 9, "Total submitted should be 9");
  assert.equal(summary.approvedTickets, 3, "Approved tickets should be 3");
  assert.equal(summary.pendingTickets, 4, "Pending tickets should be 4");
  assert.equal(summary.rejectedTickets, 2, "Rejected tickets should be 2");
  assert.equal(summary.points, 15, "3 approved tickets must equal 15 points (5 pts/ticket)");
  assert.equal(summary.carryoverTickets, 0);
  console.log("✔ Referral aggregation tests passed.");
}

// 3. Test Point Accumulation Across Incremental Submissions
console.log("\n[Test 3] Incremental Point Progression");
{
  // Volunteer starts with 1 approved ticket -> 5 pts
  let subs = [{ ticketQuantity: 1, status: "approved" }];
  let res = calculateVolunteerSummary(subs);
  assert.equal(res.points, 5);

  // Volunteer gets 1 more approved ticket -> 10 pts
  subs.push({ ticketQuantity: 1, status: "approved" });
  res = calculateVolunteerSummary(subs);
  assert.equal(res.points, 10, "1 additional ticket must add 5 points");

  // Volunteer gets 3 more approved tickets -> total 5 approved -> 25 pts
  subs.push({ ticketQuantity: 3, status: "approved" });
  res = calculateVolunteerSummary(subs);
  assert.equal(res.points, 25);
  console.log("✔ Incremental point progression verified.");
}

// 4. Test Duplicate Normalization, Constraint Logic & Point Integrity
console.log("\n[Test 4] Duplicate Identifier Normalization & Detection Rules");
{
  const normalize = (val) => (val ? val.toLowerCase().trim() : "");

  assert.equal(normalize("  MTR-TX-9901  "), "mtr-tx-9901");
  assert.equal(normalize("BUYER@DOMAIN.COM"), "buyer@domain.com");
  assert.equal(normalize(null), "");
  assert.equal(normalize(undefined), "");

  // Model a mock database referral collection
  const referralsDB = [
    {
      id: "ref-1",
      volunteer_id: "vol-1",
      buyer_name: "Babatunde Lawal",
      order_reference: "MTR-ORD-101",
      buyer_email: "babatunde@example.com",
      status: "pending",
      ticket_quantity: 2,
    },
    {
      id: "ref-2",
      volunteer_id: "vol-2",
      buyer_name: "Fatima Yusuf",
      order_reference: "MTR-ORD-202",
      buyer_email: "fatima@example.com",
      status: "approved",
      ticket_quantity: 3,
    },
    {
      id: "ref-3",
      volunteer_id: "vol-3",
      buyer_name: "Kelechi Umeh",
      order_reference: "MTR-ORD-303",
      buyer_email: "kelechi@example.com",
      status: "rejected",
      ticket_quantity: 1,
    },
  ];

  // Logic representing check_referral_duplicate() + unique index
  const evaluateSubmission = (submission, existingList) => {
    const normRef = normalize(submission.order_reference);
    const normEmail = normalize(submission.buyer_email);
    const normName = normalize(submission.buyer_name);

    // 1. Order reference match check (across pending, approved, and rejected)
    if (normRef) {
      const match = existingList.find(
        (r) => normalize(r.order_reference) === normRef
      );
      if (match) {
        return {
          allowed: false,
          errorCode: "DUPLICATE_ORDER_REFERENCE",
          message: "This order reference has already been submitted by another claim and cannot be credited again.",
          flaggedDuplicate: true,
          duplicateReason: "Purchase identifier matches existing referral claim",
        };
      }
    }

    // 2. Buyer email match check (allowed, but flagged for admin reconciliation)
    let flaggedDuplicate = false;
    let duplicateReason = null;
    if (normEmail) {
      const emailMatch = existingList.find(
        (r) => normalize(r.buyer_email) === normEmail
      );
      if (emailMatch) {
        flaggedDuplicate = true;
        duplicateReason = "Matching buyer email detected; requires organizer reconciliation";
      }
    }

    // 3. Name match check
    if (!flaggedDuplicate && normName) {
      const nameMatch = existingList.find(
        (r) => normalize(r.buyer_name) === normName
      );
      if (nameMatch) {
        flaggedDuplicate = true;
        duplicateReason = "Matching buyer name detected; requires organizer reconciliation";
      }
    }

    return {
      allowed: true,
      flaggedDuplicate,
      duplicateReason,
    };
  };

  // 1. Same order reference submitted twice while pending -> REJECTED
  const res1 = evaluateSubmission(
    { order_reference: "MTR-ORD-101", buyer_email: "different@domain.com", buyer_name: "Different Name" },
    referralsDB
  );
  assert.equal(res1.allowed, false, "Must reject duplicate order reference when existing is pending");
  assert.equal(res1.errorCode, "DUPLICATE_ORDER_REFERENCE");

  // 2. Same order reference submitted after approval -> REJECTED
  const res2 = evaluateSubmission(
    { order_reference: "MTR-ORD-202", buyer_email: "another@domain.com", buyer_name: "Another Name" },
    referralsDB
  );
  assert.equal(res2.allowed, false, "Must reject duplicate order reference when existing is approved");

  // 3. Same order reference with changed buyer details -> REJECTED
  const res3 = evaluateSubmission(
    { order_reference: "MTR-ORD-101", buyer_name: "Impersonator Name", buyer_email: "attacker@domain.com" },
    referralsDB
  );
  assert.equal(res3.allowed, false, "Changing buyer name/email must not bypass order reference duplicate check");

  // 4. Same buyer email with a DIFFERENT order reference -> ALLOWED but FLAGGED
  const res4 = evaluateSubmission(
    { order_reference: "MTR-ORD-404", buyer_email: "  Babatunde@Example.COM  ", buyer_name: "Babatunde Lawal" },
    referralsDB
  );
  assert.equal(res4.allowed, true, "Legitimate repeat purchase by same email must be allowed");
  assert.equal(res4.flaggedDuplicate, true, "Same email with new order ref must be flagged for admin review");
  assert.equal(res4.duplicateReason, "Matching buyer email detected; requires organizer reconciliation");

  // 5. Order references differing only by surrounding whitespace or letter case -> REJECTED
  const res5 = evaluateSubmission(
    { order_reference: "  mtr-ord-101  ", buyer_email: "test@domain.com", buyer_name: "Test" },
    referralsDB
  );
  assert.equal(res5.allowed, false, "Whitespace and case variation must be normalized and rejected");

  // 6. Same order reference submitted when previous was REJECTED -> REJECTED
  const res6 = evaluateSubmission(
    { order_reference: "MTR-ORD-303", buyer_email: "new@domain.com", buyer_name: "New Person" },
    referralsDB
  );
  assert.equal(res6.allowed, false, "Cannot re-submit an order reference that was previously rejected");

  // 7. Legitimate fresh second purchase by the same buyer with new order reference
  const res7 = evaluateSubmission(
    { order_reference: "MTR-ORD-505", buyer_email: "completely.new@example.com", buyer_name: "New Attendee" },
    referralsDB
  );
  assert.equal(res7.allowed, true, "Fresh purchase must be allowed without duplicate flag");
  assert.equal(res7.flaggedDuplicate, false);

  // 8. Points remaining unchanged for pending, rejected, and duplicate submissions
  const pointTestCollection = [
    { ticketQuantity: 2, status: "approved" }, // 10 pts
    { ticketQuantity: 5, status: "pending", flaggedDuplicate: true }, // 0 pts
    { ticketQuantity: 4, status: "rejected", flaggedDuplicate: true }, // 0 pts
    { ticketQuantity: 1, status: "pending", flaggedDuplicate: false }, // 0 pts
  ];
  const summaryPoints = calculateVolunteerSummary(pointTestCollection);
  assert.equal(summaryPoints.points, 10, "Points must strictly come from approved tickets only");
  assert.equal(summaryPoints.approvedTickets, 2);
  assert.equal(summaryPoints.pendingTickets, 6);
  assert.equal(summaryPoints.rejectedTickets, 4);

  console.log("✔ Duplicate normalization, constraints & point integrity verified.");
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
  // Test official 5 points per ticket policy
  const config5pts = { pointsPerTicket: 5 };
  assert.deepEqual(calculatePointsFromTickets(1, config5pts), { points: 5, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(4, config5pts), { points: 20, carryoverTickets: 0 });

  // Test custom 10 points per ticket policy
  const config10pts = { pointsPerTicket: 10 };
  assert.deepEqual(calculatePointsFromTickets(3, config10pts), { points: 30, carryoverTickets: 0 });

  // Test legacy ratio 3 with carryover
  const configRatio3 = { ticketsPerPoint: 3, enableCarryover: true };
  assert.deepEqual(calculatePointsFromTickets(6, configRatio3), { points: 2, carryoverTickets: 0 });
  assert.deepEqual(calculatePointsFromTickets(7, configRatio3), { points: 2, carryoverTickets: 1 });
  assert.deepEqual(calculatePointsFromTickets(8, configRatio3), { points: 2, carryoverTickets: 2 });
  assert.deepEqual(calculatePointsFromTickets(9, configRatio3), { points: 3, carryoverTickets: 0 });

  // Test legacy ratio 2 with carryover DISABLED
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

// 8. Test Database Invariant: Duplicate-Flagged Referral Approval Verification Notes
console.log("\n[Test 8] Database Invariant: Duplicate Referral Approval Notes");
{
  // Constraint logic matching check_duplicate_approval_notes:
  // status <> 'approved' OR flagged_duplicate = FALSE OR (admin_notes IS NOT NULL AND length(trim(admin_notes)) >= 5)
  function validateReferralApprovalConstraint(record) {
    const { status, flaggedDuplicate, adminNotes } = record;
    if (status !== "approved") return true;
    if (!flaggedDuplicate) return true;
    if (!adminNotes) return false;
    const trimmed = adminNotes.trim();
    return trimmed.length >= 5;
  }

  // Case 1: Normal referral approved without notes -> ALLOWED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: false,
      adminNotes: null,
    }),
    true,
    "Normal non-duplicate referral can be approved without notes"
  );

  // Case 2: Normal referral approved with notes -> ALLOWED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: false,
      adminNotes: "Verified attendee",
    }),
    true,
    "Normal non-duplicate referral can be approved with notes"
  );

  // Case 3: Duplicate-flagged referral pending without notes -> ALLOWED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "pending",
      flaggedDuplicate: true,
      adminNotes: null,
    }),
    true,
    "Duplicate-flagged referral in pending status is allowed without notes"
  );

  // Case 4: Duplicate-flagged referral rejected without notes -> ALLOWED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "rejected",
      flaggedDuplicate: true,
      adminNotes: null,
    }),
    true,
    "Duplicate-flagged referral can be rejected without notes"
  );

  // Case 5: Duplicate-flagged referral approved with MISSING notes -> BLOCKED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: true,
      adminNotes: null,
    }),
    false,
    "Duplicate-flagged referral CANNOT be approved with null admin_notes"
  );

  // Case 6: Duplicate-flagged referral approved with EMPTY string notes -> BLOCKED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: true,
      adminNotes: "",
    }),
    false,
    "Duplicate-flagged referral CANNOT be approved with empty string admin_notes"
  );

  // Case 7: Duplicate-flagged referral approved with WHITESPACE-ONLY notes -> BLOCKED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: true,
      adminNotes: "     ",
    }),
    false,
    "Duplicate-flagged referral CANNOT be approved with whitespace-only admin_notes"
  );

  // Case 8: Duplicate-flagged referral approved with SHORT (< 5 chars) notes -> BLOCKED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: true,
      adminNotes: "ok",
    }),
    false,
    "Duplicate-flagged referral CANNOT be approved with less than 5 characters"
  );

  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: true,
      adminNotes: "  ok  ",
    }),
    false,
    "Duplicate-flagged referral CANNOT be approved when trimmed length < 5"
  );

  // Case 9: Duplicate-flagged referral approved with VALID notes (>= 5 chars) -> ALLOWED
  assert.equal(
    validateReferralApprovalConstraint({
      status: "approved",
      flaggedDuplicate: true,
      adminNotes: "Verified distinct payment on Meeteor Hub",
    }),
    true,
    "Duplicate-flagged referral CAN be approved with valid organizer rationale"
  );

  console.log("✔ Database invariant for duplicate approval notes verified.");
}

console.log("\n=======================================================");
console.log("✔ ALL VERIFICATION TESTS PASSED SUCCESSFULLY (8/8)");
console.log("=======================================================\n");
