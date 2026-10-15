import { createClient } from "npm:@supabase/supabase-js@2.100.0";
import { checkCoachProvider, CoachProviderError, DEFAULT_COACH_MODEL, generateCoachCompletion } from "./openrouter.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return json(405, { code: "method", message: "Method not allowed." });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json(401, { code: "authentication", message: "Sign in to generate a performance review." });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const publishableKey = publishableKeys ? JSON.parse(publishableKeys).default : Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !publishableKey) return json(503, { code: "configuration", message: "The coach server is missing its Supabase configuration." });
    const client = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error } = await client.auth.getUser(authorization.slice(7));
    if (error || !user) return json(401, { code: "authentication", message: "Your session expired. Sign in again to generate a review." });

    const key = Deno.env.get("OPENROUTER_API_KEY")?.trim();
    if (!key) return json(503, { code: "configuration", message: "The coach is not connected to OpenRouter on the server. An administrator needs to configure the provider key." });
    const model = Deno.env.get("OPENROUTER_MODEL")?.trim() || DEFAULT_COACH_MODEL;
    const body = await request.json().catch(() => null) as { action?: unknown; prompt?: unknown; systemInstruction?: unknown } | null;
    if (body?.action === "status") {
      const status = await checkCoachProvider(key, fetch, model);
      return json(200, { ready: true, ...status });
    }
    if (body?.action !== "generate" || typeof body.prompt !== "string" || typeof body.systemInstruction !== "string"
      || !body.prompt.length || body.prompt.length > 250_000 || !body.systemInstruction.length || body.systemInstruction.length > 12_000)
      return json(400, { code: "request", message: "The review request is invalid or too large." });

    const result = await generateCoachCompletion(key, model, body.prompt, body.systemInstruction);
    return json(200, result);
  } catch (error) {
    if (error instanceof CoachProviderError) return json(error.status, { code: error.code, message: error.message, retryable: error.retryable });
    return json(500, { code: "server", message: "The coach server could not complete the request. Retry in a moment.", retryable: true });
  }
});
