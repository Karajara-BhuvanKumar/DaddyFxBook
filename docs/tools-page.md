# Tools page

The application provides `/tools`, `/tools/position-size-calculator`, and `/tools/forex-market-hours`. Sidebar navigation and workspace search include Tools.

Only Position Size Calculator and Forex Market Hours are listed: two available, zero coming soon. Cards and panels use the existing application theme, typography, icons and accent variables. Development-only equivalents live under `/preview/tools` for local visual checks.

## Position sizing

- USD account balance; USD-quoted major pairs and XAUUSD, plus a custom USD pip value per standard lot.
- Manual risk accepts any finite positive decimal up to 100%. Slider pointer input rounds to 0.01%; arrow keys adjust by 0.01%, Page Up/Down by 1%. Manual values with more decimal places remain synchronized.
- Risk budget = balance × risk percentage / 100. Position = budget / (stop distance × pip value). Results update immediately.
- The displayed position rounds down to 0.01 standard lots. Loss at stop uses that displayed position, so it never intentionally exceeds the budget. For the reference's $5,000, 0.5%, 30 pips, $10/pip example, the result is 0.08 lots, $25 budget and $24 estimated stop loss.
- No stale result for empty, negative, zero, out-of-range, nonfinite or unrepresentable inputs. A zero-lot result explains that the budget cannot fit the minimum increment.
- XAUUSD uses 100 ounces per standard lot and a 0.01 price pip, producing $1/pip/lot. Broker-specific gold pip definitions must match the entered stop distance; the reference's $10 value with a 0.01 pip was inconsistent with this contract size.
- Estimates exclude spread, commission, fees and slippage. Account currency and lot increment are explicit.

## Forex sessions

Conventional Sydney 08:00–17:00, Tokyo 09:00–18:00, London 08:00–17:00 and New York 08:00–17:00 local business sessions are converted with IANA timezone rules, including separate regional daylight-saving dates. The forex trading week is bounded by Sunday 17:00 through Friday 17:00 New York time. Holidays and broker breaks are not modeled and are disclosed in the interface.

The Forex dashboard and app header respect the saved workspace timezone and time format. With Asia/Kolkata selected, both use IST (UTC+05:30). Market clocks always show each city's own date, local time and date-specific timezone abbreviation. The dashboard's 12h/24h toggle changes this view and starts from the saved format; it does not overwrite Settings. Existing saved timezone defaults and the fixed Analysis session clock are unchanged.

The dashboard timeline runs from the most recent 06:00 in the user's zone through the next 06:00. Its actual elapsed duration can be 23, 24 or 25 hours across DST. Bars represent actual weekday intervals intersecting that window, including midnight/weekend tails; no closed-weekend bars are invented. The now marker uses actual elapsed time, with live clock reads every 250ms and recovery on focus/visibility changes. Session schedules are recomputed at timeline rollover or timezone changes.

Best Times cards use actual interval intersections for London/New York overlap, London's first two hours and Tokyo's first three hours. They display the active or next occurrence with its date, timezone, range and countdown; upcoming Monday ranges already use Monday's offset even before Sunday's DST change. The volume-style chart is explicitly a qualitative session-activity estimate (closed/low/moderate/high), not a live market volume feed.

`marketTime.ts` uses browser IANA timezone data via `Intl`. Standard abbreviations are display aliases for the date-specific full names returned by `Intl`; UTC offsets, DST decisions and transition dates are never hardcoded. Browser/OS timezone data and the device clock supply the current rules and current instant.

Timing references: [OANDA session overview](https://www.oanda.com/us-en/skills-and-insights/education/trading-asset-classes/forex/when-is-the-best-time-for-forex-trading/) and [OANDA trading hours](https://www.oanda.com/us-en/trading/hours-of-operation/). Sessions are conventional activity windows; exact broker availability can differ.

Transition verification references: [UK clock changes](https://www.gov.uk/when-do-the-clocks-change), [NIST US DST rules](https://www.nist.gov/pml/time-and-frequency-division/popular-links/daylight-saving-time-dst), [Reserve Bank of Australia DST dates](https://www.rba.gov.au/schedules-events/daylight-saving.html).

## Verification

- 71 focused tests passed across position sizing, Tools controls, dynamic sessions, individual clocks, saved preferences and the existing Analysis clock; cases cover all six 2026 DST transitions, mismatched US/UK transition weeks, 23/25-hour timelines, countdowns, weekend rollover and year end.
- TypeScript check and ESLint on changed application files.
- Production build.
- `node scripts/tools-qa.cjs`: browser checks at 320, 390, 768, 1024, 1440 and 1920px, exact decimal input, pointer/keyboard slider synchronization, calculated results, invalid input, custom pip value, reset, live overlaps, workspace-date rollover and weekends. Uses a foreign browser timezone and fixture network responses; no real account data.
- Screenshots in `tools-qa/`; desktop and mobile screenshots visually reviewed.
- `node scripts/forex-hours-qa.cjs`: saved IST/12h and New York/24h settings, 320–1920px browser checks, real-time transitions, synchronized ranges, local dates and abbreviations, session boundaries, 25-hour geometry, and year-end dates. Test clocks are confined to the test harness. Screenshots in `forex-hours-qa/`.

Production deployments use the existing Vercel integration on GitHub main.
