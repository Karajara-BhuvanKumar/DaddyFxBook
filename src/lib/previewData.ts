import type { Trade } from "@/hooks/useTrades";

/** Local display fixtures only. Never inserted into an account or sent to Supabase. */
const sampleTrade = (id: number, day: number, pnl: number): Trade => {
  const date = `2026-09-${String(day).padStart(2, "0")}`;
  const closeTime = `${date}T${String(10 + id).padStart(2, "0")}:00:00Z`;
  const entryPrice = 2500;

  return {
    id: `preview-trade-${id}`,
    user_id: "local-preview",
    symbol: "XAUUSD",
    direction: "Long",
    entry_price: entryPrice,
    exit_price: entryPrice + pnl / 100,
    lot_size: 1,
    stop_loss: null,
    take_profit: null,
    pnl,
    open_time: `${date}T09:00:00Z`,
    close_time: closeTime,
    session: "London",
    source: "preview",
    created_at: closeTime,
    updated_at: closeTime,
  };
};

// September: +$6,800.01 on the 5th, +$990 on the 18th, -$500 on the 27th.
// Six trades, four wins and two losses, with a total of +$7,290.01.
export const previewTrades: Trade[] = [
  sampleTrade(6, 27, -500),
  sampleTrade(5, 18, 990),
  sampleTrade(4, 5, -300),
  sampleTrade(3, 5, 2600.01),
  sampleTrade(2, 5, 2000),
  sampleTrade(1, 5, 2500),
];

export const previewMonth = new Date(2026, 8, 1);
export const previewAsOf = new Date(2026, 9, 4, 12);
