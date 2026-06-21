// ============================================================
// Claude, DeepSeek, OpenRouter stubs
// ============================================================

export async function generateClaudeResponse(_opts: {
  apiKey: string;
  prompt: string;
  model?: string;
}): Promise<string> {
  throw new Error("Anthropic Claude provider is not yet implemented.");
}
