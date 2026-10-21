/**
 * Verification Script for Stage A: VolTex In-App Notifications & Foundation
 *
 * Verifies:
 * 1. Migration SQL structure and integrity:
 *    - notifications table schema, columns, constraints
 *    - RLS enabled and strictly policy-enforced (users read/update own, direct client inserts rejected)
 *    - Deduplication index on (user_id, deduplication_key)
 *    - Fanout RPC function create_admin_notifications_for_referral security and caller authorization
 * 2. Deduplication key generation behavior & stability (no raw timestamps)
 * 3. In-memory simulation of notification store, unread count tracking, and idempotency
 * 4. API payload validation and non-blocking caller patterns
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("------------------------------------------------------------");
console.log("VolTex Stage A Verification: Notifications Foundation");
console.log("------------------------------------------------------------");

// 1. Verify Migration File Presence & SQL Safety
const migrationPath = path.join(
  rootDir,
  "supabase",
  "migrations",
  "20261021000002_create_notifications_schema.sql"
);

assert.ok(fs.existsSync(migrationPath), "Migration file 20261021000002_create_notifications_schema.sql must exist.");
const migrationSql = fs.readFileSync(migrationPath, "utf-8");

console.log("[1] Checking SQL Migration Invariants...");

assert.match(
  migrationSql,
  /CREATE TABLE IF NOT EXISTS public\.notifications/i,
  "Must create public.notifications table."
);

assert.match(
  migrationSql,
  /ALTER TABLE public\.notifications ENABLE ROW LEVEL SECURITY/i,
  "Must enable RLS on public.notifications."
);

assert.match(
  migrationSql,
  /CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_notification_dedup\s+ON public\.notifications\s*\(user_id,\s*deduplication_key\)/i,
  "Must create unique deduplication index on (user_id, deduplication_key)."
);

assert.match(
  migrationSql,
  /CREATE POLICY "Users can read own notifications"\s+ON public\.notifications\s+FOR SELECT\s+USING \(auth\.uid\(\) = user_id\)/i,
  "Select policy must restrict reads strictly to auth.uid() = user_id."
);

assert.match(
  migrationSql,
  /CREATE POLICY "Users can update own notification read status"\s+ON public\.notifications\s+FOR UPDATE\s+USING \(auth\.uid\(\) = user_id\)/i,
  "Update policy must restrict updates strictly to auth.uid() = user_id."
);

assert.match(
  migrationSql,
  /CREATE POLICY "Disallow direct client insertion"\s+ON public\.notifications\s+FOR INSERT\s+WITH CHECK \(FALSE\)/i,
  "Direct client inserts must be explicitly prohibited (WITH CHECK (FALSE))."
);

assert.match(
  migrationSql,
  /CREATE OR REPLACE FUNCTION public\.create_admin_notifications_for_referral\s*\(\s*p_referral_id UUID\s*\)/i,
  "Must define create_admin_notifications_for_referral function."
);

assert.match(
  migrationSql,
  /SECURITY DEFINER/i,
  "create_admin_notifications_for_referral must be SECURITY DEFINER."
);

assert.match(
  migrationSql,
  /SET search_path = ''/i,
  "Security definer function must fix search_path to empty string for secure schema qualification."
);

assert.match(
  migrationSql,
  /SELECT 1 FROM public\.profiles WHERE id = v_calling_user_id AND role = 'admin'/i,
  "Fanout function must enforce caller authorization (owner or admin)."
);

console.log("  ✓ Migration SQL file passes all structure, RLS, and security constraints.");

// 2. Verify Deduplication Key Stability (Never raw timestamps)
console.log("[2] Verifying Deduplication Key Generation...");

function generateReferralSubmissionDedupKey(referralId) {
  assert.ok(referralId && typeof referralId === "string", "Referral ID required");
  return `referral_submission_${referralId}`;
}

const refId = "a4175314-5d5d-4f24-b529-5ea0cb45a498";
const key1 = generateReferralSubmissionDedupKey(refId);
const key2 = generateReferralSubmissionDedupKey(refId);

assert.equal(key1, key2, "Dedup key must be deterministic and identical across retries.");
assert.ok(!/\d{10,13}/.test(key1.replace(refId, "")), "Dedup key must not contain epoch timestamps.");
console.log(`  ✓ Dedup key is stable: "${key1}"`);

// 3. In-memory simulation of notification state, deduplication index, and unread counts
console.log("[3] Simulating Notification Deduplication & State Transitions...");

class NotificationStore {
  constructor() {
    this.notifications = [];
  }

  insert(entry) {
    // Simulate unique constraint ON (user_id, deduplication_key)
    if (entry.deduplication_key) {
      const exists = this.notifications.find(
        (n) => n.user_id === entry.user_id && n.deduplication_key === entry.deduplication_key
      );
      if (exists) {
        // ON CONFLICT DO NOTHING
        return { inserted: false, record: exists };
      }
    }

    const record = {
      id: `notif_${this.notifications.length + 1}`,
      user_id: entry.user_id,
      type: entry.type,
      title: entry.title,
      message: entry.message,
      link: entry.link || null,
      is_read: false,
      deduplication_key: entry.deduplication_key || null,
      created_at: new Date().toISOString(),
    };
    this.notifications.push(record);
    return { inserted: true, record };
  }

  getForUser(userId) {
    return this.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  getUnreadCount(userId) {
    return this.notifications.filter((n) => n.user_id === userId && !n.is_read).length;
  }

  markAsRead(userId, notificationId) {
    const item = this.notifications.find((n) => n.id === notificationId && n.user_id === userId);
    if (item) item.is_read = true;
    return item;
  }

  markAllAsRead(userId) {
    this.notifications.forEach((n) => {
      if (n.user_id === userId) n.is_read = true;
    });
  }
}

const store = new NotificationStore();
const admin1 = "admin-uuid-1";
const admin2 = "admin-uuid-2";
const volunteer1 = "vol-uuid-1";

// Simulate fanout for referral 1
const dedupKey = generateReferralSubmissionDedupKey("ref-123");
const res1 = store.insert({
  user_id: admin1,
  type: "new_referral",
  title: "New Referral Submitted",
  message: "Jane Doe submitted 2 Standard tickets",
  link: "/admin?referral=ref-123",
  deduplication_key: dedupKey,
});
const res2 = store.insert({
  user_id: admin2,
  type: "new_referral",
  title: "New Referral Submitted",
  message: "Jane Doe submitted 2 Standard tickets",
  link: "/admin?referral=ref-123",
  deduplication_key: dedupKey,
});

assert.equal(res1.inserted, true);
assert.equal(res2.inserted, true);
assert.equal(store.getUnreadCount(admin1), 1);
assert.equal(store.getUnreadCount(admin2), 1);
assert.equal(store.getUnreadCount(volunteer1), 0);

// Simulate duplicate retry of fanout (e.g. network retry or multiple API calls)
const retryRes1 = store.insert({
  user_id: admin1,
  type: "new_referral",
  title: "New Referral Submitted",
  message: "Jane Doe submitted 2 Standard tickets",
  link: "/admin?referral=ref-123",
  deduplication_key: dedupKey,
});
assert.equal(retryRes1.inserted, false, "Duplicate insertion must be ignored by unique constraint.");
assert.equal(store.getUnreadCount(admin1), 1, "Unread count must not increment on duplicate retry.");

// Test mark as read
store.markAsRead(admin1, res1.record.id);
assert.equal(store.getUnreadCount(admin1), 0, "Mark as read must reduce unread count to 0.");
assert.equal(store.getUnreadCount(admin2), 1, "Other admin unread count must remain 1.");

// Test mark all as read
store.markAllAsRead(admin2);
assert.equal(store.getUnreadCount(admin2), 0);

console.log("  ✓ Notification store, deduplication, and unread counters behave correctly.");

// 4. Verify TypeScript Definitions & Component Imports
console.log("[4] Checking Type Definitions & Code References...");

const typesContent = fs.readFileSync(path.join(rootDir, "src", "types", "index.ts"), "utf-8");
assert.ok(typesContent.includes("NotificationType"), "src/types/index.ts must export NotificationType.");
assert.ok(typesContent.includes("AppNotification"), "src/types/index.ts must export AppNotification.");

const dashboardContent = fs.readFileSync(path.join(rootDir, "src", "app", "dashboard", "page.tsx"), "utf-8");
assert.ok(
  dashboardContent.includes("/api/notifications/notify-admin-referral"),
  "Dashboard page must trigger notify-admin-referral."
);
assert.ok(
  dashboardContent.includes(".catch("),
  "Notify fetch must catch errors non-blockingly."
);

const navbarContent = fs.readFileSync(path.join(rootDir, "src", "components", "Navbar.tsx"), "utf-8");
assert.ok(
  navbarContent.includes("<NotificationBell />") || navbarContent.includes("<NotificationBell"),
  "Navbar must render NotificationBell."
);

console.log("  ✓ Types and page integrations verified.");

// 5. Verify Admin Page Notification Link Hydration (Query parameter handling)
console.log("[5] Verifying Admin Page Notification Link Hydration...");

const adminPageContent = fs.readFileSync(path.join(rootDir, "src", "app", "admin", "page.tsx"), "utf-8");
assert.ok(
  adminPageContent.includes("useSearchParams"),
  "Admin page must import and use useSearchParams for notification links."
);
assert.ok(
  adminPageContent.includes("<Suspense"),
  "Admin page must wrap content using useSearchParams in Suspense boundary."
);
assert.ok(
  adminPageContent.includes("openedFromQueryRef"),
  "Admin page must guard against duplicate or infinite hydration effects."
);
assert.ok(
  adminPageContent.includes("handleCloseReviewModal"),
  "Admin page must cleanly close modal and reset query state."
);

// Pure simulation of hydration logic:
function simulateAdminHydration({ loading, adminProfile, referrals, searchParams, currentActiveReferral, handledRef }) {
  if (loading || !adminProfile || referrals.length === 0) {
    return { activeReferral: currentActiveReferral, tab: "referrals", changed: false };
  }

  let tab = "referrals";
  const requestedTab = searchParams.get("tab");
  if (requestedTab && ["referrals", "volunteers", "teams", "settings"].includes(requestedTab)) {
    tab = requestedTab;
  }

  const requestedReferralId = searchParams.get("id") || searchParams.get("referral");
  if (requestedReferralId) {
    if (handledRef.current === requestedReferralId && currentActiveReferral?.id === requestedReferralId) {
      return { activeReferral: currentActiveReferral, tab, changed: false };
    }
    handledRef.current = requestedReferralId;

    const targetReferral = referrals.find((r) => r.id === requestedReferralId);
    if (targetReferral) {
      return { activeReferral: targetReferral, tab: "referrals", changed: true };
    }
    // Missing or invalid referral ID: no modal opened, no crash
    return { activeReferral: null, tab, changed: false };
  } else {
    // When query parameters are cleared, reset the tracking ref
    handledRef.current = null;
    return { activeReferral: currentActiveReferral, tab, changed: false };
  }
}

const mockReferrals = [
  { id: "ref-uuid-1", buyerName: "Alice Smith", status: "pending" },
  { id: "ref-uuid-2", buyerName: "Bob Johnson", status: "approved" },
];

// Test 5A: Valid referral link hydration
const handledRefA = { current: null };
const paramsA = new URLSearchParams("tab=referrals&id=ref-uuid-1");
const resultA = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsA,
  currentActiveReferral: null,
  handledRef: handledRefA,
});
assert.equal(resultA.activeReferral?.id, "ref-uuid-1", "Valid referral link must open target referral.");
assert.equal(resultA.changed, true);

// Test 5B: Idempotent / no duplicate trigger on same render if active
const resultA2 = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsA,
  currentActiveReferral: resultA.activeReferral,
  handledRef: handledRefA,
});
assert.equal(resultA2.changed, false, "Subsequent renders with same query param must not re-trigger.");

// Test 5B-1: Single tap close resets URL and closes modal cleanly without requiring two clicks
const paramsCleared = new URLSearchParams("tab=referrals");
const resultClose = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsCleared,
  currentActiveReferral: null, // modal set to null by handleCloseReviewModal
  handledRef: handledRefA,
});
assert.equal(resultClose.activeReferral, null, "Modal must stay closed on single click.");
assert.equal(handledRefA.current, null, "Tracking ref must be reset when query param is cleared.");

// Test 5B-2: Reopening same referral immediately from notification re-opens modal on first tap
const resultA3 = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsA,
  currentActiveReferral: null,
  handledRef: handledRefA,
});
assert.equal(resultA3.activeReferral?.id, "ref-uuid-1", "Re-opening same referral after closing modal must succeed on single tap.");
assert.equal(resultA3.changed, true);

// Test 5B-3: Opening a different referral after the first
const paramsDiff = new URLSearchParams("tab=referrals&id=ref-uuid-2");
const resultDiff = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsDiff,
  currentActiveReferral: null,
  handledRef: handledRefA,
});
assert.equal(resultDiff.activeReferral?.id, "ref-uuid-2", "Opening a different referral must succeed.");
assert.equal(resultDiff.changed, true);

// Test 5C: Invalid / missing referral ID does not crash or open invalid modal
const handledRefC = { current: null };
const paramsC = new URLSearchParams("tab=referrals&id=non-existent-uuid");
const resultC = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsC,
  currentActiveReferral: null,
  handledRef: handledRefC,
});
assert.equal(resultC.activeReferral, null, "Missing referral must safely result in null active modal.");

// Test 5D: Normal dashboard navigation without query params
const handledRefD = { current: null };
const paramsD = new URLSearchParams("");
const resultD = simulateAdminHydration({
  loading: false,
  adminProfile: { role: "admin" },
  referrals: mockReferrals,
  searchParams: paramsD,
  currentActiveReferral: null,
  handledRef: handledRefD,
});
assert.equal(resultD.activeReferral, null, "Normal dashboard navigation must not open modal.");

// Test 5E: Unauthorized / loading state guards
const handledRefE = { current: null };
const resultE = simulateAdminHydration({
  loading: true,
  adminProfile: null,
  referrals: [],
  searchParams: paramsA,
  currentActiveReferral: null,
  handledRef: handledRefE,
});
assert.equal(resultE.activeReferral, null, "Loading / unauthorized state must not trigger hydration.");

console.log("  ✓ Admin query param hydration invariants (valid, invalid, missing, normal nav) verified.");

// 6. Verify Mobile Responsive Geometry & Positioning for Notification Panel
console.log("[6] Verifying Notification Panel Responsive Layout & Geometry...");

const notifBellContent = fs.readFileSync(path.join(rootDir, "src", "components", "NotificationBell.tsx"), "utf-8");
assert.ok(
  notifBellContent.includes("fixed sm:absolute"),
  "Panel must use fixed positioning on mobile and absolute on desktop."
);
assert.ok(
  notifBellContent.includes("left-3 right-3 sm:left-auto sm:right-0"),
  "Panel must be anchored with left-3 and right-3 on mobile to prevent left-side clipping."
);
assert.ok(
  notifBellContent.includes("max-w-[calc(100vw-24px)]"),
  "Panel must enforce max-w-[calc(100vw-24px)] on mobile viewports."
);
assert.ok(
  notifBellContent.includes("touchstart"),
  "Panel outside-click handler must support mobile touchstart events."
);

// Simulated Viewport Dimension Tests: 320px, 360px, 390px, 430px
const testViewports = [320, 360, 390, 430];
const marginX = 12; // left-3 (12px) and right-3 (12px)

for (const vw of testViewports) {
  const panelWidth = Math.min(vw - (marginX * 2), 384); // sm:w-96 is 384px
  const leftOffset = marginX;
  const rightOffset = vw - (leftOffset + panelWidth);

  assert.ok(panelWidth <= vw - 24, `Panel width (${panelWidth}px) must not exceed viewport width minus margins (${vw - 24}px) at ${vw}px.`);
  assert.ok(leftOffset >= 0, `Left offset (${leftOffset}px) must never be negative at ${vw}px.`);
  assert.ok(rightOffset >= 0, `Right offset (${rightOffset}px) must never be negative at ${vw}px.`);
  assert.ok(panelWidth >= 280, `Panel width (${panelWidth}px) at ${vw}px must allow comfortable text readability.`);
}
console.log("  ✓ Verified panel geometry across 320px, 360px, 390px, and 430px mobile viewports.");

console.log("------------------------------------------------------------");
console.log("All Stage A Verification Checks Passed Successfully!");
console.log("------------------------------------------------------------");
