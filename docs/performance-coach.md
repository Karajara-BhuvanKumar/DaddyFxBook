# Performance Coach

The `/ai-report` page uses a compact review builder and a structured report: verdict, ranked findings, strengths, five dimensions, process measures, prior-period comparisons, and a measurable next-session plan. Provider calls run through an authenticated server function. Connection status remains in a secondary dialog. Existing scorecards remain accessible using their original calculations.

## Data and evidence

`src/lib/coach/data.ts` loads account-scoped trades, journals, checklists, screenshot metadata, rules, and manual violations in stable 500-row pages. Trade-fetch failures stop generation. Optional-source failures are disclosed as unknown. No database migration is required.

Windows are half-open and based on trade entry time. Daily, Weekly, and Monthly mean the last 24 hours, 7 days, and 30 days. Custom dates use Asia/Kolkata (IST) calendar days and include the end day up to now. Comparisons use the immediately preceding interval of equal duration, with at least five trades in each interval; All Time has no previous period.

`analysis.ts` removes excluded fields before producing evidence. Aggregates cover the entire selected window. Prompt details are evenly sampled (up to 160 trades, reduced when text exceeds the detail budget). Excerpts, setup groups, and example records are bounded and the limitations are disclosed. Screenshot coverage is metadata only; no images are analyzed. Drawdown is based on cumulative closed P&L, not account equity. Lot sizes do not establish monetary risk. Keyword mentions are never treated as proof of a psychological state.

## Transparent process measures

These are separate from the coach's qualitative interpretation and are not an overall trader grade:

- Discipline: checked boolean checklist answers / recorded answers; minimum three checklists. Missing answers are unknown.
- Risk: trades with a positive recorded stop / selected trades; minimum three trades. This measures documentation, not actual protection.
- Execution: checked plan-fit, higher-timeframe, and key-level answers / recorded answers; minimum three checklists.
- Psychology: trades with emotion notes / selected trades; minimum three trades. Negative emotions are not penalized.
- Consistency: `max(0, 1 - 2 * standard deviation of weekly win rates) * 100`; minimum three UTC weeks with three trades each. Stable losses can also produce a high measure.

## Generation and history

Generation re-fetches current data and snapshots the selected sources/window. The browser sends the selected evidence to the authenticated `performance-coach` Supabase Edge Function. The function reads `OPENROUTER_API_KEY` from its production secrets and uses `OPENROUTER_MODEL` when set, or `google/gemini-2.5-flash` by default. No key enters a frontend bundle or browser request. The function makes one chat-completions request; billing, authentication, rate-limit, invalid-model, timeout, and network failures are reported separately. There is no automatic model fallback.

The structured response must satisfy a schema, include all five dimensions, reference known evidence IDs, and have at most three immediate priorities. Invalid, truncated, failed, or cancelled generations preserve the previous report. Citation validation checks references and structure; it cannot guarantee the model's interpretation is correct. Root causes are requested as hypotheses with alternatives and tests.

The five latest completed reviews are stored per account in this browser, with detailed prompt samples omitted. Stored snapshots are validated before display. Copy/download exports contain supporting observations. History is not cloud-synced. Legacy browser-stored OpenRouter keys are removed when the Coach opens. Server-side secrets are configured in the DaddyFxBook Supabase project's Edge Function Secrets page.

## Validation

Unit coverage includes window boundaries, source exclusion, sampling, minimum evidence, outcome calculations, citation validation, storage isolation/corruption, provider errors, and source failures. Browser QA with simulated account and AI responses covers period selection, source selection, generation, duplicate clicks, reload/history, and billing, model, and network failures. A successful live-model review and production account connectivity still require a funded server-side key and a signed-in user session.
