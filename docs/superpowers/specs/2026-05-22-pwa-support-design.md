# PWA Support Design — Stundennachweis

**Date:** 2026-05-22
**Approach:** A — Same project, platform abstraction layer
**Motivation:** Avoid 7-day Sideloadly resigning; keep native app for notifications alongside PWA
**Target devices:** iPhone (primary), Android phone, Desktop browser

## Architecture

Every native-only import gets a thin wrapper in `utils/platform/`. Screens import from the wrapper, never from native packages directly. On native the wrapper re-exports the real API; on web it provides the alternative.

```
utils/platform/
  storage.ts          — SQLiteProvider + useSQLiteContext
  sharing.ts          — shareAsync()
  filesystem.ts       — writeAsStringAsync, EncodingType
  orientation.ts      — lockAsync, OrientationLock enum
  notifications.ts    — schedule/cancel reminders
  document-picker.ts  — pick a file for import
  signature.ts        — SignaturePad component
```

`db/queries.ts`, `db/schema.ts`, all screens, and all other components are **zero-change**.

## Storage Layer

### Problem
`expo-sqlite` does not exist on web. The entire data layer (`queries.ts`, `schema.ts`) depends on `expo-sqlite`'s `SQLiteDatabase` interface.

### Solution
A `WebDatabase` class that implements the same `SQLiteDatabase` interface (`getAllAsync`, `getFirstAsync`, `runAsync`, `execAsync`, `withTransactionAsync`), backed by `sql.js` (WASM SQLite).

### Lifecycle
1. App loads → `WebDatabase.open()` initializes sql.js from WASM bundle
2. Checks IndexedDB for existing database blob → loads it if found
3. Runs `migrateDatabase()` (identical schema creation SQL)
4. On every write → debounce-save the database blob to IndexedDB (500ms)

### Persistence
- IndexedDB store name: `stundennachweis`
- Single key `database` storing the full `.db` as `ArrayBuffer`
- Auto-save on write with 500ms debounce to batch rapid operations

### Transaction handling
`withTransactionAsync` on web runs the callback without true transaction semantics. sql.js is single-threaded and in-memory, so concurrent writes are impossible. Behavior is identical for this single-user app.

### Provider
`utils/platform/storage.ts`:
- native → re-exports `SQLiteProvider`, `useSQLiteContext` from `expo-sqlite`
- web → exports `WebSQLiteProvider`, `useWebSQLiteContext` from `db/web-database.ts`

`app/_layout.tsx` imports the provider from `utils/platform/storage` instead of `expo-sqlite` directly.

### Size
`sql.js` WASM is ~400KB, loaded once on first visit, cached by browser.

## Signature Pad

### Problem
`react-native-signature-canvas` wraps `react-native-webview`, which doesn't exist on web. `expo-screen-orientation` has no browser equivalent.

### Solution
New `components/ui/WebSignaturePad.tsx` using `signature_pad` (the same library that `react-native-signature-canvas` wraps internally) directly on an HTML5 canvas.

- Same props: `{ visible, onSave, onClose }`
- Same output: base64 PNG data URL
- Layout: full-screen modal with wide canvas layout (no landscape lock — CSS flexbox row layout instead)
- Same buttons (Abbrechen, Speichern, Löschen)

`utils/platform/signature.ts`:
- native → re-exports `SignaturePad` from `components/ui/SignaturePad`
- web → re-exports `WebSignaturePad as SignaturePad` from `components/ui/WebSignaturePad`

`einstellungen.tsx` imports from the wrapper — zero changes.

## Report Preview & PDF Export

### Preview
`bericht.tsx` uses `react-native-webview` to render HTML. On web, replace with a `<div>` using `dangerouslySetInnerHTML` inside a scrollable container. The HTML is already self-contained with inline styles.

### PDF generation
`pdfmake` works natively in browsers — no Hermes polyfills needed. `patchForPdfmake()` only runs on native (guarded by `Platform.OS` check). On web, pdfmake generates the PDF as a Blob.

`generatePdf.ts` changes:
- Add `Platform.OS === 'web'` branch that uses pdfmake's `getBlob()` instead of `getBase64()` + FileSystem write
- Returns a Blob URL on web, file URI on native

### Sharing
`utils/platform/sharing.ts`:
- native → re-exports `expo-sharing`
- web → `shareAsync(uri, options)` using `navigator.share()` with fallback to `<a download>` click

Priority on web: try `navigator.share({ files: [File] })` first (Chrome Android, Safari 15+), fall back to download link.

## Backup/Restore

### Export
Build JSON string → create Blob → download via `navigator.share()` or `<a download>` (same pattern as PDF sharing).

### Import
`utils/platform/document-picker.ts`:
- native → re-exports `expo-document-picker`
- web → creates a hidden `<input type="file" accept=".json">`, triggers it programmatically, wraps result in same `{ canceled, assets }` shape

