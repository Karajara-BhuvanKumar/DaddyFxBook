import { describe, expect, it, vi } from "vitest";
import { checkCoachProvider, generateCoachCompletion } from "../../supabase/functions/performance-coach/openrouter";

const reply = (status: number, body: unknown) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body } as Response)) as typeof fetch;

describe("Performance Coach provider", () => {
  it("uses one configured model and a chat completion request", async () => {
    const fetcher = reply(200, { choices: [{ finish_reason: "stop", message: { content: '{"verdict":"evidence"}' } }] });
    const result = await generateCoachCompletion("server-key", "google/gemini-2.5-flash", "real trade evidence", "ground responses", fetcher);
    expect(result.report).toContain("evidence");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: "ground responses" }, { role: "user", content: "real trade evidence" }] });
  });
  it.each([
    [402, "billing", false], [404, "invalid_model", false], [401, "authentication", false], [429, "rate_limit", true], [503, "provider", true],
  ] as const)("classifies HTTP %i without trying another model", async (status, code, retryable) => {
    const fetcher = reply(status, { error: { message: "provider detail" } });
    await expect(generateCoachCompletion("server-key", "configured-model", "evidence", "instructions", fetcher)).rejects.toMatchObject({ code, retryable });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("detects an exhausted key before generation and does not make a paid call", async () => {
    const fetcher = reply(200, { data: { limit_remaining: 0 } });
    await expect(checkCoachProvider("server-key", fetcher)).rejects.toMatchObject({ code: "billing" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects truncated and empty responses", async () => {
    await expect(generateCoachCompletion("key", "model", "evidence", "instructions", reply(200, { choices: [{ finish_reason: "length", message: { content: "partial" } }] }))).rejects.toMatchObject({ code: "invalid_response" });
    await expect(generateCoachCompletion("key", "model", "evidence", "instructions", reply(200, { choices: [] }))).rejects.toMatchObject({ code: "invalid_response" });
  });
});
