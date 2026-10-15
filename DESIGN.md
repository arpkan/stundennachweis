# DESIGN.md — Stundennachweis App
> Version 1.3 | Last updated: 2026-05-22
> Read alongside PRD.md. Claude Code must follow all rules in this file for every screen.

---

## 1. Design personality

**Three anchor adjectives: Reliable. Clear. Fast.**

This is a work tool used briefly between shifts, sometimes with gloves, often in a vehicle cab. Every design decision serves one goal: the driver gets in, logs the trip, gets out. No friction. No beauty for beauty's sake.

**Reference apps for visual feel:**
- **Toggl Track** — clean time entry, no clutter, large tap targets
- **Deutsche Bahn (DB) app** — German platform conventions, structured data display
- **Things 3** — calm information hierarchy, confident use of whitespace

---

## 2. Color tokens

All colors are defined in `theme.ts` as light and dark palettes. Screens must use `useThemeColors()` plus tokens from `theme.ts`. Avoid raw colors in screens except where a native API requires a literal (for example modal overlay rgba, `DateTimePicker` theme hints, or destructive pressed colors already present in legacy code).

```ts
const light = {
  // Primary brand
  primary:        '#1A56DB',   // action blue — buttons, active states, links
  primaryPressed: '#1344B8',   // darker on press

  // Backgrounds
  bg: {
    screen:  '#F5F7FA',        // app background (off-white, not pure white)
    card:    '#FFFFFF',        // card / entry row surface
    input:   '#FFFFFF',        // input field background
    subtle:  '#EEF1F6',        // dividers, tag backgrounds
  },

  // Text
  text: {
    primary:   '#111827',      // headings, primary labels
    secondary: '#6B7280',      // supporting labels, placeholders
    disabled:  '#9CA3AF',      // disabled state
    inverse:   '#FFFFFF',      // text on primary/dark backgrounds
    error:     '#DC2626',      // validation errors
  },

  // Semantic
  success:  '#16A34A',         // saved confirmation, positive states
  warning:  '#D97706',         // caution states
  error:    '#DC2626',         // errors, destructive actions
  border:   '#D1D5DB',         // input borders, dividers
  shadow:   'rgba(0,0,0,0.06)',// card shadows
}

const dark = {
  primary:        '#3B82F6',
  primaryPressed: '#2563EB',
  bg: {
    screen: '#0F172A',
    card:   '#1E293B',
    input:  '#1E293B',
    subtle: '#334155',
  },
  text: {
    primary:   '#F8FAFC',
    secondary: '#94A3B8',
    disabled:  '#475569',
    inverse:   '#FFFFFF',
    error:     '#EF4444',
  },
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  border:  '#334155',
  shadow:  'rgba(0,0,0,0.3)',
}
```

---

## 3. Typography tokens

```ts
export const typography = {
  sizes: {
    xs:   12,   // metadata, timestamps in list rows
    sm:   14,   // secondary labels, helper text
    base: 16,   // body, input values, list row primary text (MINIMUM)
    lg:   18,   // section headers, field labels
    xl:   22,   // screen titles, monthly totals
    xxl:  28,   // hero numbers (e.g. total hours on report screen)
  },
  weights: {
    regular: '400',
    medium:  '500',
    semibold:'600',
    bold:    '700',
  },
}
```

---

## 4. Spacing scale

```ts
export const spacing = {
  xs:   4,
  sm:   8,
  md:  12,
  base:16,
  lg:  24,
  xl:  32,
  xxl: 48,
}
```

---

## 5. Component tokens

```ts
export const radii = {
  sm:   6,    // input fields, small chips
  md:  12,    // cards, modals
  lg:  16,    // bottom sheets
  pill:999,   // FAB, pill badges
}
```

---

## 6. Tap target rules (non-negotiable)

- **Minimum tap target: 48×48dp.** No exceptions.
- Time picker fields: full-width touch area, minimum height 56dp
- Action buttons: minimum height 52dp
- List row tap area: full width × minimum 64dp height
- Delete / destructive actions: never single tap — swipe gesture + confirmation only
- FAB (Neue Fahrt): 56dp diameter

