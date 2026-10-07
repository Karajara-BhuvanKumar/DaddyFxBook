import { describe, expect, it, beforeEach } from "vitest";
import { analyzeCoachData } from "@/lib/coach/analysis";
import { resolveCoachWindow } from "@/lib/coach/period";
import { buildCoachPrompt, coachReportSchema, parseCoachReport, readSavedReviews, saveReview } from "@/lib/coach/report";
import type { CoachReport, SavedCoachReport } from "@/lib/coach/report";
import { DEFAULT_SOURCES, type CoachData } from "@/lib/coach/types";
import type { Trade, Journal, Checklist } from "@/hooks/useTrades";

const trade = (id: string, patch: Partial<Trade> = {}): Trade => ({ id, user_id: "user", symbol: "XAUUSD", direction: "Long", entry_price: 2000, exit_price: 2001, lot_size: 1, pnl: 100, stop_loss: 1990, take_profit: 2030, open_time: "2026-10-05T09:00:00Z", close_time: "2026-10-05T10:00:00Z", session: "London", source: "manual", created_at: "", updated_at: "", ...patch });
const journal = (id: string, patch: Partial<Journal> = {}): Journal => ({ id: `j-${id}`, trade_id: id, user_id: "user", pre_trade_notes: "Waited patiently", post_trade_notes: "Avoided FOMO", emotions: "FOMO resisted", lessons: "Wait for confirmation", tags: "patience", strategy_setup: JSON.stringify({ htf_tf: "H1", htf_level: "SBR", market_session: "Off Session London" }), risk_reward: "1:3", rating: 4, created_at: "", updated_at: "", ...patch });
const checklist = (id: string, patch: Partial<Checklist> = {}): Checklist => ({ id: `c-${id}`, trade_id: id, user_id: "user", checked_higher_tf: true, risk_within_limits: true, fits_plan: true, key_levels: true, news_checked: true, ...patch });
const data = (trades: Trade[], journals: Journal[] = [], checklists: Checklist[] = []): CoachData => ({ trades, journals, checklists, screenshots: [], rules: [], violations: [], warnings: [] });
const range = resolveCoachWindow("Weekly", "", "", new Date("2026-10-07T12:00:00Z"));
const context = () => analyzeCoachData(data([trade("t1"), trade("t2"), trade("t3")]), range, DEFAULT_SOURCES);
const report = (): CoachReport => ({ verdict: { headline: "Document your process", summary: "There are gaps in the recorded process.", condition: "Building a foundation", evidenceIds: ["coverage"] }, insights: [{ id: "document-process", title: "Make preparation visible", priority: "Watch", dimension: "discipline", interpretation: "Without checklists the process remains uncertain.", evidenceIds: ["coverage"], rootCause: null, action: "Complete a checklist for your next 5 trades.", measurement: "5 of 5 trades have a checklist." }], dimensions: (["discipline", "risk", "execution", "psychology", "consistency"] as const).map(dimension => ({ dimension, assessment: "Limited recorded context.", evidenceIds: ["coverage"], confidence: "Tentative" })), nextPlan: { focus: "Record the process before entering", items: [{ label: "Main rule", instruction: "Complete the checklist before each entry.", evidenceIds: ["coverage"] }] }, limitations: ["Small sample"] });

