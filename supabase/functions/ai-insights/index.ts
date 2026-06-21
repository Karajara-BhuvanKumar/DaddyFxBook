
// AI Insights edge function — generates AI commentary for Phase 2 (Daily/Weekly/Monthly reports)
// and Phase 3 (Trader Scorecard). Returns JSON directly without persistence.
//
// Client computes deterministic stats and scores; server adds AI narrative.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const PERIOD_SYSTEM = `You are an elite XAUUSD (Gold) trading performance coach.
You receive pre-computed statistics for a single trading period (day, week, or month)
plus a compact list of trades. Produce a structured AI report.

Be honest and specific. Tie every claim to numbers from the provided stats. Never invent data.
Use trader language; avoid generic platitudes. Action items must be concrete.

You MUST call the tool "submit_period_report" exactly once.`;

const periodTool = (periodType: "daily" | "weekly" | "monthly") => {
  const baseProps: Record<string, unknown> = {
    headline: { type: "string", description: "One-line verdict for the period." },
    biggest_strength: { type: "string" },
    biggest_weakness: { type: "string" },
    rule_violations: { type: "array", items: { type: "string" } },
    key_mistakes: { type: "array", items: { type: "string" } },
    action_plan: { type: "array", items: { type: "string" }, description: "Concrete actions for the next session/week/month." },
  };
  const required = ["headline", "biggest_strength", "biggest_weakness", "rule_violations", "key_mistakes", "action_plan"];

  if (periodType === "weekly") {
    baseProps.best_setup = { type: "string" };
    baseProps.worst_setup = { type: "string" };
    baseProps.best_instrument = { type: "string" };
    baseProps.worst_instrument = { type: "string" };
    baseProps.best_session = { type: "string" };
    baseProps.recommended_focus = { type: "string" };
    required.push("best_setup", "worst_setup", "best_instrument", "worst_instrument", "best_session", "recommended_focus");
  }
  if (periodType === "monthly") {
    baseProps.performance_trends = { type: "array", items: { type: "string" } };
    baseProps.growth_metrics = { type: "array", items: { type: "string" } };
    baseProps.consistency_analysis = { type: "string" };
    baseProps.drawdown_analysis = { type: "string" };
    baseProps.strategy_effectiveness = { type: "string" };
    baseProps.long_term_recommendations = { type: "array", items: { type: "string" } };
    required.push(
      "performance_trends", "growth_metrics", "consistency_analysis",
      "drawdown_analysis", "strategy_effectiveness", "long_term_recommendations",
    );
  }

  return {
    name: "submit_period_report",
    description: `Submit the structured ${periodType} AI report.`,
    parameters: {
      type: "object",
      properties: baseProps,
      required,
    },
  };
};

const SCORECARD_SYSTEM = `You are an elite XAUUSD trading performance coach.
You receive a trader's scorecard with five category scores (0-100) and the underlying factors.
For each category, write a short explanation and 1-3 specific improvement recommendations.
Tie advice to the factor numbers. Never invent data. Be concise and concrete.

You MUST call the tool "submit_scorecard_insights" exactly once.`;

const scorecardTool = {
  name: "submit_scorecard_insights",
  description: "Submit AI explanations and recommendations for each scorecard category.",
  parameters: {
    type: "object",
    properties: {
      overall_summary: { type: "string" },
      categories: {
        type: "object",
        properties: {
          discipline: catSchema(),
          risk: catSchema(),
          execution: catSchema(),
          psychology: catSchema(),
          consistency: catSchema(),
        },
        required: ["discipline", "risk", "execution", "psychology", "consistency"],
      },
    },
    required: ["overall_summary", "categories"],
  },
};

function catSchema() {
  return {
    type: "object",
    properties: {
      explanation: { type: "string" },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["explanation", "recommendations"],
  };
}

async function callGemini(
  apiKey: string,
  system: string,
  user: string,
  tool: ReturnType<typeof periodTool> | typeof scorecardTool,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            { text: system },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: user }],
          },
        ],
        tools: [
          {
            functionDeclarations: [
              tool
            ],
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
  const call = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  
  if (!call?.args) {
    throw new Response(JSON.stringify({ error: "Model did not return a structured response." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  
  return call.args;
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

    // Fetch user's Gemini API key
    const { data: userSettings, error: settingsErr } = await admin
      .from("user_settings")
      .select("gemini_api_key")
      .eq("user_id", userId)
      .single();
    if (settingsErr || !userSettings?.gemini_api_key)
      return json(400, { error: "Please add your Gemini API key in settings" });

    const apiKey = userSettings.gemini_api_key;

    const body = await req.json();
    const mode = body.mode as "period" | "scorecard";

    if (mode === "period") {
      const periodType = body.period_type as "daily" | "weekly" | "monthly";
      const periodStart = body.period_start as string;
      const periodEnd = body.period_end as string;
      const stats = body.stats as Record<string, unknown>;
      const trades = body.trades as unknown[];

      if (!periodType || !periodStart || !periodEnd || !stats) return json(400, { error: "Missing fields" });
      if (!Array.isArray(trades) || trades.length === 0) {
        return json(400, { error: "More trading history is required to generate meaningful AI reports." });
      }

      const tool = periodTool(periodType);
      const report = await callGemini(
        apiKey,
        PERIOD_SYSTEM,
        `Period: ${periodType} (${periodStart} → ${periodEnd})\n\nStats:\n${JSON.stringify(stats)}\n\nTrades:\n${JSON.stringify(trades)}`,
        tool,
      );

      return json(200, { report });
    }

    if (mode === "scorecard") {
      const snapshot = body.snapshot as Record<string, unknown>;
      const tradesSummary = body.trades_summary as unknown;
      if (!snapshot) return json(400, { error: "Missing snapshot" });
      if (!body.trade_count || body.trade_count === 0)
        return json(400, { error: "More trading history is required to generate meaningful AI reports." });

      const insights = await callGemini(
        apiKey,
        SCORECARD_SYSTEM,
        `Scorecard snapshot:\n${JSON.stringify(snapshot)}\n\nTrades summary:\n${JSON.stringify(tradesSummary)}`,
        scorecardTool,
      );

      return json(200, { insights });
    }

    return json(400, { error: "Unknown mode" });
  } catch (e) {
    if (e instanceof Response) return e;
    return json(500, { error: (e as Error).message });
  }
});