---

## 7. Screen-by-screen layout rules

### HomeScreen
- Header: month navigation (ChevronLeft, MonthYearPicker, ChevronRight)
- Trip list: `FlatList` of `EntryCard` components, most recent date first
- Sticky total bar: `formatGesamtzeit(totalMinutes)` — positioned above the tab bar
- **FAB: "＋"** — primary color, bottom-right
- No "Wiederholen" button. That shortcut was intentionally replaced by Settings defaults and recent Tour-Nr. chips.
- Empty state: "Noch keine Fahrten in diesem Monat" only. There is no dev/test-data button in the current app.
- Lucide icons inside Pressables and tab buttons must set `pointerEvents="none"` so standalone iOS hit-testing reaches the parent touch target.

### EntryScreen
**Layout — single scrollable form, header with "Neue Fahrt" / "Fahrt bearbeiten" and Close (X) icon.**

**Fields:**
1. **Datum**: large bold text, opens native `DateTimePicker`.
2. **Time fields**: (Beginn, Ankunft, Abfahrt, Ende). Labels above, `TimeField` below.
   - `TimeField` opens an **inline DrumColumn picker** (hours/minutes).
3. **Gesamtzeit live display**: Centered in a card. Uses primary background when the calculated duration is valid and no form error is active; otherwise uses subtle/error styling.
4. **Tour-Nr.**: `TourChips` (last 3 used) + `TextInput` (default keyboard).
5. **Besonderheiten**: Hidden by default. Link "＋ Besonderheit hinzufügen" expands a multiline `TextInput`.
6. **Speichern button**: Full width, pinned to bottom, always visible.

### ReportScreen
- Header: Month selector navigation.
- Summary bar: count of trips + total duration.
- **PDF preview**: Rendered via `WebView` using the HTML generator in `utils/generatePdf.ts`.
- **"Bericht teilen" button**: Full width, primary, opens the system share sheet for the `pdfmake`-generated file. In browsers that cannot share files it reads "Bericht herunterladen" and downloads the PDF.
- Empty state: "Keine Fahrten in diesem Monat"; the send button appears only when the month has trips.
- Report layout source of truth: `utils/generatePdf.ts` contains both `buildReportHtml` and `generatePdf`. Any change to report columns, signature position, margins, or footer must update both HTML and pdfmake paths.
- Signature placement: signature image is left-aligned above the signature line in both preview and exported PDF.

### SettingsScreen
- Grouped sections: "Fahrer", "Standard-Werte", "Erinnerung", "Erscheinungsbild", "Unterschrift", "Daten", "Gefahrenzone".
- **Fahrer**: `SettingRow` (Name, Vorname) opens a modal sheet with text input.
- **Standard-Werte**: `SettingRow` items for Tour-Nr., Beginn, Ankunft, Abfahrt, and Ende.
- **Erinnerung**: Toggle Switch for daily reminders + `SettingRow` for the Reminder Time.
- **Erscheinungsbild**: `Farbmodus` row cycles through system -> light -> dark -> system.
- **Unterschrift**: Dashed/solid border card. Tapping opens `SignaturePad` in landscape modal. Displays signature image if exists. "Unterschrift entfernen" link below.
- **Daten**: "Daten exportieren" and "Daten importieren" rows.
  - Export: Shares a JSON file via system share.
  - Import: Opens file picker, shows a confirmation modal with data preview before overwriting.
- **Gefahrenzone**: Destructive actions (Löschen/Reset) with red labeling and double-confirmation.

---

## 8. Interaction patterns

- **Time entry**: Custom `DrumColumn` component used inline within `TimeField` (EntryScreen) and within a modal sheet (SettingsScreen). Minutes snap to 5-minute intervals; exact-minute entry is not part of the current UI.
- **Signature**: Landscape modal with `SignatureCanvas`. Orientation locked to landscape when open.
- **Signature capture timing**: `SignatureCanvas` mounts only after landscape rotation settles to avoid drawing offsets.
- **Reminders**: Uses `expo-notifications` to schedule local triggers. Permission requested on first activation.
- **Appearance**: Stored in SQLite settings as `system`, `light`, or `dark`; applied with `Appearance.setColorScheme`.
- **Save feedback**: `saving` state with `ActivityIndicator` on buttons.
- **Validation**: Inline error text shown above the save button.
- **Confirmation modals**: Used for deleting trips, importing data, and Danger Zone actions.
- **Smart Prioritization**: New entries prioritize Settings defaults. If the user has not changed time defaults, the app tries the most recent same-weekday history. Final fallback is 07:00 / 07:30 / 07:45 / 09:00.

