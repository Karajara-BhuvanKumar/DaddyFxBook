# Account settings

The settings page has three sections: Profile, Preferences, and Security. Profile and preference edits are saved together with Save changes; Cancel restores saved values. Photo changes are saved immediately. Exports include all accessible records, paginated in batches of 1,000.

## Deployment configuration

Use the existing Supabase project and tables. No database migration is required.

- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the deployment environment (see `.env.example`). This checkout has no local `.env`.
- In Supabase Authentication → URL Configuration, allow `https://YOUR_DOMAIN/reset-password` as a redirect URL, plus the equivalent local URL when testing locally.
- Keep the existing private `avatars` bucket and its user-folder upload/read policies enabled. Supported uploads are JPG, PNG, and WebP, up to 2 MB.
- Keep row-level security on `user_settings`, including the existing owner SELECT and UPDATE policies. Saving requires a returned row; a rejected or zero-row update must not show success.
- Ensure the hosting provider serves the SPA for `/reset-password`, as it does for other app routes.

## Verification

The production build, existing 99 tests, and 5 added password-control tests passed. Browser checks used mocked Supabase responses at 320, 390, 768, and 1440 pixels. They covered profile save/reload/cancel/error recovery, image type and size rejection, photo upload/removal, theme and timezone saving, password validation/error/success, reset requests, the recovery page, sign-out confirmation cancellation, and CSV export.

Live email delivery, production redirect allowlisting, and actual storage/database policies were not verified: the available Supabase connections denied project access. Before deploying, complete a reset using a real email link and upload/reload/remove a photo with a test account.

The full TypeScript check still reports existing errors in the AI provider modules and the missing CalendarIcon in AIReport.tsx. None of the changed settings files produced TypeScript errors.
