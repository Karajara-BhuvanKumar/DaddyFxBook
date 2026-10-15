export type CoachProviderCode =
  | "configuration" | "authentication" | "billing" | "rate_limit"
  | "invalid_model" | "provider" | "network" | "timeout" | "invalid_response";

export class CoachProviderError extends Error {
  constructor(
    public readonly code: CoachProviderCode,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
  ) { super(message); }
}

export const DEFAULT_COACH_MODEL = "google/gemini-2.5-flash";

const endpoint = "https://openrouter.ai/api/v1";
const timeoutMs = 110_000;

export function providerError(status: number, body: unknown): CoachProviderError {
  const upstream = typeof body === "object" && body !== null && "error" in body
    ? (body as { error?: { message?: unknown } }).error?.message : undefined;
  const invalidModel = status === 404 || (status === 400 && typeof upstream === "string" && /model|provider|endpoint/i.test(upstream));
  if (status === 401 || status === 403) return new CoachProviderError("authentication", "The coach's OpenRouter key was rejected. An administrator needs to update the server connection.", 502);
  if (status === 402) return new CoachProviderError("billing", "OpenRouter has insufficient credits or this key reached its spending limit. Add credits or raise the key limit before generating another review.", 402);
  if (status === 429) return new CoachProviderError("rate_limit", "OpenRouter is rate limiting this key. Wait a moment, then retry.", 429, true);
  if (invalidModel) return new CoachProviderError("invalid_model", "The configured OpenRouter model is unavailable for this account. An administrator needs to select a supported model.", 502);
  if (status >= 500) return new CoachProviderError("provider", "OpenRouter is temporarily unavailable. Retry in a moment.", 502, true);
  return new CoachProviderError("provider", "OpenRouter rejected the review request. Check the provider configuration before retrying.", 502);
}

async function requestOpenRouter(path: string, key: string, init: RequestInit, fetcher: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetcher(`${endpoint}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(error => { if (timedOut) throw error; return null; });
    if (!response.ok) throw providerError(response.status, body);
    if (!body || typeof body !== "object")
      throw new CoachProviderError("invalid_response", "OpenRouter returned an unreadable response. Please retry.", 502, true);
    if ("error" in body) {
      const code = (body as { error?: { code?: unknown } }).error?.code;
      throw providerError(typeof code === "number" ? code : 502, body);
    }
    return body;
  } catch (error) {
    if (error instanceof CoachProviderError) throw error;
    if (timedOut || (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")))
      throw new CoachProviderError("timeout", "The AI provider timed out. Retry with a shorter review period.", 504, true);
    throw new CoachProviderError("network", "The AI provider could not be reached. Check the connection and retry.", 502, true);
  } finally {
    clearTimeout(timer);
  }
}

export async function checkCoachProvider(key: string, fetcher: typeof fetch = fetch, model = DEFAULT_COACH_MODEL): Promise<{ limitRemaining: number | null; model: string; checkedAt: string }> {
  const body = await requestOpenRouter("/key", key, { method: "GET" }, fetcher) as { data?: { limit_remaining?: unknown } };
  const remaining = body.data?.limit_remaining;
  if (!body.data || !(remaining === null || (typeof remaining === "number" && Number.isFinite(remaining))))
    throw new CoachProviderError("invalid_response", "OpenRouter could not confirm the key status. Please retry.", 502, true);
  if (typeof remaining === "number" && remaining <= 0) throw providerError(402, {});
  // The user catalogue respects provider/privacy restrictions, unlike the public list.
  for (let offset = 0; offset < 10000; offset += 500) {
    const catalogue = await requestOpenRouter(`/models/user?limit=500&offset=${offset}`, key, { method: "GET" }, fetcher) as { data?: Array<{ id?: string }> };
    if (!Array.isArray(catalogue.data)) throw new CoachProviderError("invalid_response", "OpenRouter could not confirm model availability. Please retry.", 502, true);
    if (catalogue.data.some(item => item?.id === model)) return { limitRemaining: typeof remaining === "number" ? remaining : null, model, checkedAt: new Date().toISOString() };
    if (catalogue.data.length < 500) throw providerError(404, {});
  }
  throw new CoachProviderError("invalid_response", "OpenRouter's model list could not be fully checked. Please retry.", 502, true);
}

export async function generateCoachCompletion(
  key: string,
  model: string,
  prompt: string,
  systemInstruction: string,
  fetcher: typeof fetch = fetch,
): Promise<{ report: string; timestamp: string }> {
  const body = await requestOpenRouter("/chat/completions", key, {
    method: "POST",
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 6500,
    }),
  }, fetcher) as { choices?: Array<{ message?: { content?: unknown }; finish_reason?: string }> };
  const choice = body.choices?.[0];
  if (choice?.finish_reason === "length") throw new CoachProviderError("invalid_response", "The report was cut short. Choose a shorter period and retry.", 502, true);
  if (typeof choice?.message?.content !== "string" || !choice.message.content.trim())
    throw new CoachProviderError("invalid_response", "The AI provider returned an empty report. Retry in a moment.", 502, true);
  return { report: choice.message.content, timestamp: new Date().toISOString() };
}
