import { describe, it, expect } from "vitest";
import {
  buildSetupKey,
  buildBroadSetupKey,
  buildSetupKeyFromText,
  parseStrategySetup,
  parseSetupText,
  emptyStrategySetup,
  type StrategySetup,
} from "@/lib/strategySetup";

describe("buildSetupKey", () => {
  it("returns 'Unspecified' for an empty setup", () => {
    expect(buildSetupKey(emptyStrategySetup)).toBe("Unspecified");
  });

  it("returns 'Unspecified' for a setup with only HTF (not included in key)", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      htf_tf: "H4",
      htf_level: "TJL 1",
    };
    // HTF is intentionally excluded from the key — only LTF, Confirmation, Confluences
    expect(buildSetupKey(setup)).toBe("Unspecified");
  });

  it("builds a key with only LTF fields", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      ltf_tf: "M15",
      ltf_level: "TJL 1",
    };
    expect(buildSetupKey(setup)).toBe("M15 TJL 1");
  });

  it("builds a key with LTF and Confirmation", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      ltf_tf: "M15",
      ltf_level: "TJL 1",
      conf_tf: "M1",
      conf_type: "CC Engulfing",
    };
    expect(buildSetupKey(setup)).toBe("M15 TJL 1 Confirmation: M1 CC Engulfing");
  });

  it("builds a full key with LTF, Confirmation, and Confluences", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      ltf_tf: "M15",
      ltf_level: "TJL 1",
      conf_tf: "M1",
      conf_type: "CC Engulfing",
      confluences: ["SL Outside Zone"],
    };
    expect(buildSetupKey(setup)).toBe(
      "M15 TJL 1 Confirmation: M1 CC Engulfing Confluences: SL Outside Zone"
    );
  });

  it("handles FIB Zone with timeframe in confluences", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      ltf_tf: "M5",
      ltf_level: "SBR",
      confluences: ["FIB Zone", "Liquidity Sweep"],
      fib_tf: "H4",
    };
    expect(buildSetupKey(setup)).toBe(
      "M5 SBR Confluences: FIB Zone (H4) + Liquidity Sweep"
    );
  });

  it("handles confluences only (no LTF or confirmation)", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      confluences: ["SL Outside Zone", "Fib of Zone"],
    };
    expect(buildSetupKey(setup)).toBe(
      "Confluences: SL Outside Zone + Fib of Zone"
    );
  });
});

describe("buildBroadSetupKey", () => {
  it("returns 'Unspecified' for an empty setup", () => {
    expect(buildBroadSetupKey(emptyStrategySetup)).toBe("Unspecified");
  });

  it("builds a key with HTF, LTF, and Bias", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      htf_tf: "H4",
      htf_level: "SBR",
      ltf_tf: "M15",
      ltf_level: "TJL 1",
      bias: "Bearish",
    };
    expect(buildBroadSetupKey(setup)).toBe("H4 SBR / M15 TJL 1 / Bearish");
  });

  it("handles missing Bias", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      htf_tf: "Daily",
      htf_level: "TJL 2",
      ltf_tf: "H1",
      ltf_level: "RBS",
    };
    expect(buildBroadSetupKey(setup)).toBe("Daily TJL 2 / H1 RBS");
  });

  it("ignores confluences and confirmation", () => {
    const setup: StrategySetup = {
      ...emptyStrategySetup,
      htf_tf: "H4",
      htf_level: "SBR",
      conf_tf: "M1",
      conf_type: "CC Engulfing",
      confluences: ["SL Outside Zone"],
      bias: "Bearish",
    };
    expect(buildBroadSetupKey(setup)).toBe("H4 SBR / Bearish");
  });
});

describe("parseSetupText → buildSetupKey round-trip", () => {
  it("parses a backtest setup text and produces the correct key", () => {
    const backtestText = [
      "HTF: H4 TJL 1",
      "LTF: M15 TJL 1",
      "Confirmation: M1 CC Engulfing",
      "",
      "Confluences:",
      "✓ SL Outside Zone",
    ].join("\n");

    const parsed = parseSetupText(backtestText);
    expect(parsed.htf_tf).toBe("H4");
    expect(parsed.ltf_tf).toBe("M15");
    expect(parsed.ltf_level).toBe("TJL 1");
    expect(parsed.conf_tf).toBe("M1");
    expect(parsed.conf_type).toBe("CC Engulfing");
    expect(parsed.confluences).toEqual(["SL Outside Zone"]);

    expect(buildSetupKey(parsed)).toBe(
      "M15 TJL 1 Confirmation: M1 CC Engulfing Confluences: SL Outside Zone"
    );
  });

  it("buildSetupKeyFromText produces the same key as manual parse", () => {
    const text = "LTF: M5 SBR\nConfirmation: M1 CC Star";
    expect(buildSetupKeyFromText(text)).toBe(
      "M5 SBR Confirmation: M1 CC Star"
    );
  });

  it("returns 'Unspecified' for null text", () => {
    expect(buildSetupKeyFromText(null)).toBe("Unspecified");
  });
});

describe("live journal JSON → buildSetupKey matches backtest text → buildSetupKeyFromText", () => {
  it("same setup produces identical keys from both paths", () => {
    // Live: stored as JSON in journals.strategy_setup
    const liveJson = JSON.stringify({
      htf_tf: "Daily",
      htf_level: "TJL 2",
      ltf_tf: "M15",
      ltf_level: "TJL 1",
      conf_tf: "M1",
      conf_type: "CC Engulfing",
      confluences: ["SL Outside Zone"],
      fib_tf: "",
      market_session: "London",
      bias: "Bullish",
    });
    const liveKey = buildSetupKey(parseStrategySetup(liveJson));

    // Backtest: stored as plain text in backtest_trades.setup
    const backtestText = [
      "HTF: Daily TJL 2",
      "LTF: M15 TJL 1",
      "Confirmation: M1 CC Engulfing",
      "",
      "Confluences:",
      "✓ SL Outside Zone",
    ].join("\n");
    const backtestKey = buildSetupKeyFromText(backtestText);

    expect(liveKey).toBe(backtestKey);
    expect(liveKey).toBe(
      "M15 TJL 1 Confirmation: M1 CC Engulfing Confluences: SL Outside Zone"
    );
  });
});
