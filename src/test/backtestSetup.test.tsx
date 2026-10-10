import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SetupAnalysis from "@/components/backtest/SetupAnalysis";
import type { BreakdownRow } from "@/lib/backtest";

afterEach(cleanup);
const rows: BreakdownRow[] = Array.from({ length: 23 }, (_, i) => ({
  key: `LTF: M15 TJL ${i + 1} Confirmation: M1 CC Engulfing Confluences: SL Outside Zone`,
  trades: i + 1, wins: i, winRate: i / (i + 1), netR: 11 - i, pnl: 0,
}));
const renderedRows = () => screen.getAllByRole("row").slice(1);

describe("backtest setup comparison", () => {
  it("keeps full classifications and metrics available across every page", () => {
    render(<SetupAnalysis rows={rows} />);
    expect(screen.getByText(rows[0].key)).toBeVisible();
    expect(within(renderedRows()[0]).getByText("+11.00R")).toBeVisible();
    expect(screen.getByText("Small sample · 1 trade")).toBeVisible();
    expect(renderedRows()).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Next setup page" }));
    expect(screen.getByText("11–20 of 23 setups")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next setup page" }));
    expect(renderedRows()).toHaveLength(3);
    expect(screen.getByText(rows[22].key)).toBeVisible();
    expect(screen.getByRole("button", { name: "Next setup page" })).toBeDisabled();
  });

  it("finds full setup names and resets pagination when searching or sorting", () => {
    render(<SetupAnalysis rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Next setup page" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Search setups" }), { target: { value: "  tjl 23 confirmation  " } });
    expect(renderedRows()).toHaveLength(1);
    expect(screen.getByText(rows[22].key)).toBeVisible();
    expect(screen.getByText("Page 1 of 1")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Search setups" }), { target: { value: "missing" } });
    expect(screen.getByText("No setups match your search.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort setups" }), { target: { value: "net-asc" } });
    expect(renderedRows()[0]).toHaveTextContent(rows[22].key);
    expect(renderedRows()[0]).toHaveTextContent("-11.00R");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort setups" }), { target: { value: "trades" } });
    expect(renderedRows()[0]).toHaveTextContent(rows[22].key);
    expect(rows[0].key).toContain("TJL 1 Confirmation");
  });

  it("keeps the page valid when edited trades reduce the number of setups", () => {
    const { rerender } = render(<SetupAnalysis rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: "Next setup page" }));
    fireEvent.click(screen.getByRole("button", { name: "Next setup page" }));
    rerender(<SetupAnalysis rows={rows.slice(0, 2)} />);
    expect(screen.getByText("1–2 of 2 setups")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous setup page" })).toBeDisabled();
    rerender(<SetupAnalysis rows={[]} />);
    expect(screen.getByText("No setup data yet.")).toBeVisible();
  });
});
