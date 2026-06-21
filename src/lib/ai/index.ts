// ============================================================
// AI Library — Public Index
// Import EVERYTHING from "@/lib/ai" — do not import sub-files
// directly from the UI layer.
// ============================================================

// ── Types ─────────────────────────────────────────────────────
export type {
  AIProvider,
  AIRequest,
  AIResponse,
  ProviderName,
  ModelDefinition,
  OpenRouterModelId,
} from "./providers/types";

// ── Constants ─────────────────────────────────────────────────
export {
  OPENROUTER_MODELS,
  DEFAULT_MODEL,
  MODEL_FALLBACK_ORDER,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  MAX_TRADES_PER_PROMPT,
  HTTP_ERROR_MESSAGES,
} from "./constants";

// ── AI Service ────────────────────────────────────────────────
export {
  validateOpenRouterKey,
  callModel,
  generateWithFallback,
} from "./aiService";
export type { GenerateWithFallbackOptions, FallbackResult } from "./aiService";

// ── Prompt Builder ────────────────────────────────────────────
export { buildPrompt, AI_SYSTEM_INSTRUCTION } from "./promptBuilder";
export type { IncludeFlags, PromptBuilderInput } from "./promptBuilder";

// ── Chunking ──────────────────────────────────────────────────
export { chunkTradeData, buildSingleChunk } from "./chunking";
export type { DataChunk, ChunkingResult } from "./chunking";

// ── Token Estimator ───────────────────────────────────────────
export { estimatePromptTokens, isWithinTokenBudget, truncateToTokens } from "./tokenEstimator";

// ── Report Formatter ──────────────────────────────────────────
export { formatAIReport, reportToPlainText } from "./reportFormatter";
export type { FormattedReport, ReportSection } from "./reportFormatter";
