/**
 * GlowBackdrop — decorative blurred-circles background effect.
 *
 * Renders 3–4 overlapping circular shapes, heavily blurred to create a
 * soft mesh-gradient glow in brand blue, fading to the page background
 * at the bottom.  The entire layer is `pointer-events-none` and sits
 * behind content via z-index.
 *
 * Usage:
 *   <div className="relative min-h-screen overflow-hidden">
 *     <GlowBackdrop />
 *     <div className="relative z-10">…content…</div>
 *   </div>
 *
 * Performance: uses `will-change: transform` + `transform: translateZ(0)`
 * to promote the blurred layer to its own GPU layer, avoiding repaints
 * on the content above.
 */
export default function GlowBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* ── Shapes layer (blurred) ─────────────────────────── */}
      {/*
        On desktop, we clamp the shapes container to a max-width
        and center it so the glow doesn't stretch edge-to-edge.
      */}
      <div
        className="absolute glow-backdrop-enter"
        style={{
          top: 0,
          left: "50%",
          transform: "translateX(-50%) translateZ(0)",
          width: "min(100%, 720px)",
          height: "55vh",
          filter: "blur(90px)",
          willChange: "transform",
        }}
      >
        {/* Large primary circle — upper-left anchor */}
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(260px, 65vw, 400px)",
            height: "clamp(260px, 65vw, 400px)",
            top: "-15%",
            left: "-8%",
            background: "#3b82f6",
            opacity: 0.6,
          }}
        />

        {/* Medium deep-blue circle — overlapping centre-right */}
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(200px, 50vw, 340px)",
            height: "clamp(200px, 50vw, 340px)",
            top: "8%",
            left: "28%",
            background: "#1e3a8a",
            opacity: 0.7,
          }}
        />

        {/* Smaller bright accent — right side, adds breadth */}
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(160px, 38vw, 240px)",
            height: "clamp(160px, 38vw, 240px)",
            top: "-8%",
            right: "-2%",
            background: "#3b82f6",
            opacity: 0.35,
          }}
        />

        {/* Tiny intense dot — visual "hotspot" for centre depth */}
        <div
          className="absolute rounded-full"
          style={{
            width: "clamp(90px, 22vw, 150px)",
            height: "clamp(90px, 22vw, 150px)",
            top: "20%",
            left: "18%",
            background: "#60a5fa",
            opacity: 0.5,
          }}
        />
      </div>

      {/* ── Bottom fade-to-background overlay ──────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 22%, rgba(5,5,5,0.55) 40%, #050505 62%)",
        }}
      />
    </div>
  );
}
