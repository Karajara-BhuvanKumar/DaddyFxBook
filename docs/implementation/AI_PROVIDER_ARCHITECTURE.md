# AI Provider Architecture — DaddyFxBook

## Overview

The AI Report engine is the flagship feature of DaddyFxBook. It acts as an elite-level trading coach that analyzes the trader's complete database and delivers an expert-grade performance report using external LLM providers.

---

## Folder Structure

```
src/lib/ai/
├── constants.ts       Model registry, error codes, token limits
├── gemini.ts          Gemini REST API integration
├── openai.ts          OpenAI placeholder (future)
├── claude.ts          Anthropic Claude placeholder (future)
├── deepseek.ts        DeepSeek placeholder (future)
├── openrouter.ts      OpenRouter placeholder (future)
├── reportEngine.ts    Prompt builder + response parser
└── index.ts           Public exports
```

---

## Data Flow

```
User Clicks "Generate"
         ↓
fetchExportData(userId, startDate?, endDate?)
         ↓ (Supabase parallel fetch)
trades + journals + checklists + screenshots
         ↓
buildScorecard(trades, journals, checklists, grades)
         ↓ (deterministic scoring — no AI)
ScorecardSnapshot { discipline, risk, execution, psychology, consistency }
         ↓
buildAIReportPrompt(data, options)
         ↓ (prompt construction + data sanitization)
Full structured Markdown prompt (data-only, no hallucination possible)
         ↓
generateGeminiResponse({ apiKey, prompt, model, temperature, maxOutputTokens })
         ↓ (Gemini REST API call)
rawMarkdown response
         ↓
parseAIReportMarkdown(markdown, scorecard)
         ↓
ParsedAIReport { sections[], strengths[], weaknesses[], actionPlan[], scores{} }
         ↓
UI Renders Report Cards
```

---

## Prompt Strategy

The prompt is constructed in `reportEngine.ts` using a multi-stage approach:

### 1. System Instruction
A hardcoded persona: "Elite trading coach with 20+ years of prop firm experience. Data-driven. Never hallucinate."

### 2. Pre-computed Metrics Section
The following metrics are calculated client-side before sending to the LLM to:
- Reduce the chance of mathematical errors by the LLM
- Save tokens by not sending raw trade rows for numeric analysis
- Guarantee score accuracy

Pre-computed metrics:
- Win rate, gross profit, gross loss, profit factor
- Average lot size, lot variance
- Session breakdown (by_session)
- Symbol breakdown (by_symbol)
- Day-of-week breakdown (by_day)
- Time-of-day breakdown (by_hour, UTC)
- Suspected revenge trades (loss → <30 min gap → larger lot)
- Loss streaks
- Scorecard snapshot (100-point system)

### 3. Raw Trade Data Section
Each trade is serialized as a JSON object. Fields are filtered based on user checkboxes to:
- Respect user's data inclusion preferences
- Avoid token overflow with irrelevant data
- Protect data privacy

### 4. Report Structure Instructions
The LLM is instructed to return exactly 35 numbered Markdown sections, making parsing deterministic and reliable.

---

## Scoring System

All scores are computed in `src/lib/scoring.ts` — deterministically, without AI.

| Score | Factors | Weight |
|---|---|---|
| Discipline | Rule adherence, Session adherence, Overtrading, Frequency | 20% |
| Risk Management | SL usage, Risk consistency, Drawdown health, Position sizing | 25% |
| Execution | Win rate, Payoff ratio, AI review grades, Checklist completion | 25% |
| Psychology | Revenge trading, FOMO clusters, Journaling rate, Emotion tone | 15% |
| Consistency | Profitable months, Win-rate stability, Risk stability, Drawdown stability | 15% |

**Overall Score** = weighted sum of all five pillars.

Classification:
- 85-100: Elite
- 70-84: Advanced
- 50-69: Developing
- 0-49: Beginner

---

## Token Overflow Prevention

- Maximum 200 trades sent per prompt (`MAX_TRADES_PER_PROMPT`)
- Journal text truncated to 400 characters per entry (`MAX_JOURNAL_TEXT_CHARS`)
- Strategy setup text truncated to 200 characters
- Emotions field truncated to 150 characters
- Lessons field truncated to 200 characters
- Only top 5 UTC hours by trade count included in time analysis
- Pre-computed aggregates replace raw data where possible

---

## Error Handling

| Error Code | User Message |
|---|---|
| 400 | "Bad request — the prompt may be malformed or too long." |
| 401 | "Invalid API key. Please check your Gemini API key." |
| 403 | "Access denied. Your API key may not have permission for this model." |
| 404 | "Model not found." |
| 429 | "Rate limit exceeded. Please wait a moment." |
| 500 | "Gemini server error. Please try again." |
| Network | "Network error: {message}" |
| Timeout | "Request timed out. Try reducing the data range." |
| Empty response | "Gemini returned an empty response. Please try again." |
| Safety filter | "Response blocked by Gemini safety filters." |

---

## Model Registry

All supported models are defined in `constants.ts` in the `GEMINI_MODELS` object. Adding a new model requires only adding a new entry to this object — no changes required anywhere else.

```typescript
export const GEMINI_MODELS = {
  "gemini-2.5-flash": { ... },
  "gemini-2.5-pro": { ... },
  "gemini-2.0-flash": { ... },
  // Add new models here
};
```

---

## Future Provider Extension

To add a new AI provider (e.g., OpenAI):

1. Open `src/lib/ai/openai.ts`
2. Implement `generateOpenAIResponse(opts: OpenAIOptions): Promise<GeminiResponse>`
3. Add provider selection UI to `AIReport.tsx`
4. Export from `index.ts`
5. No other files need to change

---

## API Key Security

- Keys are stored in the browser's `localStorage` only
- Keys are never sent to DaddyFxBook's backend
- Keys are included in HTTPS requests to the provider's REST API
- Keys are validated with a lightweight test call before allowing report generation
- The UI masks the key with a password field
