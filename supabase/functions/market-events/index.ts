// Fetches the upcoming-week economic calendar from the free ForexFactory feed
// (nfs.faireconomy.media) and normalizes it for the Market page.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

import { createClient } from "npm:@supabase/supabase-js@2";

type FFEvent = {
  title: string;
  country: string;
  date: string; // ISO with TZ
  impact: string; // High | Medium | Low | Holiday
  forecast: string;
  previous: string;
  actual?: string;
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  USD: "USD", EUR: "EUR", GBP: "GBP", JPY: "JPY", AUD: "AUD",
  NZD: "NZD", CAD: "CAD", CHF: "CHF", CNY: "CNY",
};

const COUNTRY_NAME: Record<string, string> = {
  USD: "United States", EUR: "Eurozone", GBP: "United Kingdom",
  JPY: "Japan", AUD: "Australia", NZD: "New Zealand",
  CAD: "Canada", CHF: "Switzerland", CNY: "China",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch calendar feed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = (await res.json()) as FFEvent[];

    const events = data.map((e, idx) => {
      const code = e.country?.toUpperCase() ?? "";
      const currency = COUNTRY_TO_CURRENCY[code] ?? code;
      const utc = new Date(e.date);
      return {
        id: `${code}-${utc.getTime()}-${idx}`,
        title: e.title,
        country: COUNTRY_NAME[code] ?? code,
        countryCode: code,
        currency,
        impact: (e.impact || "Low").toLowerCase(), // high | medium | low | holiday
        timeUTC: utc.toISOString(),
        forecast: e.forecast || "",
        previous: e.previous || "",
        actual: e.actual || "",
      };
    });

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
