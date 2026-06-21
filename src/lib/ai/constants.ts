// ============================================================
// AI Constants — Single source of truth
// All models, limits, and error codes live here.
// Never import model names from anywhere else.
// ============================================================

import type { ModelDefinition, OpenRouterModelId } from "./providers/types";

// ── OpenRouter endpoint ───────────────────────────────────────
export const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_APP_TITLE = "DaddyFxBook";

// ── Supported models via OpenRouter ──────────────────────────
export const OPENROUTER_MODELS: Record<OpenRouterModelId, ModelDefinition> = {
  "anthropic/claude-sonnet-4-5": {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "claude",
    description: "Best reasoning & psychology analysis. Recommended.",
    maxOutputTokens: 8192,
    isDefault: true,
  },
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "openai",
    description: "Excellent structured output and data analysis.",
    maxOutputTokens: 8192,
  },
  "google/gemini-2.5-flash": {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    description: "Fastest generation. Best for large trade sets.",
    maxOutputTokens: 8192,
  },
  "google/gemini-2.5-pro": {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    description: "Deep context analysis. Best for full history.",
    maxOutputTokens: 8192,
  },
  "deepseek/deepseek-chat": {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek Chat",
    provider: "deepseek",
    description: "Cost-efficient. Strong analytical reasoning.",
    maxOutputTokens: 8192,
  },
  "x-ai/grok-4": {
    id: "x-ai/grok-4",
    label: "Grok 4",
    provider: "grok",
    description: "Fast and capable. Great fallback option.",
    maxOutputTokens: 8192,
  },
};

export const DEFAULT_MODEL: OpenRouterModelId = "anthropic/claude-sonnet-4-5";

// ── Fallback order (all via OpenRouter) ──────────────────────
// If one model fails, the next is automatically tried.
export const MODEL_FALLBACK_ORDER: OpenRouterModelId[] = [
  "anthropic/claude-sonnet-4-5",
  "openai/gpt-4o",
  "google/gemini-2.5-flash",
  "deepseek/deepseek-chat",
  "x-ai/grok-4",
];

// ── Generation defaults ───────────────────────────────────────
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 8192;
export const REQUEST_TIMEOUT_MS = 120_000; // 2 min

// ── Token budgets ─────────────────────────────────────────────
export const MAX_TRADES_PER_PROMPT = 200;
export const MAX_JOURNAL_TEXT_CHARS = 400;
export const MAX_STRATEGY_TEXT_CHARS = 200;
export const MAX_EMOTIONS_TEXT_CHARS = 150;
export const MAX_LESSONS_TEXT_CHARS = 200;
export const CHUNK_SIZE_TRADES = 50;

// ── HTTP error → user message ─────────────────────────────────
export const HTTP_ERROR_MESSAGES: Record<number, string> = {
  400: "Bad request — the prompt may be malformed or too large.",
  401: "Invalid API key. Please check your OpenRouter key and try again.",
  402: "Insufficient credits. Please top up your OpenRouter account.",
  403: "Access denied. Your key may not have permission for this model.",
  404: "Model not found. It may be unavailable or deprecated on OpenRouter.",
  429: "Rate limit exceeded. Please wait a moment and try again.",
  500: "OpenRouter server error. Please retry in a few seconds.",
  503: "OpenRouter temporarily unavailable. Please retry shortly.",
};

// ── Retriable status codes ────────────────────────────────────
export const RETRIABLE_STATUS_CODES = new Set([429, 500, 503]);
