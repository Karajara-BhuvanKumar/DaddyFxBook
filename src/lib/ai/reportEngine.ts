// ============================================================
// AI Report Prompt Engine
// Builds a comprehensive, elite-level trading coach prompt
// from all available trader data.
// ============================================================

import type { Trade, Journal, Checklist } from "@/hooks/useTrades";
import type { ScorecardSnapshot } from "@/lib/scoring";
import { buildScorecard } from "@/lib/scoring";
import { buildPeriodStats } from "@/lib/periodStats";
import { MAX_JOURNAL_TEXT_CHARS, MAX_TRADES_PER_PROMPT } from "@/lib/ai/constants";

export interface RawExportData {
  trades: Trade[];
  journals: Journal[];
  checklists: Checklist[];
  screenshots: any[];
}

export interface PromptOptions {
  reportType: "Daily" | "Weekly" | "Monthly" | "Custom" | "Full";
  customInstructions?: string;
  include: {
    trades: boolean;
    journalEntries: boolean;
    strategySetup: boolean;
    emotions: boolean;
    tags: boolean;
    lessonsLearned: boolean;
    screenshots: boolean;
    executionChecklist: boolean;
    backtestData?: boolean;
  };
  backtestSummary?: string;
  tradeReviewGrades?: Array<"A+" | "A" | "B" | "C" | "F">;
}

// Utility to truncate text for token budgeting
function truncate(text: string | null | undefined, maxLen = MAX_JOURNAL_TEXT_CHARS): string {
  if (!text) return "";
  return text.length > maxLen ? text.slice(0, maxLen) + "…" : text;
}

// Build per-trade summary JSON
function buildTradeRow(
  trade: Trade,
  journal: Journal | undefined,
  checklist: Checklist | undefined,
  screenshotCount: number,
  options: PromptOptions,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (options.include.trades) {
    row.symbol = trade.symbol;
    row.direction = trade.direction;
    row.openTime = trade.open_time;
    row.closeTime = trade.close_time;
    row.entry = trade.entry_price;
    row.exit = trade.exit_price;
    row.lot = trade.lot_size;
    row.pnl = trade.pnl;
    row.session = trade.session ?? "Unknown";
    row.sl = trade.stop_loss ?? null;
    row.tp = trade.take_profit ?? null;
  }

  if (journal) {
    if (options.include.journalEntries) {
      row.preTrade = truncate(journal.pre_trade_notes);
      row.postTrade = truncate(journal.post_trade_notes);
      row.riskReward = journal.risk_reward ?? null;
      row.rating = journal.rating ?? null;
    }
    if (options.include.strategySetup) {
      row.strategySetup = truncate(journal.strategy_setup, 200);
    }
    if (options.include.emotions) {
      row.emotions = truncate(journal.emotions, 150);
    }
    if (options.include.tags) {
      row.tags = journal.tags ?? null;
    }
    if (options.include.lessonsLearned) {
      row.lessons = truncate(journal.lessons, 200);
    }
  }

  if (checklist && options.include.executionChecklist) {
    row.checklist = {
      higherTF: checklist.checked_higher_tf,
      riskLimit: checklist.risk_within_limits,
      fitsPlan: checklist.fits_plan,
      keyLevels: checklist.key_levels,
      newsChecked: checklist.news_checked,
    };
  }

  if (options.include.screenshots && screenshotCount > 0) {
    row.screenshots = screenshotCount;
  }

  return row;
}

