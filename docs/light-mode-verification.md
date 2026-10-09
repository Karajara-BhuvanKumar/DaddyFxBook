# Light Mode verification

The existing routes and shared components now use light surfaces, readable foregrounds and borders. Explicit `dark:` variants retain the previous hardcoded dark colors. Shared CSS tokens cover native controls, scrollbars, charts, portal content, report code blocks and public-page decoration.

Workspace accent colors use deeper light-theme values. The existing dark accent values are restored when the resolved theme changes, including operating-system changes in System mode.

## Coverage

- Dashboard, performance chart and monthly P&L calendar.
- Trades, trade history, edit and share dialogs.
- Journal list, selected trade, notes, checklist, rating, strategy fields, AI review and export dialog.
- Rules, Analysis, market-session timeline, session performance, analysis calendar and day details.
- Performance Coach, connection dialog and previous scorecards.
- Backtesting sessions, trade form and option menus, analytics and AI report panels.
- Settings, theme preferences and compact-layout switches.
- Authentication, password recovery, public shared trades and not-found pages.
- Mobile navigation, search dialog and notifications.

Market and Traders Lounge do not have separate routes or page implementations in this checkout. No replacement pages were added.

## Reproduce

Run `npm run build`, `npm test`, and `node scripts/theme-qa.cjs`.

The browser script launches a local Vite server and headless Microsoft Edge. All account/API responses use synthetic fixtures; it does not access a real account. It checks widths of 320, 390, 768, 1440 and 1920 pixels, light/dark switching with selected Journal content intact, chart tooltip colors, portal menus, controls, empty/error states and public pages. Screenshots and `audit.json` are written to `../theme-qa`.

The computed-text contrast check composites background colors and uses 4.5:1 for normal text and 3:1 for large text. It excludes disabled/decorative text and does not claim to replace a complete accessibility audit of images, gradients or every possible user-generated report. Screenshots were also visually reviewed.

The final browser run checked 123 page/component states, with zero detected text-contrast findings, horizontal overflows or page runtime errors. Dark route screenshots and live theme-switching assertions also passed.

The production build and all 155 unit tests pass. The standalone TypeScript check still reports pre-existing missing exports and provider-interface mismatches in `src/lib/ai/gemini.ts`, `src/lib/ai/providers/gemini.provider.ts` and `src/lib/ai/providers/stubs.providers.ts`; those modules are unchanged.

Changes are local to the repository; no production deployment was performed.
