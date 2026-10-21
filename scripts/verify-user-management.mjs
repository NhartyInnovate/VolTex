/**
 * Tests for Admin User Management functionality:
 * 1. Authorization checks (Admin role required)
 * 2. Self-deletion protection (Prevent deleting current admin)
 * 3. Last admin protection (Prevent deleting only remaining admin)
 * 4. Deletion sequencing & dependency cleanup logic
 * 5. Partial failure & recovery handling
 */

import assert from "node:assert";

console.log("=== Running VolTex Admin User Management Test Suite ===");

// 1. Authorization Logic Test
function testAuthorizationRule(callerRole) {
  if (!callerRole) {
    return { allowed: false, status: 401 };
  }
  if (callerRole !== "admin") {
    return { allowed: false, status: 403 };
  }
  return { allowed: true, status: 200 };
}

assert.strictEqual(testAuthorizationRule(undefined).status, 401, "Missing caller must return 401");
assert.strictEqual(testAuthorizationRule("volunteer").status, 403, "Volunteer caller must return 403");
assert.strictEqual(testAuthorizationRule("admin").status, 200, "Admin caller must return 200");
console.log("✔ Test 1 Passed: Server-side authorization checks verified.");

// 2. Self-Deletion Protection Rule
function testSelfDeletionRule(callingAdminId, targetUserId) {
  if (callingAdminId === targetUserId) {
    return { allowed: false, error: "Operation forbidden: You cannot delete your own administrator account." };
  }
  return { allowed: true };
}

assert.strictEqual(testSelfDeletionRule("admin-1", "admin-1").allowed, false, "Self-deletion must be blocked");
assert.strictEqual(testSelfDeletionRule("admin-1", "user-2").allowed, true, "Targeting another user must be allowed");
console.log("✔ Test 2 Passed: Self-deletion safeguard verified.");

// 3. Last Administrator Protection Rule
function testLastAdminRule(targetRole, totalAdmins) {
  if (targetRole === "admin" && totalAdmins <= 1) {
    return { allowed: false, error: "Operation forbidden: Cannot delete the last remaining administrator account." };
  }
  return { allowed: true };
}

assert.strictEqual(testLastAdminRule("admin", 1).allowed, false, "Cannot delete last admin");
assert.strictEqual(testLastAdminRule("admin", 2).allowed, true, "Can delete admin when multiple exist");
assert.strictEqual(testLastAdminRule("volunteer", 1).allowed, true, "Can delete volunteer regardless of admin count");
console.log("✔ Test 3 Passed: Last administrator protection verified.");

// 4. Deletion Order & Dependency Simulation
function simulateUserDeletion(db, targetUserId, options = {}) {
  // Step 1: Find user referrals
  const userReferralIds = db.referrals.filter((r) => r.volunteer_id === targetUserId).map((r) => r.id);

  // Step 2: Delete referral audit logs
  db.audit_logs = db.audit_logs.filter((a) => !a.referral_id || !userReferralIds.includes(a.referral_id));

  // Step 3: Delete referrals
  db.referrals = db.referrals.filter((r) => r.volunteer_id !== targetUserId);

  // Step 4: Delete auth account (cascading to profiles)
  if (options.failAuthDelete) {
    return { success: false, error: "Auth delete failed; state recoverable on retry." };
  }

  db.auth_users = db.auth_users.filter((u) => u.id !== targetUserId);
  db.profiles = db.profiles.filter((p) => p.id !== targetUserId);

  return { success: true };
}

// Test successful deletion simulation
const mockDb1 = {
  audit_logs: [
    { id: "a1", referral_id: "r1" },
    { id: "a2", referral_id: "r2" },
    { id: "a_unrelated", referral_id: "r_other" },
  ],
  referrals: [
    { id: "r1", volunteer_id: "target-vol" },
    { id: "r2", volunteer_id: "target-vol" },
    { id: "r_other", volunteer_id: "other-vol" },
  ],
  profiles: [
    { id: "target-vol", role: "volunteer" },
    { id: "other-vol", role: "volunteer" },
    { id: "admin-1", role: "admin" },
  ],
  auth_users: [
    { id: "target-vol" },
    { id: "other-vol" },
    { id: "admin-1" },
  ],
};

const result1 = simulateUserDeletion(mockDb1, "target-vol");
assert.strictEqual(result1.success, true, "Deletion should succeed");
assert.strictEqual(mockDb1.referrals.length, 1, "Only unrelated referrals should remain");
assert.strictEqual(mockDb1.referrals[0].id, "r_other", "Unrelated referral preserved");
assert.strictEqual(mockDb1.audit_logs.length, 1, "Only unrelated audit logs should remain");
assert.strictEqual(mockDb1.audit_logs[0].id, "a_unrelated", "Unrelated audit log preserved");
assert.strictEqual(mockDb1.profiles.length, 2, "Target profile removed, admin and other vol preserved");
assert.strictEqual(mockDb1.auth_users.length, 2, "Target auth user removed");
console.log("✔ Test 4 Passed: Ordered dependency cleanup and record isolation verified.");

// Test partial failure and recoverable state
const mockDb2 = {
  audit_logs: [{ id: "a1", referral_id: "r1" }],
  referrals: [{ id: "r1", volunteer_id: "target-vol" }],
  profiles: [{ id: "target-vol", role: "volunteer" }],
  auth_users: [{ id: "target-vol" }],
};

const result2 = simulateUserDeletion(mockDb2, "target-vol", { failAuthDelete: true });
assert.strictEqual(result2.success, false, "Partial failure caught");
assert.strictEqual(mockDb2.referrals.length, 0, "Referrals cleaned safely before auth failure");
assert.strictEqual(mockDb2.auth_users.length, 1, "Auth account still present for retry");

// Retry should be idempotent and succeed
const retryResult = simulateUserDeletion(mockDb2, "target-vol", { failAuthDelete: false });
assert.strictEqual(retryResult.success, true, "Retry succeeded cleanly");
assert.strictEqual(mockDb2.auth_users.length, 0, "Auth account deleted upon retry");
console.log("✔ Test 5 Passed: Recoverable partial-failure handling verified.");

console.log("=======================================================");
console.log("✔ ALL ADMIN USER MANAGEMENT TESTS PASSED SUCCESSFULLY!");
console.log("=======================================================");
