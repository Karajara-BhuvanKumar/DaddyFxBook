# Performance Coach

The `/ai-report` page uses a compact review builder and a structured report: verdict, ranked findings, strengths, five dimensions, process measures, prior-period comparisons, and a measurable next-session plan. Model routing stays inside the existing AI service. Connection settings remain in a secondary dialog. Existing scorecards remain accessible using their original calculations.

## Data and evidence

`src/lib/coach/data.ts` loads account-scoped trades, journals, checklists, screenshot metadata, rules, and manual violations in stable 500-row pages. Trade-fetch failures stop generation. Optional-source failures are disclosed as unknown. No database migration is required.

Windows are half-open and based on trade entry time. Daily, Weekly, and Monthly mean the last 24 hours, 7 days, and 30 days. Custom dates use the browser timezone and include the end day up to now. Comparisons use the immediately preceding interval of equal duration, with at least five trades in each interval; All Time has no previous period.

`analysis.ts` removes excluded fields before producing evidence. Aggregates cover the entire selected window. Prompt details are evenly sampled (up to 160 trades, reduced when text exceeds the detail budget). Excerpts, setup groups, and example records are bounded and the limitations are disclosed. Screenshot coverage is metadata only; no images are analyzed. Drawdown is based on cumulative closed P&L, not account equity. Lot sizes do not establish monetary risk. Keyword mentions are never treated as proof of a psychological state.

## Transparent process measures

These are separate from the coach's qualitative interpretation and are not an overall trader grade:

- Discipline: checked boolean checklist answers / recorded answers; minimum three checklists. Missing answers are unknown.
- Risk: trades with a positive recorded stop / selected trades; minimum three trades. This measures documentation, not actual protection.
- Execution: checked plan-fit, higher-timeframe, and key-level answers / recorded answers; minimum three checklists.
- Psychology: trades with emotion notes / selected trades; minimum three trades. Negative emotions are not penalized.
- Consistency: `max(0, 1 - 2 * standard deviation of weekly win rates) * 100`; minimum three UTC weeks with three trades each. Stable losses can also produce a high measure.

## Generation and history

Generation re-fetches current data and snapshots the selected sources/window. The structured response must satisfy a schema, include all five dimensions, reference known evidence IDs, and have at most three immediate priorities. Invalid, truncated, failed, or cancelled generations preserve the previous report. Citation validation checks references and structure; it cannot guarantee the model's interpretation is correct. Root causes are requested as hypotheses with alternatives and tests.

The five latest completed reviews are stored per account in this browser, with detailed prompt samples omitted. Stored snapshots are validated before display. Copy/download exports contain supporting observations. History is not cloud-synced. Connection keys remain browser-local under account-specific keys, matching the current direct OpenRouter architecture.

## Validation

Unit coverage includes window boundaries, source exclusion, sampling, minimum evidence, outcome calculations, citation validation, storage isolation/corruption, full pagination, source failures, and cancellation. Browser QA with simulated account and AI responses covers widths 320–1920, generation, evidence expansion, hypotheses, score explanations, export, reload/history, malformed output, network fallback, cancellation, and custom dates. Live model output quality and production account connectivity require real credentials and were not exercised by simulated QA.
