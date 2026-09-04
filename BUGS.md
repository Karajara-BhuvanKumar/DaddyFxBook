# DaddyFxBook — Bug Audit Log

## Section 1: Dashboard ✅

### LOGIC BUGS

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| D-L1 | **Percentage-change badge returns `null` when prev period P&L is $0** — shows "—" which is ambiguous. Could show "NEW" instead. | Wrong data shown | OPEN (awaiting design decision) |
| D-L2 | **`perfPct` formula: negative-to-negative edge case** — mathematically correct but potentially confusing. | Low | WONTFIX (intentional) |
| D-L3 | **`gradientOffset` produces `NaN` when all cumulative values are $0** | Wrong data shown | ✅ FIXED |
| D-L5 | **Win Rate card icon always blue regardless of rate** | Cosmetic | ✅ FIXED (now uses theme `text-profit` token) |

### UI BUGS

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| D-U1 | **`getPnlTone()` hardcoded hex; `text-white` invisible in light mode** | Breaks functionality | ✅ FIXED → `text-profit`/`text-loss`/`text-foreground` |
| D-U2 | **`getPnlIconBg()` hardcoded dark hex backgrounds** | Breaks functionality | ✅ FIXED → `bg-profit-tint`/`bg-loss-tint`/`bg-neutral-tint` |
| D-U3 | **`stat-card` CSS uses `background: #0B0B0B`** | Breaks functionality | ✅ FIXED → `hsl(var(--card))` |
| D-U4 | **Chart container hardcoded `background: #080808`** | Breaks functionality | ✅ FIXED → `bg-card` class |
| D-U5 | **Calendar container hardcoded `background: #0B0B0B`** | Breaks functionality | ✅ FIXED → `bg-card` class |
| D-U6 | **Calendar day cells hardcoded dark hex** | Breaks functionality | ✅ FIXED → `bg-profit-tint`/`bg-loss-tint`/`bg-muted` |
| D-U7 | **Calendar tooltip profit color `#10B981` differs from blue** | Cosmetic | ✅ FIXED → `text-profit` |
| D-U8 | **Calendar P&L text `text-emerald-600 dark:text-blue-500`** | Cosmetic | ✅ FIXED → `text-profit`/`text-loss` |
| D-U9 | **Weekly summary color inconsistent** | Cosmetic | ✅ FIXED → `text-profit`/`text-loss` |
| D-U10 | **Legend dot `bg-emerald-500 dark:bg-blue-500`** | Cosmetic | ✅ FIXED → `bg-profit` |
| D-U11 | **Timeframe selector hardcoded `bg-[#121212]`, `bg-[#2A2A2A]`** | Breaks functionality | ✅ FIXED → `bg-secondary`/`bg-muted` |
| D-U12 | **`surface-card` CSS uses `background: #0B0B0B`** | Breaks functionality | ✅ FIXED → `hsl(var(--card))` |

### BACKEND / INTEGRATION

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| D-B1 | **`useTrades` query missing `.eq('user_id', ...)`** | Data integrity risk | ✅ FIXED |

---

## Section 2: Trades ✅

### LOGIC BUGS

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| T-L1 | **Add-trade form hardcodes symbol to `'XAUUSD'`** — no symbol input field in the add form. User can only add XAUUSD trades. The edit modal has a symbol field, but the add form doesn't. | Wrong data shown | OPEN (feature gap — needs symbol dropdown/input added) |
| T-L2 | **`handleClearAll` deletes trades in a serial loop** — fires N separate DELETE + invalidateQueries calls. With many trades, this is slow and could leave partial state on error. Should batch or use a single server-side delete. | Breaks functionality (perf) | OPEN (needs server-side bulk delete) |
| T-L3 | **EditTradeModal form overwritten when journal/checklist data loads** — useEffect at L49-86 re-runs when async `journal`/`checklist` data arrives. If user starts typing before data loads, edits are silently wiped. | Breaks functionality | OPEN (needs refactor to only set initial values once) |

