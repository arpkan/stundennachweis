# PRD.md — Stundennachweis App
> Version 1.2 | Last updated: 2026-05-21
> Stack: React Native + Expo (TypeScript) | Platform: iOS + Android

---

## 1. What does this app do?

A mobile app for German school bus / workshop shuttle drivers to digitally record their daily trip times — replacing the existing paper *Stundennachweis* form — and send a completed monthly report as a PDF (including a digital signature) to their company via any system sharing option (Email, WhatsApp, etc.).

**One sentence:** A driver opens the app, logs each trip in under 30 seconds, and sends a PDF report to the company at month-end without touching paper.

---

## 2. Who uses it?

**Primary user: The bus driver**

- Age range: 30–60, not assumed to be tech-savvy
- Logs trips **at the end of the day** — recalling times from memory, not in real-time
- Does **1–2 trips per day** — entry volume is low but must feel effortless every single day
- Has a **mix of regular and irregular tours** — some Tour-Nr. repeat, some do not
- Works in Germany — app language is **German**
- Sends the monthly report themselves to their company

**Secondary user: The company / dispatcher**

- Receives the PDF report only — they do NOT use the app
- Expects the PDF to look identical to the existing paper *Stundennachweis* form
- Uses the report to calculate monthly wages

---

## 3. What does success look like?

**In 6 weeks, success means:**
- A driver can log a complete trip entry in ≤ 45 seconds **from memory**, at end of day
- The generated PDF is visually equivalent to the existing paper form (same columns, same layout)
- The driver can send the PDF via any system sharing option in 2 taps
- Zero data loss — entries persist even if the app is closed or the phone restarts
- A non-tech-savvy driver can use the app without a manual after one 5-minute onboarding
- Drivers can backup and restore their data manually to prevent loss when switching devices

**Measurable outcomes:**
- Time-to-log per entry (new): ≤ 45 seconds
- Time-to-log per entry (repeat tour via "Wiederholen"): ≤ 20 seconds
- Time-to-send monthly report: ≤ 60 seconds from opening the app
- Zero support requests about lost data

---

## 4. What does this app explicitly NOT do?

- Does NOT connect to any company backend or API (v1 is fully offline/local)
- Does NOT calculate wages or apply tariff rules (Gesamtzeit only — the company calculates pay)
- Does NOT require driver login or authentication (v1: single driver per device)
- Does NOT support multiple drivers sharing one device
- Does NOT store data in the cloud (v1: local device storage + manual file backup)
- Does NOT send reports automatically — driver triggers manually
- Does NOT handle GPS tracking, mileage, or fuel
- Does NOT support company-side report viewing or approval workflow

---

## 5. Core data model

Each **trip entry** captures exactly the fields from the existing paper form:

| Field | German Label | Type | Notes |
|---|---|---|---|
| Date | Datum | Date | DD.MM.YYYY format |
| Trip start | Beginn Fahrt | Time | HH:MM, 24h |
| Arrival at school/workshop | Ankunft Schule / Werkstätte | Time | HH:MM, 24h |
| Departure from school/workshop | Abfahrt Schule / Werkstätte | Time | HH:MM, 24h |
| Trip end | Ende Fahrt | Time | HH:MM, 24h |
| Total time | Gesamtzeit | Calculated | Auto: (Ende Fahrt − Beginn Fahrt), stored as minutes |
| Tour number | Tour-Nr. | Text | Short string e.g. "12", "A3" |
| Special remarks | Besonderheiten | Text | Optional, free text |
| Recorded on | aufgezeichnet am | Date | Auto-filled: today's date |

Each **monthly report** has:
- Month + Year header (Stundennachweis für den Monat)
- Driver name (Name, Vorname) — set once in Settings, persists
- All trip entries for that month, sorted by date ascending
- **Digital signature image** (set in Settings, included in PDF)
- Total Gesamtzeit sum for the month (footer)

---

## 6. Features — MVP scope

### F1 — Trip entry (primary action — designed for end-of-day memory recall)

**Core principle:** The driver is recalling times from memory after finishing work. Every field that can be pre-filled, auto-suggested, or skipped must be. Every tap that isn't necessary must be eliminated.

**Smart defaults — applied automatically on every new entry:**
- `Datum` defaults to today (DD.MM.YYYY). Driver taps to change if logging for a previous day.
- `aufgezeichnet am` auto-fills to today, hidden from the driver — not shown as an editable field.
- `Beginn Fahrt` defaults to the most common start time from the last 5 entries for the same weekday (e.g. if Monday trips usually start at 07:15, that is pre-filled). Falls back to 07:00 if no history.
- `Tour-Nr.` defaults to the last used tour number. Driver changes it only if different.