describe("Performance coach evidence", () => {
  it("uses inclusive starts, exclusive ends and a previous equal-duration window", () => {
    expect(range.start).toBe("2026-09-30T12:00:00.000Z");
    const result = analyzeCoachData(data([trade("start", { open_time: range.start! }), trade("end", { open_time: range.end }), trade("prior", { open_time: range.previousStart! })]), range, DEFAULT_SOURCES);
    expect(result.tradeCount).toBe(1);
    expect(result.samples[0].record).toBe("start");
  });
  it("includes the custom end day and rejects missing or reversed dates", () => {
    const custom = resolveCoachWindow("Custom", "2026-10-01", "2026-10-03", new Date("2026-10-07T12:00:00Z"));
    expect(new Date(custom.end).getDate()).toBe(4);
    expect(() => resolveCoachWindow("Custom", "", "")).toThrow();
    expect(() => resolveCoachWindow("Custom", "2026-10-04", "2026-10-01")).toThrow(/end date/);
    expect(() => resolveCoachWindow("Custom", "2026-02-30", "2026-03-01")).toThrow(/valid/);
  });
  it("computes drawdown from zero and handles breakevens without treating them as losses", () => {
    const result = analyzeCoachData(data([trade("a", { pnl: -100, close_time: "2026-10-05T10:00:00Z" }), trade("b", { pnl: 0 }), trade("c", { pnl: 300 })]), range, DEFAULT_SOURCES);
    expect(result.evidence.find(e => e.id === "drawdown")?.observation).toContain("100 account units");
    expect(result.evidence.find(e => e.id === "outcomes")?.observation).toContain("1 wins, 1 losses, 1 breakeven");
    expect(result.evidence.find(e => e.id === "outcomes")?.observation).toContain("3:1");
  });
  it("does not turn overlapping positions into revenge-trading flags", () => {
    const result = analyzeCoachData(data([trade("loss", { pnl: -100 }), trade("overlap", { open_time: "2026-10-05T09:30:00Z", lot_size: 3 }), trade("after", { open_time: "2026-10-05T10:15:00Z", close_time: "2026-10-05T11:00:00Z", lot_size: 2 })]), range, DEFAULT_SOURCES);
    expect(result.evidence.find(e => e.id === "loss-response")?.tradeIds).not.toContain("overlap");
  });
  it("distinguishes mentions from diagnoses and uses explicit off-session labels", () => {
    const result = analyzeCoachData(data([trade("a")], [journal("a")]), range, DEFAULT_SOURCES);
    expect(result.evidence.find(e => e.id === "mention-fomo")?.observation).toContain("resisting, avoiding or experiencing");
    expect(result.evidence.find(e => e.id === "off-session")?.observation).toContain("1 trades explicitly marked");
  });
  it("does not leak excluded journal fields through aggregates or detailed records", () => {
    const include = { ...DEFAULT_SOURCES, journalEntries: false, emotions: false, tags: false, lessonsLearned: false, strategySetup: false };
    const result = analyzeCoachData(data([trade("a")], [journal("a")]), range, include);
    const prompt = buildCoachPrompt(result, "");
    for (const secret of ["Waited patiently", "Avoided FOMO", "FOMO resisted", "Wait for confirmation", "Off Session London", "SBR", '"patience"']) expect(prompt).not.toContain(secret);
    expect(result.evidence.some(e => e.id.startsWith("journal-"))).toBe(false);
  });
  it("excludes performance metrics when trades are unchecked", () => {
    const result = analyzeCoachData(data([trade("a", { pnl: 987654, symbol: "SECRET_SYMBOL", lot_size: 42 })], [journal("a")]), range, { ...DEFAULT_SOURCES, trades: false });
    const prompt = buildCoachPrompt(result, "");
    expect(prompt).not.toContain("987654"); expect(prompt).not.toContain("SECRET_SYMBOL");
    expect(result.evidence.some(e => ["outcomes", "drawdown", "loss-response", "stops"].includes(e.id))).toBe(false);
    expect(result.measures.find(m => m.dimension === "risk")?.score).toBeNull();
  });
  it("treats null checklist fields as unknown and missing data as unscored", () => {
    const trades = [trade("a"), trade("b"), trade("c")];
    const checks = trades.map(t => checklist(t.id, { news_checked: null, fits_plan: null }));
    const result = analyzeCoachData(data(trades, [], checks), range, DEFAULT_SOURCES);
    expect(result.measures.find(m => m.dimension === "discipline")?.score).toBe(100);
    const missing = analyzeCoachData(data(trades), range, DEFAULT_SOURCES);
    expect(missing.measures.find(m => m.dimension === "discipline")?.score).toBeNull();
    expect(missing.measures.find(m => m.dimension === "consistency")?.score).toBeNull();
  });
  it("uses all trades in aggregates and discloses detailed sampling", () => {
    const result = analyzeCoachData(data(Array.from({ length: 1205 }, (_, i) => trade(`t-${i}`))), range, DEFAULT_SOURCES);
    expect(result.tradeCount).toBe(1205); expect(result.sampleCount).toBe(160);
    expect(result.evidence.find(e => e.id === "outcomes")?.observation).toContain("1205 trades");
    expect(result.limitations.some(l => l.includes("1205 selected trades"))).toBe(true);
  });
  it("reports failed optional sources as unknown rather than zero violations or adherence", () => {
    const input = data([trade("a"), trade("b"), trade("c")]);
    input.warnings = ["journals", "checklists", "trading rules", "rule violations", "screenshots"].map(source => `${source} could not be loaded; this source is unavailable.`);
    const result = analyzeCoachData(input, range, { ...DEFAULT_SOURCES, screenshots: true });
    expect(result.evidence.find(e => e.id === "rules")?.observation).toContain("count is unknown");
    expect(result.evidence.find(e => e.id === "rules")?.observation).not.toContain("0 manually logged");
    expect(result.evidence.find(e => e.id === "checklists")?.observation).toContain("unknown");
    expect(result.evidence.find(e => e.id === "screenshots")?.observation).toContain("unknown");
    expect(result.measures.find(m => m.dimension === "psychology")?.score).toBeNull();
  });
  it("requires both periods to have enough data and suppresses all-time comparisons", () => {
    const now = Array.from({ length: 5 }, (_, i) => trade(`a-${i}`));
    const prior = Array.from({ length: 5 }, (_, i) => trade(`b-${i}`, { open_time: "2026-09-28T12:00:00Z", pnl: -100 }));
    expect(analyzeCoachData(data(now.concat(prior)), range, DEFAULT_SOURCES).comparisons.length).toBeGreaterThan(0);
    expect(analyzeCoachData(data(now.concat(prior.slice(0, 4))), range, DEFAULT_SOURCES).comparisons).toEqual([]);
    expect(analyzeCoachData(data(now.concat(prior)), resolveCoachWindow("All Time"), DEFAULT_SOURCES).comparisons).toEqual([]);
  });
});

