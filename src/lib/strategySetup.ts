export const HTF_TIMEFRAMES = ["Daily", "H4", "H1"] as const;
export const LTF_TIMEFRAMES = ["M15", "M5", "M1"] as const;
export const CONFIRM_TIMEFRAMES = ["M1", "M5"] as const;
export const FIB_TIMEFRAMES = ["Daily", "H4", "H1", "M15", "M5", "M1"] as const;
export const LEVEL_TYPES = ["TJL 1", "TJL 2", "SBR", "RBS", "DT", "DB", "QML", "ISS Level 3", "ISS Level 4"] as const;
export const CONFIRM_TYPES = ["CC Star", "CC Engulfing", "SBR", "RBS", "QML", "ISS Level 3", "ISS Level 4"] as const;
export const CONFLUENCES = ["FIB Zone", "SL Outside Zone", "Liquidity Sweep", "Fib of Zone"] as const;
export const MARKET_SESSIONS = ["Asian", "London", "New York", "London Killzone", "New York Killzone"] as const;

export type StrategySetup = {
  htf_tf: string;
  htf_level: string;
  ltf_tf: string;
  ltf_level: string;
  conf_tf: string;
  conf_type: string;
  confluences: string[];
  fib_tf: string;
  market_session: string;
  bias: string;
};

export const emptyStrategySetup: StrategySetup = {
  htf_tf: "",
  htf_level: "",
  ltf_tf: "",
  ltf_level: "",
  conf_tf: "",
  conf_type: "",
  confluences: [],
  fib_tf: "",
  market_session: "",
  bias: "",
};

export function buildStrategySummary(s: StrategySetup): string {
  const lines: string[] = [];

  if (s.htf_tf || s.htf_level) {
    lines.push("HTF:");
    lines.push([s.htf_tf, s.htf_level].filter(Boolean).join(" "));
  }
  if (s.ltf_tf || s.ltf_level) {
    if (lines.length) lines.push("");
    lines.push("LTF:");
    lines.push([s.ltf_tf, s.ltf_level].filter(Boolean).join(" "));
  }
  if (s.conf_tf || s.conf_type) {
    if (lines.length) lines.push("");
    lines.push("Confirmation:");
    lines.push([s.conf_tf, s.conf_type].filter(Boolean).join(" "));
  }
  if (s.confluences.length) {
    if (lines.length) lines.push("");
    lines.push("Confluences:");
    const parts = s.confluences.map((c) =>
      c === "FIB Zone" && s.fib_tf ? `${c} (${s.fib_tf})` : c
    );
    lines.push(parts.join(" + "));
  }
  if (s.market_session) {
    if (lines.length) lines.push("");
    lines.push("Session:");
    lines.push(s.market_session);
  }
  if (s.bias) {
    if (lines.length) lines.push("");
    lines.push("Bias:");
    lines.push(s.bias);
  }

  return lines.join("\n");
}

export function parseStrategySetup(raw: string | null | undefined): StrategySetup {
  if (!raw) return { ...emptyStrategySetup };
  try {
    const parsed = JSON.parse(raw) as Partial<StrategySetup>;
    return { ...emptyStrategySetup, ...parsed };
  } catch {
    return { ...emptyStrategySetup };
  }
}

export function serializeStrategySetup(s: StrategySetup): string {
  return JSON.stringify(s);
}
