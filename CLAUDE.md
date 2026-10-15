# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Stundennachweis** — a React Native + Expo (TypeScript) mobile app for German school bus/shuttle drivers to log daily trip times and generate a monthly PDF report matching the existing paper Stundennachweis form. iOS 16+ and Android 10+. 100% offline, no backend, single driver per device.

## Stack

```
React Native + Expo (TypeScript)
expo-router              — file-based navigation
expo-sqlite              — local data persistence
pdfmake                  — PDF generation (HTML in a WebView for the preview)
expo-sharing             — share PDF via system sheet
NativeWind               — Tailwind utility classes for RN
lucide-react-native      — icons
react-native-reanimated v4 — animations
react-native-gesture-handler — swipe-to-delete
@react-native-community/datetimepicker — date picker
react-native-signature-canvas — digital signature
expo-document-picker     — file picking for restore
expo-notifications       — local daily reminders
```

## Common commands

```bash
npx expo start          # start dev server
npx expo run:ios        # run on iOS simulator
npx expo run:android    # run on Android emulator
npx expo lint           # lint
npx tsc --noEmit        # type check
```

## Architecture

### Navigation (expo-router, tab-based)
```
app/
  (tabs)/
    index.tsx           # HomeScreen — monthly trip list
    bericht.tsx         # ReportScreen — PDF preview + send
    einstellungen.tsx   # SettingsScreen — Fahrer, Signature, Backup, Reminders, Reset
  entry/
    [id].tsx            # EntryScreen (modal) — add/edit trip
utils/
  generatePdf.ts        # report preview HTML + pdfmake PDF
components/
  ui/                   # ALL primitive components live here
theme.ts                # ALL design tokens
```

### Data model (expo-sqlite)

**Trip entry fields:** `datum` (DD.MM.YYYY), `beginn_fahrt` (HH:MM, empty for Rückfahrt-only), `ankunft_schule` (HH:MM, empty for Sonderfahrt or Rückfahrt-only), `abfahrt_schule` (HH:MM, empty for Sonderfahrt or Hinfahrt-only), `ende_fahrt` (HH:MM, empty for Hinfahrt-only), `gesamtzeit` (calculated, stored as minutes), `ist_sonderfahrt` (0/1), `tour_nr` (text), `besonderheiten` (optional text), `aufgezeichnet_am` (auto today), `bericht_monat` (YYYY-MM — which report the trip belongs to, independent of trip date).

**Gesamtzeit formula** (four modes, `calcGesamtzeit` in `utils/format.ts`):
- Vollständige Fahrt: `(Ankunft−Beginn) + (Ende−Abfahrt)`
- Nur Hinfahrt (Rückfahrt off): `Ankunft − Beginn`
- Nur Rückfahrt (Hinfahrt off): `Ende − Abfahrt`
- Sonderfahrt: `Ende − Beginn`
Never enter manually. Formula is inferred from which fields are non-empty.

**Settings:** driver name, digital signature, default tour/times, reminder enabled/time.

**Backup & Restore:** Manual JSON export/import via `utils/backup.ts`.

### Theme system

**Never use raw hex values, hardcoded sizes, or arbitrary spacing in screen components.** Always import from `theme.ts`.

## Non-negotiable rules (from DESIGN.md)

1. **All UI text in German** — no English visible to the user
2. **No hardcoded colors/sizes/spacing** in screen components — use `theme.ts` tokens
3. **Minimum font size: 16 (`typography.sizes.base`)** — no exceptions
4. **Minimum tap target: 48dp** — all interactive elements
5. **Time fields use inline DrumColumn, never `TextInput`**
6. **Tour-Nr. chips**: always render last 3 used values as quick-tap chips above the text input
7. **Besonderheiten collapsed by default** — never open on new entry
8. **"Wiederholen" button** is replaced by global defaults in settings
9. **Gesamtzeit is calculated and read-only** — four modes: Vollständige Fahrt `(Ankunft−Beginn)+(Ende−Abfahrt)`; Nur Hinfahrt `Ankunft−Beginn`; Nur Rückfahrt `Ende−Abfahrt`; Sonderfahrt `Ende−Beginn`
10. **All primitives from `components/ui/`** — no inline component definitions
11. **Offline-first** — no feature requires a network connection
12. **No `Alert.alert()` for validation** — inline field errors only
13. **Digital signature** is captured in landscape via `SignaturePad`
14. **Backup/Restore** uses system share sheet and document picker
15. **Reminders** are local-only and use `expo-notifications`

## EntryScreen smart defaults

- `Datum`: next weekday after the latest trip in the report month being viewed; with no trips there, today (current month) or the first weekday of that month (`defaultEntryDate` in `utils/format.ts`)
- `Pre-fill Priority`: User Settings > Same Weekday History > System Baseline
- Minute column snaps to 5-minute intervals

## PDF spec

Generated in `utils/generatePdf.ts`: `buildReportHtml` renders the on-screen preview, `generatePdf` builds the PDF with `pdfmake`. Keep both in sync. A4 landscape. Column order: Datum | Beginn Fahrt | Ankunft Schule/Werkstätte | Abfahrt Schule/Werkstätte | Ende Fahrt | Gesamtzeit | Tour-Nr. | Besonderheiten | aufgezeichnet am. Footer: digital signature image, monthly Gesamtzeit total right. Font: serif.

## German locale conventions

- Date format: `DD.MM.YYYY`
- Time format: `HH:MM` (24-hour, no AM/PM)
- Duration display: `X Std. Y Min.`
- Sentence case for all labels
