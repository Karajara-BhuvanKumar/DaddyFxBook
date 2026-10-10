# Holding-time tracking

The add and edit forms share a calendar/time picker with month navigation, Now/Yesterday/Clear shortcuts, hour/minute controls, AM/PM and an explicit Done action. Dismissing the picker discards its draft; Clear immediately clears the form field. Entry remains in browser local time, matching the existing trade forms. The selected time is saved as an absolute UTC instant; an unchanged edit retains the original timestamp, including seconds, milliseconds and its original DST offset.

`src/lib/holdingTime.ts` calculates elapsed milliseconds and formats durations for Trade History, Journal, exports and Analysis. Date-only, missing, malformed and reversed timestamps have no completed duration. Open status-bearing records also have no completed duration. Zero-duration trades remain valid; durations below one minute display `<1m`. Longer displays truncate to whole minutes, without truncating calculation inputs.

The existing trade schema is for completed trades, so forms continue requiring both opening and closing timestamps. No schema migration or historical-data rewrite is required. P&L calculation is unchanged.

Trade History shows Holding time by default. It participates in existing column visibility, ordering, filtering, sorting and CSV/Excel exports. Numeric duration conditions use minutes.

Analysis uses its existing validated records and page filters. Holding Time adds average, median, total, shortest/longest trade identities, and winner/loser averages. Total time sums individual durations, including overlapping trades. Range boundaries are [0,15m), [15m,60m), [1h,4h), [4h,24h), and [24h,infinity). Each range shows count, total P&L, average P&L, and win rate excluding break-even trades, consistent with other Analysis sections. Fewer than five trades is labeled a small sample. No records displays unavailable metrics rather than invented zero-duration averages.

Journal trade details display opening/closing timestamps, duration and the local timezone. All journal export formats (PDF, Excel, CSV and Word) share the same field source. The Trade details export selection includes separate local opening/closing date and 12-hour time fields, display timezone and duration. Existing UTC timestamp fields remain available for precision and compatibility.

## Verification

- Current release suite: 198 tests passed, including six new tests cover precision, DST offsets, missing/invalid timestamps, bucket boundaries, aggregates, export consistency and picker confirmation/cancellation.
- TypeScript check and lint on new components/helpers/tests passed.
- Production build passed; existing bundle-size advisory remains.
- `node scripts/holding-time-qa.cjs` runs browser acceptance against isolated fixture responses, never real account writes. It verifies creation timestamps, edit duration updates, responsive layouts at 1440/390/320px, analytics, journal timing details, CSV/Excel values and PDF generation.
- Exported PDF timing fields were independently extracted and verified, and both rendered pages visually inspected.

QA screenshots and sample exports are in `holding-time-qa/`. Fixtures are only used by tests; production metrics use actual records.
