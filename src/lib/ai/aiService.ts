// ============================================================
// AI Service — Orchestrates all AI calls.
// OpenRouter is the sole transport. Model-level fallback
// automatically retries the next model in the priority list
// on any failure so the user never hits a dead end.
// ============================================================

import { openRouterProvider } from "./providers/openrouter.provider";
import type { AIRequest, AIResponse, OpenRouterModelId } from "./providers/types";
import {
  MODEL_FALLBACK_ORDER,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
} from "./constants";
import { AI_SYSTEM_INSTRUCTION } from "./promptBuilder";

// ── Key validation ────────────────────────────────────────────

export async function validateOpenRouterKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  const valid = await openRouterProvider.validateKey(apiKey);
  return { valid, error: valid ? undefined : "API key validation failed. Check your OpenRouter key." };
}

// ── Single model call ─────────────────────────────────────────

export async function callModel(
  apiKey: string,
  model: string,
  prompt: string,
  options?: { temperature?: number; maxTokens?: number; systemInstruction?: string },
): Promise<AIResponse> {
  const request: AIRequest = {
    apiKey,
    model,
    prompt,
    systemInstruction: options?.systemInstruction ?? AI_SYSTEM_INSTRUCTION,
    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
  };
  return openRouterProvider.generateReport(request);
}

// ── Fallback config ───────────────────────────────────────────

export interface GenerateWithFallbackOptions {
  apiKey: string;
  /** Primary model to attempt first. Defaults to fallback order position 0. */
  preferredModel?: OpenRouterModelId | string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  /** Called when a model attempt starts. */
  onModelAttempt?: (model: string, attemptNumber: number) => void;
  /** Called when a model fails before trying the next. */
  onModelFailed?: (model: string, error: string, willRetry: boolean) => void;
}

export interface FallbackResult extends AIResponse {
  attemptedModels: string[];
}

// ── Main generation entry point ───────────────────────────────

export async function generateWithFallback(
  opts: GenerateWithFallbackOptions,
): Promise<FallbackResult> {
  const { apiKey, preferredModel, prompt, systemInstruction, temperature, maxTokens } = opts;

  // Build the ordered list: preferred first, then the rest of the fallback chain
  const order: string[] = preferredModel
    ? [preferredModel, ...MODEL_FALLBACK_ORDER.filter((m) => m !== preferredModel)]
    : [...MODEL_FALLBACK_ORDER];

  const attempted: string[] = [];

  for (let i = 0; i < order.length; i++) {
    const model = order[i];
    attempted.push(model);
    opts.onModelAttempt?.(model, i + 1);

    const response = await callModel(apiKey, model, prompt, {
      systemInstruction: systemInstruction ?? AI_SYSTEM_INSTRUCTION,
      temperature: temperature ?? DEFAULT_TEMPERATURE,
      maxTokens: maxTokens ?? DEFAULT_MAX_TOKENS,
    });

    if (response.success) {
      return { ...response, attemptedModels: attempted };
    }

    const isLast = i === order.length - 1;
    opts.onModelFailed?.(model, response.error ?? "Unknown error", !isLast);
  }

  // Exhausted all models
  return {
    success: false,
    provider: "openrouter",
    model: order[order.length - 1] ?? "",
    report: "",
    timestamp: new Date().toISOString(),
    error: "All models failed. Check your OpenRouter API key, credits, or try again later.",
    attemptedModels: attempted,
  };
}
