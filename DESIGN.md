# DESIGN.md — Stundennachweis App
> Version 1.2 | Last updated: 2026-05-21
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

All colors defined in `theme.ts`. Never use raw hex values in screen components.

```ts
export const colors = {
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
- **"Wiederholen" button**: secondary outlined button, positioned left of or above FAB when history exists. Label: "Wiederholen".
- Empty state: "Noch keine Fahrten in diesem Monat" + "Testdaten laden" (in DEV)

### EntryScreen
**Layout — single scrollable form, header with "Neue Fahrt" / "Fahrt bearbeiten" and Close (X) icon.**

**Fields:**
1. **Datum**: large bold text, opens native `DateTimePicker`.
2. **Time fields**: (Beginn, Ankunft, Abfahrt, Ende). Labels above, `TimeField` below.
   - `TimeField` opens an **inline DrumColumn picker** (hours/minutes).
3. **Gesamtzeit live display**: Centered in a `bg.subtle` card. xxl bold text.
4. **Tour-Nr.**: `TourChips` (last 3 used) + `TextInput` (default keyboard).
5. **Besonderheiten**: Hidden by default. Link "＋ Besonderheit hinzufügen" expands a multiline `TextInput`.
6. **Speichern button**: Full width, pinned to bottom, always visible.

### ReportScreen
- Header: Month selector navigation.
- Summary bar: count of trips + total duration.
- **PDF preview**: Rendered via `WebView` using the HTML generator in `utils/generatePdf.ts`.
- **"Bericht senden" button**: Full width, primary, triggers native system sharing sheet for the `pdfmake`-generated file.

### SettingsScreen
- Grouped sections: "Fahrer", "Standard-Werte", "Erinnerung", "Unterschrift", "Daten", "Gefahrenzone".
- **Fahrer**: `SettingRow` (Name, Vorname) opens a modal sheet with text input.
- **Standard-Werte**: `SettingRow` items for Tour-Nr., Beginn, Ankunft, Abfahrt, and Ende.
- **Erinnerung**: Toggle Switch for daily reminders + `SettingRow` for the Reminder Time.
- **Unterschrift**: Dashed/solid border card. Tapping opens `SignaturePad` in landscape modal. Displays signature image if exists. "Unterschrift entfernen" link below.
- **Daten**: "Daten exportieren" and "Daten importieren" rows.
  - Export: Shares a JSON file via system share.
  - Import: Opens file picker, shows a confirmation modal with data preview before overwriting.
- **Gefahrenzone**: Destructive actions (Löschen/Reset) with red labeling and double-confirmation.

---

## 8. Interaction patterns

- **Time entry**: Custom `DrumColumn` component used inline within `TimeField` (EntryScreen) and within a modal sheet (SettingsScreen). Minutes snap to 5-minute intervals.
- **Signature**: Landscape modal with `SignatureCanvas`. Orientation locked to landscape when open.
- **Reminders**: Uses `expo-notifications` to schedule local triggers. Permission requested on first activation.
- **Save feedback**: `saving` state with `ActivityIndicator` on buttons.
- **Validation**: Inline error text shown above the save button.
- **Confirmation modals**: Used for deleting trips, importing data, and Danger Zone actions.
- **Smart Prioritization**: New entries prioritize User Defaults (from Settings) > Weekday History (same day last week) > System Fallback (07:00-09:00).

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
