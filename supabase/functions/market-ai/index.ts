// AI analysis for a single economic event. Returns a structured payload
// covering explanation, market-bias prediction, asset impact, educational
// guidance, historical behavior and warnings.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You are an elite macro-economics trading coach.
You receive a single economic-calendar event and must return a structured AI
analysis aimed at retail forex / gold / indices traders.

Be specific, practical, educational and honest about uncertainty. Never claim a
guaranteed direction. Always frame predictions as probabilities. Tie reasoning
to the supplied forecast / previous / actual values when available.

You MUST call the tool "submit_event_analysis" exactly once.`;

const tool = {
  type: "function" as const,
  function: {
    name: "submit_event_analysis",
    description: "Structured AI analysis for an economic calendar event.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        explanation: {
          type: "object",
          additionalProperties: false,
          properties: {
            what_it_measures: { type: "string" },
            why_traders_care: { type: "string" },
            markets_affected: { type: "array", items: { type: "string" } },
            why_volatility_increases: { type: "string" },
          },
          required: ["what_it_measures", "why_traders_care", "markets_affected", "why_volatility_increases"],
        },
        bias_prediction: {
          type: "object",
          additionalProperties: false,
          properties: {
            scenario: { type: "string", description: "Which scenario this prediction assumes (e.g. actual > forecast)." },
            usd_bias: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
            gold_bias: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
            equities_bias: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            reasoning: { type: "string" },
          },
          required: ["scenario", "usd_bias", "gold_bias", "equities_bias", "confidence", "reasoning"],
        },
        asset_impact: {
          type: "object",
          additionalProperties: false,
          properties: {
            XAUUSD: assetSchema(),
            EURUSD: assetSchema(),
            GBPUSD: assetSchema(),
            USDJPY: assetSchema(),
            NASDAQ: assetSchema(),
            SP500: assetSchema(),
            BTCUSD: assetSchema(),
          },
          required: ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NASDAQ", "SP500", "BTCUSD"],
        },
        educational: {
          type: "object",
          additionalProperties: false,
          properties: {
            indicator_meaning: { type: "string" },
            why_it_matters: { type: "string" },
            how_institutions_react: { type: "string" },
            behavior_before_release: { type: "string" },
            behavior_after_release: { type: "string" },
            common_mistakes: { type: "array", items: { type: "string" } },
            beginners_should_avoid: { type: "boolean" },
            beginners_reason: { type: "string" },
          },
          required: [
            "indicator_meaning", "why_it_matters", "how_institutions_react",
            "behavior_before_release", "behavior_after_release",
            "common_mistakes", "beginners_should_avoid", "beginners_reason",
          ],
        },
        how_to_trade: {
          type: "object",
          additionalProperties: false,
          properties: {
            before: { type: "array", items: { type: "string" } },
            during: { type: "array", items: { type: "string" } },
            after: { type: "array", items: { type: "string" } },
          },
          required: ["before", "during", "after"],
        },
        historical_behavior: { type: "array", items: { type: "string" } },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: [
        "explanation", "bias_prediction", "asset_impact",
        "educational", "how_to_trade", "historical_behavior", "warnings",
      ],
    },
  },
};

function assetSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
      strength: { type: "string", enum: ["low", "medium", "high"] },
      note: { type: "string" },
    },
    required: ["direction", "strength", "note"],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json(500, { error: "Missing LOVABLE_API_KEY" });

    const event = await req.json();
    if (!event?.title) return json(400, { error: "Missing event" });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Event:\n${JSON.stringify(event, null, 2)}` },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
      }),
    });

    if (res.status === 429) return json(429, { error: "Rate limit exceeded. Try again shortly." });
    if (res.status === 402) return json(402, { error: "AI credits exhausted." });
    if (!res.ok) return json(502, { error: "AI gateway error", detail: await res.text() });

    const data = await res.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) return json(502, { error: "Model did not return analysis." });
    const analysis = JSON.parse(call.function.arguments);

    return json(200, { analysis });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