// Compute derived metrics for the prompt
function computeMetrics(trades: Trade[], journals: Journal[], checklists: Checklist[], tradeReviewGrades: Array<"A+" | "A" | "B" | "C" | "F">) {
  const scorecard = buildScorecard(trades, journals, checklists, tradeReviewGrades);
  const stats = buildPeriodStats(trades);

  // Day-of-week analysis
  const byDow: Record<string, { count: number; pnl: number; wins: number }> = {};
  trades.forEach(t => {
    const dow = new Date(t.close_time).toLocaleDateString("en-US", { weekday: "long" });
    byDow[dow] ??= { count: 0, pnl: 0, wins: 0 };
    byDow[dow].count++;
    byDow[dow].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) byDow[dow].wins++;
  });

  // Lot size variance (overtrading/revenge proxy)
  const lots = trades.map(t => Number(t.lot_size));
  const avgLot = lots.reduce((a, b) => a + b, 0) / (lots.length || 1);

  // Detect revenge trades: loss followed <30min by bigger lot
  const sorted = [...trades].sort((a, b) => +new Date(a.close_time) - +new Date(b.close_time));
  const revengeTrades: { symbol: string; date: string; lotIncrease: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gapMin = (+new Date(curr.open_time) - +new Date(prev.close_time)) / 60000;
    if (Number(prev.pnl) < 0 && gapMin < 30 && Number(curr.lot_size) > Number(prev.lot_size) * 1.4) {
      revengeTrades.push({ symbol: curr.symbol, date: curr.open_time, lotIncrease: Number(curr.lot_size) / Number(prev.lot_size) });
    }
  }

  // Consecutive loss streaks
  let curL = 0; const lossStreaks: number[] = [];
  for (const t of sorted) {
    if (Number(t.pnl) < 0) { curL++; } else { if (curL > 1) lossStreaks.push(curL); curL = 0; }
  }
  if (curL > 1) lossStreaks.push(curL);

  // Profit factor
  const grossProfit = trades.filter(t => Number(t.pnl) > 0).reduce((s, t) => s + Number(t.pnl), 0);
  const grossLoss = Math.abs(trades.filter(t => Number(t.pnl) < 0).reduce((s, t) => s + Number(t.pnl), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Time-of-day analysis
  const byHour: Record<number, { count: number; pnl: number; wins: number }> = {};
  trades.forEach(t => {
    const h = new Date(t.open_time).getUTCHours();
    byHour[h] ??= { count: 0, pnl: 0, wins: 0 };
    byHour[h].count++;
    byHour[h].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) byHour[h].wins++;
  });

  return {
    scorecard,
    stats,
    byDow,
    avgLot,
    revengeTrades,
    lossStreaks,
    profitFactor,
    byHour,
  };
}

