// AI Insights edge function — generates AI commentary for Phase 2 (Daily/Weekly/Monthly reports)
// and Phase 3 (Trader Scorecard). Persists results so they show up across sessions.
//
// Client computes deterministic stats and scores; server adds AI narrative and persists.

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
    type: "function" as const,
    function: {
      name: "submit_period_report",
      description: `Submit the structured ${periodType} AI report.`,
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: baseProps,
        required,
      },
    },
  };
};

const SCORECARD_SYSTEM = `You are an elite XAUUSD trading performance coach.
You receive a trader's scorecard with five category scores (0-100) and the underlying factors.
For each category, write a short explanation and 1-3 specific improvement recommendations.
Tie advice to the factor numbers. Never invent data. Be concise and concrete.

You MUST call the tool "submit_scorecard_insights" exactly once.`;

const scorecardTool = {
  type: "function" as const,
  function: {
    name: "submit_scorecard_insights",
    description: "Submit AI explanations and recommendations for each scorecard category.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        overall_summary: { type: "string" },
        categories: {
          type: "object",
          additionalProperties: false,
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
  },
};

function catSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      explanation: { type: "string" },
      recommendations: { type: "array", items: { type: "string" } },
    },
    required: ["explanation", "recommendations"],
  };
}

async function callAI(
  apiKey: string,
  system: string,
  user: string,
  tool: ReturnType<typeof periodTool> | typeof scorecardTool,
): Promise<Record<string, unknown>> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
  if (res.status === 429) throw new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (res.status === 402) throw new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (!res.ok) throw new Response(JSON.stringify({ error: "AI gateway error", detail: await res.text() }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) throw new Response(JSON.stringify({ error: "Model did not return a structured response." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  return JSON.parse(call.function.arguments);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json(500, { error: "Missing LOVABLE_API_KEY" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub as string;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const mode = body.mode as "period" | "scorecard";

    if (mode === "period") {
      const periodType = body.period_type as "daily" | "weekly" | "monthly";
      const periodStart = body.period_start as string; // YYYY-MM-DD
      const periodEnd = body.period_end as string;
      const stats = body.stats as Record<string, unknown>;
      const trades = body.trades as unknown[];

      if (!periodType || !periodStart || !periodEnd || !stats) return json(400, { error: "Missing fields" });
      if (!Array.isArray(trades) || trades.length === 0) {
        return json(400, { error: "More trading history is required to generate meaningful AI reports." });
      }

      const tool = periodTool(periodType);
      const report = await callAI(
        apiKey,
        PERIOD_SYSTEM,
        `Period: ${periodType} (${periodStart} → ${periodEnd})\n\nStats:\n${JSON.stringify(stats)}\n\nTrades:\n${JSON.stringify(trades)}`,
        tool,
      );

      const { error: upErr } = await admin
        .from("ai_period_reports")
        .upsert(
          {
            user_id: userId,
            period_type: periodType,
            period_start: periodStart,
            period_end: periodEnd,
            trade_count: trades.length,
            stats,
            report,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,period_type,period_start" },
        );
      if (upErr) return json(500, { error: upErr.message });

      return json(200, { report });
    }

    if (mode === "scorecard") {
      const snapshot = body.snapshot as Record<string, unknown>;
      const tradesSummary = body.trades_summary as unknown;
      if (!snapshot) return json(400, { error: "Missing snapshot" });
      if (!body.trade_count || body.trade_count === 0)
        return json(400, { error: "More trading history is required to generate meaningful AI reports." });

      const insights = await callAI(
        apiKey,
        SCORECARD_SYSTEM,
        `Scorecard snapshot:\n${JSON.stringify(snapshot)}\n\nTrades summary:\n${JSON.stringify(tradesSummary)}`,
        scorecardTool,
      );

      const overall = snapshot.overall as number;
      const classification = snapshot.classification as string;
      const discipline = snapshot.discipline as { score: number };
      const risk = snapshot.risk as { score: number };
      const execution = snapshot.execution as { score: number };
      const psychology = snapshot.psychology as { score: number };
      const consistency = snapshot.consistency as { score: number };

      const { error: insErr } = await admin.from("ai_scorecards").insert({
        user_id: userId,
        discipline_score: discipline.score,
        risk_score: risk.score,
        execution_score: execution.score,
        psychology_score: psychology.score,
        consistency_score: consistency.score,
        overall_score: overall,
        classification,
        trade_count: body.trade_count,
        breakdown: snapshot,
        ai_insights: insights,
      });
      if (insErr) return json(500, { error: insErr.message });

      return json(200, { insights });
    }

    return json(400, { error: "Unknown mode" });
  } catch (e) {
    if (e instanceof Response) return e;
    return json(500, { error: (e as Error).message });
  }
});
