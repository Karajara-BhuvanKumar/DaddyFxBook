// ============================================================
// Placeholder providers — scaffolded for future implementation.
// Each must implement AIProvider fully before activation.
// ============================================================

import type { AIProvider, AIRequest, AIResponse, ProviderName } from "./types";

function notImplemented(provider: ProviderName): AIResponse {
  return {
    success: false,
    provider,
    model: "",
    report: "",
    timestamp: new Date().toISOString(),
    error: `${provider} provider is not yet configured. Please use Gemini for now.`,
  };
}

// ── OpenAI ───────────────────────────────────────────────────
export class OpenAIProvider implements AIProvider {
  readonly name = "openai" as const;
  getSupportedModels() { return ["gpt-4o", "gpt-4-turbo", "gpt-4o-mini"]; }
  async validateKey(_apiKey: string): Promise<boolean> { return false; }
  async generateReport(request: AIRequest): Promise<AIResponse> {
    return { ...notImplemented("openai"), model: request.model };
  }
}

// ── Claude ───────────────────────────────────────────────────
export class ClaudeProvider implements AIProvider {
  readonly name = "claude" as const;
  getSupportedModels() { return ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-3-5"]; }
  async validateKey(_apiKey: string): Promise<boolean> { return false; }
  async generateReport(request: AIRequest): Promise<AIResponse> {
    return { ...notImplemented("claude"), model: request.model };
  }
}

// ── DeepSeek ─────────────────────────────────────────────────
export class DeepSeekProvider implements AIProvider {
  readonly name = "deepseek" as const;
  getSupportedModels() { return ["deepseek-chat", "deepseek-reasoner"]; }
  async validateKey(_apiKey: string): Promise<boolean> { return false; }
  async generateReport(request: AIRequest): Promise<AIResponse> {
    return { ...notImplemented("deepseek"), model: request.model };
  }
}

// ── OpenRouter ───────────────────────────────────────────────
export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter" as const;
  getSupportedModels() { return ["anthropic/claude-opus-4", "openai/gpt-4o"]; }
  async validateKey(_apiKey: string): Promise<boolean> { return false; }
  async generateReport(request: AIRequest): Promise<AIResponse> {
    return { ...notImplemented("openrouter"), model: request.model };
  }
}

// ── Grok ─────────────────────────────────────────────────────
export class GrokProvider implements AIProvider {
  readonly name = "grok" as const;
  getSupportedModels() { return ["grok-3", "grok-3-mini"]; }
  async validateKey(_apiKey: string): Promise<boolean> { return false; }
  async generateReport(request: AIRequest): Promise<AIResponse> {
    return { ...notImplemented("grok"), model: request.model };
  }
}
