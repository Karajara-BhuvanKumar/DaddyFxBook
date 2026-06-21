export type Grade = "A+" | "A" | "B" | "C" | "F";

export interface Strength {
  title: string;
  description: string;
  evidence: string;
  category: "setup" | "session" | "winrate" | "day" | "instrument" | "risk_reward" | "execution";
}

export interface Weakness {
  title: string;
  description: string;
  evidence: string;
  severity: "low" | "medium" | "high";
  category:
    | "overtrading"
    | "revenge_trading"
    | "fomo"
    | "early_exit"
    | "late_exit"
    | "risk_management"
    | "session_discipline"
    | "rule_break";
}

export interface Suggestion {
  title: string;
  action: string;
  rationale: string;
  priority: "low" | "medium" | "high";
}

export interface TradeReview {
  trade_id: string;
  grade: Grade;
  went_right: string[];
  went_wrong: string[];
  improvements: string[];
  summary: string;
}

export interface AIReport {
  strengths: Strength[];
  weaknesses: Weakness[];
  suggestions: Suggestion[];
  trade_reviews: TradeReview[];
}
