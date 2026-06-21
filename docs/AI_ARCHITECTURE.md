# AI Architecture — DaddyFxBook

## Overview

The AI Report is the flagship feature of DaddyFxBook. It delivers an elite-level trading performance analysis using the trader's own [OpenRouter](https://openrouter.ai) API key. OpenRouter acts as a unified gateway — a single key gives access to Claude, GPT-4o, Gemini, DeepSeek, Grok, and more.

The architecture is designed for reliability (automatic model fallback), scalability (token-safe chunking), and future extensibility (modular provider interface).

---

## Folder Structure

```
src/lib/ai/
│
├── providers/
│   ├── types.ts                   Interfaces: AIProvider, AIRequest, AIResponse, OpenRouterModelId
│   └── openrouter.provider.ts     OpenRouter Chat Completions API (sole transport)
│
├── constants.ts                   Model registry, error messages, token limits, fallback order
├── aiService.ts                   Orchestrator: validateKey, callModel, generateWithFallback
├── promptBuilder.ts               35-section elite coaching prompt builder
├── chunking.ts                    Large dataset splitting (prevents context overflow)
├── tokenEstimator.ts              Fast approximate token counting
├── reportFormatter.ts             Parses raw Markdown → typed FormattedReport
└── index.ts                       Public exports (single import point)
```

---

## Data Flow

```
User clicks "Generate"
         ↓
[AIReport.tsx] Resolves date range
         ↓
fetchExportData(userId, start?, end?)   ← Supabase
         ↓ { trades, journals, checklists, screenshots }
buildScorecard(...)   ← deterministic TypeScript, no AI involved
         ↓ ScorecardSnapshot (5 pillar scores)
buildPrompt(input)   ← all metrics pre-computed client-side
         ↓ ~8,000–15,000 token prompt
generateWithFallback({ apiKey, preferredModel, prompt, ... })
         ↓ tries: Claude Sonnet → GPT-4o → Gemini Flash → DeepSeek → Grok
POST https://openrouter.ai/api/v1/chat/completions
         ↓ raw Markdown response
formatAIReport(markdown, scorecard, meta)
         ↓ FormattedReport { sections[], scores{}, strengths[], actionPlan[], ... }
UI renders 35 collapsible sections + scorecard + coach message
```

---

## OpenRouter Provider

**Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions`

**Headers:**
```
Authorization: Bearer {apiKey}
Content-Type:  application/json
HTTP-Referer:  window.location.origin
X-Title:       DaddyFxBook
```

**Request body:**
```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user",   "content": "..." }
  ],
  "temperature": 0.7,
  "max_tokens": 8192
}
```

All models (Claude, GPT-4o, Gemini, DeepSeek, Grok) are accessed through this single endpoint.

---

## Supported Models

| Model ID | Label | Provider | Use Case |
|---|---|---|---|
| `anthropic/claude-sonnet-4-5` | Claude Sonnet 4.5 | Anthropic | Best for psychology & reasoning (**default**) |
| `openai/gpt-4o` | GPT-4o | OpenAI | Best for structured analysis |
| `google/gemini-2.5-flash` | Gemini 2.5 Flash | Google | Fastest, best for large datasets |
| `google/gemini-2.5-pro` | Gemini 2.5 Pro | Google | Deepest context window |
| `deepseek/deepseek-chat` | DeepSeek Chat | DeepSeek | Cost-efficient |
| `x-ai/grok-4` | Grok 4 | xAI | Reliable fallback |

---

## Fallback System

`generateWithFallback()` automatically retries the next model on any failure:

```
Claude Sonnet 4.5 → GPT-4o → Gemini 2.5 Flash → DeepSeek Chat → Grok 4
```

**Failure triggers:**
- HTTP 401 (bad key)
- HTTP 402 (insufficient credits)
- HTTP 403 (access denied)
- HTTP 404 (model unavailable)
- HTTP 429 (rate limited)
- HTTP 500/503 (server error)
- Network timeout (2 minutes)
- Empty / safety-filtered response

The user sees live toast notifications when a model fails and the next is tried. The error card shows which models were attempted.

---

## Prompt Strategy

The 35-section prompt in `promptBuilder.ts` uses a three-layer approach:

### Layer 1 — System Instruction
A strict persona: elite prop firm coach, psychologist, risk manager. Data-driven only. No hallucinations.

### Layer 2 — Pre-computed Metrics (ground truth)
All arithmetic is computed in TypeScript before the prompt is assembled. The LLM receives finished tables, not raw data to crunch. This guarantees accuracy and reduces tokens significantly.

Metrics computed client-side:
- Core stats (win rate, P&L, profit factor, expectancy, avg RR)
- Direction breakdown (Long vs Short)
- Session analysis
- Symbol analysis
- Day-of-week table
- Top UTC hours by trade count
- Revenge trade detection (loss → <30 min gap → bigger lot)
- FOMO cluster detection (>3 trades within 15 min window)
- Overtrading days (>5 trades/day)
- Loss and win streaks (≥3)
- Max drawdown
- Scorecard (5 pillars, 0–100)
- Emotion keyword frequency
- Strategy setup distribution

### Layer 3 — Compact Trade Data
Each trade is a minimal JSON object. Fields filtered by user's Include Data toggles. Text fields truncated to budget limits.

---

## Scoring System

Scores are computed in `src/lib/scoring.ts` — never by the LLM.

| Pillar | Key Factors |
|---|---|
| Discipline | Rule adherence, session adherence, trade frequency |
| Risk Management | SL usage, lot consistency, drawdown health |
| Execution | Win rate, payoff ratio, checklist completion |
| Psychology | Revenge trading, FOMO, journaling rate |
| Consistency | Profitable periods, metric stability |

---

## Token Management

| Limit | Value |
|---|---|
| Max trades per prompt | 200 (most recent) |
| Journal text per field | 400 characters |
| Strategy text | 200 characters |
| Emotion text | 150 characters |
| Lessons text | 200 characters |
| Max output tokens | 8192 |

---

## Error Handling

| HTTP Code | Message |
|---|---|
| 401 | Invalid API key. Check your OpenRouter key. |
| 402 | Insufficient credits. Top up your account. |
| 403 | Access denied. Key may lack model permissions. |
| 404 | Model unavailable or deprecated. |
| 429 | Rate limit exceeded. Wait and retry. |
| 500/503 | OpenRouter server error. Retry. |
| Timeout | Timed out. Try smaller date range or faster model. |
| Empty | Model returned nothing. Retry. |
| Safety | Blocked by content filter. |

---

## Security

- API keys stored in `localStorage` only — on the user's own device
- Keys sent directly from the browser to OpenRouter over HTTPS
- Keys never stored in DaddyFxBook backend, database, or logs
- Each key validated with a lightweight ping call before generation

---

## Future Expansion

### Adding a new model
1. Add an entry to `OPENROUTER_MODELS` in `constants.ts`
2. Optionally add to `MODEL_FALLBACK_ORDER`
3. Zero other changes needed

### Adding a different provider (e.g., direct Anthropic API)
1. Create `src/lib/ai/providers/anthropic.provider.ts`
2. Implement the `AIProvider` interface from `providers/types.ts`
3. Register in `aiService.ts`
4. No other changes needed

### Streaming support
Replace the `fetch` call in `openrouter.provider.ts` with a streaming fetch + `ReadableStream` decoder. Expose a callback in `GenerateWithFallbackOptions`. No prompt or formatter changes needed.
