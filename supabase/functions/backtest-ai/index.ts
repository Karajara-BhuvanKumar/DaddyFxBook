// Backtest AI edge function — analyzes a single backtest session's trades and
// produces strengths, weaknesses, patterns, suggestions, a 0-100 scorecard, and
// a written summary. Persists into public.backtest_ai_reports.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are an elite trading strategy analyst reviewing the results of a manual backtest.
Analyze the provided trades and aggregate stats and produce an honest, evidence-based strategy report.

Identify real patterns and reference concrete numbers (win rate, R, setup names, sessions, etc.).
Never invent data. Be specific, decisive, and actionable — talk like a professional strategy coach.

You MUST call the tool submit_backtest_report exactly once with the full structured analysis.`;

const tool = {
  type: "function" as const,
  function: {
    name: "submit_backtest_report",
    description: "Submit the structured backtest AI strategy report.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        strengths: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              evidence: { type: "string" },
              category: {
                type: "string",
                enum: ["setup", "session", "pair", "market_condition", "risk_reward", "direction"],
              },
            },
            required: ["title", "description", "evidence", "category"],
          },
        },
        weaknesses: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              evidence: { type: "string" },
              severity: { type: "string", enum: ["low", "medium", "high"] },
              category: {
                type: "string",
                enum: ["setup", "session", "pair", "market_condition", "risk_reward", "emotion", "execution"],
              },
            },
            required: ["title", "description", "evidence", "severity", "category"],
          },
        },
        patterns: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              kind: { type: "string", enum: ["winning", "losing"] },
              title: { type: "string" },
              description: { type: "string" },
              evidence: { type: "string" },
            },
            required: ["kind", "title", "description", "evidence"],
          },
        },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["title", "description", "priority"],
          },
        },
        scorecard: {
          type: "object",
          additionalProperties: false,
          properties: {
            strategy_quality: { type: "number" },
            consistency: { type: "number" },
            risk_management: { type: "number" },
            execution: { type: "number" },
            overall: { type: "number" },
            classification: { type: "string", enum: ["Elite", "Strong", "Average", "Weak"] },
            rationale: { type: "string" },
          },
          required: [
            "strategy_quality",
            "consistency",
            "risk_management",
            "execution",
            "overall",
            "classification",
            "rationale",
          ],
        },
        summary: { type: "string" },
      },
      required: ["strengths", "weaknesses", "patterns", "suggestions", "scorecard", "summary"],
    },
  },
};

type Trade = {
  id: string;
  pair: string;
  direction: string;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  rr: number | null;
  r_gained: number | null;
  pnl: number | null;
  outcome: string;
  setup: string | null;
  session: string | null;
  market_condition: string | null;
  emotion: string | null;
  trade_date: string | null;
};

function summarize(trades: Trade[]) {
  const wins = trades.filter((t) => t.outcome === "win");
  const losses = trades.filter((t) => t.outcome === "loss");
  const breakeven = trades.filter((t) => t.outcome === "breakeven");
  const netR = trades.reduce((s, t) => s + Number(t.r_gained ?? 0), 0);
  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
  const winR = wins.reduce((s, t) => s + Math.max(0, Number(t.r_gained ?? 0)), 0);
  const lossR = Math.abs(losses.reduce((s, t) => s + Math.min(0, Number(t.r_gained ?? 0)), 0));

  const grp = <K extends keyof Trade>(key: K) => {
    const m = new Map<string, { n: number; wins: number; netR: number }>();
    for (const t of trades) {
      const k = String(t[key] ?? "Unspecified");
      const r = m.get(k) ?? { n: 0, wins: 0, netR: 0 };
      r.n += 1;
      if (t.outcome === "win") r.wins += 1;
      r.netR += Number(t.r_gained ?? 0);
      m.set(k, r);
    }
    return Object.fromEntries(
      Array.from(m.entries()).map(([k, v]) => [
        k,
        { ...v, win_rate: v.n ? Number((v.wins / v.n).toFixed(2)) : 0, netR: Number(v.netR.toFixed(2)) },
      ]),
    );
  };

  return {
    total: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    win_rate: trades.length ? Number((wins.length / trades.length).toFixed(2)) : 0,
    net_r: Number(netR.toFixed(2)),
    total_pnl: Number(totalPnl.toFixed(2)),
    profit_factor: lossR > 0 ? Number((winR / lossR).toFixed(2)) : winR,
    by_setup: grp("setup"),
    by_session: grp("session"),
    by_pair: grp("pair"),
    by_market_condition: grp("market_condition"),
    by_direction: grp("direction"),
    by_emotion: grp("emotion"),
  };
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

    const body = (await req.json().catch(() => ({}))) as { session_id?: string };
    if (!body.session_id) return json(400, { error: "session_id required" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: session, error: sErr } = await admin
      .from("backtest_sessions")
      .select("*")
      .eq("id", body.session_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) return json(500, { error: sErr.message });
    if (!session) return json(404, { error: "Session not found" });

    const { data: trades, error: tErr } = await admin
      .from("backtest_trades")
      .select("*")
      .eq("session_id", body.session_id)
      .eq("user_id", userId)
      .order("trade_date", { ascending: true });
    if (tErr) return json(500, { error: tErr.message });
    if (!trades || trades.length === 0) return json(400, { error: "Add trades to this session first." });

    const stats = summarize(trades as Trade[]);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json(500, { error: "Missing LOVABLE_API_KEY" });

    const payload = {
      session: { name: session.name, pair: session.pair, strategy: session.strategy },
      aggregate_stats: stats,
      trades: (trades as Trade[]).slice(0, 150).map((t) => ({
        pair: t.pair,
        dir: t.direction,
        entry: t.entry_price,
        sl: t.stop_loss,
        tp: t.take_profit,
        exit: t.exit_price,
        rr: t.rr,
        r: t.r_gained,
        pnl: t.pnl,
        outcome: t.outcome,
        setup: t.setup,
        session: t.session,
        market: t.market_condition,
        emotion: t.emotion,
        date: t.trade_date,
      })),
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              "Analyze the following backtest session and submit the report via submit_backtest_report.\n\n" +
              JSON.stringify(payload),
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_backtest_report" } },
      }),
    });

    if (aiRes.status === 429) return json(429, { error: "Rate limit exceeded. Try again shortly." });
    if (aiRes.status === 402)
      return json(402, { error: "AI credits exhausted. Add credits in workspace settings." });
    if (!aiRes.ok) {
      const text = await aiRes.text();
      return json(502, { error: "AI gateway error", detail: text });
    }

    const data = await aiRes.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments)
      return json(502, { error: "Model did not return a structured report." });

    const report = JSON.parse(call.function.arguments);

    const { data: inserted, error: insErr } = await admin
      .from("backtest_ai_reports")
      .insert({
        user_id: userId,
        session_id: body.session_id,
        strengths: report.strengths ?? [],
        weaknesses: report.weaknesses ?? [],
        patterns: report.patterns ?? [],
        suggestions: report.suggestions ?? [],
        scorecard: report.scorecard ?? {},
        summary: report.summary ?? "",
        metrics: stats,
      })
      .select()
      .single();
    if (insErr) return json(500, { error: insErr.message });

    return json(200, { report: inserted });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
