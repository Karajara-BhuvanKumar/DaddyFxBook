import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
import type { Trade } from "@/hooks/useTrades";

interface Props {
  anchorRect: DOMRect;
  dateStr: string; // YYYY-MM-DD
  trades: Trade[];
  onClose: () => void;
}

const POPUP_WIDTH = 360;
const GAP = 12;

export function DayTradesPopup({ anchorRect, dateStr, trades, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handleClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Positioning: prefer right; fallback below; clamp to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const estHeight = Math.min(480, 180 + trades.length * 64);
  let left = anchorRect.right + GAP;
  let top = anchorRect.top;
  if (left + POPUP_WIDTH + 8 > vw) {
    // place below
    left = anchorRect.left;
    top = anchorRect.bottom + GAP;
  }
  left = Math.min(Math.max(8, left), vw - POPUP_WIDTH - 8);
  top = Math.min(Math.max(8, top), vh - estHeight - 8);

  const [y, m, d] = dateStr.split("-").map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const visible = mounted && !closing;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top,
        left,
        width: POPUP_WIDTH,
        maxWidth: "calc(100vw - 16px)",
        background: "linear-gradient(180deg, rgba(18,20,30,.98), rgba(12,14,22,.98))",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 24,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: "0 20px 80px rgba(0,0,0,.45)",
        padding: 24,
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.95)",
        transformOrigin: "top left",
        transition: "opacity 200ms ease, transform 200ms ease",
      }}
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 style={{ fontSize: 22, fontWeight: 700, color: "#F8FAFC", letterSpacing: "-0.02em" }}>
            Trades on {dateLabel}
          </h3>
          <p style={{ fontSize: 14, color: "#94A3B8", marginTop: 4 }}>
            {trades.length} {trades.length === 1 ? "trade" : "trades"}
          </p>
        </div>
        <button
          onClick={handleClose}
          className="rounded-full p-1.5 hover:bg-white/[0.02] transition"
          style={{ color: "#94A3B8" }}
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {trades.length === 0 ? (
        <div style={{ padding: "28px 0", textAlign: "center", fontSize: 16, color: "#64748B" }}>
          No trades recorded
        </div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 8 }}>
          {trades.map((t) => {
            const pnl = Number(t.pnl);
            const positive = pnl >= 0;
            const isLong = (t.direction || "").toLowerCase() === "long";
            return (
              <div
                key={t.id}
                style={{
                  height: 64,
                  padding: "0 4px",
                  borderBottom: "1px solid rgba(255,255,255,.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#F8FAFC",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {t.symbol}
                  </span>
                  <span
                    style={{
                      background: isLong ? "rgba(59,130,246,.15)" : "rgba(239,68,68,.15)",
                      color: isLong ? "#3B82F6" : "#EF4444",
                      borderRadius: 999,
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isLong ? "Long" : "Short"}
                  </span>
                </div>
                <span
                  className="text-num"
                  style={{
                    color: positive ? "#3B82F6" : "#EF4444",
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {positive ? "+" : "-"}${Math.abs(pnl).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => {
          handleClose();
          navigate("/trades");
        }}
        style={{
          marginTop: 12,
          width: "100%",
          height: 52,
          background: "rgba(255,255,255,.05)",
          border: "1px solid rgba(255,255,255,.06)",
          borderRadius: 16,
          color: "#F8FAFC",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "background 160ms ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.05)")}
      >
        View All Trades <ArrowRight className="w-4 h-4" />
      </button>
    </div>,
    document.body
  );
}
