// ============================================================
// Placeholder providers for future expansion.
// These stubs let you import them without breaking the build.
// Implement fully when adding a new provider.
// ============================================================

export async function generateOpenAIResponse(_opts: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  throw new Error("OpenAI provider is not yet implemented.");
}

export async function generateClaudeResponse(_opts: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  throw new Error("Anthropic Claude provider is not yet implemented.");
}

export async function generateDeepSeekResponse(_opts: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  throw new Error("DeepSeek provider is not yet implemented.");
}

export async function generateOpenRouterResponse(_opts: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  throw new Error("OpenRouter provider is not yet implemented.");
}
