import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CoachErrorCode = "configuration" | "authentication" | "billing" | "rate_limit" | "invalid_model" | "provider" | "network" | "timeout" | "invalid_response" | "server" | "request";

export class CoachConnectionError extends Error {
  constructor(public readonly code: CoachErrorCode, message: string, public readonly retryable = false) { super(message); }
}

function isCode(value: unknown): value is CoachErrorCode {
  return typeof value === "string" && ["configuration", "authentication", "billing", "rate_limit", "invalid_model", "provider", "network", "timeout", "invalid_response", "server", "request"].includes(value);
}

async function invoke(body: object, signal?: AbortSignal): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("performance-coach", { body, signal });
  if (!error) return data;
  if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
  if (error instanceof FunctionsHttpError) {
    const response = error.context;
    const details: unknown = response instanceof Response ? await response.json().catch(() => null) : null;
    if (details && typeof details === "object") {
      const payload = details as { code?: unknown; message?: unknown; retryable?: unknown };
      if (isCode(payload.code) && typeof payload.message === "string")
        throw new CoachConnectionError(payload.code, payload.message, payload.retryable === true);
    }
    if (response instanceof Response && response.status === 404)
      throw new CoachConnectionError("configuration", "The Performance Coach function is not deployed in this project's server. Contact the administrator.");
    if (response instanceof Response && response.status === 401)
      throw new CoachConnectionError("authentication", "Your session expired. Sign in again to generate a review.");
  }
  throw new CoachConnectionError("network", "The coach server could not be reached. Check your connection and retry.", true);
}

export async function getCoachProviderStatus(signal?: AbortSignal): Promise<{ ready: boolean; limitRemaining: number | null; model?: string }> {
  const data = await invoke({ action: "status" }, signal);
  if (!data || typeof data !== "object" || (data as { ready?: unknown }).ready !== true)
    throw new CoachConnectionError("invalid_response", "The coach server returned an invalid status.", true);
  const remaining = (data as { limitRemaining?: unknown }).limitRemaining;
  return { ready: true, limitRemaining: typeof remaining === "number" ? remaining : null, model: typeof (data as { model?: unknown }).model === "string" ? (data as { model: string }).model : undefined };
}

export async function generateCoachReview(prompt: string, systemInstruction: string, signal: AbortSignal): Promise<{ report: string; timestamp: string }> {
  const data = await invoke({ action: "generate", prompt, systemInstruction }, signal);
  if (!data || typeof data !== "object" || typeof (data as { report?: unknown }).report !== "string" || typeof (data as { timestamp?: unknown }).timestamp !== "string")
    throw new CoachConnectionError("invalid_response", "The coach server returned an incomplete report. Retry in a moment.", true);
  return data as { report: string; timestamp: string };
}
