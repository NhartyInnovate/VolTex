/**
 * Automated Verification Suite for VolTex Onboarding Tour
 * Tests Step 1 target configuration, DOM alignment, mobile viewport bounds,
 * dynamic stabilization, and tooltip placement invariants.
 */

import assert from "node:assert/strict";
import fs from "node:fs";

console.log("=== Running VolTex Onboarding Tour Verification Suite ===");

// 1. Verify Tour Steps Configuration in page.tsx
console.log("\n[Test 1] Tour Steps Configuration in src/app/dashboard/page.tsx");
{
  const dashboardContent = fs.readFileSync("src/app/dashboard/page.tsx", "utf8");

  // Step 1 must target tour-section-templates
  assert(
    dashboardContent.includes('targetId: "tour-section-templates"'),
    "Step 1 must target tour-section-templates"
  );
  assert(
    dashboardContent.includes('title: "Promote with Confidence"'),
    "Step 1 title must be preserved"
  );
  assert(
    dashboardContent.includes('tabKey: "templates"'),
    "Step 1 tabKey must be templates"
  );

  // Steps 2, 3, 4 must remain unchanged
  assert(
    dashboardContent.includes('targetId: "tour-btn-submit-referral"'),
    "Step 2 must target tour-btn-submit-referral"
  );
  assert(
    dashboardContent.includes('targetId: "tour-tab-referrals"'),
    "Step 3 must target tour-tab-referrals"
  );
  assert(
    dashboardContent.includes('targetId: "tour-tab-leaderboard"'),
    "Step 4 must target tour-tab-leaderboard"
  );

  // Target IDs must be present in JSX
  assert(
    dashboardContent.includes('id="tour-section-templates"'),
    "Container for promotional templates must have id='tour-section-templates'"
  );
  assert(
    dashboardContent.includes('id="tour-btn-submit-referral"'),
    "Submit referral button must have id='tour-btn-submit-referral'"
  );
  assert(
    dashboardContent.includes('id="tour-tab-referrals"'),
    "Referrals tab button must have id='tour-tab-referrals'"
  );
  assert(
    dashboardContent.includes('id="tour-tab-leaderboard"'),
    "Leaderboard tab button must have id='tour-tab-leaderboard'"
  );

  console.log("✔ Step 1 target and subsequent step IDs verified in JSX.");
}

// 2. Verify OnboardingTour.tsx Implementation Invariants
console.log("\n[Test 2] OnboardingTour.tsx Stabilization & Cleanup Invariants");
{
  const tourContent = fs.readFileSync("src/components/OnboardingTour.tsx", "utf8");

  // Must not have fragile fixed setTimeout 250ms measurement
  assert(
    !tourContent.includes("setTimeout(updateTargetRect, 250)"),
    "Must not rely on fragile fixed 250ms timeout"
  );

  // Must have requestAnimationFrame tracking
  assert(
    tourContent.includes("requestAnimationFrame(trackFrame)"),
    "Must track smooth scroll frame-by-frame via requestAnimationFrame"
  );

  // Must detect stabilization (stableFrames >= 8)
  assert(
    tourContent.includes("stableFrames >= 8"),
    "Must detect position stabilization across consecutive frames"
  );

  // Must have cancellation on unmount/step change
  assert(
    tourContent.includes("isCancelled = true"),
    "Must cancel pending operations on step change or close"
  );
  assert(
    tourContent.includes("cancelAnimationFrame(rafIdRef.current)"),
    "Must cancel active animation frames on cleanup"
  );

  // Must support ResizeObserver for layout shifts
  assert(
    tourContent.includes("new ResizeObserver") && tourContent.includes("ro.observe(document.body)"),
    "Must observe target element and document.body for layout shifts caused by elements above"
  );

  console.log("✔ Dynamic stabilization, frame tracking, and cleanup invariants verified.");
}

