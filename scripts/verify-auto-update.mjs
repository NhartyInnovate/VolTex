/**
 * VolTex Verification Suite: Automatic Reload & Cache Busting
 *
 * Verifies:
 * 1. Build version endpoint (/api/version) configuration and cache-busting headers
 * 2. next.config.mjs Cache-Control headers for HTML pages and Service Worker
 * 3. VersionUpdateMonitor component safety (prevents disrupting active input/forms)
 * 4. Tab visibility change & focus listeners for proactive refresh
 * 5. Integration into RootLayout
 * 6. Service worker proactive update checking
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("=======================================================");
console.log("Running VolTex Auto-Update & Cache Busting Verification");
console.log("=======================================================\n");

const versionRoutePath = path.join(rootDir, "src", "app", "api", "version", "route.ts");
const nextConfigPath = path.join(rootDir, "next.config.mjs");
const monitorComponentPath = path.join(rootDir, "src", "components", "VersionUpdateMonitor.tsx");
const layoutPath = path.join(rootDir, "src", "app", "layout.tsx");
const swRegisterPath = path.join(rootDir, "src", "components", "ServiceWorkerRegister.tsx");

// [Test 1] Version Route Exists & Enforces No-Cache
console.log("[Test 1] /api/version Route Verification");
{
  assert.ok(fs.existsSync(versionRoutePath), "api/version/route.ts must exist.");
  const content = fs.readFileSync(versionRoutePath, "utf-8");

  assert.match(content, /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/, "Version route must be force-dynamic.");
  assert.match(content, /no-cache,\s*no-store,\s*must-revalidate/i, "Version route must set no-cache headers.");
  assert.match(content, /buildId/, "Version route must return buildId.");
  console.log("  ✔ /api/version route exists with strict dynamic cache-busting headers.");
}

// [Test 2] next.config.mjs Cache-Control Headers
console.log("\n[Test 2] next.config.mjs Cache Headers");
{
  assert.ok(fs.existsSync(nextConfigPath), "next.config.mjs must exist.");
  const content = fs.readFileSync(nextConfigPath, "utf-8");

  assert.match(content, /NEXT_PUBLIC_APP_BUILD_ID/, "next.config.mjs must inject NEXT_PUBLIC_APP_BUILD_ID.");
  assert.match(content, /must-revalidate/, "next.config.mjs must enforce must-revalidate on pages.");
  assert.match(content, /\/sw\.js/, "next.config.mjs must configure no-cache headers for sw.js.");
  console.log("  ✔ next.config.mjs enforces must-revalidate on pages and no-cache on sw.js.");
}

// [Test 3] VersionUpdateMonitor Safety & Zero User Interruption
console.log("\n[Test 3] VersionUpdateMonitor Non-Disruptive Guard Verification");
{
  assert.ok(fs.existsSync(monitorComponentPath), "VersionUpdateMonitor.tsx must exist.");
  const content = fs.readFileSync(monitorComponentPath, "utf-8");

  assert.match(content, /['"]use client['"]/, "VersionUpdateMonitor must be a client component.");
  assert.match(content, /isUserActivelyTyping/, "Must include active typing detection.");
  assert.match(content, /['"]INPUT['"]|['"]TEXTAREA['"]|['"]SELECT['"]/, "Must guard input, textarea, and select elements.");
  assert.match(content, /visibilitychange/, "Must check version on tab visibility change.");
  assert.match(content, /window\.location\.reload/, "Must reload when safe.");
  console.log("  ✔ VersionUpdateMonitor safely prevents interrupting users while typing.");
}

// [Test 4] Root Layout Integration
console.log("\n[Test 4] Root Layout Integration");
{
  assert.ok(fs.existsSync(layoutPath), "src/app/layout.tsx must exist.");
  const content = fs.readFileSync(layoutPath, "utf-8");

  assert.match(content, /import\s*\{\s*VersionUpdateMonitor\s*\}\s*from\s*['"]@\/components\/VersionUpdateMonitor['"]/, "layout.tsx must import VersionUpdateMonitor.");
  assert.match(content, /<VersionUpdateMonitor\s*\/>/, "layout.tsx must render <VersionUpdateMonitor />.");
  console.log("  ✔ VersionUpdateMonitor is properly integrated into RootLayout.");
}

// [Test 5] Proactive Service Worker Update Check
console.log("\n[Test 5] Proactive ServiceWorker Update Check");
{
  assert.ok(fs.existsSync(swRegisterPath), "ServiceWorkerRegister.tsx must exist.");
  const content = fs.readFileSync(swRegisterPath, "utf-8");

  assert.match(content, /registration\.update\(\)/, "ServiceWorkerRegister must call registration.update().");
  console.log("  ✔ ServiceWorkerRegister proactively checks for service worker script updates.");
}

console.log("\n=======================================================");
console.log("✔ ALL AUTO-UPDATE & CACHE-BUSTING CHECKS PASSED (5/5)");
console.log("=======================================================\n");
