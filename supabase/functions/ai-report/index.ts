// AI Report edge function — runs the AI Performance Coach + per-trade Trade Reviews.
// Authenticated via JWT. Fetches the user's trades server-side, calls Lovable AI,
// then persists the report and trade reviews so they are visible everywhere.

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

interface Trade {
  id: string;
  symbol: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  lot_size: number;
  stop_loss: number | null;
  take_profit: number | null;
  pnl: number;
  open_time: string;
  close_time: string;
  session: string | null;
}

const SYSTEM_PROMPT = `You are an elite XAUUSD (Gold) trading performance coach.
Analyze the trader's historical trades and produce an honest, structured performance report.

Identify real patterns — do not invent data. Base every claim on the provided trades.
Be concise, specific, and actionable. Use trader language. Avoid generic platitudes.

For each individual trade you also produce a "trade review" with a grade (A+, A, B, C, F),
what went right, what went wrong, improvements, and a one-sentence summary.

You MUST call the tool "submit_report" exactly once with the full structured analysis,
and the trade_reviews array MUST contain one entry per provided trade using the trade id verbatim.`;

const tool = {
  type: "function" as const,
  function: {
    name: "submit_report",
    description: "Submit the structured AI performance report and per-trade reviews.",
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
                enum: ["setup", "session", "winrate", "day", "instrument", "risk_reward", "execution"],
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
                enum: [
                  "overtrading",
                  "revenge_trading",
                  "fomo",
                  "early_exit",
                  "late_exit",
                  "risk_management",
                  "session_discipline",
                  "rule_break",
                ],
              },
            },
            required: ["title", "description", "evidence", "severity", "category"],
          },
        },
        suggestions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              action: { type: "string" },
              rationale: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["title", "action", "rationale", "priority"],
          },
        },
        trade_reviews: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              trade_id: { type: "string" },
              grade: { type: "string", enum: ["A+", "A", "B", "C", "F"] },
              went_right: { type: "array", items: { type: "string" } },
              went_wrong: { type: "array", items: { type: "string" } },
              improvements: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
            },
            required: ["trade_id", "grade", "went_right", "went_wrong", "improvements", "summary"],
          },
        },
      },
      required: ["strengths", "weaknesses", "suggestions", "trade_reviews"],
    },
  },
};

function summarize(trades: Trade[]) {
  const wins = trades.filter((t) => Number(t.pnl) > 0);
  const losses = trades.filter((t) => Number(t.pnl) < 0);
  const total = trades.reduce((s, t) => s + Number(t.pnl), 0);
  const bySession: Record<string, { count: number; pnl: number; wins: number }> = {};
  for (const t of trades) {
    const k = t.session ?? "Unknown";
    bySession[k] ??= { count: 0, pnl: 0, wins: 0 };
    bySession[k].count++;
    bySession[k].pnl += Number(t.pnl);
    if (Number(t.pnl) > 0) bySession[k].wins++;
  }
  return {
    total_trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    win_rate: trades.length ? wins.length / trades.length : 0,
    total_pnl: Number(total.toFixed(2)),
    avg_win: wins.length ? Number((wins.reduce((s, t) => s + Number(t.pnl), 0) / wins.length).toFixed(2)) : 0,
    avg_loss: losses.length ? Number((losses.reduce((s, t) => s + Number(t.pnl), 0) / losses.length).toFixed(2)) : 0,
    by_session: bySession,
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

    const body = (await req.json().catch(() => ({}))) as {
      mode?: "full" | "single";
      trade_id?: string;
    };
    const mode = body.mode ?? "full";

    const admin = createClient(supabaseUrl, serviceKey);

    let query = admin
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("close_time", { ascending: false });
    if (mode === "single") {
      if (!body.trade_id) return json(400, { error: "trade_id required" });
      query = query.eq("id", body.trade_id);
    } else {
      query = query.limit(60);
    }
    const { data: trades, error: tradesErr } = await query;
    if (tradesErr) return json(500, { error: tradesErr.message });
    if (!trades || trades.length === 0) return json(400, { error: "No trades found." });

    const stats = summarize(trades as Trade[]);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json(500, { error: "Missing LOVABLE_API_KEY" });

    const userPayload = {
      mode,
      aggregate_stats: stats,
      trades: (trades as Trade[]).map((t) => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        entry: t.entry_price,
        exit: t.exit_price,
        sl: t.stop_loss,
        tp: t.take_profit,
        lot: t.lot_size,
        pnl: t.pnl,
        session: t.session,
        opened: t.open_time,
        closed: t.close_time,
      })),
    };

    const userPrompt =
      mode === "single"
        ? "Review this single XAUUSD trade. Strengths/weaknesses/suggestions can be brief but the trade_reviews array MUST contain this trade. Submit via submit_report.\n\n"
        : "Analyze these XAUUSD trades and submit the report via the submit_report tool.\n\n";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt + JSON.stringify(userPayload) },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_report" } },
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

    const report = JSON.parse(call.function.arguments) as {
      strengths: unknown[];
      weaknesses: unknown[];
      suggestions: unknown[];
      trade_reviews: Array<{
        trade_id: string;
        grade: string;
        went_right: string[];
        went_wrong: string[];
        improvements: string[];
        summary: string;
      }>;
    };

    // Persist per-trade reviews (upsert on user_id+trade_id).
    const tradeIds = new Set((trades as Trade[]).map((t) => t.id));
    const validReviews = (report.trade_reviews ?? []).filter((r) => tradeIds.has(r.trade_id));
    if (validReviews.length > 0) {
      const rows = validReviews.map((r) => ({
        user_id: userId,
        trade_id: r.trade_id,
        grade: r.grade,
        went_right: r.went_right ?? [],
        went_wrong: r.went_wrong ?? [],
        improvements: r.improvements ?? [],
        summary: r.summary ?? "",
        updated_at: new Date().toISOString(),
      }));
      const { error: upErr } = await admin
        .from("ai_trade_reviews")
        .upsert(rows, { onConflict: "user_id,trade_id" });
      if (upErr) console.error("upsert reviews failed", upErr.message);
    }

    // Persist the full Performance Coach report (only on full runs).
    if (mode === "full") {
      const { error: repErr } = await admin.from("ai_performance_reports").insert({
        user_id: userId,
        report,
        stats,
        trade_count: trades.length,
      });
      if (repErr) console.error("insert report failed", repErr.message);
    }

    return json(200, { report, stats });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
