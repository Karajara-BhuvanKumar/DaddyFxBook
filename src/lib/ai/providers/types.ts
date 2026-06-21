// ============================================================
// AI Provider Type Contracts
// Single source of truth for all provider interfaces.
// ============================================================

export type ProviderName =
  | "openrouter"
  | "gemini"
  | "openai"
  | "claude"
  | "deepseek"
  | "grok";

// All models are routed through OpenRouter.
// These are the canonical model IDs used in API calls.
export type OpenRouterModelId =
  | "anthropic/claude-sonnet-4-5"
  | "openai/gpt-4o"
  | "google/gemini-2.5-flash"
  | "google/gemini-2.5-pro"
  | "deepseek/deepseek-chat"
  | "x-ai/grok-4";

export interface ModelDefinition {
  id: OpenRouterModelId;
  label: string;
  provider: ProviderName;
  description: string;
  maxOutputTokens: number;
  isDefault?: boolean;
}

export interface AIRequest {
  apiKey: string;
  model: OpenRouterModelId | string;
  prompt: string;
  systemInstruction?: string;
  temperature: number;
  maxTokens: number;
}

export interface AIResponse {
  success: boolean;
  provider: string;
  model: string;
  report: string;
  timestamp: string;
  tokensUsed?: number;
  latencyMs?: number;
  error?: string;
}

export interface AIProvider {
  readonly name: ProviderName;
  generateReport(request: AIRequest): Promise<AIResponse>;
  validateKey(apiKey: string, model?: string): Promise<boolean>;
  getSupportedModels(): OpenRouterModelId[];
}
