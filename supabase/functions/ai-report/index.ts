
// AI Report edge function - generates AI reports using user's Gemini API key
// Authenticated via JWT, fetches user's key from user_settings

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

Identify real patterns - do not invent data. Base every claim on the provided trades.
Be concise, specific, and actionable. Use trader language. Avoid generic platitudes.`;

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

    const body = (await req.json().catch(() => ({}))) as {
      mode?: "full" | "single";
      trade_id?: string;
    };
    const mode = body.mode ?? "full";

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
    if (!trades || trades.length === 0) return json(400, { error: "No trades found" });

    const stats = summarize(trades as Trade[]);

    const userPrompt =
      mode === "single"
        ? "Review this single XAUUSD trade. Provide a brief analysis and 1-3 actionable recommendations."
        : "Analyze these XAUUSD trades and provide a structured performance report with strengths, weaknesses, and recommendations.";

    // Call Gemini API directly
    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: SYSTEM_PROMPT },
                { text: userPrompt },
                {
                  text: JSON.stringify({
                    stats,
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
                  }),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      },
    );

    if (!aiRes.ok) {
      const text = await aiRes.text();
      return json(502, { error: "Gemini API error", detail: text });
    }

    const aiData = await aiRes.json();
    const report = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "No report generated";

    return json(200, { report, stats });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
