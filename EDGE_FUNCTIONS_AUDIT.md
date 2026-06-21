
# DaddyFxBook Edge Functions Audit

---

## ai-insights
### Purpose
Generates structured AI commentary for daily/weekly/monthly reports and trader scorecards, persists results to the database.

### Input payload
- mode: "period" or "scorecard"
- For period mode: period_type, period_start, period_end, stats, trades
- For scorecard mode: snapshot, trades_summary, trade_count

### Response payload
- For period mode: { report: object }
- For scorecard mode: { insights: object }

### Database tables used
- public.ai_period_reports (NOT IN PRODUCTION SCHEMA)
- public.ai_scorecards (NOT IN PRODUCTION SCHEMA)

### RPC calls used
None

### External APIs used
https://ai.gateway.lovable.dev/v1/chat/completions

### Environment variables used
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- LOVABLE_API_KEY (critical)

### OpenAI usage
None

### Gemini usage
Uses "google/gemini-2.5-flash" via Lovable AI gateway

### Anthropic usage
None

### Lovable dependencies
- ai.gateway.lovable.dev
- LOVABLE_API_KEY env var
- Tool-calling via Lovable's OpenAI-compatible API

### Security concerns
- Uses global API key (LOVABLE_API_KEY) instead of user-specific keys
- Persists to tables not in current production schema
- Risk of exceeding rate limits/credit usage across all users

### Recommendation
REWRITE - Can be modified to use user_settings.gemini_api_key and call Gemini directly, but requires rethinking persistence (if needed). If persistence is not required, can simplify to return insights on the fly without storing.

---

## backtest-ai
### Purpose
Analyzes a backtest session's trades, produces structured strengths/weaknesses/patterns/suggestions/scorecard/summary, persists to database.

### Input payload
- session_id: string

### Response payload
- { report: object }

### Database tables used
- public.backtest_sessions
- public.backtest_trades
- public.backtest_ai_reports (NOT IN PRODUCTION SCHEMA)

### RPC calls used
None

### External APIs used
https://ai.gateway.lovable.dev/v1/chat/completions

### Environment variables used
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- LOVABLE_API_KEY (critical)

### OpenAI usage
None

### Gemini usage
Uses "google/gemini-2.5-flash" via Lovable AI gateway

### Anthropic usage
None

### Lovable dependencies
- ai.gateway.lovable.dev
- LOVABLE_API_KEY env var
- Tool-calling via Lovable's OpenAI-compatible API

### Security concerns
- Uses global API key (LOVABLE_API_KEY) instead of user-specific keys
- Persists to tables not in current production schema

### Recommendation
REWRITE - Can be modified to use user_settings.gemini_api_key and call Gemini directly, can optionally persist to a new/updated table if needed.

---

## market-ai
### Purpose
Generates structured AI analysis for a single economic event, covering explanation/bias prediction/asset impact/educational guidance/historical behavior/warnings.

### Input payload
- event: any object with title/forecast/previous/actual

### Response payload
- { analysis: object }

### Database tables used
None

### RPC calls used
None

### External APIs used
https://ai.gateway.lovable.dev/v1/chat/completions

### Environment variables used
- LOVABLE_API_KEY (critical)

### OpenAI usage
None

### Gemini usage
Uses "google/gemini-2.5-flash" via Lovable AI gateway

### Anthropic usage
None

### Lovable dependencies
- ai.gateway.lovable.dev
- LOVABLE_API_KEY env var
- Tool-calling via Lovable's OpenAI-compatible API

### Security concerns
- Uses global API key (LOVABLE_API_KEY) instead of user-specific keys

### Recommendation
REWRITE OR REMOVE - If keeping, modify to use user_settings.gemini_api_key and call Gemini directly. If not core feature, can be removed.

---

## market-events
### Purpose
Fetches upcoming week's economic calendar from free ForexFactory feed and normalizes the data for the Market page.

### Input payload
None (GET request, optionally POST)

### Response payload
- { events: array of normalized event objects }

### Database tables used
None

### RPC calls used
None

### External APIs used
https://nfs.faireconomy.media/ff_calendar_thisweek.json

### Environment variables used
- SUPABASE_URL
- SUPABASE_ANON_KEY
- (NO AI/LLM env vars)

### OpenAI usage
None

### Gemini usage
None

### Anthropic usage
None

### Lovable dependencies
None

### Security concerns
- No AI/LLM security concerns
- Auth check (only authenticated users can call)

### Recommendation
KEEP - Core feature, no AI/Lovable dependencies, no hardcoded keys, uses only public calendar feed.

---

## Migration Priority

### Priority 1
- market-events: KEEP (no changes needed)
- ai-report: ALREADY MIGRATED to use user_settings.gemini_api_key

### Priority 2
- ai-insights: REWRITE (if keeping the feature)
- backtest-ai: REWRITE (if keeping the feature)

### Priority 3
- market-ai: OPTIONAL (rewrite or remove)

---

## Additional Findings
- No hardcoded API keys found in any function
- No OpenAI/Anthropic SDK imports
- All AI functions use Lovable's ai.gateway.lovable.dev
- All AI functions use model "google/gemini-2.5-flash"
- No OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY found in code (all rely on LOVABLE_API_KEY)
