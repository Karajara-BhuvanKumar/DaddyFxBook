import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/pages/Dashboard";
import { previewTrades } from "@/lib/previewData";

vi.mock("@/hooks/useTrades", () => ({ useTrades: vi.fn() }));
vi.mock("recharts", async (importOriginal) => ({
  ...await importOriginal<typeof import("recharts")>(),
  ResponsiveContainer: () => null,
}));

afterEach(cleanup);

function renderCalendar(date: Date, days: [number, number][]) {
  const trades = days.map(([day, pnl], index) => ({
    ...previewTrades[0],
    id: `test-${index}`,
    pnl,
    close_time: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00Z`,
  }));
  const view = render(<MemoryRouter><DashboardView trades={trades} initialDate={date} initialTimeframe="ALL" /></MemoryRouter>);
  return { ...view, list: within(view.container.querySelector(".mobile-pnl-list") as HTMLElement) };
}

describe("Dashboard calendar views", () => {
  it("shares Monday-based weekly totals, retains zero-P&L traded days, and skips untraded days", () => {
    const { container, list } = renderCalendar(new Date(2026, 8, 1), [[1, 40], [6, -10], [7, 20], [7, -20], [30, -5]]);
    expect(container.querySelectorAll(".pnl-day")).toHaveLength(30);
    expect(list.getAllByRole("button")).toHaveLength(4);
    const weeks = list.getAllByRole("region");
    expect(weeks).toHaveLength(5);
    expect(within(weeks[0]).getByText("+$30.00")).toBeInTheDocument();
    expect(within(weeks[0]).getByText("2 trades")).toBeInTheDocument();
    expect(within(weeks[1]).getByRole("button")).toHaveTextContent("$0.00");
    expect(container.querySelectorAll(".pnl-week-total")[0]).toHaveTextContent("+$30");
    fireEvent.click(list.getByRole("button", { name: /September 2026 7,/ }));
    expect(screen.getByRole("dialog", { name: "Trades on Sep 7" })).toHaveTextContent("2 trades");
  });

  it.each([
    [new Date(2026, 2, 1), 31, 6],
    [new Date(2024, 1, 1), 29, 5],
    [new Date(2027, 1, 1), 28, 4],
  ])("handles month boundaries for %s", (date, lastDay, weekCount) => {
    const { container, list } = renderCalendar(date, [[1, 1], [lastDay, -1]]);
    expect(container.querySelectorAll(".pnl-day")).toHaveLength(lastDay);
    const weeks = list.getAllByRole("region");
    expect(weeks).toHaveLength(weekCount);
    expect(within(weeks[0]).getAllByRole("button")).toHaveLength(1);
    expect(within(weeks[weekCount - 1]).getAllByRole("button")).toHaveLength(1);
  });

  it("shows an empty month without empty day rows and clears day details on month navigation", () => {
    const { list } = renderCalendar(new Date(2026, 8, 1), [[5, 50]]);
    fireEvent.click(list.getByRole("button"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(list.getByText("No trades this month.")).toBeInTheDocument();
    expect(list.queryAllByRole("button")).toHaveLength(0);
  });
});
