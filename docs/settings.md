# Account settings

Profile and Preferences share one local draft. Appearance, accent, compact layout, region, time format, currency, profile details, photos and trading defaults change only in the form until Save changes is clicked. The workspace uses the last successfully saved settings. Switching between these tabs preserves the draft; Cancel clears all draft fields, pending photos and invalid color text.

Save changes sends all pending fields in one settings update and is disabled while saving or when no changes remain. Changes saved confirms success. Failures keep the full draft for retry and show an inline error plus the existing error toast. There are no optimistic appearance updates. A pending photo is previewed with a temporary local URL, uploaded only on Save, then saved with the other fields. A failed settings update cleans up only that attempt's new upload. Previously saved photos are not deleted by Cancel.

The separate header theme shortcut is disabled on Settings to avoid bypassing the form. Outside Settings it retains its explicit theme-toggle action. Saved System theme continues to follow the OS. Password updates, reset emails, sign-out and exports remain separate explicit actions.

## Accent picker

The four original named presets remain available. The picker adds 84 swatches across 12 hue families, six brightness levels, grays and browns; a draggable saturation/brightness gradient; keyboard-accessible hue, saturation and brightness sliders; a native custom picker; and validated hex input. Named preset IDs remain compatible; custom colors use normalized six-digit hex strings in the existing accent_color text column.

Only the two sample cards inside the picker preview unsaved colors. Shared accent tokens update after a successful save and are restored from the account on reload or sign-in. The exact chosen color remains saved, while display brightness and black/white button labels adapt for contrast in each theme. Shared buttons, highlights, active navigation, profit numbers and accent chart strokes/fills consume those tokens. Loss, warning and distinct data-series colors keep their semantic roles.

Compact mode, timezone and time format keep their existing roles. Currency labels the account-size default and does not convert recorded trade amounts. Trading timestamps and the dedicated IST session clock retain their behavior.

## Deployment configuration

Use the existing Supabase project and tables. No database migration is required.

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment (see `.env.example`). This checkout has no local `.env`.
- In Supabase Authentication → URL Configuration, allow `https://YOUR_DOMAIN/reset-password` as a redirect URL, plus the equivalent local URL when testing locally.
- Keep the existing private `avatars` bucket and its user-folder upload/read policies enabled. Supported uploads are JPG, PNG, and WebP, up to 2 MB.
- Keep row-level security on `user_settings`, including the existing owner SELECT and UPDATE policies. Saving requires a returned row; a rejected or zero-row update must not show success.
- Ensure the hosting provider serves the SPA for `/reset-password`, as it does for other app routes.

## Verification

- Integration tests use the real settings hook with isolated database/storage mocks to verify no writes or global appearance changes during edits, combined saving, Cancel, failed-save retention/retry, fresh-cache persistence, photo staging/cleanup, invalid input and double-submission prevention.
- Color tests cover all 84 swatches, named presets, invalid input, RGB/HSV round trips, black/white extremes and minimum 4.5:1 contrast for foreground text and button labels in both themes.
- Browser verification: node scripts/settings-accent-qa.cjs. Tests the real routes with fixture requests, save/reload/cancel/error recovery, pointer and keyboard input, staged photos, 320/390/768/1440px layouts in both themes, and computed browser button contrast for extreme colors.
- Production build and TypeScript checks pass. No live database or account data is modified by the tests; live persistence depends on the existing deployment credentials and ownership policies.
