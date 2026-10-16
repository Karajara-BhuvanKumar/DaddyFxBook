# Reliability and timezone verification — 15 October 2026

## Changes

- Performance Coach checks the server key and account-specific model availability. Failed checks cannot leave a cached ready indicator. Generation rechecks the connection, preserves prior reviews on failure, and handles billing/model/authentication/network errors without exposing provider responses or keys.
- Response-body stalls, malformed JSON, and provider errors returned inside HTTP 200 responses now fail explicitly. Requests use the configured model with structured JSON output; no model fallback or fabricated review is used.
- Trades, trade editing, journal filters/exports, analysis day/month grouping, Dashboard calendar, and Coach custom windows use the saved workspace timezone. New defaults use IST; explicitly saved UTC is preserved. Holding durations remain elapsed time between absolute timestamps.
- Unchanged trade dates preserve seconds and ambiguous DST instants. Missing DST times are rejected. Date ranges include complete 23/25-hour DST days. Last Month handles month-end correctly.
- Dashboard and Analysis share validated closed-trade metrics and the same breakeven convention. Dashboard's month shortcut means 30 days, and its rolling scope refreshes each minute/on foregrounding. History counts distinguish the current page, matching records, and all records.
- New backtest trade dates use the saved timezone; historical date-only backtest values are unchanged.

## Validation

- Full automated suite: 35 files, 322 tests passed. Includes provider status/failure handling, prior-review retention, saved timezone defaults, midnight boundaries, exports, DST, financial calculations, journal save/drafts, and existing rules/tools coverage.
- TypeScript application check passed. Production build passed before final deployment; build retains existing large-bundle warnings.
- Authenticated local checks: Dashboard/Analysis totals agree over the same 30-day scope; today's calendar agrees with Today filtering; trade editor matches history times and holding duration. Editor dismissed without saving.
- Journal saved entries, counts, Light Mode editor layout, and export selection loaded. Existing rules, backtest session list and session trades, Settings preferences, and workspace search inspected.
- No historical trade, journal, rule, or backtest records were changed during these browser checks. Tests use isolated mocks; no mock provider responses are used in production.

## External dependency

The production `performance-coach` function was backed up and deployed as version 2 in the existing Supabase project, with JWT verification retained. The server still requires a funded `OPENROUTER_API_KEY`. The account owner deferred configuring it. Real AI generation, save, and reopen cannot be verified until that secret is available; automated success/failure tests are not a substitute for that live verification. Existing review storage remains per-account browser storage, not cloud sync.

## Follow-up verification — 16 October 2026

- Confirmed the deployed Coach returns the precise missing-server-key error while authenticated. Generate opens the connection explanation; Past Reviews remains accessible with an honest empty state. No successful live generation is claimed.
- Inspected real Dashboard at 390 px, mobile navigation, journal list-to-editor flow at 390 px, journal at 768 px in dark/light themes, and Analysis at 320 px in Light Mode. Preserved the account's accent and restored Dark Mode.
- Production deep links load successfully. The deployed Trades page shows saved-zone timestamps and distinct page/matching/total counts.
- Live cross-page comparison revealed that History's Last 30 Days used calendar midnights while Dashboard/Analysis used rolling hours. Corrected History to the same rolling interval, including the boundary instant and excluding future trades; added a cross-page regression test.
- The final focused suites passed 25 tests, including the additional rolling-window regression (323 tests across the full and focused runs).
- Downloaded a real saved journal as CSV from production. Confirmed opening/closing times, Asia/Kolkata display timezone, and elapsed holding duration match the editor. The export showed a success notification.
