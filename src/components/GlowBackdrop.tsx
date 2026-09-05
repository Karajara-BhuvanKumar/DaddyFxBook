/**
 * GlowBackdrop — decorative blurred-circles background effect.
 *
 * Two variants:
 *   - "hero"    — bold, high-opacity glow for near-empty pages (Auth).
 *   - "ambient" — subtle, barely-there brand tint for data-dense pages.
 *
 * Usage:
 *   <GlowBackdrop variant="hero" />    // Auth page
 *   <GlowBackdrop variant="ambient" /> // App shell
 *
 * Performance: uses will-change + translateZ(0) to promote to a GPU layer.
 */

interface GlowBackdropProps {
  /** "hero" = bold Auth-page glow; "ambient" = subtle app-shell tint */
  variant?: "hero" | "ambient";
}

/* ── Per-variant configuration ─────────────────────────── */

const HERO_CONFIG = {
  containerHeight: "55vh",
  containerMaxWidth: "min(100%, 720px)",
  blur: "blur(90px)",
  fade: "linear-gradient(to bottom, transparent 0%, transparent 22%, rgba(5,5,5,0.55) 40%, #050505 62%)",
  animationClass: "glow-backdrop-enter",
  circles: [
    { w: "clamp(260px, 65vw, 400px)", h: "clamp(260px, 65vw, 400px)", top: "-15%", left: "-8%",  right: undefined, bg: "#3b82f6", opacity: 0.6  },
    { w: "clamp(200px, 50vw, 340px)", h: "clamp(200px, 50vw, 340px)", top: "8%",   left: "28%",  right: undefined, bg: "#1e3a8a", opacity: 0.7  },
    { w: "clamp(160px, 38vw, 240px)", h: "clamp(160px, 38vw, 240px)", top: "-8%",  left: undefined, right: "-2%",  bg: "#3b82f6", opacity: 0.35 },
    { w: "clamp(90px, 22vw, 150px)",  h: "clamp(90px, 22vw, 150px)",  top: "20%",  left: "18%",  right: undefined, bg: "#60a5fa", opacity: 0.5  },
  ],
} as const;

const AMBIENT_CONFIG = {
  containerHeight: "320px",      // confined to the very top
  containerMaxWidth: "min(100%, 900px)",
  blur: "blur(120px)",           // extra-soft so no visible shapes
  fade: "linear-gradient(to bottom, transparent 0%, rgba(5,5,5,0.5) 40%, #050505 70%)",
  animationClass: "",            // no entrance animation — always there
  circles: [
    { w: "clamp(180px, 40vw, 300px)", h: "clamp(180px, 40vw, 300px)", top: "-30%", left: "5%",   right: undefined, bg: "#3b82f6", opacity: 0.18 },
    { w: "clamp(140px, 30vw, 240px)", h: "clamp(140px, 30vw, 240px)", top: "-10%", left: "30%",  right: undefined, bg: "#1e3a8a", opacity: 0.22 },
    { w: "clamp(120px, 25vw, 200px)", h: "clamp(120px, 25vw, 200px)", top: "-20%", left: undefined, right: "10%",  bg: "#3b82f6", opacity: 0.1  },
  ],
} as const;

export default function GlowBackdrop({ variant = "hero" }: GlowBackdropProps) {
  const cfg = variant === "hero" ? HERO_CONFIG : AMBIENT_CONFIG;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* ── Shapes layer (blurred) ─────────────────────────── */}
      <div
        className={`absolute ${cfg.animationClass}`.trim()}
        style={{
          top: 0,
          left: "50%",
          transform: "translateX(-50%) translateZ(0)",
          width: cfg.containerMaxWidth,
          height: cfg.containerHeight,
          filter: cfg.blur,
          willChange: "transform",
        }}
      >
        {cfg.circles.map((c, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: c.w,
              height: c.h,
              top: c.top,
              left: c.left,
              right: c.right,
              background: c.bg,
              opacity: c.opacity,
            }}
          />
        ))}
      </div>

      {/* ── Bottom fade-to-background overlay ──────────────── */}
      <div
        className="absolute inset-0"
        style={{ background: cfg.fade }}
      />
    </div>
  );
}
