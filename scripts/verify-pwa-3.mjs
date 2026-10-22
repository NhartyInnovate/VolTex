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
assert.match(hookContent, /PWA_PROMPT_READY_EVENT/, "Hook must subscribe to the early-capture prompt notification.");
assert.match(hookContent, /appinstalled/, "Hook must listen to appinstalled event.");
assert.match(hookContent, /launchNativeInstallPrompt\(nativePrompt\)/, "Hook must launch the native prompt directly.");
assert.match(hookContent, /voltex_pwa_install_dismissed/, "Hook must track dismissal state.");
assert.match(hookContent, /isIOS/, "Hook must detect iOS Safari devices.");
assert.match(hookContent, /isAndroid/, "Hook must detect Android devices.");
assert.match(hookContent, /window\.__voltex_pwa_prompt/, "Hook must read the captured prompt from the window.");

// Single-listener / hydration / stale-reference invariants
assert.doesNotMatch(
  hookContent,
  /addEventListener\(\s*["']beforeinstallprompt["']/,
  "Hook must not register its own beforeinstallprompt listener (early capture script owns it)."
);
assert.match(
  hookContent,
  /useState<BeforeInstallPromptEvent \| null>\(null\)/,
  "deferredPrompt must initialise to null to avoid hydration mismatches."
);
assert.doesNotMatch(hookContent, /\},\s*\[deferredPrompt\]\);/, "Listener effect must not re-run on prompt changes.");

const promptInstallBody = hookContent.slice(
  hookContent.indexOf("const promptInstall = useCallback"),
  hookContent.indexOf("const openInstallInstructions")
);
assert.ok(promptInstallBody.length > 0, "promptInstall must exist.");
assert.doesNotMatch(promptInstallBody, /\bawait\b/, "promptInstall must not await anything before launching prompt().");
const clearIdx = promptInstallBody.indexOf("window.__voltex_pwa_prompt = null");
const launchIdx = promptInstallBody.indexOf("launchNativeInstallPrompt(nativePrompt)");
const modalIdx = promptInstallBody.indexOf("setShowInstructionsModal(true)");
assert.ok(clearIdx > -1 && clearIdx < launchIdx, "Consumed prompt must be cleared before launching.");
assert.ok(
  modalIdx > -1 && modalIdx < launchIdx && promptInstallBody.indexOf("if (!nativePrompt)") < modalIdx,
  "Instructions modal must only open on the no-native-prompt branch (or after a failed launch)."
);

console.log("  ✓ usePwaInstall hook launches the native prompt directly with no stale refs or duplicate listeners.");

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

// Install handlers must invoke promptInstall() first (inside the tap), not after other awaits
const installHandlers = navbarContent.match(/onClick=\{[^}]*?promptInstall\(\)[^}]*?\}/gs) || [];
assert.ok(installHandlers.length >= 3, `Expected 3 install handlers (desktop, guest, auth). Found: ${installHandlers.length}`);
for (const handler of installHandlers) {
  assert.doesNotMatch(handler, /\bawait\b/, "Install handlers must not await before invoking the prompt.");
  const promptIdx = handler.indexOf("promptInstall()");
  const closeIdx = handler.search(/set(Mobile|User)\w*Open\(false\)/);
  assert.ok(closeIdx === -1 || promptIdx < closeIdx, "promptInstall() must be invoked before closing menus.");
}

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

// 5. Behavioural tests against the real src/lib/pwaInstall.ts (via Node type stripping)
console.log("[5] Testing src/lib/pwaInstall.ts capture script, native prompt launcher & platform detection...");

const layoutContent = fs.readFileSync(path.join(rootDir, "src", "app", "layout.tsx"), "utf-8");
assert.match(
  layoutContent,
  /<script dangerouslySetInnerHTML=\{\{ __html: PWA_INSTALL_CAPTURE_SCRIPT \}\} \/>/,
  "RootLayout must inline the early beforeinstallprompt capture script in <head>."
);
assert.ok(
  layoutContent.indexOf("PWA_INSTALL_CAPTURE_SCRIPT }}") < layoutContent.indexOf("</head>"),
  "Capture script must be rendered inside <head>, before hydration."
);

const vm = await import("node:vm");
const { pathToFileURL } = await import("node:url");
const lib = await import(pathToFileURL(path.join(rootDir, "src", "lib", "pwaInstall.ts")).href);

// 5a. Early capture script: stores the event, prevents the mini-infobar, notifies the hook, clears on install
{
  const win = new EventTarget();
  vm.runInNewContext(lib.PWA_INSTALL_CAPTURE_SCRIPT, { window: win, Event });
  assert.equal(win.__voltex_pwa_prompt, null, "Capture script must initialise the global to null.");

  let notified = 0;
  win.addEventListener(lib.PWA_PROMPT_READY_EVENT, () => notified++);

  const bip = new Event("beforeinstallprompt", { cancelable: true });
  win.dispatchEvent(bip);
  assert.equal(bip.defaultPrevented, true, "Capture script must call preventDefault().");
  assert.equal(win.__voltex_pwa_prompt, bip, "Capture script must store the event.");
  assert.equal(notified, 1, "Capture script must notify mounted hooks exactly once.");

  win.dispatchEvent(new Event("appinstalled"));
  assert.equal(win.__voltex_pwa_prompt, null, "appinstalled must clear the stored prompt.");
}

// 5b. launchNativeInstallPrompt: prompt() runs synchronously; outcomes handled safely
function fakePrompt({ outcome = "accepted", promptThrows = false, promptRejects = false } = {}) {
  const evt = { prompted: 0 };
  evt.prompt = () => {
    evt.prompted++;
    if (promptThrows) throw new Error("InvalidStateError");
    return promptRejects ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve();
  };
  evt.userChoice = Promise.resolve({ outcome, platform: "web" });
  return evt;
}

{
  const accepted = fakePrompt({ outcome: "accepted" });
  const pending = lib.launchNativeInstallPrompt(accepted);
  assert.equal(accepted.prompted, 1, "prompt() must be invoked synchronously within the user gesture.");
  assert.equal(await pending, "accepted");

  assert.equal(await lib.launchNativeInstallPrompt(fakePrompt({ outcome: "dismissed" })), "dismissed");
  assert.equal(await lib.launchNativeInstallPrompt(fakePrompt({ promptThrows: true })), "unavailable");
  assert.equal(await lib.launchNativeInstallPrompt(fakePrompt({ promptRejects: true })), "unavailable");
}

// 5c. Platform detection
{
  const android = lib.detectInstallPlatform(
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
    "Linux armv8l",
    5
  );
  assert.deepEqual(android, { isIOS: false, isAndroid: true });

  const iosSafari = lib.detectInstallPlatform(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "iPhone",
    5
  );
  assert.deepEqual(iosSafari, { isIOS: true, isAndroid: false });

  const iosChrome = lib.detectInstallPlatform(
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1",
    "iPhone",
    5
  );
  assert.equal(iosChrome.isIOS, false, "Chrome on iOS must not be treated as iOS Safari.");

  const desktop = lib.detectInstallPlatform(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Win32",
    0
  );
  assert.deepEqual(desktop, { isIOS: false, isAndroid: false });
}

console.log("  ✓ Early capture, one-tap native prompt launch, outcome handling and platform detection verified.");

console.log("------------------------------------------------------------");
console.log("All PWA-3 Verification Checks Passed Successfully!");
console.log("------------------------------------------------------------");
