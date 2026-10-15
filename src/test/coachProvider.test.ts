import { describe, expect, it, vi } from "vitest";
import { checkCoachProvider, generateCoachCompletion } from "../../supabase/functions/performance-coach/openrouter";

const reply = (status: number, body: unknown) => vi.fn(async () => ({ ok: status >= 200 && status < 300, status, json: async () => body } as Response)) as typeof fetch;

describe("Performance Coach provider", () => {
  it("confirms both the key and the account's configured model without a paid request", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { limit_remaining: null } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'my-model' }] }) });
    await expect(checkCoachProvider('key', fetcher, 'my-model')).resolves.toMatchObject({ limitRemaining: null, model: 'my-model' });
    expect(fetcher.mock.calls.map(call => call[0])).toEqual(['https://openrouter.ai/api/v1/key', 'https://openrouter.ai/api/v1/models/user?limit=500&offset=0']);
  });
  it("rejects an unavailable model even with a valid key", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: { limit_remaining: 10 } }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'different-model' }] }) });
    await expect(checkCoachProvider('key', fetcher, 'my-model')).rejects.toMatchObject({ code: 'invalid_model' });
  });
  it.each([{}, { data: {} }, { data: { limit_remaining: '10' } }])("does not accept malformed key status %j", async body => {
    await expect(checkCoachProvider('key', reply(200, body))).rejects.toMatchObject({ code: 'invalid_response' });
  });
  it("recognizes a provider error inside an HTTP 200 response", async () => {
    await expect(generateCoachCompletion('key', 'model', 'evidence', 'instructions', reply(200, { error: { code: 402 } }))).rejects.toMatchObject({ code: 'billing' });
  });
  it("keeps the timeout active while reading the response body", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(async (_url, init) => ({ ok: true, json: () => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))) })) as unknown as typeof fetch;
      const result = expect(generateCoachCompletion('key', 'model', 'evidence', 'instructions', fetcher)).rejects.toMatchObject({ code: 'timeout' });
      await vi.advanceTimersByTimeAsync(110_000);
      await result;
    } finally { vi.useRealTimers(); }
  });
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
