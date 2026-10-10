# Analysis calendar rule tracking

The Rules page owns rule types, thresholds, permitted sessions, and active state. Use the pencil button to edit a rule. Rules configured as manual are never inferred from their description.

Trade entry and editing now include an optional **Recorded risk (%)** field: the percentage of account equity risked at entry. Blank means unknown. This value is not calculated from realized P&L, lot size, the checklist, risk/reward, or Settings defaults.

## Evaluation

| Rule | Evidence and date |
| --- | --- |
| Maximum trades per day | Counts distinct actual entries by opening date; only entries beyond the limit are offending trades. |
| Maximum risk per trade | Compares each recorded percentage with the active threshold on its opening date. Unknown/invalid risk is skipped. |
| Permitted sessions | Compares the entry instant against any selected session in `IST_MARKET_SESSIONS`. Includes overlaps and New York's overnight window. Start is inclusive; end is exclusive. |
| Maximum daily loss | Uses the complete day's net realized P&L, grouped by closing date. A missing outcome makes the daily loss check unverifiable. Equality is permitted. |
| Stop after consecutive losses | Checks realized outcomes known by each entry, resetting each calendar day. Reaching the limit alone is not a violation; subsequent entries are. Unknown outcomes and ambiguous simultaneous win/loss closures do not establish a streak. |

Calendar dates use the saved workspace timezone. Session hours remain the existing fixed IST definitions. Calendar P&L and Day Trades retain closing-date semantics and the current Analysis filters; other Analysis calculations are unchanged. Discipline checks always use complete trade history, irrespective of Winners/Losers or period filters, so filtering cannot conceal violations. Consequently, an entry-date warning may appear on a date without closed trades in the selected filter.

One marker is shown per affected day. The Day Trades panel lists every violation, thresholds, and expandable relevant trade IDs, opening/closing times, recorded risk, and P&L. Automatic flags are derived from current data rather than stored as historical snapshots. Disabling or editing a rule recalculates historical flags too.

## Persistence

Migration `20261010062514_calendar_rule_tracking.sql` adds nullable `trades.risk_pct`, `trading_rules.allowed_sessions`, two automatic rule types, and validation constraints. It was applied to the project configured in `.env.local`. Existing RLS and ownership policies continue to apply; existing trade risk remains null.

Trade mutations invalidate Analysis data; Rules mutations invalidate the shared rules query. Both queries refetch when the app regains focus. Refresh reloads persisted configuration and trades. Rule fetch failures show an unavailable state rather than presenting stale flags as verified.

## Verification

- 192 unit/component tests passed, including timezone boundaries, missing risk, session overlaps/overnight boundaries, consecutive loss ordering, threshold edits, disabled rules, and existing Analysis tests.
- Production build and TypeScript check passed; lint passed for the changed evaluation, Rules, Analysis, and violation presentation code.
- `node scripts/calendar-rules-qa.cjs` verifies actual application routes with isolated API fixtures: Rules edits/toggles, session-rule creation, risk edits/new trades, cache updates, and reloads.
- Browser layout checks passed at 320, 390, 768, and 1440 pixels in light and dark themes, with no marker overlap or page overflow.
- Live API schema checks returned HTTP 200 for both new fields; both tables retain RLS and authenticated column access. The security advisor reported no new findings (the pre-existing leaked-password protection setting is unchanged).