// ============================================================
// Main prompt builder
// ============================================================
export function buildAIReportPrompt(data: RawExportData, options: PromptOptions): string {
  const { trades, journals, checklists, screenshots } = data;

  // Cap trades to prevent token overflow
  const cappedTrades = trades.slice(0, MAX_TRADES_PER_PROMPT);
  const journalMap = new Map(journals.map(j => [j.trade_id, j]));
  const checklistMap = new Map(checklists.map(c => [c.trade_id, c]));
  const screenshotMap: Record<string, number> = {};
  screenshots.forEach(s => { screenshotMap[s.trade_id] = (screenshotMap[s.trade_id] ?? 0) + 1; });

  const tradeReviewGrades = (options.tradeReviewGrades ?? []) as Array<"A+" | "A" | "B" | "C" | "F">;
  const metrics = computeMetrics(cappedTrades, journals, checklists, tradeReviewGrades);
  const { scorecard, stats, byDow, avgLot, revengeTrades, lossStreaks, profitFactor, byHour } = metrics;

  // Trade rows
  const tradeRows = cappedTrades.map(t =>
    buildTradeRow(t, journalMap.get(t.id), checklistMap.get(t.id), screenshotMap[t.id] ?? 0, options)
  );

  // Emotional keywords aggregated
  const emotionKeywords: string[] = [];
  if (options.include.emotions) {
    journals.forEach(j => {
      if (j.emotions) emotionKeywords.push(j.emotions);
    });
  }

  // Strategy setups aggregated
  const strategyCounts: Record<string, number> = {};
  if (options.include.strategySetup) {
    journals.forEach(j => {
      if (j.strategy_setup) {
        const k = j.strategy_setup.slice(0, 30);
        strategyCounts[k] = (strategyCounts[k] ?? 0) + 1;
      }
    });
  }

  const systemInstruction = `You are an elite trading performance coach, risk manager, trading psychologist, and data analyst. You have 20+ years of prop firm experience. You are reviewing a trader's complete data. Your analysis must be:
- 100% data-driven. Never hallucinate or invent insights.
- Brutally honest but always constructive and growth-oriented.
- Using professional trading terminology.
- Specific: always reference actual numbers, symbols, dates, and patterns from the data.
- Structured in clean, readable sections.
- Action-oriented: every weakness must have a concrete fix.`;

  const prompt = `${systemInstruction}

## REPORT TYPE
${options.reportType} Trading Performance Review

## TRADER DATA SUMMARY
- Period: ${trades.length > 0 ? `${trades[trades.length - 1]?.open_time?.slice(0, 10)} to ${trades[0]?.open_time?.slice(0, 10)}` : "N/A"}
- Total Trades Analyzed: ${cappedTrades.length}
- Trades Capped: ${trades.length > MAX_TRADES_PER_PROMPT ? `Yes (showing latest ${MAX_TRADES_PER_PROMPT} of ${trades.length})` : "No"}
- Win Rate: ${(stats.win_rate * 100).toFixed(1)}%
- Net P&L: $${stats.net_pnl}
- Gross Profit: $${stats.gross_profit}
- Gross Loss: $${stats.gross_loss}
- Profit Factor: ${profitFactor.toFixed(2)}
- Average R:R: ${stats.avg_rr}R
- Best Trade: ${stats.best_trade ? `+$${stats.best_trade.pnl} on ${stats.best_trade.symbol}` : "N/A"}
- Worst Trade: ${stats.worst_trade ? `$${stats.worst_trade.pnl} on ${stats.worst_trade.symbol}` : "N/A"}
- Win Streak: ${stats.longest_streak.wins}
- Loss Streak: ${stats.longest_streak.losses}
- Average Lot Size: ${avgLot.toFixed(2)}
- Journals Submitted: ${journals.length}/${trades.length}

## SCORECARD (Pre-computed)
- Overall Score: ${scorecard.overall}/100 (${scorecard.classification})
- Discipline: ${scorecard.discipline.score}/100
- Risk Management: ${scorecard.risk.score}/100
- Execution: ${scorecard.execution.score}/100
- Psychology: ${scorecard.psychology.score}/100
- Consistency: ${scorecard.consistency.score}/100

## SESSION PERFORMANCE
${JSON.stringify(stats.by_session, null, 2)}

## SYMBOL PERFORMANCE
${JSON.stringify(stats.by_symbol, null, 2)}

## DAY-OF-WEEK PERFORMANCE
${JSON.stringify(byDow, null, 2)}

## TOP 5 HOURS BY TRADE COUNT (UTC)
${Object.entries(byHour).sort((a, b) => b[1].count - a[1].count).slice(0, 5).map(([h, v]) => `UTC ${h}:00 — ${v.count} trades, P&L $${v.pnl.toFixed(2)}, WR ${v.count > 0 ? ((v.wins / v.count) * 100).toFixed(0) : 0}%`).join("\n")}

## SUSPECTED REVENGE TRADES (${revengeTrades.length})
${revengeTrades.length ? JSON.stringify(revengeTrades, null, 2) : "None detected."}

## LOSS STREAKS DETECTED
${lossStreaks.length ? lossStreaks.map((l, i) => `Streak ${i + 1}: ${l} consecutive losses`).join("\n") : "No significant loss streaks."}

${options.include.emotions && emotionKeywords.length ? `## EMOTIONAL NOTES SUMMARY\n${emotionKeywords.slice(0, 20).join(" | ")}` : ""}

${options.include.strategySetup && Object.keys(strategyCounts).length ? `## STRATEGY SETUP DISTRIBUTION\n${JSON.stringify(strategyCounts, null, 2)}` : ""}

${options.backtestSummary ? `## BACKTESTING COMPARISON\n${options.backtestSummary}` : ""}

${options.customInstructions ? `## COACH INSTRUCTIONS FROM TRADER\n${options.customInstructions}` : ""}

## DETAILED TRADE DATA
${JSON.stringify(tradeRows, null, 2)}

---

## YOUR TASK

Generate a full, elite-level trading performance report. Every section must be directly justified by the data above. Do not invent insights.

Structure your response EXACTLY in this Markdown format:

# TRADING PERFORMANCE REPORT

## 1. Executive Summary
[2-3 paragraph overview of the trader's overall performance, major trends, and the single most impactful finding]

## 2. Overall Performance Score
[Score breakdown table and explanation of each pillar]

## 3. Risk Management Analysis
[Detailed analysis of stop-loss usage, position sizing, risk:reward, profit factor, drawdown behavior]

## 4. Win Rate Analysis
[Win rate, when they win, by session, by symbol, by time of day]

## 5. Reward-to-Risk Analysis
[Average RR achieved vs planned. Are they cutting winners or holding losers?]

## 6. Session Analysis
[Which session is best? Worst? What does the data say and why?]

## 7. Time-of-Day Analysis
[UTC hours where performance is best/worst. What patterns explain this?]

## 8. Symbol Analysis
[Which symbols are profitable? Which are costing money? Trade volume vs quality per symbol]

## 9. Long vs Short Performance
[Long trade stats vs Short trade stats. Any directional bias?]

## 10. Best Performing Setup
[Identify the setup generating the most alpha. Be specific.]

## 11. Worst Performing Setup
[What setup is destroying the account? Be specific with examples.]

## 12. Emotional Analysis
[Pattern recognition from emotional notes. What emotions appear most? What triggered them?]

## 13. Psychology Review
[Deep dive into psychological patterns: FOMO, revenge, fear, overconfidence]

## 14. Journal Review
[Journaling consistency. What are the pre-trade plans vs post-trade reality? Any consistent gaps?]

## 15. Rule Violations
[Which trading rules are being broken most often? Use checklist data.]

## 16. Checklist Compliance
[Checklist completion rate and what items are most skipped]

## 17. Strengths
[5 specific strengths backed by data]

## 18. Weaknesses
[5 specific weaknesses backed by data]

## 19. Recurring Mistakes
[Top 3-5 mistakes that keep repeating. Include specific trade examples if available]

## 20. Hidden Patterns
[Non-obvious patterns only visible through data aggregation — e.g., Monday losses, Friday FOMO, etc.]

## 21. Behavioral Biases
[Loss aversion, confirmation bias, recency bias, anchoring detected from trade data]

## 22. Overtrading Detection
[Evidence of overtrading? Days with too many trades? What triggered it?]

## 23. Revenge Trading Detection
[Suspected revenge trades with specific dates and symbols if detected]

## 24. FOMO Detection
[Clustered entries, chasing moves, late setups identified]

## 25. Confidence Analysis
[How does trade size correlate with outcomes? Does the trader bet bigger on winners or losers?]

## 26. Streak Analysis
[Win/loss streak behavior. Does performance change during streaks?]

## 27. Drawdown Analysis
[How is the trader managing drawdowns? Are they stopping when down or doubling down?]

## 28. Consistency Analysis
[Monthly/weekly performance stability. Is performance improving, declining, or erratic?]

## 29. Strategy Quality
[Are the strategies being traded actually profitable? Edge analysis per setup type]

## 30. Execution Quality
[Entry timing, entry vs planned, exit timing — are they executing well?]

## 31. Improvement Priorities
[Top 3 things that will have the most impact if fixed immediately]

## 32. Action Plan
[5 specific, measurable, time-bound action items — not generic advice]

## 33. Weekly Goals
[3 specific goals for next week based on this report]

## 34. Daily Focus
[One single sentence: the #1 thing this trader must focus on every single trading day]

## 35. Final Coach Message
[A direct, personalized, motivational + honest closing message from the AI trading coach to this specific trader]
`;

  return prompt;
}

// ============================================================
// Parse the Gemini Markdown response into a structured object
// ============================================================
export interface ParsedAIReport {
  rawMarkdown: string;
  sections: { title: string; body: string }[];
  executiveSummary: string;
  strengths: string[];
  weaknesses: string[];
  actionPlan: string[];
  weeklyGoals: string[];
  dailyFocus: string;
  coachMessage: string;
  scores: {
    discipline: number;
    risk: number;
    execution: number;
    psychology: number;
    consistency: number;
    overall: number;
    grade: string;
  };
}

function extractSection(markdown: string, header: string): string {
  const pattern = new RegExp(`## ${header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^#]*)`, "i");
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function extractBulletList(text: string): string[] {
  return text
    .split("\n")
    .filter(l => /^[-*•\d]/.test(l.trim()))
    .map(l => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter(Boolean);
}

function extractScoreFromText(text: string, label: string): number {
  const pattern = new RegExp(`${label}[^\\d]*(\\d{1,3})`, "i");
  const m = text.match(pattern);
  return m ? Math.min(100, parseInt(m[1], 10)) : 0;
}

function letterGradeFromScore(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D";
  return "F";
}

export function parseAIReportMarkdown(markdown: string, scorecard: ScorecardSnapshot): ParsedAIReport {
  // Split into numbered sections
  const sectionMatches = [...markdown.matchAll(/^## \d+\. (.+)$/gm)];
  const sections: { title: string; body: string }[] = sectionMatches.map((match, i) => {
    const nextMatch = sectionMatches[i + 1];
    const start = match.index! + match[0].length;
    const end = nextMatch ? nextMatch.index! : markdown.length;
    return {
      title: match[1].trim(),
      body: markdown.slice(start, end).trim(),
    };
  });

  const strengthsSection = extractSection(markdown, "17. Strengths");
  const weaknessesSection = extractSection(markdown, "18. Weaknesses");
  const actionSection = extractSection(markdown, "32. Action Plan");
  const weeklySection = extractSection(markdown, "33. Weekly Goals");
  const dailySection = extractSection(markdown, "34. Daily Focus");
  const coachSection = extractSection(markdown, "35. Final Coach Message");
  const execSection = extractSection(markdown, "1. Executive Summary");

  return {
    rawMarkdown: markdown,
    sections,
    executiveSummary: execSection,
    strengths: extractBulletList(strengthsSection).slice(0, 6),
    weaknesses: extractBulletList(weaknessesSection).slice(0, 6),
    actionPlan: extractBulletList(actionSection).slice(0, 5),
    weeklyGoals: extractBulletList(weeklySection).slice(0, 3),
    dailyFocus: dailySection.replace(/^#.*$/m, "").trim().split("\n").filter(Boolean)[0] ?? "",
    coachMessage: coachSection,
    scores: {
      discipline: scorecard.discipline.score,
      risk: scorecard.risk.score,
      execution: scorecard.execution.score,
      psychology: scorecard.psychology.score,
      consistency: scorecard.consistency.score,
      overall: scorecard.overall,
      grade: letterGradeFromScore(scorecard.overall),
    },
  };
}
