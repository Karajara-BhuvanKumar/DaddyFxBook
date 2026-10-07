import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchCoachData } from "@/lib/coach/data";

const state = vi.hoisted(() => ({
  counts: {} as Record<string, number>, failures: new Set<string>(),
  calls: [] as { table: string; columns: string; user: string; from: number; to: number; signal?: AbortSignal }[],
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  const call = { table, columns: "", user: "", from: 0, to: 0, signal: undefined as AbortSignal | undefined };
  const query = {
    select(columns: string) { call.columns = columns; return query; },
    eq(field: string, value: string) { expect(field).toBe("user_id"); call.user = value; return query; },
    order(field: string) { expect(field).toBe("id"); return query; },
    range(from: number, to: number) { call.from = from; call.to = to; return query; },
    abortSignal(signal: AbortSignal) { call.signal = signal; return query; },
    then(resolve: (value: unknown) => unknown) {
      state.calls.push({ ...call });
      const failed = state.failures.has(table);
      const count = Math.max(0, Math.min(call.to + 1, state.counts[table] || 0) - call.from);
      return Promise.resolve(resolve({ data: failed ? null : Array.from({ length: count }, (_, i) => ({ id: `${table}-${i + call.from}` })), error: failed ? { message: "Unavailable" } : null }));
    },
  };
  return query;
} } }));

describe("Coach data loading", () => {
  beforeEach(() => { state.counts = {}; state.failures.clear(); state.calls = []; });
  it("loads every page with a stable order and account scope", async () => {
    state.counts.trades = 1205;
    const result = await fetchCoachData("account-a");
    expect(result.trades).toHaveLength(1205);
    expect(state.calls.filter(c => c.table === "trades").map(c => [c.from, c.to])).toEqual([[0, 499], [500, 999], [1000, 1499]]);
    expect(state.calls.every(c => c.user === "account-a")).toBe(true);
    expect(state.calls.find(c => c.table === "screenshots")?.columns).toBe("id,trade_id");
  });
  it("does not return a partial review when trade loading fails", async () => {
    state.failures.add("trades");
    await expect(fetchCoachData("account-a")).rejects.toThrow("Couldn't load trades");
  });
  it("reports optional source failures explicitly", async () => {
    state.failures.add("rule_violations");
    const result = await fetchCoachData("account-a");
    expect(result.warnings).toEqual(["rule violations could not be loaded; this source is unavailable."]);
  });
  it("propagates cancellation to every query and never returns cancelled data", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(fetchCoachData("account-a", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(state.calls.every(c => c.signal === controller.signal)).toBe(true);
  });
});