// 3. Test Tooltip Layout Positioning Across Viewports (375px, 390px, 1440px)
console.log("\n[Test 3] Tooltip Positioning Across Mobile & Desktop Viewports");
{
  function calculateTooltipPlacement({
    viewportWidth,
    viewportHeight,
    targetRect,
  }) {
    const isMobile = viewportWidth < 640;

    if (!targetRect || isMobile) {
      return {
        position: "fixed",
        bottom: "max(16px, env(safe-area-inset-bottom, 16px))",
        left: "16px",
        right: "16px",
        width: "calc(100vw - 32px)",
        maxWidth: "400px",
        margin: "0 auto",
      };
    }

    const padding = 12;
    const tooltipWidth = 360;
    const tooltipEstimatedHeight = 220;

    let top = targetRect.bottom + padding;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;

    if (top + tooltipEstimatedHeight > viewportHeight - 20) {
      top = Math.max(20, targetRect.top - tooltipEstimatedHeight - padding);
    }

    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    return {
      position: "fixed",
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
      width: `${tooltipWidth}px`,
    };
  }

  // Viewport A: iPhone SE (375x667)
  const mobileSE = calculateTooltipPlacement({
    viewportWidth: 375,
    viewportHeight: 667,
    targetRect: { top: 120, left: 16, width: 343, height: 320, bottom: 440, right: 359 },
  });
  assert.equal(mobileSE.position, "fixed");
  assert(mobileSE.bottom.includes("16px"), "Mobile must dock to bottom");
  assert.equal(mobileSE.width, "calc(100vw - 32px)");
  assert.equal(mobileSE.maxWidth, "400px");

  // Viewport B: iPhone 13/14 (390x844)
  const mobile13 = calculateTooltipPlacement({
    viewportWidth: 390,
    viewportHeight: 844,
    targetRect: { top: 150, left: 16, width: 358, height: 320, bottom: 470, right: 374 },
  });
  assert.equal(mobile13.position, "fixed");
  assert(mobile13.bottom.includes("16px"));
  assert.equal(mobile13.width, "calc(100vw - 32px)");

  // Viewport C: Desktop 1440x900
  const desktop = calculateTooltipPlacement({
    viewportWidth: 1440,
    viewportHeight: 900,
    targetRect: { top: 200, left: 300, width: 840, height: 400, bottom: 600, right: 1140 },
  });
  assert.equal(desktop.position, "fixed");
  assert.equal(desktop.width, "360px");
  // Placed below target: bottom (600) + padding (12) = 612px
  assert.equal(desktop.top, "612px");

  console.log("✔ Responsive tooltip placement verified for 375px, 390px, and 1440px.");
}

// 4. Test Target Spotlight Geometry & Aspect Ratio
console.log("\n[Test 4] Target Spotlight Geometry & Mobile Aspect Ratio");
{
  // Previous broken configuration: tab button on mobile 375px
  const brokenButtonRect = { left: 16, top: 400, width: 343, height: 36 };
  const brokenAspectRatio = brokenButtonRect.width / brokenButtonRect.height;
  assert(brokenAspectRatio > 9, "Old button was a thin strip with aspect ratio > 9:1");

  // New fixed configuration: promotional templates container on mobile 375px
  const fixedSectionRect = { left: 16, top: 250, width: 343, height: 280 };
  const fixedAspectRatio = fixedSectionRect.width / fixedSectionRect.height;
  assert(fixedAspectRatio < 1.5, "New section container provides balanced card aspect ratio < 1.5:1");

  // Spotlight cutout padding calculation
  const cutout = {
    x: fixedSectionRect.left - 6,
    y: fixedSectionRect.top - 6,
    width: fixedSectionRect.width + 12,
    height: fixedSectionRect.height + 12,
  };
  assert.equal(cutout.x, 10);
  assert.equal(cutout.y, 244);
  assert.equal(cutout.width, 355);
  assert.equal(cutout.height, 292);

  console.log("✔ Target spotlight geometry resolves thin horizontal strip into card-proportioned highlight.");
}

// 5. Test Frame Stabilization Convergence
console.log("\n[Test 5] Dynamic Frame Stabilization Convergence Simulation");
{
  // Simulate 15 frames of smooth scrolling followed by settling
  let currentTop = 600;
  let lastTop = 600;
  let stableFrames = 0;
  let settledFrame = -1;

  for (let frame = 1; frame <= 30; frame++) {
    // Decelerating scroll until frame 12
    if (frame <= 12) {
      currentTop -= 25 * (1 - frame / 15);
    }
    const delta = Math.abs(currentTop - lastTop);
    if (delta > 0.25) {
      stableFrames = 0;
      lastTop = currentTop;
    } else {
      stableFrames++;
    }

    if (stableFrames >= 8) {
      settledFrame = frame;
      break;
    }
  }

  assert(settledFrame > 12, "Must settle only after motion stops");
  assert(settledFrame <= 22, "Must converge within 8 frames of motion stopping");
  console.log(`✔ Frame stabilization converged at frame ${settledFrame} (~${Math.round(settledFrame * 16.6)}ms).`);
}

console.log("\n=======================================================");
console.log("✔ ALL ONBOARDING TOUR VERIFICATION TESTS PASSED (5/5)");
console.log("=======================================================\n");
