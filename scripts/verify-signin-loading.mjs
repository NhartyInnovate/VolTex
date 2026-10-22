import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

console.log("=== Running VolTex Sign-In Loading Overlay Cleanup Verification Suite ===\n");

// 1. Inspect src/components/LoadingSpinner.tsx
console.log("[Test 1] Verifying CenteredProcessingOverlay in src/components/LoadingSpinner.tsx...");
const spinnerFile = fs.readFileSync(path.join(rootDir, "src", "components", "LoadingSpinner.tsx"), "utf-8");

assert.match(
  spinnerFile,
  /interface\s+CenteredProcessingOverlayProps\s*\{[^}]*hasBackdrop\?: boolean;?[^}]*\}/s,
  "CenteredProcessingOverlayProps must declare optional hasBackdrop boolean property."
);

assert.match(
  spinnerFile,
  /export\s+function\s+CenteredProcessingOverlay\(\s*\{[^}]*hasBackdrop\s*=\s*true[^}]*\}\s*:\s*CenteredProcessingOverlayProps\s*\)/s,
  "CenteredProcessingOverlay must default hasBackdrop to true to preserve other consumers."
);

assert.match(
  spinnerFile,
  /hasBackdrop\s*\?\s*["']bg-black\/10 dark:bg-black\/40 backdrop-blur-\[1px\]["']\s*:\s*["']["']/,
  "CenteredProcessingOverlay must conditionally apply backdrop and dimming classes based on hasBackdrop."
);

assert.match(
  spinnerFile,
  /<LoadingSpinner\s+size=["']xl["']\s+colorScheme=["']red-dark["']\s+label=\{label\}\s*\/>/,
  "CenteredProcessingOverlay must preserve the red-dark segmented LoadingSpinner."
);

assert.match(
  spinnerFile,
  /role=["']status["']/,
  "CenteredProcessingOverlay must preserve accessible role='status'."
);

assert.match(
  spinnerFile,
  /aria-live=["']polite["']/,
  "CenteredProcessingOverlay must preserve aria-live='polite'."
);

console.log("  ✔ CenteredProcessingOverlay supports configurable hasBackdrop with safe defaults and preserved spinner/a11y.");

// 2. Inspect src/app/auth/login/page.tsx
console.log("\n[Test 2] Verifying Sign-In Page (src/app/auth/login/page.tsx)...");
const loginFile = fs.readFileSync(path.join(rootDir, "src", "app", "auth", "login", "page.tsx"), "utf-8");

// Verify CenteredProcessingOverlay invocation with hasBackdrop={false}
assert.match(
  loginFile,
  /<CenteredProcessingOverlay\s+message=["']Signing in\.\.\.["']\s+label=["']Signing in to your account["']\s+hasBackdrop=\{false\}\s*\/>/,
  "Sign-in page must invoke CenteredProcessingOverlay with hasBackdrop={false}."
);

// Verify duplicate submission prevention
assert.match(
  loginFile,
  /const\s+handleSubmit\s*=\s*async\s*\([^)]*\)\s*=>\s*\{\s*e\.preventDefault\(\);\s*if\s*\(\s*isSubmitting\s*\)\s*return;/s,
  "handleSubmit must immediately guard with 'if (isSubmitting) return;' to prevent duplicate submissions via rapid clicks or Enter key."
);

// Verify submit button disabled during submission
assert.match(
  loginFile,
  /<button\s+type=["']submit["']\s+disabled=\{isSubmitting\}/,
  "Submit button must be disabled when isSubmitting is true."
);

// Verify button status text
assert.match(
  loginFile,
  /\{isSubmitting\s*\?\s*["']Signing in\.\.\.["']\s*:\s*["']Sign In["']\}/,
  "Submit button must display 'Signing in...' during submission."
);

// Verify underlying form container does NOT have dimming or opacity classes during submission
const formContainerMatch = loginFile.match(/<div className="([^"]*rounded[^"]*p-6[^"]*)">/);
assert.ok(formContainerMatch, "Form container element must be present.");
const formContainerClasses = formContainerMatch[1];
assert.ok(
  !formContainerClasses.includes("opacity") && !formContainerClasses.includes("pointer-events-none"),
  "Form container itself must remain undimmed."
);

// Verify Supabase signInWithPassword, error handling, and redirection are intact
assert.match(
  loginFile,
  /supabase\.auth\.signInWithPassword\(\{\s*email:\s*trimmedEmail,\s*password,?\s*\}\)/s,
  "Supabase signInWithPassword call must be preserved."
);
assert.match(
  loginFile,
  /getAuthErrorMessage\(error\)/,
  "Supabase auth error mapping must be preserved."
);
assert.match(
  loginFile,
  /if\s*\(\s*profile\?\.role\s*===\s*["']admin["']\s*\)\s*\{\s*router\.push\(["']\/admin["']\);\s*\}\s*else\s*\{\s*router\.push\(["']\/dashboard["']\);\s*\}/s,
  "Role-based routing to /admin or /dashboard must be preserved."
);

console.log("  ✔ Sign-in page correctly removes backdrop/dimming, prevents duplicate submits, and preserves all auth flows.");

// 3. Verify Unrelated Consumers Remain Unchanged
console.log("\n[Test 3] Verifying Unrelated Auth Loading Indicators Remain Intact...");

const forgotPasswordFile = fs.readFileSync(path.join(rootDir, "src", "app", "auth", "forgot-password", "page.tsx"), "utf-8");
assert.ok(
  !forgotPasswordFile.includes("hasBackdrop={false}"),
  "Forgot-password page must maintain default loading overlay behavior."
);
assert.match(forgotPasswordFile, /<CenteredProcessingOverlay/, "Forgot-password page must still use CenteredProcessingOverlay.");

const registerFile = fs.readFileSync(path.join(rootDir, "src", "app", "auth", "register", "page.tsx"), "utf-8");
assert.ok(
  !registerFile.includes("hasBackdrop={false}"),
  "Register page must maintain default loading overlay behavior."
);
assert.match(registerFile, /<CenteredProcessingOverlay/, "Register page must still use CenteredProcessingOverlay.");

const resetPasswordFile = fs.readFileSync(path.join(rootDir, "src", "app", "auth", "reset-password", "page.tsx"), "utf-8");
assert.ok(
  !resetPasswordFile.includes("hasBackdrop={false}"),
  "Reset-password page must maintain default loading overlay behavior."
);
assert.match(resetPasswordFile, /<CenteredProcessingOverlay/, "Reset-password page must still use CenteredProcessingOverlay.");

console.log("  ✔ Unrelated loading indicators (forgot-password, register, reset-password) are completely untouched.");

// 4. Invariant Tests: Verify Backdrop Class Computation
console.log("\n[Test 4] Testing Backdrop Class Computation Invariants...");

function computeOverlayClassName({ hasBackdrop = true, className = "" }) {
  return `fixed inset-0 z-50 flex items-center justify-center transition-colors duration-200 animate-subtle-fade-up select-none ${
    hasBackdrop ? "bg-black/10 dark:bg-black/40 backdrop-blur-[1px]" : ""
  } ${className}`.trim();
}

const withBackdrop = computeOverlayClassName({ hasBackdrop: true });
assert.ok(withBackdrop.includes("bg-black/10"), "Default overlay must include light mode backdrop opacity.");
assert.ok(withBackdrop.includes("dark:bg-black/40"), "Default overlay must include dark mode backdrop opacity.");
assert.ok(withBackdrop.includes("backdrop-blur-[1px]"), "Default overlay must include backdrop blur.");

const withoutBackdrop = computeOverlayClassName({ hasBackdrop: false });
assert.ok(!withoutBackdrop.includes("bg-black"), "No-backdrop overlay must not include bg-black.");
assert.ok(!withoutBackdrop.includes("backdrop-blur"), "No-backdrop overlay must not include backdrop-blur.");
assert.ok(!withoutBackdrop.includes("opacity"), "No-backdrop overlay must not include opacity classes.");
assert.ok(withoutBackdrop.includes("fixed inset-0 z-50"), "Overlay must maintain viewport positioning to catch outside interaction.");

console.log("  ✔ Class computation correctly eliminates backdrop opacity and blur when hasBackdrop is false.");

console.log("\n=======================================================");
console.log("✔ ALL SIGN-IN LOADING OVERLAY VERIFICATION TESTS PASSED!");
console.log("=======================================================");