---

## 9. Navigation structure

```
Tab Bar (app/(tabs)/_layout.tsx):
├── Fahrten (index.tsx)         — Clock icon
├── Bericht (bericht.tsx)       — FileText icon
└── Einstellungen (einstellungen.tsx) — Settings icon

Modal Stack:
└── EntryScreen (app/entry/[id].tsx)
```

---

## 10. Non-negotiables

1. **All UI text in German.**
2. **Use tokens from `theme.ts`.**
3. **Minimum font size: 16 (base).**
4. **Minimum tap target: 48dp.**
5. **Time fields use inline DrumColumn, not text keyboard.**
6. **Gesamtzeit is calculated and read-only.**
7. **Offline-first.**
8. **Digital Signature is stored as base64 DataURL in settings.**
9. **Backups are stored/shared as JSON files.**
10. **PDF Engine**: Uses `pdfmake` for export and HTML for preview. All PDF styles are in `utils/generatePdf.ts`.
11. **Preview/export parity**: Report preview and final PDF must remain visually aligned. Update both paths for any report layout change.
12. **Icon touch handling**: `lucide-react-native` icons inside touch targets must use `pointerEvents="none"`.

---

## 11. Gesamtzeit calculation

Four trip modes, controlled in EntryScreen:

| Mode | UI controls | Formula | Empty fields stored |
|---|---|---|---|
| **Vollständige Fahrt** | Hinfahrt on + Rückfahrt on (default) | `(Ankunft−Beginn) + (Ende−Abfahrt)` | — |
| **Nur Hinfahrt** | Hinfahrt on, Rückfahrt off | `Ankunft − Beginn` | `abfahrt_schule`, `ende_fahrt` |
| **Nur Rückfahrt** | Hinfahrt off, Rückfahrt on | `Ende − Abfahrt` | `beginn_fahrt`, `ankunft_schule` |
| **Sonderfahrt** | Sonderfahrt toggle on (overrides sections) | `Ende − Beginn` | `ankunft_schule`, `abfahrt_schule` |

**Hinfahrt / Rückfahrt section toggles** appear in EntryScreen when Sonderfahrt is off. Toggling a section off collapses its fields but preserves their values in memory so they can be restored if re-enabled. At least one section must remain on.

**Sonderfahrt toggle** hides both section toggles and shows only Beginn + Ende.

In the PDF, any empty time field renders as `—`.

---

## 12. Abrechnungsmonat (report month)

Each trip has a `bericht_monat` (YYYY-MM) column that determines which monthly report it appears in. This is independent of the trip's actual `datum`.

- The month navigator on the Home and Bericht screens represents the **report month**, not a calendar filter.
- When the user opens a new entry from the June tab, the new trip gets `bericht_monat = 2026-06` regardless of which date they pick — a May trip recorded late still appears in June's report.
- A new entry's date defaults to the next weekday after the latest trip **of that report month**, so catching up on an earlier month starts in that month rather than after the newest trip overall.
- The "Abrechnungsmonat" label is shown below the date field in EntryScreen so the driver always knows which report the trip will land in.
- `bericht_monat` is set at creation time and preserved on edits (editing a trip never moves it to a different report).
- Old backup files without `bericht_monat` fall back to `substr(datum_iso, 1, 7)` on restore.

---

## 13. Current design gaps

- New-entry default detection currently considers only `Standard Beginn` and `Standard Ende` when deciding whether user defaults should override weekday-history fallback. If `Standard Ankunft` or `Standard Abfahrt` alone changes, weekday history may still win.
- Report preview and final PDF are generated by separate engines, so parity relies on disciplined updates and regression checks.
