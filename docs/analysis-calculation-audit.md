# Analysis Calculation Audit

Audited 2026-10-05. No database records or schema were changed.

## Source of Truth

- Analysis reads the authenticated user's `public.trades`, not the visible Trades table or journal rows. An Analysis-specific keyset loader now retrieves every page, including server-shortened pages, with stable ID ordering, user scoping, abort support, and failure of the entire load if any page fails. Other pages' queries are unchanged.
- Both local migrations and the live schema contain `pnl`, entry/exit price, lot size, `open_time` and `close_time` (TIMESTAMPTZ). They contain no status, commissions, swaps, separate fees, account balance history, currency, or broker ticket. This is a closed-trade journal, not an open-position ledger. Deletion is physical and IDs are primary keys.
- All 101 records in the user-authorized account matched the app's rounded price-movement formula: signed price change times lots times 100. Stored P&L is therefore price-movement P&L, not demonstrably broker-net P&L. Analysis sums that authoritative field without recalculating it or inventing/deducting costs. Fees/swaps and open trades show `Not recorded`/`N/A`; misleading net-result labels were removed. Adding true broker-net accounting requires actual cost data and a defined accounting model, not assumed zero costs.
- The existing dollar/USD formatting convention remains. There is no multi-currency conversion source in this schema.
- Journal completeness does not control core totals. Journals only enrich the setup breakdown; a trade without a recognized setup still contributes to every applicable realized-trade statistic. Setup journals now load completely and share the existing journal mutation invalidation prefix.

## Dataset and Definitions

`includedClosedTrades` is the single normalized, filtered, chronologically ordered dataset in `src/lib/analysisStats.ts`.

- It validates finite amounts, entry/exit prices, positive lot size, direction, symbol, explicit-zone timestamps, timestamp ordering, and distinct trade IDs. Missing/invalid realized data, future closes, duplicate IDs, deleted flags, and non-closed status-bearing legacy/future rows are rejected and counted in a visible notice. Negative zero is normalized. Distinct IDs with identical amounts are not arbitrarily merged: no broker ticket exists to prove they are duplicates.
- Dates normalize to UTC. Today begins at UTC midnight; 7/30 Days are rolling durations; 3 Months/1 Year are calendar lookbacks clamped at month ends. Every scope ends at the current instant, including All Time. Date scope refreshes each minute and when foregrounded; the one-second session clock does not trigger stats computation or data fetching.
- Total = sum of stored realized P&L. Positive and negative decimal sums use decimal integer arithmetic to avoid ordinary cent-summation drift. Display formatting happens last; derived ratios retain floating-point precision.
- Wins: P&L > 0; losses: P&L < 0; break-even: P&L = 0. Win rate = wins / (wins + losses), consistently for the headline and direction, symbol, session and setup groups. Break-even counts are visible and remain included in trade counts and expectancy.
- Profit factor = gross positive P&L / absolute gross negative P&L. All-win is infinity; empty/all-break-even/all-loss is zero, never NaN.
- Expectancy = total / all included closed trades, or zero when empty. The weighted equivalent uses wins / ALL trades and losses / ALL trades. Using the displayed break-even-excluding win rate as its probability would not be equivalent when break-even trades exist.
- Best/worst trade are extrema of all included trades. Largest profit/loss clamp to zero if there is no result of that sign. Average winner/loser uses only the matching sign; losing averages remain negative. The former Risk:Reward label is now Avg Win:Loss, accurately describing the realized average-win/average-loss ratio rather than planned stop/target risk.
- Trade streaks use close-instant ordering, ID tie-breaks and break-even resets. Day streaks use successive active UTC trading dates (non-trading dates are skipped), with break-even days resetting streaks.
- Holding time = close minus entry. Daily averages divide by active trading days; average daily volume is lots per active day, not trade count. Monthly averages divide by active months. Best/worst month use the same filtered UTC close-date grouping.
- Equity and mini-chart show cumulative realized P&L in close-time order, beginning at zero. Drawdown is the decline from each running peak after EVERY trade, including intraday declines and losses below the starting zero. Dollar maximum drawdown is the largest such decline. Account drawdown percentage is unavailable without balance history; dividing a dollar decline by an unrelated final cumulative-profit peak was removed.
- Calendar daily values, weekly totals and day details all use included trades and UTC close dates. Navigating calendar months changes the displayed month, not the overall Analysis period.
- Sessions use actual UTC ENTRY timestamps and the displayed fixed boundaries (Asian 00-08/22-24, London 08-13, New York 13-22). The old approach silently skipped missing tags and could disagree with the displayed UTC windows. Manual/journal session tags are preserved in storage but do not override this time-based breakdown. Counts and P&L now reconcile across all three sessions; the percentage labeled Volume is correctly labeled Trade Share.

## Independent Live Verification

Read-only SQL was scoped to the account explicitly identified by the user. No other account's trades were read. Independent Postgres numeric aggregation at 2026-10-05 15:01:55 UTC returned:

| Scope | Trades | Wins | Losses | P&L | Gross profit | Gross loss | PF | Expectancy |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Old 30-day filter (no upper time bound) | 25 | 9 | 16 | 326.80 | 772.60 | -445.80 | 1.7330641543 | 13.072 |
| Correct 30-day scope as of audit time | 24 | 8 | 16 | 248.30 | 694.10 | -445.80 | 1.5569762225 | 10.3458333333 |

The screenshot's arithmetic was correct for those 25 stored records: 36.0%, 1.73 PF, $13.07 expectancy. Its dataset included one future-dated +78.50 trade closing at 18:16 UTC that day. The corrected as-of result is 33.3%, 1.56 PF and $10.35 expectancy. The record becomes eligible at its stored close instant. All 101 authorized account rows were also run locally through the new production calculation function; it matched the SQL result at audit time and the 25-trade result at 18:16 UTC. These private row fixtures are not included in the repository.

The trade-entry form sent `datetime-local` text without an offset, which PostgreSQL interprets using its timezone. The edit form also sliced UTC text directly into a local-time control. Both conversion paths are fixed without changing their appearance: local input becomes an explicit UTC ISO instant; editing displays local time; unchanged edits preserve the original instant and sub-minute precision. Historical timestamps are NOT rewritten, since the original intended timezone is unknown.

## Clock and Verification

Display update: at the user's request, the session bar, NOW tooltip and session-card time ranges now display IST (Asia/Kolkata). The existing absolute session windows are unchanged: the bar runs from 05:30 IST to 05:30 IST the following day, with boundaries at 13:30, 18:30 and 03:30. Trade filtering and accounting still use UTC instants.

The isolated, memoized session timeline reads the actual clock each second, aligns the next callback to the next second, updates active-session semantics, and resynchronizes on focus/visibility changes. Seconds and milliseconds determine position. UTC has no DST offsets. Timers/listeners are removed on unmount and midnight resets position to zero without accumulating timer drift. Styling, session boundaries and track proportions are unchanged.

Automated coverage includes headline identities, all-win/all-loss/empty/break-even cases, decimals, invalid records, duplicate IDs, future closes, offset dates, intraday drawdown, common filters, pagination beyond 1,000 rows, truncated server pages, failed pages, every requested session boundary, midnight, timezone independence, clock isolation and cleanup, setup filtering, calendar/chart interaction and local timestamp round-trips.

Browser checks cover 320, 390, 768, 1536 and 1920px in both themes, filters, chart switching, setup expansion, calendar selection and horizontal overflow. No Analysis stylesheet or shared layout styling was changed. Production build and tests pass. Full TypeScript checking still reports pre-existing AI module export/provider errors and the missing AIReport CalendarIcon; those unrelated files were not changed.
