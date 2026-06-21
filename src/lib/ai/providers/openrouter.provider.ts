// ============================================================
// OpenRouter Provider
// Sends all AI requests through openrouter.ai using the
// OpenAI-compatible Chat Completions API.
// Every model (Claude, GPT-4o, Gemini, DeepSeek, Grok) is
// accessed through a single unified endpoint.
// ============================================================

import type { AIProvider, AIRequest, AIResponse, OpenRouterModelId } from "./types";
import {
  OPENROUTER_API_URL,
  OPENROUTER_APP_TITLE,
  HTTP_ERROR_MESSAGES,
  REQUEST_TIMEOUT_MS,
  RETRIABLE_STATUS_CODES,
  OPENROUTER_MODELS,
} from "../constants";

// ── Error parsing ─────────────────────────────────────────────

interface ParsedError {
  message: string;
  statusCode: number | "network" | "timeout";
  retriable: boolean;
}

function parseError(status: number, body: unknown): ParsedError {
  // OpenRouter surfaces the upstream error under body.error.message
  const upstreamMessage =
    (body as any)?.error?.message ??
    (body as any)?.message ??
    null;

  const friendly = HTTP_ERROR_MESSAGES[status] ?? upstreamMessage ?? `Unexpected error (HTTP ${status}).`;
  return {
    message: friendly,
    statusCode: status,
    retriable: RETRIABLE_STATUS_CODES.has(status),
  };
}

function parseNetworkError(err: unknown): ParsedError {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AbortError") || msg.includes("timeout")) {
    return { message: "Request timed out. Try a smaller date range or faster model.", statusCode: "timeout", retriable: false };
  }
  return { message: `Network error: ${msg}`, statusCode: "network", retriable: true };
}

// ── Request builder ───────────────────────────────────────────

function buildRequestBody(request: AIRequest): Record<string, unknown> {
  const messages: Array<{ role: string; content: string }> = [];

  if (request.systemInstruction) {
    messages.push({ role: "system", content: request.systemInstruction });
  }

  messages.push({ role: "user", content: request.prompt });

  return {
    model: request.model,
    messages,
    temperature: request.temperature,
    max_tokens: request.maxTokens,
  };
}

// ── OpenRouter Provider ───────────────────────────────────────

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter" as const;

  getSupportedModels(): OpenRouterModelId[] {
    return Object.keys(OPENROUTER_MODELS) as OpenRouterModelId[];
  }

  async validateKey(apiKey: string, model: string = "google/gemini-2.5-flash"): Promise<boolean> {
    try {
      const result = await this.generateReport({
        apiKey,
        model,
        prompt: "Reply with exactly one word: OK",
        systemInstruction: undefined,
        temperature: 0,
        maxTokens: 10,
      });
      return result.success;
    } catch {
      return false;
    }
  }

  async generateReport(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    const origin = typeof window !== "undefined" ? window.location.origin : "https://daddyfxbook.app";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${request.apiKey}`,
          "HTTP-Referer": origin,
          "X-Title": OPENROUTER_APP_TITLE,
        },
        body: JSON.stringify(buildRequestBody(request)),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const body: unknown = await response.json().catch(() => ({}));

      if (!response.ok) {
        const parsed = parseError(response.status, body);
        return {
          success: false,
          provider: "openrouter",
          model: request.model,
          report: "",
          timestamp: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          error: parsed.message,
        };
      }

      const text: string | undefined = (body as any)?.choices?.[0]?.message?.content;
      const tokensUsed: number | undefined = (body as any)?.usage?.total_tokens;

      if (!text || text.trim() === "") {
        const finishReason = (body as any)?.choices?.[0]?.finish_reason;
        const errorMsg =
          finishReason === "length"
            ? "Response was cut short (max tokens reached). Try a smaller date range."
            : finishReason === "content_filter"
              ? "Response blocked by content filter. Try different custom instructions."
              : "Model returned an empty response. Please try again.";
        return {
          success: false,
          provider: "openrouter",
          model: request.model,
          report: "",
          timestamp: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          error: errorMsg,
        };
      }

      return {
        success: true,
        provider: "openrouter",
        model: request.model,
        report: text,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        tokensUsed,
      };
    } catch (err) {
      clearTimeout(timer);
      const parsed = parseNetworkError(err);
      return {
        success: false,
        provider: "openrouter",
        model: request.model,
        report: "",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        error: parsed.message,
      };
    }
  }
}

// Singleton — avoids re-construction on every render
export const openRouterProvider = new OpenRouterProvider();
