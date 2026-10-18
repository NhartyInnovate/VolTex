/**
 * VolTex Zero-Dependency Confetti Utility
 * Minimalist, high-performance, and respectful of prefers-reduced-motion.
 * Utilizes native HTML5 Canvas and exact TEDx palette tokens.
 */

interface ConfettiOptions {
  type?: "registration" | "referral";
  origin?: { x: number; y: number }; // normalized 0 to 1
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  decay: number;
}

// TEDx-inspired particle palette
const PALETTE = [
  "#EB0028", // TEDx Red
  "#FFFFFF", // Pure White
  "#F4F4F5", // Off-white
  "#A1A1AA", // Muted Zinc
  "#C20021", // Darker Red
];

export function triggerConfetti(options: ConfettiOptions = {}): void {
  if (typeof window === "undefined") return;

  // Respect user preference for reduced motion
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (prefersReducedMotion) return;

  const { type = "referral", origin } = options;
  const isRegistration = type === "registration";

  // Create canvas element
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.inset = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "99999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  // Origin point
  const startX = origin ? origin.x * width : width / 2;
  const startY = origin ? origin.y * height : isRegistration ? height * 0.45 : height * 0.5;

  // Particle count: concise and restrained
  const count = isRegistration ? 48 : 28;
  const particles: Particle[] = [];

  for (let i = 0; i < count; i++) {
    // Spread angles
    const angle = isRegistration
      ? -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.8) // fan upward
      : (Math.random() * Math.PI * 2); // 360 burst

    const speed = isRegistration
      ? 5 + Math.random() * 7
      : 3 + Math.random() * 5;

    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: isRegistration ? 4 + Math.random() * 4 : 3 + Math.random() * 3,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      opacity: 1,
      decay: isRegistration ? 0.012 + Math.random() * 0.008 : 0.02 + Math.random() * 0.01,
    });
  }

  let animationId: number;

  const render = () => {
    ctx.clearRect(0, 0, width, height);
    let activeParticles = 0;

    for (const p of particles) {
      if (p.opacity <= 0) continue;

      activeParticles++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravity
      p.vx *= 0.98; // air drag
      p.rotation += p.rotationSpeed;
      p.opacity -= p.decay;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      // Draw rectangular confetti flake
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    }

    if (activeParticles > 0) {
      animationId = requestAnimationFrame(render);
    } else {
      cancelAnimationFrame(animationId);
      canvas.remove();
    }
  };

  animationId = requestAnimationFrame(render);

  // Safety cleanup timeout after 3 seconds max
  setTimeout(() => {
    cancelAnimationFrame(animationId);
    if (canvas.parentElement) {
      canvas.remove();
    }
  }, 3000);
}
