# AGENTS.md

## Source Of Truth
- This is an Expo SDK 54 app (`expo ~54.0.33`, `expo-router ~6.0.23`, React 19, RN 0.81); read the exact versioned Expo docs at https://docs.expo.dev/versions/v54.0.0/ before changing Expo APIs.
- Prefer executable config over older prose: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `eas.json`, and `.github/workflows/build-ios.yml` are the reliable sources.
- `DESIGN.md` and `PRD.md` contain product/UI requirements; `CLAUDE.md` and `GEMINI.md` have useful context but some stack details may lag package versions.

## Commands
- Install with `npm ci`; CI uses Node 22 and npm cache.
- Dev server scripts are only `npm run start`, `npm run android`, `npm run ios`, and `npm run web`.
- There are no root `lint`, `test`, or `typecheck` scripts; use `npx tsc --noEmit` for TypeScript verification.
- Native folders are generated and ignored. CI builds with `npx expo prebuild --platform ios --clean --no-install` then `pod install`, and Android with `npx expo prebuild --platform android --clean` then Gradle.

## App Wiring
- Entry point is `expo-router/entry`; root layout is `app/_layout.tsx`.
- `app/_layout.tsx` wraps the app in `GestureHandlerRootView` and `SQLiteProvider` using `databaseName="stundennachweis.db"`; schema migration runs via `migrateDatabase` from `db/schema.ts`.
- Main routes are tabs in `app/(tabs)/`: `index` (Fahrten), `bericht`, and `einstellungen`; `app/entry/[id].tsx` is a full-screen modal for new/edit trip entries.
- Use the `@/*` TypeScript alias for root imports; it is configured in `tsconfig.json`.

## Data And Offline Behavior
- The app is offline-only: no backend, login, sync, GPS, or wage calculation.
- SQLite tables are `trips` and key/value `settings`; query helpers live in `db/queries.ts` and types in `db/types.ts`.
- Trip dates are stored both as display `datum` (`DD.MM.YYYY`) and sortable/filterable `datum_iso` (`YYYY-MM-DD`); monthly queries filter on `datum_iso`.
- Backup/restore is manual JSON via `utils/backup.ts`; import clears existing `trips` and `settings` before inserting backup data.

## UI And Product Rules
- All visible UI text is German; use `DD.MM.YYYY`, `HH:MM`, and duration text like `X Std. Y Min.`.
- Screen styling should use `useThemeColors()` plus tokens from `theme.ts`; avoid raw colors/sizes in screens except where a native API requires a literal.
- Keep minimum body font size at `typography.sizes.base` (16) and interactive targets at least 48dp.
- Time entry uses `TimeField`/`DrumColumn` with 5-minute snapping, not plain text inputs; `Gesamtzeit` is calculated/read-only.
- `TourChips` shows the last 3 tour numbers; `Besonderheiten` starts collapsed for new entries.
- Signature data is a base64 PNG data URL stored in `settings.unterschrift`; `SignaturePad` locks capture to landscape.

## PDF And Sharing
- Report preview and final export both live in `utils/generatePdf.ts`: `buildReportHtml` feeds the WebView preview, while `generatePdf` uses `pdfmake` and writes through `expo-file-system/legacy`.
- When changing report layout or columns, update both the HTML preview path and the pdfmake document definition so preview/export stay aligned.
- `generatePdf.ts` contains Hermes/Expo polyfills for `pdfmake` font parsing; avoid removing them unless verified on device/simulator.

## Build And Secrets
- `app.json` enables the new architecture, typed routes, portrait orientation, and native plugins for router, SQLite, splash, notifications, mail composer, datetime picker, and assets.
- EAS config requires CLI `>=14.0.0` and uses remote app version source; production builds auto-increment remotely.
- Signing material is intentionally ignored (`*.p12`, `*.jks`, `*.pem`, `/ios`, `/android`); do not commit local keystores or generated native folders.
