import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalysisView } from "@/pages/Analysis";
import { previewTrades } from "@/lib/previewData";
import type { Journal } from "@/hooks/useTrades";

vi.mock("@/hooks/useAnalysisData", () => ({ useAnalysisData: vi.fn() }));
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
  it.each(['Asian', 'London', 'New York'])('renders all combined metrics for %s and preserves the timeline through edits and filters', name => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-05T18:00:00Z'));
    const assigned = journals.map((j, i) => ({ ...j, strategy_setup: JSON.stringify({ market_session: i === 0 ? name : i === 1 ? `Off Session ${name}` : '' }) }));
    const timed = trades.map((t, i) => ({ ...t, session: null, open_time: `2026-10-0${i + 1}T10:00:00Z` }));
    const { container, rerender } = render(<AnalysisView trades={timed} allJournals={assigned} />);
    const cards = () => container.querySelectorAll('.an-session-grid > div');
    const index = ['Asian', 'London', 'New York'].indexOf(name);
    const card = within(cards()[index] as HTMLElement);
    const timeline = container.querySelector('.an-session-timeline')!.innerHTML;
    expect(cards()[index].querySelector('.an-session-pnl')).toHaveTextContent('$60.00');
    expect(card.getByText('Trades').nextElementSibling).toHaveTextContent('2');
    expect(card.getByText('Win Rate').nextElementSibling).toHaveTextContent('50.0%');
    expect(card.getByText('Avg Trade').nextElementSibling).toHaveTextContent('$30.00');
    expect(card.getByText('Trade Share').nextElementSibling).toHaveTextContent('67%');
    expect(container.querySelector('.an-session-unassigned')).toHaveTextContent('1 trade ($0.00)');
    expect(container.querySelector('.an-session-unassigned')).toHaveTextContent('includes its regular and off-session categories');
    expect(screen.queryByText(/excluded from these cards/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Winners' }));
    expect(cards()[index].querySelector('.an-session-pnl')).toHaveTextContent('$100.00');
    expect(card.getByText('Trades').nextElementSibling).toHaveTextContent('1');
    expect(card.getByText('Win Rate').nextElementSibling).toHaveTextContent('100.0%');
    expect(card.getByText('Avg Trade').nextElementSibling).toHaveTextContent('$100.00');
    expect(card.getByText('Trade Share').nextElementSibling).toHaveTextContent('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Losers' }));
    expect(cards()[index].querySelector('.an-session-pnl')).toHaveTextContent('-$40.00');
    expect(card.getByText('Win Rate').nextElementSibling).toHaveTextContent('0.0%');
    fireEvent.click(screen.getByRole('button', { name: 'All Trades' }));
    const otherIndex = (index + 1) % 3;
    const edited = assigned.map((j, i) => i === 0 ? { ...j, strategy_setup: JSON.stringify({ market_session: ['Asian', 'London', 'New York'][otherIndex] }) } : j);
    rerender(<AnalysisView trades={timed} allJournals={edited} />);
    expect(cards()[otherIndex].querySelector('.an-session-pnl')).toHaveTextContent('$100.00');
    expect(cards()[index].querySelector('.an-session-pnl')).toHaveTextContent('-$40.00');
    rerender(<AnalysisView trades={timed.map((t, i) => i === 0 ? { ...t, open_time: '2026-10-01T05:30:00Z' } : t)} allJournals={edited} />);
    expect(cards()[otherIndex].querySelector('.an-session-pnl')).toHaveTextContent('$100.00');
    expect(cards()[index].querySelector('.an-session-pnl')).toHaveTextContent('-$40.00');
    expect(container.querySelector('.an-session-timeline')!.innerHTML).toBe(timeline);
  });

  it("preserves setup aggregation and updates it with the page filters", () => {
    const { container } = showAnalysis();
    const setups = within(screen.getByRole("region", { name: "Performance by Setup" }));
    const summary = container.querySelector(".an-setup-group summary")!;
    expect(summary).toHaveTextContent("H4 TJL 2 / M5 QML / Bullish");
    expect(summary).toHaveTextContent("50%");
    expect(summary).toHaveTextContent("$60.00");
    expect(setups.getByText("M5 QML Confirmation: M1 TJL 1")).toBeInTheDocument();
    expect(setups.getByText("M5 QML Confirmation: M1 CC Engulfing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Winners" }));
    expect(container.querySelector(".an-setup-group summary")).toHaveTextContent("100%");
    expect(container.querySelector(".an-setup-group summary")).toHaveTextContent("$100.00");
    expect(setups.queryByText("M5 QML Confirmation: M1 CC Engulfing")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Losers" }));
    expect(container.querySelector(".an-setup-group summary")).toHaveTextContent("-$40.00");
  });

  it("switches chart mode, selects a calendar day, and clears selection on period change", () => {
    showAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "Drawdown" }));
    expect(screen.getByRole("button", { name: "Drawdown" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("img", { name: "Drawdown chart, 3 trades" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "October 2, 1 trades, -$40.00" }));
    const details = within(screen.getByRole("complementary", { name: "Day Trades" }));
    expect(details.getByText("-$40.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(details.getByText("No day selected")).toBeInTheDocument();
    expect(screen.getByText("No trades in this period")).toBeInTheDocument();
    expect(screen.getByText("No journal setups in this period")).toBeInTheDocument();
  });

  it("reports drawdown as a loss and handles profit factor with no losing trades", () => {
    const { container } = showAnalysis();
    const stats = within(screen.getByRole("region", { name: "Your Stats" }));
    expect(stats.getByText("Max drawdown").parentElement).toHaveTextContent("-$40.00");
    fireEvent.click(screen.getByRole("button", { name: "Winners" }));
    expect(container.querySelectorAll(".an-kpi")[2]).toHaveTextContent("∞");
  });
});
