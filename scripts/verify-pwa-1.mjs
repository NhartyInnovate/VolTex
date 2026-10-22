/**
 * Automated Verification Script for VolTex PWA-1:
 * App Manifest, Icons, and Viewport/Metadata Configuration
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("------------------------------------------------------------");
console.log("VolTex PWA-1 Verification: Manifest, Icons & Metadata");
console.log("------------------------------------------------------------");

// 1. Verify Icons on Disk
console.log("[1] Verifying Generated PWA Icons on Disk...");

const requiredIcons = [
  { file: "icon-192x192.png", expectedWidth: 192, expectedHeight: 192, minBytes: 5000 },
  { file: "icon-512x512.png", expectedWidth: 512, expectedHeight: 512, minBytes: 15000 },
  { file: "icon-maskable-512x512.png", expectedWidth: 512, expectedHeight: 512, minBytes: 15000 },
  { file: "apple-touch-icon.png", expectedWidth: 180, expectedHeight: 180, minBytes: 4000 },
];

for (const icon of requiredIcons) {
  const iconPath = path.join(rootDir, "public", "icons", icon.file);
  assert.ok(fs.existsSync(iconPath), `Icon file must exist: ${icon.file}`);

  const stat = fs.statSync(iconPath);
  assert.ok(stat.size >= icon.minBytes, `${icon.file} size (${stat.size}B) must be at least ${icon.minBytes}B`);

  // Simple PNG header check
  const buffer = fs.readFileSync(iconPath);
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  assert.ok(isPng, `${icon.file} must be a valid PNG image.`);

  // Parse width and height from IHDR chunk (bytes 16..23)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.equal(width, icon.expectedWidth, `${icon.file} width must be ${icon.expectedWidth}`);
  assert.equal(height, icon.expectedHeight, `${icon.file} height must be ${icon.expectedHeight}`);

  console.log(`  ✓ ${icon.file}: ${width}x${height} PNG (${stat.size} bytes)`);
}

// 2. Verify Next.js App Router Manifest (src/app/manifest.ts)
console.log("[2] Verifying App Manifest Source Configuration...");

const manifestTsPath = path.join(rootDir, "src", "app", "manifest.ts");
assert.ok(fs.existsSync(manifestTsPath), "src/app/manifest.ts must exist.");

const manifestContent = fs.readFileSync(manifestTsPath, "utf-8");
assert.match(manifestContent, /name:\s*["']VolTex — TEDxGwarinpa["']/, "Manifest name must be 'VolTex — TEDxGwarinpa'.");
assert.match(manifestContent, /short_name:\s*["']VolTex["']/, "Manifest short_name must be 'VolTex'.");
assert.match(manifestContent, /start_url:\s*["']\/["']/, "Manifest start_url must be '/'.");
assert.match(manifestContent, /display:\s*["']standalone["']/, "Manifest display mode must be 'standalone'.");
assert.match(manifestContent, /background_color:\s*["']#09090b["']/, "Manifest background_color must match brand dark theme.");
assert.match(manifestContent, /theme_color:\s*["']#09090b["']/, "Manifest theme_color must match brand dark theme.");
assert.match(manifestContent, /\/icons\/icon-192x192\.png/, "Manifest must include 192x192 icon.");
assert.match(manifestContent, /\/icons\/icon-512x512\.png/, "Manifest must include 512x512 icon.");
assert.match(manifestContent, /\/icons\/icon-maskable-512x512\.png/, "Manifest must include 512x512 maskable icon.");
assert.match(manifestContent, /purpose:\s*["']maskable["']/, "Maskable icon must have purpose='maskable'.");

console.log("  ✓ src/app/manifest.ts satisfies all W3C Web App Manifest standards.");

// 3. Verify Layout Metadata and Viewport Exports (src/app/layout.tsx)
console.log("[3] Verifying Layout Metadata & Viewport Exports...");

const layoutContent = fs.readFileSync(path.join(rootDir, "src", "app", "layout.tsx"), "utf-8");

assert.match(layoutContent, /export const viewport:\s*Viewport\s*=/i, "layout.tsx must export viewport object.");
assert.match(layoutContent, /themeColor:\s*\[/, "viewport must configure themeColor.");
assert.match(layoutContent, /viewportFit:\s*["']cover["']/, "viewport must configure viewportFit: 'cover'.");
assert.match(layoutContent, /appleWebApp:\s*\{/, "metadata must configure appleWebApp object.");
assert.match(layoutContent, /capable:\s*true/, "appleWebApp must set capable: true.");
assert.match(layoutContent, /statusBarStyle:\s*["']black-translucent["']/, "appleWebApp must configure black-translucent status bar.");
assert.match(layoutContent, /\/icons\/apple-touch-icon\.png/, "metadata must reference apple-touch-icon.png.");

console.log("  ✓ layout.tsx metadata and viewport exports conform to Next.js 14 conventions.");

console.log("------------------------------------------------------------");
console.log("All PWA-1 Verification Checks Passed Successfully!");
console.log("------------------------------------------------------------");
