// ============================================================
// Gemini AI Provider
// Handles all communication with the Gemini REST API.
// ============================================================

import { AI_ERROR_MESSAGES, DEFAULT_GEMINI_MODEL, DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_TEMPERATURE } from "./constants";
import type { GeminiModelId } from "./constants";

export interface GeminiOptions {
  apiKey: string;
  prompt: string;
  model?: GeminiModelId;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export interface GeminiResponse {
  text: string;
  model: string;
  finishReason?: string;
}

function parseGeminiError(status: number, body: unknown): string {
  const message = (body as any)?.error?.message;
  if (message) return message;
  return AI_ERROR_MESSAGES[status] ?? `Unexpected error (HTTP ${status}).`;
}

export async function generateGeminiResponse(opts: GeminiOptions): Promise<GeminiResponse> {
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;
  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${opts.apiKey}`;

  const requestBody: Record<string, unknown> = {
    contents: [{ parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (opts.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: opts.systemInstruction }],
    };
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120_000), // 2 minute timeout
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("AbortError") || message.includes("timeout")) {
      throw new Error("Request timed out. Gemini took too long to respond. Try reducing the data range.");
    }
    throw new Error(`Network error: ${message}`);
  }

  const data: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(parseGeminiError(response.status, data));
  }

  const text: string | undefined =
    (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text || text.trim() === "") {
    const finishReason = (data as any)?.candidates?.[0]?.finishReason;
    if (finishReason === "SAFETY") {
      throw new Error("Response blocked by Gemini safety filters. Try adjusting your prompt.");
    }
    if (finishReason === "MAX_TOKENS") {
      throw new Error("Response was cut short (max tokens reached). Try a smaller date range.");
    }
    throw new Error("Gemini returned an empty response. Please try again.");
  }

  return {
    text,
    model,
    finishReason: (data as any)?.candidates?.[0]?.finishReason,
  };
}

/** Validates the API key with a lightweight test call. */
export async function validateGeminiKey(
  apiKey: string,
  model: GeminiModelId = DEFAULT_GEMINI_MODEL,
): Promise<{ valid: boolean; error?: string }> {
  try {
    await generateGeminiResponse({
      apiKey,
      model,
      prompt: "Reply with the single word: OK",
      maxOutputTokens: 10,
      temperature: 0,
    });
    return { valid: true };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}
