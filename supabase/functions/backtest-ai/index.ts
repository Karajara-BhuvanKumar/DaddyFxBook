
// Backtest AI edge function — generates AI analysis for a backtest session.
// Fetches the trades, calls Gemini for structured insight, returns JSON directly without persistence.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `You are an elite XAUUSD (Gold) trading coach. Analyze a backtest session's trades and produce a structured AI report.

Be honest, specific, and actionable. Tie every claim to the numbers provided. Use trader language.

You MUST call the tool "submit_backtest_report" exactly once.`;

const tool = {
  name: "submit_backtest_report",
  description: "Submit structured AI analysis for a backtest session.",
  parameters: {
    type: "object",
    properties: {
      strengths: { type: "array", items: { type: "string" } },
      weaknesses: { type: "array", items: { type: "string" } },
      patterns: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      score: { type: "number", description: "Overall 0-100 score for this backtest." },
      summary: { type: "string" },
    },
    required: ["strengths", "weaknesses", "patterns", "recommendations", "score", "summary"],
  },
};

async function callGemini(
  apiKey: string,
  userPrompt: string,
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
          parts: [{ text: SYSTEM_PROMPT }],
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

    const { session_id } = await req.json() as { session_id: string };
    if (!session_id) return json(400, { error: "Missing session_id" });

    const { data: session, error: sErr } = await admin
      .from("backtest_sessions")
      .select("*")
      .eq("id", session_id)
      .eq("user_id", userId)
      .single();
    if (sErr || !session) return json(404, { error: "Session not found" });

    const { data: trades, error: tErr } = await admin
      .from("backtest_trades")
      .select("*")
      .eq("session_id", session_id)
      .eq("user_id", userId)
      .order("trade_number", { ascending: true });
    if (tErr) return json(500, { error: tErr.message });

    const report = await callGemini(
      apiKey,
      `Session:\n${JSON.stringify(session)}\n\nTrades:\n${JSON.stringify(trades)}`,
    );

    return json(200, { report });
  } catch (e) {
    if (e instanceof Response) return e;
    return json(500, { error: (e as Error).message });
  }
});
