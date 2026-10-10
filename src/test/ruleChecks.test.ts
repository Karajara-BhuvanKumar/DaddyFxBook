import { describe, it, expect } from "vitest";
import {
  getDayKey,
  evaluateRules,
  summarizeDiscipline,
  type RuleRow,
  type TradeRow,
  type ManualViolationRow,
} from "@/lib/ruleChecks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function trade(overrides: Partial<TradeRow> & { pnl: number }): TradeRow {
  return {
    id: Math.random().toString(36).slice(2),
    open_time: "2025-01-10T10:00:00Z",
    close_time: "2025-01-10T11:00:00Z",
    ...overrides,
    pnl: overrides.pnl,
  };
}

function rule(overrides: Partial<RuleRow> & { rule_type: string }): RuleRow {
  return {
    id: Math.random().toString(36).slice(2),
    rule: "test rule",
    active: true,
    threshold: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDayKey
// ---------------------------------------------------------------------------

describe("getDayKey", () => {
  it("extracts YYYY-MM-DD from ISO timestamp", () => {
    expect(getDayKey("2025-03-15T14:30:00Z")).toBe("2025-03-15");
  });
  it("normalizes offsets to UTC unless a timezone is supplied", () => {
    expect(getDayKey("2025-01-01T00:00:00+05:30")).toBe("2024-12-31");
    expect(getDayKey("2025-01-01T00:00:00+05:30", "Asia/Kolkata")).toBe("2025-01-01");
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — max_trades_per_day
// ---------------------------------------------------------------------------

describe("evaluateRules — max_trades_per_day", () => {
  const r = rule({ id: "r1", rule_type: "max_trades_per_day", threshold: 3, rule: "Max 3 trades/day" });

  it("does NOT flag when trades == threshold (boundary: exactly N is NOT a violation)", () => {
    const trades = [
      trade({ pnl: 10, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: -5, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
      trade({ pnl: 20, close_time: "2025-01-10T13:00:00Z", open_time: "2025-01-10T12:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("flags when trades > threshold", () => {
    const trades = [
      trade({ id: "t1", pnl: 10, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ id: "t2", pnl: -5, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
      trade({ id: "t3", pnl: 20, close_time: "2025-01-10T13:00:00Z", open_time: "2025-01-10T12:00:00Z" }),
      trade({ id: "t4", pnl: -3, close_time: "2025-01-10T14:00:00Z", open_time: "2025-01-10T13:00:00Z" }),
      trade({ id: "t5", pnl: 7, close_time: "2025-01-10T15:00:00Z", open_time: "2025-01-10T14:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(result["2025-01-10"]).toHaveLength(1);
    expect(result["2025-01-10"][0].detail).toBe("5 trades taken; limit is 3.");
    expect(result["2025-01-10"][0].tradeIds).toEqual(["t4", "t5"]);
    expect(result["2025-01-10"][0].source).toBe("auto");
  });

  it("does NOT flag a different day with fewer trades", () => {
    const trades = [
      trade({ pnl: 10, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: 20, close_time: "2025-01-11T11:00:00Z", open_time: "2025-01-11T10:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — max_consecutive_losses
// ---------------------------------------------------------------------------

describe("evaluateRules — max_consecutive_losses", () => {
  const r = rule({ id: "r2", rule_type: "max_consecutive_losses", threshold: 2, rule: "Stop after 2 losses" });

  it("flags trades AFTER N consecutive losses", () => {
    const trades = [
      trade({ id: "t1", pnl: -10, close_time: "2025-01-10T10:00:00Z", open_time: "2025-01-10T09:00:00Z" }),
      trade({ id: "t2", pnl: -5, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ id: "t3", pnl: 20, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(result["2025-01-10"]).toHaveLength(1);
    expect(result["2025-01-10"][0].tradeIds).toEqual(["t3"]);
    expect(result["2025-01-10"][0].detail).toBe("Traded after 2 consecutive losses");
  });

  it("does NOT flag if streak not reached", () => {
    const trades = [
      trade({ pnl: -10, close_time: "2025-01-10T10:00:00Z", open_time: "2025-01-10T09:00:00Z" }),
      trade({ pnl: 5, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: -3, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("pnl == 0 does NOT reset or increment the streak", () => {
    const trades = [
      trade({ id: "t1", pnl: -10, close_time: "2025-01-10T10:00:00Z", open_time: "2025-01-10T09:00:00Z" }),
      trade({ id: "t2", pnl: 0, close_time: "2025-01-10T10:30:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ id: "t3", pnl: -5, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:30:00Z" }),
      trade({ id: "t4", pnl: 10, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    // After t1 (-10) streak=1, t2 (0) streak=1 (ignored), t3 (-5) streak=2 → breach, t4 is offending
    expect(result["2025-01-10"]).toHaveLength(1);
    expect(result["2025-01-10"][0].tradeIds).toEqual(["t4"]);
  });

  it("streak resets on a win", () => {
    const trades = [
      trade({ pnl: -10, close_time: "2025-01-10T10:00:00Z", open_time: "2025-01-10T09:00:00Z" }),
      trade({ pnl: 5, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: -10, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
      trade({ pnl: 5, close_time: "2025-01-10T13:00:00Z", open_time: "2025-01-10T12:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — max_daily_loss
// ---------------------------------------------------------------------------

describe("evaluateRules — max_daily_loss", () => {
  const r = rule({ id: "r3", rule_type: "max_daily_loss", threshold: 250, rule: "Max daily loss $250" });

  it("flags when net P&L < -threshold", () => {
    const trades = [
      trade({ pnl: -200, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: -100, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
      trade({ pnl: 30, close_time: "2025-01-10T13:00:00Z", open_time: "2025-01-10T12:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(result["2025-01-10"]).toHaveLength(1);
    expect(result["2025-01-10"][0].detail).toContain("270");
    expect(result["2025-01-10"][0].detail).toContain("250");
  });

  it("does NOT flag when net P&L == -threshold (boundary)", () => {
    const trades = [
      trade({ pnl: -150, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: -100, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    // -250 is NOT < -250, so no violation
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("does NOT flag positive days", () => {
    const trades = [
      trade({ pnl: 100, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — manual rules
// ---------------------------------------------------------------------------

describe("evaluateRules — manual rules", () => {
  const r = rule({ id: "r4", rule_type: "manual", rule: "Follow plan" });

  it("is broken only when a matching violation row exists", () => {
    const violations: ManualViolationRow[] = [
      { rule_id: "r4", violation_date: "2025-01-10", note: "Revenge traded" },
    ];
    const result = evaluateRules([r], [], violations);
    expect(result["2025-01-10"]).toHaveLength(1);
    expect(result["2025-01-10"][0].source).toBe("manual");
    expect(result["2025-01-10"][0].detail).toBe("Revenge traded");
  });

  it("is NOT broken when no violation row exists", () => {
    const result = evaluateRules([r], [], []);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("defaults detail to 'Manually flagged' when note is empty", () => {
    const violations: ManualViolationRow[] = [
      { rule_id: "r4", violation_date: "2025-01-10", note: "" },
    ];
    const result = evaluateRules([r], [], violations);
    expect(result["2025-01-10"][0].detail).toBe("Manually flagged");
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — inactive rules ignored
// ---------------------------------------------------------------------------

describe("evaluateRules — inactive rules", () => {
  it("ignores inactive rules entirely", () => {
    const r = rule({ id: "r5", rule_type: "max_trades_per_day", threshold: 1, active: false, rule: "Max 1" });
    const trades = [
      trade({ pnl: 10, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: 20, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
    ];
    const result = evaluateRules([r], trades, []);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateRules — multiple rules on same day
// ---------------------------------------------------------------------------

describe("evaluateRules — multiple rules on same day", () => {
  it("returns multiple violations for the same day", () => {
    const r1 = rule({ id: "r1", rule_type: "max_trades_per_day", threshold: 2, rule: "Max 2" });
    const r2 = rule({ id: "r2", rule_type: "max_daily_loss", threshold: 50, rule: "Max loss $50" });
    const trades = [
      trade({ pnl: -30, close_time: "2025-01-10T10:00:00Z", open_time: "2025-01-10T09:00:00Z" }),
      trade({ pnl: -20, close_time: "2025-01-10T11:00:00Z", open_time: "2025-01-10T10:00:00Z" }),
      trade({ pnl: -10, close_time: "2025-01-10T12:00:00Z", open_time: "2025-01-10T11:00:00Z" }),
    ];
    const result = evaluateRules([r1, r2], trades, []);
    expect(result["2025-01-10"]).toHaveLength(2);
    const sources = result["2025-01-10"].map((v) => v.ruleText);
    expect(sources).toContain("Max 2");
    expect(sources).toContain("Max loss $50");
  });
});

// ---------------------------------------------------------------------------
// summarizeDiscipline
// ---------------------------------------------------------------------------

describe("summarizeDiscipline", () => {
  it("computes correct compliance, P&L split, per-rule counts", () => {
    const violations = {
      "2025-01-10": [
        { ruleId: "r1", ruleText: "Max 3", source: "auto" as const, detail: "..." },
        { ruleId: "r2", ruleText: "Max loss", source: "auto" as const, detail: "..." },
      ],
      "2025-01-12": [
        { ruleId: "r1", ruleText: "Max 3", source: "auto" as const, detail: "..." },
      ],
    };
    const dailyPnl: Record<string, number> = {
      "2025-01-10": -100,
      "2025-01-11": 50,
      "2025-01-12": -30,
      "2025-01-13": 80,
    };
    const summary = summarizeDiscipline(violations, dailyPnl);
    expect(summary.daysTraded).toBe(4);
    expect(summary.daysBroken).toBe(2);
    expect(summary.daysClean).toBe(2);
    expect(summary.compliancePct).toBe(50);
    expect(summary.pnlClean).toBe(130); // 50 + 80
    expect(summary.pnlBroken).toBe(-130); // -100 + -30
    expect(summary.perRuleCounts).toHaveLength(2);
    expect(summary.perRuleCounts[0]).toEqual({ ruleId: "r1", ruleText: "Max 3", count: 2 });
    expect(summary.perRuleCounts[1]).toEqual({ ruleId: "r2", ruleText: "Max loss", count: 1 });
  });

  it("returns 100% compliance when no violations", () => {
    const summary = summarizeDiscipline({}, { "2025-01-10": 50 });
    expect(summary.compliancePct).toBe(100);
    expect(summary.daysClean).toBe(1);
    expect(summary.daysBroken).toBe(0);
  });

  it("returns 100% compliance when no trading days", () => {
    const summary = summarizeDiscipline({}, {});
    expect(summary.compliancePct).toBe(100);
    expect(summary.daysTraded).toBe(0);
  });
});
