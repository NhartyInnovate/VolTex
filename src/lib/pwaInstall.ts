/**
 * Framework-free PWA installation helpers.
 *
 * Kept dependency-free (no imports, only erasable TypeScript syntax) so the
 * exact same code can be exercised by `scripts/verify-pwa-3.mjs` under Node's
 * native type stripping.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

/** Custom DOM event dispatched by the early capture script when Chrome supplies a prompt. */
export const PWA_PROMPT_READY_EVENT = "voltex:installprompt";

/**
 * Inline <head> script that captures `beforeinstallprompt` before React hydrates.
 *
 * Chrome fires `beforeinstallprompt` at most once per page load. If it fires
 * before the Navbar's effects run, a listener registered in React would miss it.
 * This script is the single `beforeinstallprompt` listener in the app: it stores
 * the event on `window.__voltex_pwa_prompt` and notifies any mounted hook.
 */
export const PWA_INSTALL_CAPTURE_SCRIPT =
  '(function(){try{' +
  'window.__voltex_pwa_prompt=window.__voltex_pwa_prompt||null;' +
  'window.addEventListener("beforeinstallprompt",function(e){' +
  "e.preventDefault();" +
  "window.__voltex_pwa_prompt=e;" +
  'window.dispatchEvent(new Event("' + PWA_PROMPT_READY_EVENT + '"));' +
  "});" +
  'window.addEventListener("appinstalled",function(){window.__voltex_pwa_prompt=null;});' +
  "}catch(e){}})();";

/**
 * Launches the browser's native install dialog.
 *
 * IMPORTANT: `event.prompt()` is invoked synchronously (before any `await`), so
 * when this function is called directly from a click handler the call happens
 * inside the user-activation window that Chrome requires.
 *
 * A `BeforeInstallPromptEvent` can only be prompted once; callers must discard
 * the event after calling this function regardless of the outcome.
 */
export async function launchNativeInstallPrompt(
  event: BeforeInstallPromptEvent
): Promise<InstallOutcome> {
  let promptResult: Promise<void>;
  try {
    promptResult = event.prompt();
  } catch {
    return "unavailable";
  }

  try {
    await promptResult;
    const choice = await event.userChoice;
    return choice.outcome === "accepted" ? "accepted" : "dismissed";
  } catch {
    return "unavailable";
  }
}

export interface InstallPlatform {
  isIOS: boolean;
  isAndroid: boolean;
}

/** Detects iOS Safari (manual Share → Add to Home Screen) and Android devices. */
export function detectInstallPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number
): InstallPlatform {
  const isIOSDevice =
    /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);

  const isSafari =
    /Safari/.test(userAgent) &&
    !/CriOS|FxiOS|OPiOS|mercury|EdgiOS/.test(userAgent) &&
    !/Chrome|Android/.test(userAgent);

  return {
    isIOS: isIOSDevice && isSafari,
    isAndroid: /Android/i.test(userAgent),
  };
}
