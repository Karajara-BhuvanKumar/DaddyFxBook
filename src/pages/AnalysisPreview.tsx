import { AnalysisView } from "@/pages/Analysis";
import { previewTrades } from "@/lib/previewData";
import type { Journal } from "@/hooks/useTrades";

// Local fixtures only; no sample data is written to the user's account.
const dates = ["2026-09-17", "2026-09-26", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05"];
const pnl = [990, -500, 733.4, -33.7, -30.3, 175];
const trades = previewTrades.map((trade, index) => ({
  ...trade,
  id: `analysis-preview-${index}`,
  direction: index === 2 ? "Short" : "Long",
  pnl: pnl[index],
  session: index === 0 ? "New York" : index === 1 ? "Asian" : "London",
  open_time: `${dates[index]}T08:00:00Z`,
  close_time: `${dates[index]}T13:30:00Z`,
}));
const journals: Journal[] = trades.map((trade, index) => ({
  id: `analysis-journal-${index}`, trade_id: trade.id, user_id: "local-preview",
  pre_trade_notes: null, post_trade_notes: null, emotions: null, lessons: null,
  tags: null, rating: null, risk_reward: null,
  strategy_setup: JSON.stringify({ htf_tf: index < 3 ? "H4" : "H1", htf_level: index < 3 ? "TJL 2" : "TJL 1", ltf_tf: "M5", ltf_level: index < 3 ? "QML" : "ISS Level 3", bias: index < 3 ? "Bullish" : "Bearish", conf_tf: "M1", conf_type: index % 2 ? "CC Engulfing" : "TJL 1", confluences: [] }),
  created_at: trade.close_time, updated_at: trade.close_time,
}));

export default function AnalysisPreview() {
  return <AnalysisView trades={trades} allJournals={journals} initialDate={new Date(2026, 9, 1)} />;
}
