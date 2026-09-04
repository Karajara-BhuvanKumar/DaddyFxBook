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
  if (!raw) return { ...emptyStrategySetup, confluences: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<StrategySetup>;
    return { ...emptyStrategySetup, confluences: [], ...parsed };
  } catch {
    return { ...emptyStrategySetup, confluences: [] };
  }
}

export function serializeStrategySetup(s: StrategySetup): string {
  return JSON.stringify(s);
}

/**
 * Build a single-line composite key from a StrategySetup for aggregation grouping.
 * Example: "M15 TJL 1 Confirmation: M1 CC Engulfing Confluences: SL Outside Zone"
 * Returns "Unspecified" if no meaningful fields are set.
 */
export function buildSetupKey(s: StrategySetup): string {
  const parts: string[] = [];

  const ltf = [s.ltf_tf, s.ltf_level].filter(Boolean).join(" ");
  if (ltf) parts.push(ltf);

  const conf = [s.conf_tf, s.conf_type].filter(Boolean).join(" ");
  if (conf) parts.push(`Confirmation: ${conf}`);

  if (s.confluences.length) {
    const confluenceParts = s.confluences.map((c) =>
      c === "FIB Zone" && s.fib_tf ? `${c} (${s.fib_tf})` : c
    );
    parts.push(`Confluences: ${confluenceParts.join(" + ")}`);
  }

  return parts.length > 0 ? parts.join(" ") : "Unspecified";
}

/**
 * Build a broad composite key from a StrategySetup for high-level grouping.
 * Example: "H4 SBR / M15 TJL 1 / Bearish"
 * Groups by HTF, LTF, and Bias only. Returns "Unspecified" if no meaningful fields are set.
 */
export function buildBroadSetupKey(s: StrategySetup): string {
  const parts: string[] = [];

  const htf = [s.htf_tf, s.htf_level].filter(Boolean).join(" ");
  if (htf) parts.push(htf);

  const ltf = [s.ltf_tf, s.ltf_level].filter(Boolean).join(" ");
  if (ltf) parts.push(ltf);

  if (s.bias) parts.push(s.bias);

  return parts.length > 0 ? parts.join(" / ") : "Unspecified";
}

/**
 * Parse a multi-line backtest setup text (as stored in backtest_trades.setup)
 * back into a StrategySetup object. Best-effort parsing.
 */
export function parseSetupText(text: string | null | undefined): StrategySetup {
  const s: StrategySetup = { ...emptyStrategySetup, confluences: [] };
  if (!text) return s;

  const lines = text.split("\n");
  const parseTwo = (rest: string, tfs: readonly string[], levels: readonly string[]) => {
    const tf = tfs.find((t) => rest.startsWith(t + " ") || rest === t) ?? "";
    const remaining = tf ? rest.slice(tf.length).trim() : rest;
    const level = levels.find((l) => remaining === l) ?? "";
    return { tf, level };
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("HTF:")) {
      const r = parseTwo(trimmed.slice(4).trim(), HTF_TIMEFRAMES, LEVEL_TYPES);
      s.htf_tf = r.tf; s.htf_level = r.level;
    } else if (trimmed.startsWith("LTF:")) {
      const r = parseTwo(trimmed.slice(4).trim(), LTF_TIMEFRAMES, LEVEL_TYPES);
      s.ltf_tf = r.tf; s.ltf_level = r.level;
    } else if (trimmed.startsWith("Confirmation:")) {
      const r = parseTwo(trimmed.slice(13).trim(), CONFIRM_TIMEFRAMES, CONFIRM_TYPES);
      s.conf_tf = r.tf; s.conf_type = r.level;
    } else if (trimmed.startsWith("✓")) {
      const rest = trimmed.slice(1).trim();
      const fibMatch = rest.match(/^FIB Zone \(([^)]+)\)$/);
      if (fibMatch) {
        if (!s.confluences.includes("FIB Zone")) s.confluences.push("FIB Zone");
        s.fib_tf = fibMatch[1];
      } else if ((CONFLUENCES as readonly string[]).includes(rest)) {
        if (!s.confluences.includes(rest)) s.confluences.push(rest);
      }
    }
  }
  return s;
}

/**
 * Build a setup key from the raw multi-line text stored in backtest_trades.setup.
 * Parses the text into a StrategySetup, then calls buildSetupKey().
 * Ensures backtesting and live journal produce identical keys for the same setup.
 */
export function buildSetupKeyFromText(text: string | null | undefined): string {
  return buildSetupKey(parseSetupText(text));
}
