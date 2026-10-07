import type { Trade, Journal, Checklist } from "@/hooks/useTrades";
import type { TradingRule, RuleViolationRow } from "@/hooks/useRules";
import type { IncludeFlags } from "@/lib/ai";

export type Period = "Daily" | "Weekly" | "Monthly" | "Custom" | "All Time";
export type Dimension = "discipline" | "risk" | "execution" | "psychology" | "consistency";
export const DIMENSIONS: Record<Dimension, string> = { discipline: "Discipline", risk: "Risk management", execution: "Execution", psychology: "Psychology", consistency: "Consistency" };
export const SOURCE_LABELS: Record<keyof IncludeFlags, string> = { trades: "Trade performance", journalEntries: "Journal notes", strategySetup: "Strategies & setups", emotions: "Emotions", tags: "Tags", lessonsLearned: "Lessons learned", screenshots: "Screenshot coverage", executionChecklist: "Checklists & rules" };
export const DEFAULT_SOURCES: IncludeFlags = { trades: true, journalEntries: true, strategySetup: true, emotions: true, tags: true, lessonsLearned: true, screenshots: false, executionChecklist: true };
export interface CoachData {
  trades: Trade[];
  journals: Journal[];
  checklists: Checklist[];
  screenshots: { id: string; trade_id: string }[];
  rules: TradingRule[];
  violations: RuleViolationRow[];
  warnings: string[];
}
export interface WindowRange { period: Period; start: string | null; end: string; previousStart: string | null; label: string; timezone: string }
export interface Evidence { id: string; title: string; observation: string; tradeIds: string[]; totalRecords: number }
export interface Measure { dimension: Dimension; label: string; score: number | null; formula: string; detail: string; limitation: string; evidenceIds: string[] }
export interface Comparison { label: string; current: number; previous: number; unit: string; direction: "up" | "down" | "neutral"; evidenceId: string }
export interface CoachAnalysis {
  window: WindowRange;
  include: IncludeFlags;
  evidence: Evidence[];
  measures: Measure[];
  comparisons: Comparison[];
  comparisonNote: string;
  tradeCount: number;
  journalCount: number;
  checklistCount: number;
  sampleCount: number;
  samples: Record<string, unknown>[];
  limitations: string[];
  records: { id: string; date: string; symbol?: string; pnl?: number }[];
}