describe("Structured performance reviews", () => {
  beforeEach(() => localStorage.clear());
  it("accepts cited structured reports and rejects fabricated evidence or duplicate dimensions", () => {
    expect(parseCoachReport(JSON.stringify(report()), context()).insights).toHaveLength(1);
    const fabricated = report(); fabricated.insights[0].evidenceIds = ["invented"];
    expect(() => parseCoachReport(JSON.stringify(fabricated), context())).toThrow(/outside/);
    const duplicate = report(); duplicate.dimensions[1].dimension = "discipline";
    expect(() => parseCoachReport(JSON.stringify(duplicate), context())).toThrow(/duplicate/);
    expect(() => parseCoachReport('{"verdict":', context())).toThrow(/incomplete/);
  });
  it("rejects unsupported conclusions and limits immediate priorities to three", () => {
    const unsupported = report(); unsupported.dimensions[0].confidence = "Supported"; unsupported.dimensions[0].evidenceIds = [];
    expect(() => parseCoachReport(JSON.stringify(unsupported), context())).toThrow(/unsupported/);
    const tooMany = report(); tooMany.insights = Array.from({ length: 4 }, (_, i) => ({ ...tooMany.insights[0], id: `priority-${i}`, priority: "High priority" }));
    expect(() => parseCoachReport(JSON.stringify(tooMany), context())).toThrow(/focused/);
  });
  it("keeps saved reports isolated per user, caps history and omits raw prompt samples", () => {
    const saved: SavedCoachReport = { version: 1, id: "one", generatedAt: new Date().toISOString(), report: report(), analysis: context(), instructions: "" };
    for (let i = 0; i < 7; i++) saveReview("a", { ...saved, id: String(i) });
    expect(readSavedReviews("a")).toHaveLength(5);
    expect(readSavedReviews("a")[0].analysis.samples).toEqual([]);
    expect(readSavedReviews("b")).toEqual([]);
    expect(coachReportSchema.safeParse(report()).success).toBe(true);
  });
  it("ignores corrupted saved snapshots without breaking valid history", () => {
    const saved: SavedCoachReport = { version: 1, id: "valid", generatedAt: new Date().toISOString(), report: report(), analysis: context(), instructions: "" };
    const broken = { ...saved, id: "broken", analysis: { ...saved.analysis, measures: [null, {}, "bad", {}, {}] } };
    localStorage.setItem("dfb-coach-reviews-v1:a", JSON.stringify([broken, saved]));
    expect(readSavedReviews("a").map(r => r.id)).toEqual(["valid"]);
  });
});
