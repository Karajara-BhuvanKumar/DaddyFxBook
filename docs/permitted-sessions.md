# Permitted trading sessions

`src/lib/marketSessions.ts` is the single runtime source of truth for session identities, IST windows, generated display hours, timeline boundaries and entry classification. Rules, the Analysis timeline and session performance all consume it.

- Asian: 5:30 AM–8:00 AM IST
- London: 11:00 AM–2:30 PM IST
- New York: 5:00 PM–8:30 PM IST

All windows include the start and exclude the end. An entry at exactly 8:00 AM, 2:30 PM or 8:30 PM IST is off-session. IST uses a fixed UTC+05:30 offset without daylight saving or device timezone adjustments. Multiple selections permit the union of those windows.

The actual timezone-qualified `open_time` determines the session. Closing times, journal classifications and trade session labels do not override it. Existing invalid-record checks remain in force. The calendar's selected timezone still controls which date displays a violation; it does not change the permitted IST windows.

Analysis assigns eligible closed trades to the three session cards using their opening timestamps. Trades outside all windows remain in overall totals and appear in the existing explanatory line below the cards. Off-session P&L plus session P&L reconciles to overall P&L. A disabled rule produces no violations; an enabled rule additionally rejects entries in unselected windows.

## Database deployment

Apply `supabase/migrations/20261011104419_permitted_sessions_ist.sql` before deploying the frontend. It replaces the old allowed-session constraint, converts Sydney/Tokyo selections to one Asian selection, and preserves other selections and unrelated configuration. The database stores session IDs only; it does not duplicate the runtime schedule. The frontend also normalizes legacy IDs when evaluating or editing existing rules.

The migration has been tested against isolated PostgreSQL using PGlite. Checks covered consolidation and deduplication, preservation of disabled state and other fields, acceptance of the three new IDs, and rejection of removed, unknown and null IDs. It has not been applied to a live project as part of this change.

## Verification

- 215 tests passed: existing suite plus session rule/UI regression tests.
- Boundary tests cover all seven nonempty selection combinations, millisecond edges, timezone-qualified timestamps, device/calendar timezones, midnight, winter/summer and DST transition dates.
- Analysis tests cover conflicting journal labels, off-session accounting, filters and opening-time edits.
- Production build, TypeScript and lint checks for changed source files passed.
- `node scripts/session-clock-qa.cjs`: responsive timeline at 320–1920px, browser timezones Asia/Kolkata and America/New_York, rollover, focus recovery and clock isolation.
- `node scripts/permitted-sessions-qa.cjs`: exactly three options, save/reload, enable/disable, matching Analysis labels and no page overflow at 320–1440px. Uses mocked requests and never writes account data.
