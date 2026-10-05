import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisView } from "@/pages/Analysis";
import { previewTrades } from "@/lib/previewData";
import type { Journal } from "@/hooks/useTrades";

vi.mock("@/hooks/useTrades", () => ({ useTrades: vi.fn(), useAllJournals: vi.fn() }));
vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: () => null,
}));
afterEach(() => { cleanup(); vi.useRealTimers(); });

const trades = [100, -40, 0].map((pnl, index) => ({ ...previewTrades[0], id: `trade-${index}`, pnl, close_time: `2026-10-0${index + 1}T12:00:00Z` }));
const journals: Journal[] = trades.map((trade, index) => ({
  id: `journal-${index}`, trade_id: trade.id, user_id: "test",
  pre_trade_notes: null, post_trade_notes: null, emotions: null, lessons: null,
  tags: null, rating: null, risk_reward: null,
  strategy_setup: JSON.stringify({ htf_tf: "H4", htf_level: "TJL 2", ltf_tf: "M5", ltf_level: "QML", bias: "Bullish", conf_tf: "M1", conf_type: index ? "CC Engulfing" : "TJL 1" }),
  created_at: trade.close_time, updated_at: trade.close_time,
}));

function showAnalysis() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T18:00:00Z"));
  return render(<AnalysisView trades={trades} allJournals={journals} initialDate={new Date(2026, 9, 1)} />);
}

describe("Analysis redesign", () => {
  it("preserves setup aggregation and updates it with the page filters", () => {
    const { container } = showAnalysis();
    const setups = within(screen.getByRole("region", { name: "Performance by Setup" }));
    const summary = container.querySelector(".an-setup-group summary")!;
    expect(summary).toHaveTextContent("H4 TJL 2 / M5 QML / Bullish");
    expect(summary).toHaveTextContent("33%");
    expect(summary).toHaveTextContent("$60.00");
    expect(setups.getByText("M5 QML Confirmation: M1 TJL 1")).toBeInTheDocument();
    expect(setups.getByText("M5 QML Confirmation: M1 CC Engulfing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Winners", exact: true }));
    expect(container.querySelector(".an-setup-group summary")).toHaveTextContent("100%");
    expect(container.querySelector(".an-setup-group summary")).toHaveTextContent("$100.00");
    expect(setups.queryByText("M5 QML Confirmation: M1 CC Engulfing")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Losers", exact: true }));
    expect(container.querySelector(".an-setup-group summary")).toHaveTextContent("-$40.00");
  });

  it("switches chart mode, selects a calendar day, and clears selection on period change", () => {
    showAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Drawdown", exact: true }));
    expect(screen.getByRole("button", { name: "Drawdown", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Drawdown chart, 3 trades" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "October 2, 1 trades, -$40.00" }));
    const details = within(screen.getByRole("complementary", { name: "Day Trades" }));
    expect(details.getByText("-$40.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today", exact: true }));
    expect(details.getByText("No day selected")).toBeInTheDocument();
    expect(screen.getByText("No trades in this period")).toBeInTheDocument();
    expect(screen.getByText("No journal setups in this period")).toBeInTheDocument();
  });

  it("reports drawdown as a loss and handles profit factor with no losing trades", () => {
    const { container } = showAnalysis();
    const stats = within(screen.getByRole("region", { name: "Your Stats" }));
    expect(stats.getByText("Max drawdown").parentElement).toHaveTextContent("-$40.00");
    fireEvent.click(screen.getByRole("button", { name: "Winners", exact: true }));
    expect(container.querySelectorAll(".an-kpi")[2]).toHaveTextContent("∞");
  });
});
