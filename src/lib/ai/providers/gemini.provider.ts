// ============================================================
// Gemini Provider — Uses @google/genai SDK (not raw fetch)
// ============================================================

import { GoogleGenAI } from "@google/genai";
import type { AIProvider, AIRequest, AIResponse } from "./types";
import {
  GEMINI_MODELS,
  HTTP_ERROR_MESSAGES,
  REQUEST_TIMEOUT_MS,
  RETRIABLE_HTTP_CODES,
} from "../constants";

function parseGeminiError(err: unknown): { message: string; code: number | "network" | "timeout"; retriable: boolean } {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("AbortError") || msg.includes("timed out") || msg.includes("timeout")) {
    return { message: "Request timed out. Try a smaller date range.", code: "timeout", retriable: false };
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ENOTFOUND")) {
    return { message: "Network error. Check your internet connection.", code: "network", retriable: true };
  }

  // Extract HTTP code from SDK error messages like "got status: 401 ..."
  const httpMatch = msg.match(/(?:status|code)[:\s]+(\d{3})/i) ?? msg.match(/\b(4\d\d|5\d\d)\b/);
  if (httpMatch) {
    const code = parseInt(httpMatch[1], 10);
    const friendly = HTTP_ERROR_MESSAGES[code] ?? msg;
    return { message: friendly, code, retriable: RETRIABLE_HTTP_CODES.has(code) };
  }

  if (msg.toLowerCase().includes("api_key") || msg.toLowerCase().includes("api key")) {
    return { message: HTTP_ERROR_MESSAGES[401], code: 401, retriable: false };
  }
  if (msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("rate limit")) {
    return { message: HTTP_ERROR_MESSAGES[429], code: 429, retriable: true };
  }

  return { message: msg, code: 500, retriable: true };
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  getSupportedModels(): string[] {
    return Object.keys(GEMINI_MODELS);
  }

  async validateKey(apiKey: string, model = "gemini-2.5-flash"): Promise<boolean> {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model,
        contents: "Reply with the single word: OK",
        config: { maxOutputTokens: 10, temperature: 0 },
      });
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return text.trim().length > 0;
    } catch {
      return false;
    }
  }

  async generateReport(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    const fullPrompt = request.systemInstruction
      ? `${request.systemInstruction}\n\n---\n\n${request.prompt}`
      : request.prompt;

    try {
      const ai = new GoogleGenAI({ apiKey: request.apiKey });

      // Use AbortSignal for timeout
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let resultText = "";
      try {
        const result = await ai.models.generateContent({
          model: request.model,
          contents: fullPrompt,
          config: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
          },
        });
        resultText = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      } finally {
        clearTimeout(timer);
      }

      if (!resultText || resultText.trim() === "") {
        return {
          success: false,
          provider: "gemini",
          model: request.model,
          report: "",
          timestamp: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          error: "Gemini returned an empty response. Please try again.",
        };
      }

      return {
        success: true,
        provider: "gemini",
        model: request.model,
        report: resultText,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      const parsed = parseGeminiError(err);
      return {
        success: false,
        provider: "gemini",
        model: request.model,
        report: "",
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        error: parsed.message,
      };
    }
  }
}
