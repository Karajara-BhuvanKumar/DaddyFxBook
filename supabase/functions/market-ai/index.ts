
// AI analysis for a single economic event. Returns a structured payload
// covering explanation, market bias prediction, asset impact, educational
// guidance, historical behavior and warnings.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM = `You are an elite macro-economics trading coach.
You receive a single economic calendar event and must return a structured AI
analysis aimed at retail forex / gold / indices traders.

Be specific, practical, educational and honest about uncertainty. Never claim a
guaranteed direction. Always frame predictions as probabilities. Tie reasoning
to the supplied forecast / previous / actual values when available.

You MUST call the tool "submit_event_analysis" exactly once.`;

const tool = {
  name: "submit_event_analysis",
  description: "Structured AI analysis for an economic calendar event.",
  parameters: {
    type: "object",
    properties: {
      explanation: {
        type: "object",
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
        properties: {
          XAUUSD: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
          EURUSD: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
          GBPUSD: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
          USDJPY: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
          NASDAQ: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
          SP500: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
          BTCUSD: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["bullish", "bearish", "sideways", "high_volatility", "unclear"] },
              strength: { type: "string", enum: ["low", "medium", "high"] },
              note: { type: "string" },
            },
            required: ["direction", "strength", "note"],
          },
        },
        required: ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NASDAQ", "SP500", "BTCUSD"],
      },
      educational: {
        type: "object",
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
};

async function callGemini(
  apiKey: string,
  userPrompt: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: userPrompt }],
          },
        ],
        tools: [
          {
            functionDeclarations: [tool],
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: [tool.name],
          },
        },
      }),
    },
  );
  
  if (!res.ok) {
    const text = await res.text();
    throw new Response(JSON.stringify({ error: "Gemini API error", detail: text }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  
  const data = await res.json();
  const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  
  if (!functionCall?.args) {
    throw new Response(JSON.stringify({ error: "Model did not return a structured analysis." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  
  return functionCall.args;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub as string;
    
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userSettings, error: settingsErr } = await admin
      .from("user_settings")
      .select("gemini_api_key")
      .eq("user_id", userId)
      .single();
    if (settingsErr || !userSettings?.gemini_api_key)
      return json(400, { error: "Please add your Gemini API key in settings" });

    const apiKey = userSettings.gemini_api_key;

    const event = await req.json();
    if (!event?.title) return json(400, { error: "Missing event" });

    const analysis = await callGemini(apiKey, `Event:\n${JSON.stringify(event, null, 2)}`);

    return json(200, { analysis });
  } catch (e) {
    if (e instanceof Response) return e;
    return json(500, { error: (e as Error).message });
  }
});
