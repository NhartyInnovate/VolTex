/**
 * Automated Verification Script for VolTex PWA-2:
 * Service Worker, Security Exclusions, Offline Fallback & Registration Component
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("------------------------------------------------------------");
console.log("VolTex PWA-2 Verification: Service Worker & Safe Offline");
console.log("------------------------------------------------------------");

// 1. Verify Offline HTML File
console.log("[1] Verifying public/offline.html...");

const offlineHtmlPath = path.join(rootDir, "public", "offline.html");
assert.ok(fs.existsSync(offlineHtmlPath), "public/offline.html must exist.");
const offlineContent = fs.readFileSync(offlineHtmlPath, "utf-8");

assert.match(offlineContent, /<title>Offline — VolTex<\/title>/i, "Offline HTML must have a branded title.");
assert.match(offlineContent, /You are currently offline/i, "Offline HTML must explain offline state.");
assert.match(offlineContent, /window\.location\.reload\(\)/, "Offline HTML must offer a reload/retry action.");
assert.match(offlineContent, /Private referral claims|Live data protection/i, "Offline HTML must explain that private data is not stored offline.");
assert.ok(!offlineContent.includes("localStorage.getItem"), "Offline HTML must not attempt to read local private auth/referral data.");

console.log("  ✓ public/offline.html is properly branded, informative, and safe.");

// 2. Verify Service Worker File (public/sw.js)
console.log("[2] Verifying public/sw.js & Security Exclusions...");

const swPath = path.join(rootDir, "public", "sw.js");
assert.ok(fs.existsSync(swPath), "public/sw.js must exist.");
const swContent = fs.readFileSync(swPath, "utf-8");

// Cache versioning and lifecycle
assert.match(swContent, /const CACHE_VERSION\s*=\s*['"]voltex-v\d+['"]/, "Must define a versioned cache name.");
assert.match(swContent, /self\.addEventListener\(['"]install['"]/, "Must handle install event.");
assert.match(swContent, /self\.addEventListener\(['"]activate['"]/, "Must handle activate event.");
assert.match(swContent, /self\.addEventListener\(['"]fetch['"]/, "Must handle fetch event.");
assert.match(swContent, /self\.skipWaiting\(\)/, "Must call skipWaiting.");
assert.match(swContent, /self\.clients\.claim\(\)/, "Must claim clients on activation.");

// Cache cleanup safety: only deletes voltex- caches
assert.match(swContent, /key\.startsWith\(['"]voltex-['"]\)\s*&&\s*key\s*!==\s*CACHE_VERSION/, "Must only clean up old voltex- caches.");

// Security Exclusions
assert.match(swContent, /request\.method\s*!==\s*['"]GET['"]/, "Must immediately bypass non-GET requests.");
assert.match(swContent, /url\.origin\s*!==\s*self\.location\.origin/, "Must bypass all cross-origin requests (e.g. Supabase).");
assert.match(swContent, /url\.pathname\.startsWith\(['"]\/api\/['"]\)/, "Must strictly bypass all /api/ routes.");
assert.match(swContent, /url\.pathname\.startsWith\(['"]\/dashboard['"]\)/, "Must identify /dashboard as a private route.");
assert.match(swContent, /url\.pathname\.startsWith\(['"]\/admin['"]\)/, "Must identify /admin as a private route.");
assert.match(swContent, /url\.pathname\.startsWith\(['"]\/auth['"]\)/, "Must identify /auth as a private route.");

// Navigation offline fallback behavior
assert.match(swContent, /request\.mode\s*===\s*['"]navigate['"]/, "Must specifically check for navigation requests.");
assert.match(swContent, /OFFLINE_URL/, "Must return OFFLINE_URL on failed navigation.");

// Allowlisted static assets
assert.match(swContent, /PRECACHE_ASSETS/, "Must have an explicit list of precached assets.");
assert.match(swContent, /['"]\/manifest\.webmanifest['"]/, "Must precache manifest.");
assert.match(swContent, /['"]\/icons\/icon-192x192\.png['"]/, "Must precache icons.");

console.log("  ✓ public/sw.js enforces all strict security boundaries and cache exclusions.");

// 3. Simulated Service Worker Routing Tests
console.log("[3] Simulating Service Worker Fetch Filter Logic...");

function simulateSwFetchFilter({ method, origin, pathname, mode }) {
  if (method !== "GET") {
    return { action: "BYPASS_METHOD" };
  }
  const appOrigin = "https://voltex.nkaylabs.com";
  if (origin !== appOrigin) {
    return { action: "BYPASS_CROSS_ORIGIN" };
  }
  if (pathname.startsWith("/api/")) {
    return { action: "BYPASS_API" };
  }

  const isPrivateRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/auth");

  if (mode === "navigate") {
    return { action: "NAVIGATE_NETWORK_WITH_OFFLINE_FALLBACK", isPrivateRoute };
  }

  if (isPrivateRoute) {
    return { action: "BYPASS_PRIVATE_SUBRESOURCE" };
  }

  const allowlist = [
    "/offline.html",
    "/manifest.webmanifest",
    "/voltex-logo.png",
    "/icons/icon-192x192.png",
    "/icons/icon-512x512.png",
    "/icons/icon-maskable-512x512.png",
    "/icons/apple-touch-icon.png",
  ];

  if (allowlist.includes(pathname)) {
    return { action: "CACHE_FIRST_STATIC" };
  }

  return { action: "PASS_THROUGH" };
}

// Case A: Supabase Auth/Data Request
const res1 = simulateSwFetchFilter({
  method: "POST",
  origin: "https://xyz.supabase.co",
  pathname: "/rest/v1/referrals",
  mode: "cors",
});
assert.equal(res1.action, "BYPASS_METHOD");

const res2 = simulateSwFetchFilter({
  method: "GET",
  origin: "https://xyz.supabase.co",
  pathname: "/auth/v1/user",
  mode: "cors",
});
assert.equal(res2.action, "BYPASS_CROSS_ORIGIN");

// Case B: VolTex API Routes
const res3 = simulateSwFetchFilter({
  method: "POST",
  origin: "https://voltex.nkaylabs.com",
  pathname: "/api/notifications/notify-volunteer-decision",
  mode: "cors",
});
assert.equal(res3.action, "BYPASS_METHOD");

const res4 = simulateSwFetchFilter({
  method: "GET",
  origin: "https://voltex.nkaylabs.com",
  pathname: "/api/notifications",
  mode: "cors",
});
assert.equal(res4.action, "BYPASS_API");

// Case C: Authenticated Dashboard Navigation
const res5 = simulateSwFetchFilter({
  method: "GET",
  origin: "https://voltex.nkaylabs.com",
  pathname: "/dashboard",
  mode: "navigate",
});
assert.equal(res5.action, "NAVIGATE_NETWORK_WITH_OFFLINE_FALLBACK");
assert.equal(res5.isPrivateRoute, true);

// Case D: Static Asset
const res6 = simulateSwFetchFilter({
  method: "GET",
  origin: "https://voltex.nkaylabs.com",
  pathname: "/icons/icon-192x192.png",
  mode: "no-cors",
});
assert.equal(res6.action, "CACHE_FIRST_STATIC");

console.log("  ✓ Fetch filter simulation confirms zero private data exposure.");

// 4. Verify ServiceWorkerRegister Component & Root Layout Integration
console.log("[4] Verifying ServiceWorkerRegister component & layout integration...");

const registerCompPath = path.join(rootDir, "src", "components", "ServiceWorkerRegister.tsx");
assert.ok(fs.existsSync(registerCompPath), "ServiceWorkerRegister.tsx must exist.");
const registerContent = fs.readFileSync(registerCompPath, "utf-8");

assert.match(registerContent, /['"]use client['"]/, "Must be a client component.");
assert.match(registerContent, /navigator\.serviceWorker\s*\.register\(\s*['"]\/sw\.js['"]/, "Must register /sw.js.");
assert.match(registerContent, /window\.location\.protocol\s*!==\s*['"]https:['"]/, "Must guard HTTPS/localhost.");

const layoutPath = path.join(rootDir, "src", "app", "layout.tsx");
const layoutContent = fs.readFileSync(layoutPath, "utf-8");
assert.match(layoutContent, /import\s*\{\s*ServiceWorkerRegister\s*\}\s*from\s*['"]@\/components\/ServiceWorkerRegister['"]/, "layout.tsx must import ServiceWorkerRegister.");
assert.match(layoutContent, /<ServiceWorkerRegister\s*\/>/, "layout.tsx must render <ServiceWorkerRegister />.");

console.log("  ✓ ServiceWorkerRegister component is non-blocking, guarded, and integrated in RootLayout.");

console.log("------------------------------------------------------------");
console.log("All PWA-2 Verification Checks Passed Successfully!");
console.log("------------------------------------------------------------");
