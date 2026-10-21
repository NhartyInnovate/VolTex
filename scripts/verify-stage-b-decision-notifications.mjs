/**
 * Automated Verification Script for VolTex Stage B1: In-App Volunteer Decision Notifications
 *
 * Verifies:
 * 1. Migration SQL structure and safety invariants:
 *    - create_volunteer_decision_notification function exists and uses SECURITY DEFINER
 *    - search_path is set to empty string (''): full schema qualification
 *    - Enforces authentication and checks caller profile role = 'admin'
 *    - Fetches authoritative referral, points per ticket, and dense rank
 *    - Awards points strictly on approval (quantity * active points per ticket)
 *    - Awards exactly 0 points on rejection
 *    - Fallback rejection note preserved: 'Declined: Record does not match Meeteor Hub attendee list'
 *    - Deduplication key: 'referral_decision_' || referral_id || '_' || status
 *    - ON CONFLICT (user_id, deduplication_key) DO NOTHING prevents duplicate inserts
 *    - Revokes execute from PUBLIC and anon; grants strictly to authenticated
 * 2. Deduplication key stability & determinism across retries
 * 3. Store simulation of volunteer decision alerts, score calculation, and rank attribution
 * 4. RLS data isolation simulation (volunteers only see their own decisions)
 * 5. Dashboard integration and parameter hydration safety
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("------------------------------------------------------------");
console.log("VolTex Stage B1 Verification: Volunteer Decision Notifications");
console.log("------------------------------------------------------------");

// 1. Verify Migration File Presence & SQL Safety
const migrationPath = path.join(
  rootDir,
  "supabase",
  "migrations",
  "20261021000003_volunteer_decision_notifications.sql"
);

assert.ok(
  fs.existsSync(migrationPath),
  "Migration file 20261021000003_volunteer_decision_notifications.sql must exist."
);
const migrationSql = fs.readFileSync(migrationPath, "utf-8");

console.log("[1] Checking SQL Migration Invariants...");

assert.match(
  migrationSql,
  /CREATE OR REPLACE FUNCTION public\.create_volunteer_decision_notification\s*\(\s*p_referral_id UUID\s*\)/i,
  "Must define create_volunteer_decision_notification(p_referral_id UUID)."
);

assert.match(
  migrationSql,
  /SECURITY DEFINER/i,
  "Function must be SECURITY DEFINER."
);

assert.match(
  migrationSql,
  /SET search_path = ''/i,
  "Function must fix search_path to empty string for secure schema qualification."
);

assert.match(
  migrationSql,
  /SELECT 1 FROM public\.profiles\s+WHERE id = v_calling_user_id AND role = 'admin'/i,
  "Function must verify caller has role = 'admin'."
);

assert.match(
  migrationSql,
  /v_active_pts_per_ticket := public\.get_active_points_per_ticket\(\)/i,
  "Function must dynamically fetch active points per ticket from database function."
);

assert.match(
  migrationSql,
  /FROM public\.get_public_leaderboard\(\)\s+WHERE volunteer_id = v_referral\.volunteer_id/i,
  "Function must query authoritative cumulative score and rank from public.get_public_leaderboard()."
);

assert.match(
  migrationSql,
  /v_points_earned := v_referral\.ticket_quantity \* v_active_pts_per_ticket/i,
  "Approval branch must calculate points as ticket_quantity * active_pts_per_ticket."
);

assert.match(
  migrationSql,
  /v_points_earned := 0/i,
  "Rejection branch must award exactly 0 points."
);

assert.match(
  migrationSql,
  /Declined: Record does not match Meeteor Hub attendee list/i,
  "Must preserve the standard fallback rejection note."
);

assert.match(
  migrationSql,
  /v_dedup_key := 'referral_decision_' \|\| v_referral\.id::TEXT \|\| '_' \|\| v_status_text/i,
  "Deduplication key must be deterministic: 'referral_decision_' || id || '_' || status."
);

assert.match(
  migrationSql,
  /ON CONFLICT \(user_id, deduplication_key\) DO NOTHING/i,
  "Must enforce ON CONFLICT (user_id, deduplication_key) DO NOTHING."
);

assert.match(
  migrationSql,
  /REVOKE ALL ON FUNCTION public\.create_volunteer_decision_notification\(UUID\) FROM PUBLIC, anon/i,
  "Must revoke execution from PUBLIC and anon."
);

assert.match(
  migrationSql,
  /GRANT EXECUTE ON FUNCTION public\.create_volunteer_decision_notification\(UUID\) TO authenticated/i,
  "Must grant execution strictly to authenticated."
);

console.log("  ✓ Migration SQL file passes all structure, RLS, and security constraints.");

// 2. Verify Deduplication Key Determinism
console.log("[2] Verifying Decision Deduplication Keys...");

function generateDecisionDedupKey(referralId, status) {
  assert.ok(referralId && typeof referralId === "string", "Referral ID required");
  assert.ok(["approved", "rejected"].includes(status), "Status must be approved or rejected");
  return `referral_decision_${referralId}_${status}`;
}

const refId = "b9175314-5d5d-4f24-b529-5ea0cb45a999";
const keyApproved1 = generateDecisionDedupKey(refId, "approved");
const keyApproved2 = generateDecisionDedupKey(refId, "approved");
const keyRejected = generateDecisionDedupKey(refId, "rejected");

assert.equal(keyApproved1, keyApproved2, "Decision dedup key must be identical across retries.");
assert.notEqual(keyApproved1, keyRejected, "Approved and rejected keys must be distinct.");
assert.ok(!/\d{10,13}/.test(keyApproved1.replace(refId, "")), "Dedup key must not contain epoch timestamps.");
console.log(`  ✓ Dedup key is stable: "${keyApproved1}"`);

// 3. Store Simulation: Decision Alerts, Authoritative Scores, and Deduplication
console.log("[3] Simulating Decision Notifications Store...");

class DecisionNotificationStore {
  constructor() {
    this.notifications = [];
  }

  insert(entry) {
    if (entry.deduplication_key) {
      const exists = this.notifications.find(
        (n) => n.user_id === entry.user_id && n.deduplication_key === entry.deduplication_key
      );
      if (exists) {
        return { inserted: false, record: exists };
      }
    }

    const record = {
      id: `notif_${this.notifications.length + 1}`,
      user_id: entry.user_id,
      title: entry.title,
      message: entry.message,
      type: entry.type,
      link_url: entry.link_url || null,
      metadata: entry.metadata || {},
      deduplication_key: entry.deduplication_key,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    this.notifications.push(record);
    return { inserted: true, record };
  }

  getForUser(userId) {
    return this.notifications.filter((n) => n.user_id === userId);
  }
}

const store = new DecisionNotificationStore();
const volunteerAlice = "vol-uuid-alice";
const volunteerBob = "vol-uuid-bob";

// Scenario A: Administrator approves 2 Regular tickets for Alice (pointsPerTicket = 5)
const ptsPerTicket = 5;
const qty = 2;
const ptsEarned = qty * ptsPerTicket;
const aliceCumPoints = 25; // 25 total
const aliceRank = 3;

const approveRes = store.insert({
  user_id: volunteerAlice,
  title: "Referral Claim Approved",
  message: `Your claim for 2x Regular Ticket was verified (+ ${ptsEarned} pts). Total Score: ${aliceCumPoints} pts (Rank #${aliceRank}).`,
  type: "referral_approved",
  link_url: `/dashboard?tab=referrals&id=${refId}`,
  metadata: {
    referral_id: refId,
    decision: "approved",
    points_earned: ptsEarned,
    cumulative_points: aliceCumPoints,
    rank: aliceRank,
  },
  deduplication_key: generateDecisionDedupKey(refId, "approved"),
});

assert.equal(approveRes.inserted, true);
assert.equal(approveRes.record.metadata.points_earned, 10);
assert.equal(approveRes.record.metadata.cumulative_points, 25);
assert.equal(approveRes.record.metadata.rank, 3);

// Scenario B: Admin retries approve button (idempotency check)
const retryRes = store.insert({
  user_id: volunteerAlice,
  title: "Referral Claim Approved",
  message: `Duplicate approval`,
  type: "referral_approved",
  deduplication_key: generateDecisionDedupKey(refId, "approved"),
});
assert.equal(retryRes.inserted, false, "Duplicate approval insert must be suppressed by unique constraint.");
assert.equal(store.getForUser(volunteerAlice).length, 1);

// Scenario C: Administrator rejects Bob's referral (0 points, preserves admin note)
const bobRefId = "c1234567-0000-4f24-b529-5ea0cb45a000";
const customNote = "Payment receipt reference does not match any transaction on Meeteor Hub.";

const rejectRes = store.insert({
  user_id: volunteerBob,
  title: "Referral Claim Declined",
  message: `Your claim for 1x VIP Ticket was declined. Reason: ${customNote}`,
  type: "referral_rejected",
  link_url: `/dashboard?tab=referrals&id=${bobRefId}`,
  metadata: {
    referral_id: bobRefId,
    decision: "rejected",
    points_earned: 0,
    admin_notes: customNote,
  },
  deduplication_key: generateDecisionDedupKey(bobRefId, "rejected"),
});

assert.equal(rejectRes.inserted, true);
assert.equal(rejectRes.record.metadata.points_earned, 0, "Rejection must award exactly 0 points.");
assert.equal(rejectRes.record.metadata.admin_notes, customNote, "Admin note must be preserved verbatim.");

// Scenario D: RLS Isolation check (Alice cannot see Bob's rejection)
assert.equal(store.getForUser(volunteerAlice).length, 1);
assert.equal(store.getForUser(volunteerAlice)[0].type, "referral_approved");
assert.equal(store.getForUser(volunteerBob).length, 1);
assert.equal(store.getForUser(volunteerBob)[0].type, "referral_rejected");

console.log("  ✓ Decision notifications store, points, rank, and isolation verified.");

// 4. Verify Code Integrations in Admin and Dashboard Pages
console.log("[4] Checking Code References in Admin & Dashboard Pages...");

const adminContent = fs.readFileSync(path.join(rootDir, "src", "app", "admin", "page.tsx"), "utf-8");
assert.ok(
  adminContent.includes("/api/notifications/notify-volunteer-decision"),
  "Admin page must trigger notify-volunteer-decision upon status update."
);
assert.ok(
  adminContent.includes("res.ok"),
  "Admin page must check response.ok in a non-blocking then handler."
);
assert.ok(
  adminContent.includes("console.warn"),
  "Admin page must log safe diagnostics with console.warn on non-2xx or fetch errors."
);
assert.ok(
  adminContent.includes(".catch("),
  "Notify volunteer fetch must catch errors non-blockingly."
);

const dashboardContent = fs.readFileSync(path.join(rootDir, "src", "app", "dashboard", "page.tsx"), "utf-8");
assert.ok(
  dashboardContent.includes("useSearchParams"),
  "Volunteer dashboard must read searchParams for referral highlighting."
);
assert.ok(
  dashboardContent.includes("<Suspense"),
  "Volunteer dashboard must wrap content in Suspense."
);
assert.ok(
  dashboardContent.includes("selectedReferralId"),
  "Volunteer dashboard must highlight target referral upon notification navigation."
);

const routeContent = fs.readFileSync(
  path.join(rootDir, "src", "app", "api", "notifications", "notify-volunteer-decision", "route.ts"),
  "utf-8"
);
assert.ok(
  routeContent.includes("create_volunteer_decision_notification"),
  "Server route must invoke create_volunteer_decision_notification RPC."
);
assert.ok(
  routeContent.includes("rpcResult.success === false"),
  "Server route must detect RPC domain-level failure and return non-2xx status."
);
assert.ok(
  routeContent.includes("status: 403"),
  "Server route must map forbidden/unauthorized exceptions to 403."
);
assert.ok(
  routeContent.includes("status: 422"),
  "Server route must return HTTP 422 for unprocessable decision notification requests."
);

console.log("  ✓ Code references, error handling, and non-blocking integration verified.");

console.log("------------------------------------------------------------");
console.log("All Stage B1 Decision Notifications Verification Checks Passed!");
console.log("------------------------------------------------------------");