### UI BUGS — All fixed (same hardcoded dark-mode color pattern as Dashboard)

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| T-U1 | **Trades.tsx: ~25 hardcoded dark hex colors** (`bg-[#0B0B0B]`, `text-white`, `text-[#71717A]`, `text-[#3B82F6]`, etc.) | Breaks functionality (light mode) | ✅ FIXED — all swapped to theme tokens |
| T-U2 | **Trades table P&L uses `text-[#3B82F6]`/`text-[#EF4444]`** | Cosmetic (inconsistency) | ✅ FIXED → `text-profit`/`text-loss` |
| T-U3 | **TradeCard P&L uses `text-[#3B82F6]`/`text-[#EF4444]`** | Cosmetic (inconsistency) | ✅ FIXED → `text-profit`/`text-loss` |
| T-U4 | **Direction badges use hardcoded hex across 4 components** | Breaks functionality (light mode) | ✅ FIXED → `bg-profit-tint text-profit`/`bg-loss-tint text-loss` |
| T-U5 | **Filter button is a no-op** — renders but has no handler | Cosmetic (stub UI) | OPEN (not a bug per se — planned feature) |
| T-U6 | **"Connect MT4/MT5" button is a no-op** | Cosmetic (stub UI) | OPEN (not a bug — planned feature) |
| T-U7 | **TradeCard bg `bg-[#0B0B0B]`** hardcoded | Breaks functionality | ✅ FIXED → `bg-card` |
| T-U8 | **EditTradeModal: all dark hex values** (`bg-[#0B0B0B]`, `bg-[#121212]`, `border-white/[0.08]`, `text-white`) | Breaks functionality (light mode) | ✅ FIXED → theme tokens |

### New utilities added (index.css)
- `.bg-profit-tint` — `hsl(var(--profit) / 0.12)` 
- `.bg-loss-tint` — `hsl(var(--loss) / 0.12)`
- `.bg-neutral-tint` — `hsl(var(--muted))`

---
*Last updated: Section 2 fixes complete — TSC verified ✓*

---

## Targeted Fixes: Trade Datetime + Session Performance ✅

### LOGIC BUGS

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| TF-L1 | **Add Trade form datetime defaults to UTC, not local time** — `new Date().toISOString().slice(0,16)` returns UTC, but `datetime-local` inputs treat values as local. Shows wrong time (5h30m behind IST). Affects initial default + post-submit reset. | Wrong data shown | ✅ FIXED → `localNow()` helper using local Date methods |
| TF-L2 | **Session Performance widget derives session from UTC hour ranges** — ignores trade's stored `session` field and journal's `market_session`. Hardcoded `getUTCHours()` ranges (22-8, 8-13, 13-22) guess session incorrectly. | Wrong data shown | ✅ FIXED → reads `trade.session`, falls back to journal `strategy_setup.market_session`, folds killzones into parent sessions |
| TF-L3 | **Journal save doesn't sync `market_session` to `trades.session`** — `useSaveJournal` only writes to `journals` table. Trade's `session` field stays null, causing stale data in AI reports and analysis. | Data integrity | ✅ FIXED → `useSaveJournal` now parses `market_session` and updates `trades.session` |

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Trades.tsx` | Added `localNow()` helper; replaced 3 `toISOString()` calls |
| `src/pages/Analysis.tsx` | Rewrote `sessionPerf` to use stored session field + journal fallback |
| `src/hooks/useTrades.ts` | `useSaveJournal` syncs `market_session` → `trades.session`; invalidates `trades` query |

### Notes

- **Killzone handling**: "London Killzone" → "London", "New York Killzone" → "New York" for the 3-bucket widget
- **AI report/prompt builder `getUTCHours()`**: NOT the same bug — they do hour-of-day analytics, not session bucketing, and already read `trade.session` separately. Left untouched.
- **Timezone**: Uses browser local time for datetime defaults. App has a `settings.timezone` field but `datetime-local` inputs are inherently browser-local.

---
*Last updated: Targeted fixes — TSC + Vite build verified ✓*