**Quick-fill time entry:**
- Time fields use a custom drum/scroll picker — no keyboard, no typing. 24-hour format.
- Each time picker shows hour and minute as two separate scrollable columns, large enough for thumb use.
- Minute column snaps to 5-minute intervals (00, 05, 10 … 55) — most real-world trip times fall on 5-minute marks. Driver can override to exact minute if needed via fine-scroll.
- Tapping a time field opens the picker inline (not a modal) — faster than a popup.

**Tour-Nr. smart input:**
- Displays last 3 used tour numbers as quick-tap chips above the text field.
- Tapping a chip fills the field instantly — zero keyboard required for repeat tours.
- For new/irregular tours: text input field.

**Gesamtzeit live feedback:**
- Calculated automatically: `Ende Fahrt − Beginn Fahrt`.
- Displayed prominently in real-time as times are adjusted — driver sees "2 Std. 15 Min." update live.
- This acts as a sanity check: if the number looks wrong, the driver knows immediately before saving.

**Besonderheiten (special remarks):**
- Optional. Collapsed by default — shown as a small "＋ Besonderheit hinzufügen" link.
- Only expands if tapped. Reduces visual noise for the majority of entries that have no remarks.

**Saving:**
- "Speichern" button: full-width, primary color, 52dp height, always visible at bottom.
- Validation: `Beginn Fahrt` must be before `Ende Fahrt`. Inline error below the field.

**"Wiederholen" shortcut (repeat last trip):**
- A "Wiederholen" button on the HomeScreen (secondary, beside FAB).
- Copies all fields from the most recent entry into a new EntryScreen with today's date.
- Driver only changes what differs (usually just the times). Saves ~60% of entry effort for regular tours.

### F2 — Trip list (home screen)
- Current month's entries listed, sorted by date descending (most recent first)
- Each row shows: Datum, Beginn Fahrt, Ende Fahrt, Tour-Nr., Gesamtzeit
- Tap to edit any entry
- Swipe left to delete (with confirmation)
- Monthly total Gesamtzeit shown as sticky footer
- Month selector at top to view/switch previous months
- **"Wiederholen" button** — copies last entry into new EntryScreen with today's date pre-filled

### F3 — Settings (set once)
- Driver name (Name, Vorname) — stored locally, used in every report
- **Standard-Werte**: User-defined default values (Tour-Nr., Beginn, Ankunft, Abfahrt, Ende) that pre-fill every new trip entry for maximum speed.
- **Digital Signature**: Driver can draw their signature on a landscape canvas; it is saved and included in the PDF report.
- **Daily Reminders**: Proactive local notifications to remind the driver to log their trips at a user-defined time (e.g., 17:00).
- **Backup & Restore**: Export all data (trips + settings) to a JSON file and import it back to restore data.

### F4 — PDF report generation
- PDF layout matches existing paper Stundennachweis exactly.
- A4 landscape orientation, including driver name, trip list, digital signature, and monthly totals.
- **Dual-Engine Strategy**: 
  - **In-App Preview**: Rendered via HTML string in a WebView for speed.
  - **Final Export**: Generated locally using `pdfmake` for high-fidelity output.
- 100% offline generation.

### F5 — Report delivery
- "Bericht senden" button on report preview screen
- Opens native system share sheet (Email, WhatsApp, etc.) with PDF attached.
- Driver can choose recipient before sending.

---

## 7. Screens

1. **HomeScreen** — monthly trip list + "Neue Fahrt" FAB button + "Wiederholen" button
2. **EntryScreen** — add / edit a single trip entry
3. **ReportScreen** — PDF preview + "Bericht senden" button
4. **SettingsScreen** — driver name, digital signature, backup/restore

Navigation: `expo-router` file-based. Tab bar: Fahrten | Bericht | Einstellungen.

---

## 8. Data persistence

- All data stored locally using `expo-sqlite`
- No cloud sync in v1
- Data survives app close, restart, and OS-level app suspension
- Manual JSON backup/restore via system file picker

---

## 9. Non-functional requirements

- **Language**: German throughout (all labels, errors, confirmations)
- **Date format**: DD.MM.YYYY (German standard)
- **Time format**: HH:MM, 24-hour (no AM/PM)
- **Offline-first**: 100% functional with no internet connection
- **Performance**: Entry save ≤ 200ms, PDF generation ≤ 3 seconds
- **Accessibility**: minimum font size 16sp body, tap targets ≥ 48dp
- **Platforms**: iOS 16+ and Android 10+

---

## 10. Out of scope for v1 (potential v2)

- Cloud backup / sync
- Multi-driver support
- Company-side dashboard
- Automatic monthly report scheduling
- Push notification reminders to log trips
- Dark mode
