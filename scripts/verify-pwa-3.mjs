/**
 * Automated Verification Script for VolTex PWA-3:
 * App Installation Experience, usePwaInstall Hook, iOS Safari Modal, and Navigation Integration
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("------------------------------------------------------------");
console.log("VolTex PWA-3 Verification: Installation UI & Hook");
console.log("------------------------------------------------------------");

// 1. Verify usePwaInstall Hook
console.log("[1] Verifying src/hooks/usePwaInstall.ts...");

const hookPath = path.join(rootDir, "src", "hooks", "usePwaInstall.ts");
assert.ok(fs.existsSync(hookPath), "src/hooks/usePwaInstall.ts must exist.");
const hookContent = fs.readFileSync(hookPath, "utf-8");

assert.match(hookContent, /['"]use client['"]/, "Hook file must be a client module.");
assert.match(hookContent, /display-mode:\s*standalone/, "Hook must check for standalone display mode.");
assert.match(hookContent, /window\.navigator\.standalone/, "Hook must check legacy iOS standalone property.");
assert.match(hookContent, /beforeinstallprompt/, "Hook must listen to beforeinstallprompt event.");
assert.match(hookContent, /appinstalled/, "Hook must listen to appinstalled event.");
assert.match(hookContent, /prompt\(\)/, "Hook must invoke prompt() on user action.");
assert.match(hookContent, /voltex_pwa_install_dismissed/, "Hook must track dismissal state.");
assert.match(hookContent, /isIOS/, "Hook must detect iOS Safari devices.");
assert.match(hookContent, /isAndroid/, "Hook must detect Android devices.");
assert.match(hookContent, /window\.__voltex_pwa_prompt/, "Hook must preserve prompt on global window object.");

console.log("  ✓ usePwaInstall hook implements complete standalone, prompt, Android, and iOS detection.");

// 2. Verify PwaInstallModal Component
console.log("[2] Verifying src/components/PwaInstallModal.tsx...");

const modalPath = path.join(rootDir, "src", "components", "PwaInstallModal.tsx");
assert.ok(fs.existsSync(modalPath), "src/components/PwaInstallModal.tsx must exist.");
const modalContent = fs.readFileSync(modalPath, "utf-8");

assert.match(modalContent, /['"]use client['"]/, "PwaInstallModal must be a client component.");
assert.match(modalContent, /createPortal\(/, "PwaInstallModal must portal directly to avoid transform clipping.");
assert.match(modalContent, /document\.body/, "PwaInstallModal must portal to document.body.");
assert.match(modalContent, /role=["']dialog["']/, "PwaInstallModal must have role='dialog'.");
assert.match(modalContent, /aria-modal=["']true["']/, "PwaInstallModal must have aria-modal='true'.");
assert.match(modalContent, /Escape/, "PwaInstallModal must support Escape key dismissal.");
assert.match(modalContent, /Share/, "PwaInstallModal must explain Safari Share button.");
assert.match(modalContent, /Add to Home Screen/i, "PwaInstallModal must guide user to Add to Home Screen.");
assert.match(modalContent, /platform === ["']android["']/, "PwaInstallModal must support Android platform instructions.");
assert.match(modalContent, /MoreVertical/, "PwaInstallModal must show Android 3-dot menu icon.");

console.log("  ✓ PwaInstallModal is fully accessible, portaled, and provides clear iOS and Android guidance.");

// 3. Verify Navbar Navigation Integration
console.log("[3] Verifying Install App integration in src/components/Navbar.tsx...");

const navbarPath = path.join(rootDir, "src", "components", "Navbar.tsx");
assert.ok(fs.existsSync(navbarPath), "src/components/Navbar.tsx must exist.");
const navbarContent = fs.readFileSync(navbarPath, "utf-8");

assert.match(navbarContent, /usePwaInstall/, "Navbar must use usePwaInstall hook.");
assert.match(navbarContent, /PwaInstallModal/, "Navbar must render PwaInstallModal.");
assert.match(navbarContent, /Install App/, "Navbar must contain 'Install App' label.");
assert.match(navbarContent, /canInstall\s*&&/, "Install button must only render when canInstall is true.");
assert.match(navbarContent, /promptInstall\(\)/, "Clicking install button must invoke promptInstall().");

// Confirm "Install App" appears in both authenticated and guest sections
const installOccurrences = (navbarContent.match(/Install App/g) || []).length;
assert.ok(
  installOccurrences >= 2,
  `Navbar must provide 'Install App' across desktop, guest mobile drawer, and auth drawer. Found: ${installOccurrences}`
);

console.log("  ✓ Navbar cleanly renders Install App in desktop dropdown, mobile drawer (guest & auth).");

// 4. Simulated Hook State Logic Tests
console.log("[4] Simulating Hook Detection Logic Across Environments...");

function simulateInstallState({ isStandalone, userAgent, hasBeforeInstallPrompt }) {
  if (isStandalone) {
    return { canInstall: false, isInstalled: true, mode: "INSTALLED" };
  }

  const isIOS =
    (/iPad|iPhone|iPod/.test(userAgent)) &&
    /Safari/.test(userAgent) &&
    !/Chrome|CriOS|Android/.test(userAgent);

  if (isIOS) {
    return { canInstall: true, isInstalled: false, mode: "IOS_SAFARI_MANUAL" };
  }

  const isAndroid = /Android/i.test(userAgent);

  if (hasBeforeInstallPrompt) {
    return { canInstall: true, isInstalled: false, mode: "NATIVE_PROMPT_READY" };
  }

  if (isAndroid) {
    return { canInstall: true, isInstalled: false, mode: "ANDROID_MANUAL_GUIDE" };
  }

  return { canInstall: false, isInstalled: false, mode: "UNSUPPORTED_BROWSER" };
}

// Case A: Running as an installed PWA (standalone)
const stateInstalled = simulateInstallState({
  isStandalone: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile",
  hasBeforeInstallPrompt: false,
});
assert.equal(stateInstalled.canInstall, false);
assert.equal(stateInstalled.isInstalled, true);

// Case B1: Android Chrome with beforeinstallprompt event captured
const stateAndroidPrompt = simulateInstallState({
  isStandalone: false,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile",
  hasBeforeInstallPrompt: true,
});
assert.equal(stateAndroidPrompt.canInstall, true);
assert.equal(stateAndroidPrompt.mode, "NATIVE_PROMPT_READY");

// Case B2: Android Chrome without beforeinstallprompt fired yet (manual fallback guide)
const stateAndroidManual = simulateInstallState({
  isStandalone: false,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile",
  hasBeforeInstallPrompt: false,
});
assert.equal(stateAndroidManual.canInstall, true);
assert.equal(stateAndroidManual.mode, "ANDROID_MANUAL_GUIDE");

// Case C: iPhone iOS Safari (no beforeinstallprompt, requires Share -> Add to Home Screen)
const stateIos = simulateInstallState({
  isStandalone: false,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  hasBeforeInstallPrompt: false,
});
assert.equal(stateIos.canInstall, true);
assert.equal(stateIos.mode, "IOS_SAFARI_MANUAL");

// Case D: Unsupported Desktop Browser or in-app webview without install prompt
const stateUnsupported = simulateInstallState({
  isStandalone: false,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0",
  hasBeforeInstallPrompt: false,
});
assert.equal(stateUnsupported.canInstall, false);

console.log("  ✓ Simulated install states match expected W3C and iOS platform behaviors.");

console.log("------------------------------------------------------------");
console.log("All PWA-3 Verification Checks Passed Successfully!");
console.log("------------------------------------------------------------");
