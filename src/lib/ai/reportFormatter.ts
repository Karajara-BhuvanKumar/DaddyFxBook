// ============================================================
// Report Formatter
// Converts raw AI Markdown into structured UI-ready shapes.
// Supports: Markdown (raw), TXT, copy-to-clipboard.
// PDF/DOCX are handled by the existing exportUtils.ts.
// ============================================================

import type { ScorecardSnapshot } from "@/lib/scoring";

export interface ReportSection {
  number: number;
  title: string;
  body: string;
  tone: "default" | "success" | "warning" | "danger";
}

export interface FormattedReport {
  rawMarkdown: string;
  sections: ReportSection[];
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
    classification: string;
  };
  meta: {
    provider: string;
    model: string;
    generatedAt: string;
    latencyMs?: number;
    tradeCount: number;
    wasCapped: boolean;
  };
}

// ── Helpers ───────────────────────────────────────────────────

function letterGrade(score: number): string {
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

function sectionTone(title: string): ReportSection["tone"] {
  const t = title.toLowerCase();
  if (/strength|best|positive/.test(t)) return "success";
  if (/weak|mistake|violation|revenge|fomo|worst|tilt|danger/.test(t)) return "danger";
  if (/pattern|bias|risk|drawdown|streak|overtrading/.test(t)) return "warning";
  return "default";
}

function extractSection(markdown: string, header: string): string {
  const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`## ${escaped}([^#]*)`, "i");
  return markdown.match(pattern)?.[1]?.trim() ?? "";
}

function extractBullets(text: string, maxItems = 6): string[] {
  return text
    .split("\n")
    .filter((l) => /^[-*•\d]/.test(l.trim()))
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

// ── Main formatter ────────────────────────────────────────────

export function formatAIReport(
  rawMarkdown: string,
  scorecard: ScorecardSnapshot,
  meta: FormattedReport["meta"],
): FormattedReport {
  // Extract all numbered sections
  const sectionMatches = [...rawMarkdown.matchAll(/^## (\d+)\. (.+)$/gm)];
  const sections: ReportSection[] = sectionMatches.map((match, i) => {
    const nextMatch = sectionMatches[i + 1];
    const start = match.index! + match[0].length;
    const end = nextMatch ? nextMatch.index! : rawMarkdown.length;
    const body = rawMarkdown.slice(start, end).trim();
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    return { number, title, body, tone: sectionTone(title) };
  });

  // Extract key sections by known numbers
  const exec = extractSection(rawMarkdown, "1. Executive Summary");
  const strengths = extractBullets(extractSection(rawMarkdown, "17. Strengths"));
  const weaknesses = extractBullets(extractSection(rawMarkdown, "18. Weaknesses"));
  const actionPlan = extractBullets(extractSection(rawMarkdown, "32. Action Plan"), 5);
  const weeklyGoals = extractBullets(extractSection(rawMarkdown, "33. Weekly Goals"), 3);
  const dailyRaw = extractSection(rawMarkdown, "34. Daily Focus");
  const dailyFocus = dailyRaw.replace(/^#.*$/m, "").trim().split("\n").filter(Boolean)[0] ?? "";
  const coachMessage = extractSection(rawMarkdown, "35. Final Coach Message");

  return {
    rawMarkdown,
    sections,
    executiveSummary: exec,
    strengths,
    weaknesses,
    actionPlan,
    weeklyGoals,
    dailyFocus,
    coachMessage,
    scores: {
      discipline: scorecard.discipline.score,
      risk: scorecard.risk.score,
      execution: scorecard.execution.score,
      psychology: scorecard.psychology.score,
      consistency: scorecard.consistency.score,
      overall: scorecard.overall,
      grade: letterGrade(scorecard.overall),
      classification: scorecard.classification,
    },
    meta,
  };
}

// ── Export helpers ────────────────────────────────────────────

/** Plain-text export of the full report. */
export function reportToPlainText(report: FormattedReport): string {
  return [
    `TRADING PERFORMANCE REPORT`,
    `Generated: ${new Date(report.meta.generatedAt).toLocaleString()}`,
    `Provider: ${report.meta.provider} / Model: ${report.meta.model}`,
    `Trades analyzed: ${report.meta.tradeCount}${report.meta.wasCapped ? " (capped)" : ""}`,
    `Overall Score: ${report.scores.overall}/100 (${report.scores.grade} — ${report.scores.classification})`,
    "",
    "─".repeat(60),
    "",
    report.rawMarkdown,
  ].join("\n");
}
