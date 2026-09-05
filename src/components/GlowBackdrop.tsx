/**
 * GlowBackdrop — decorative blurred-circles background effect.
 *
 * Usage:
 *   <GlowBackdrop variant="hero" />    // Auth page
 *
 * Performance: uses will-change + translateZ(0) to promote to a GPU layer.
 */

interface GlowBackdropProps {
  variant?: "hero";
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

export default function GlowBackdrop({ variant = "hero" }: GlowBackdropProps) {
  const cfg = HERO_CONFIG;

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
