// ============================================================
// Token Estimator
// Provides fast approximate token counts without external libs.
// Rule of thumb: 1 token ≈ 4 characters for English prose,
// ≈ 2.5 characters for dense JSON/code.
// ============================================================

const CHARS_PER_TOKEN_PROSE = 4;
const CHARS_PER_TOKEN_JSON = 2.5;

/** Rough token estimate for a plain text string. */
export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN_PROSE);
}

/** Rough token estimate for a JSON-serializable value. */
export function estimateJsonTokens(value: unknown): number {
  const json = typeof value === "string" ? value : JSON.stringify(value);
  return Math.ceil(json.length / CHARS_PER_TOKEN_JSON);
}

/** Estimate the total token count of a fully-assembled prompt string. */
export function estimatePromptTokens(prompt: string): number {
  // Mixed content — use average
  return Math.ceil(prompt.length / 3.2);
}

/** Returns true when the estimated tokens are within the budget. */
export function isWithinTokenBudget(prompt: string, maxTokens: number, outputReserve = 2048): boolean {
  const contextLimit = maxTokens + outputReserve;
  const estimated = estimatePromptTokens(prompt);
  return estimated < contextLimit;
}

/** Truncate a string to approximately `maxTokens` tokens. */
export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN_PROSE;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}
