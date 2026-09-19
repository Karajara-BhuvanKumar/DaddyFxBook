/**
 * Rule evaluation logic for trading discipline tracking.
 * Known limitation: day keys are UTC-based, matching the current calendar
 * which uses `close_time.split('T')[0]`. A future change could switch to
 * the user's timezone; when that happens, update getDayKey in ONE place.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuleRow {
  id: string;
  rule: string;
  active: boolean;
  rule_type: string;
  threshold: number | null;
}

export interface TradeRow {
  id: string;
  pnl: number;
  open_time: string;
  close_time: string;
}

export interface ManualViolationRow {
  rule_id: string;
  violation_date: string; // YYYY-MM-DD
  note: string;
}

export interface RuleViolation {
  ruleId: string;
  ruleText: string;
  source: "auto" | "manual";
  detail: string;
  tradeIds?: string[];
}

export interface DisciplineSummary {
  daysTraded: number;
  daysClean: number;
  daysBroken: number;
  compliancePct: number;
  pnlClean: number;
  pnlBroken: number;
  perRuleCounts: { ruleId: string; ruleText: string; count: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the same day bucket the Analysis calendar uses today.
 * Intentionally matches `close_time.split('T')[0]` used elsewhere.
 */
export function getDayKey(isoTimestamp: string): string {
  return isoTimestamp.split("T")[0];
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

export function evaluateRules(
  rules: RuleRow[],
  trades: TradeRow[],
  manualViolations: ManualViolationRow[],
): Record<string, RuleViolation[]> {
  const activeRules = rules.filter((r) => r.active);
  if (activeRules.length === 0) return {};

  // Group trades by day, sorted by open_time within each day
  const dayTrades = new Map<string, TradeRow[]>();
  for (const t of trades) {
    const day = getDayKey(t.close_time);
    const arr = dayTrades.get(day) ?? [];
    arr.push(t);
    dayTrades.set(day, arr);
  }
  for (const arr of dayTrades.values()) {
    arr.sort((a, b) => a.open_time.localeCompare(b.open_time));
  }

  // Index manual violations: Map<ruleId, Set<date>>
  const manualIndex = new Map<string, Map<string, string>>();
  for (const mv of manualViolations) {
    if (!manualIndex.has(mv.rule_id)) manualIndex.set(mv.rule_id, new Map());
    manualIndex.get(mv.rule_id)!.set(mv.violation_date, mv.note);
  }

  const result: Record<string, RuleViolation[]> = {};

  const addViolation = (day: string, v: RuleViolation) => {
    if (!result[day]) result[day] = [];
    result[day].push(v);
  };

  for (const rule of activeRules) {
    if (rule.rule_type === "manual") {
      // Manual rules: broken only if a matching row exists in rule_violations
      const dateMap = manualIndex.get(rule.id);
      if (dateMap) {
        for (const [date, note] of dateMap.entries()) {
          addViolation(date, {
            ruleId: rule.id,
            ruleText: rule.rule,
            source: "manual",
            detail: note || "Manually flagged",
          });
        }
      }
    } else if (rule.rule_type === "max_trades_per_day") {
      const limit = rule.threshold ?? 0;
      for (const [day, dayArr] of dayTrades.entries()) {
        if (dayArr.length > limit) {
          const offending = dayArr.slice(limit).map((t) => t.id);
          addViolation(day, {
            ruleId: rule.id,
            ruleText: rule.rule,
            source: "auto",
            detail: `${dayArr.length} trades (limit ${limit})`,
            tradeIds: offending,
          });
        }
      }
    } else if (rule.rule_type === "max_consecutive_losses") {
      const limit = rule.threshold ?? 0;
      for (const [day, dayArr] of dayTrades.entries()) {
        let streak = 0;
        let breached = false;
        const offending: string[] = [];
        for (const t of dayArr) {
          const pnl = Number(t.pnl);
          if (pnl < 0) {
            streak++;
          } else if (pnl > 0) {
            streak = 0;
          }
          // pnl === 0 is ignored (doesn't reset or increment)
          if (breached) {
            offending.push(t.id);
          } else if (streak >= limit) {
            breached = true;
            // Every LATER trade is a violation — not the ones in the streak
          }
        }
        if (breached && offending.length > 0) {
          addViolation(day, {
            ruleId: rule.id,
            ruleText: rule.rule,
            source: "auto",
            detail: `Traded after ${limit} consecutive losses`,
            tradeIds: offending,
          });
        } else if (breached) {
          // Breached but no trade after — still flag the day
          addViolation(day, {
            ruleId: rule.id,
            ruleText: rule.rule,
            source: "auto",
            detail: `${limit} consecutive losses reached`,
          });
        }
      }
    } else if (rule.rule_type === "max_daily_loss") {
      const limit = rule.threshold ?? 0;
      for (const [day, dayArr] of dayTrades.entries()) {
        const netPnl = dayArr.reduce((s, t) => s + Number(t.pnl), 0);
        if (netPnl < -limit) {
          addViolation(day, {
            ruleId: rule.id,
            ruleText: rule.rule,
            source: "auto",
            detail: `-$${Math.abs(netPnl).toFixed(0)} (limit -$${limit})`,
            tradeIds: dayArr.map((t) => t.id),
          });
        }
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Discipline summary
// ---------------------------------------------------------------------------

export function summarizeDiscipline(
  violations: Record<string, RuleViolation[]>,
  dailyPnl: Record<string, number>,
): DisciplineSummary {
  const tradedDays = Object.keys(dailyPnl);
  const daysTraded = tradedDays.length;
  const brokenDaySet = new Set(Object.keys(violations));
  const daysBroken = tradedDays.filter((d) => brokenDaySet.has(d)).length;
  const daysClean = daysTraded - daysBroken;
  const compliancePct = daysTraded > 0 ? (daysClean / daysTraded) * 100 : 100;

  let pnlClean = 0;
  let pnlBroken = 0;
  for (const day of tradedDays) {
    if (brokenDaySet.has(day)) {
      pnlBroken += dailyPnl[day];
    } else {
      pnlClean += dailyPnl[day];
    }
  }

  // Per-rule counts
  const ruleCounts = new Map<string, { ruleText: string; count: number }>();
  for (const dayViolations of Object.values(violations)) {
    for (const v of dayViolations) {
      const existing = ruleCounts.get(v.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleCounts.set(v.ruleId, { ruleText: v.ruleText, count: 1 });
      }
    }
  }

  const perRuleCounts = Array.from(ruleCounts.entries())
    .map(([ruleId, { ruleText, count }]) => ({ ruleId, ruleText, count }))
    .sort((a, b) => b.count - a.count);

  return { daysTraded, daysClean, daysBroken, compliancePct, pnlClean, pnlBroken, perRuleCounts };
}