`utils/platform/filesystem.ts`:
- native → re-exports `expo-file-system/legacy`
- web → `writeAsStringAsync` (creates Blob for download), `readAsStringAsync` (uses FileReader)

`backup.ts` validation and data logic stays unchanged — only file I/O primitives are swapped.

## Notifications

`utils/platform/notifications.ts`:
- native → re-exports everything from `utils/notifications.ts`
- web → exports stub functions (all no-ops, `requestNotificationPermissions` returns `false`)

UI in Settings: reminder toggle still visible on web. When toggled on, show a hint "Nur in der App verfügbar".

## Other Native APIs

### GestureHandlerRootView
`react-native-gesture-handler` provides a web-compatible version that is already a no-op. Zero changes.

### Swipeable (EntryCard delete)
`react-native-gesture-handler`'s `Swipeable` has basic web support via `react-native-web`. If the swipe gesture feels poor on web, add a visible delete button as fallback. Test first, decide later.

### DrumColumn (time picker)
Uses `ScrollView` with `snapToInterval`. `react-native-web` maps this to CSS `scroll-snap-type`. Works but momentum feel varies by browser. Acceptable tradeoff.

### expo-splash-screen
`SplashScreen.preventAutoHideAsync()` is harmless on web. No changes needed.

### expo-status-bar
No-op on web already. Zero changes.

### lucide-react-native
Works on web via `react-native-svg` + `react-native-web`. Zero changes.

## PWA Configuration

### Manifest
Add `web/` directory with `manifest.json` for PWA installability:
- `name`: Stundennachweis
- `display`: standalone
- `theme_color` / `background_color`: match app theme
- `icons`: use existing app icon assets

### Service Worker
Use `expo-router`'s built-in static output mode (`app.json` already has `web.output: "static"`). Add a simple caching service worker for offline support.

### Meta tags
`index.html` needs viewport meta, theme-color, apple-mobile-web-app-capable for iOS PWA.

## Files Changed

### New files
- `db/web-database.ts` — sql.js adapter implementing SQLiteDatabase interface
- `components/ui/WebSignaturePad.tsx` — direct signature_pad canvas component
- `utils/platform/storage.ts` — provider abstraction
- `utils/platform/sharing.ts` — share abstraction
- `utils/platform/filesystem.ts` — file I/O abstraction
- `utils/platform/orientation.ts` — screen orientation abstraction
- `utils/platform/notifications.ts` — notifications abstraction
- `utils/platform/document-picker.ts` — file picker abstraction
- `utils/platform/signature.ts` — signature component abstraction
- `web/manifest.json` — PWA manifest
- `web/sw.js` — service worker for offline caching

### Modified files
- `app/_layout.tsx` — import provider from `utils/platform/storage`
- `utils/generatePdf.ts` — add web branch (pdfmake getBlob, skip polyfills)
- `utils/backup.ts` — import from `utils/platform/filesystem`, `utils/platform/sharing`, `utils/platform/document-picker`
- `components/ui/SignaturePad.tsx` — import orientation from wrapper (optional)
- `app/(tabs)/bericht.tsx` — import share from wrapper, conditional WebView/div
- `app/(tabs)/einstellungen.tsx` — import notifications from wrapper, add web hint
- `app.json` — add web manifest reference, favicon
- `package.json` — add `sql.js`, `signature_pad` dependencies
- `public/index.html` (if needed) — Expo web template for PWA meta tags (theme-color, apple-mobile-web-app-capable, manifest link)

### Zero-change files
- `db/queries.ts` — all SQL queries work identically
- `db/schema.ts` — same migration SQL
- `components/ui/TimeField.tsx` — react-native-web handles ScrollView snap
- `components/ui/DrumColumn.tsx` — same
- `components/ui/EntryCard.tsx` — Swipeable has web support
- `components/ui/MonthYearPicker.tsx` — pure RN components
- `app/(tabs)/index.tsx` — no native API usage
- `app/entry/[id].tsx` — no native API usage (uses db via context)
- `theme.ts` — pure JS constants

## Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| sql.js WASM load time on slow connections | First load delay | Show loading spinner (already exists); WASM cached after first visit |
| IndexedDB storage limit (50MB on some browsers) | Data loss | App stores text only; ~10K trips ≈ 2MB; well within limits |
| Swipeable feels wrong on web | Poor delete UX | Add visible delete button fallback, test on real devices |
| iOS Safari PWA limitations (no push, 50MB storage) | Missing notifications | Accept this gap; native app still used for notifications |
| Landscape signature on small phones | Cramped canvas | CSS media query adjusts layout; canvas still usable in portrait-style wide mode |

## Out of Scope
- Web Push notifications (requires server)
- True landscape lock on web
- Data sync between native app and PWA
- Desktop-specific responsive layouts
