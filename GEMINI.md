# GEMINI.md — Project Instructions

This file provides instructional context for Gemini CLI when working in the **Stundennachweis** repository.

## Project Overview

**Stundennachweis** is a React Native + Expo mobile application designed for German school bus and workshop shuttle drivers. It allows them to digitally record their daily trip times, replacing traditional paper forms, and generate a monthly PDF report that can be shared via email or WhatsApp.

### Core Technology Stack
- **Framework:** React Native + Expo (TypeScript)
- **Navigation:** `expo-router` (file-based navigation)
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Database:** `expo-sqlite` (local-only, offline-first)
- **PDF Generation:** `pdfmake` for the PDF, HTML in a WebView for the preview
- **Sharing:** `expo-sharing` & `expo-mail-composer`
- **Notifications:** `expo-notifications` (for daily reminders)
- **UI Components:** `react-native-reusables`, `lucide-react-native` (icons)
- **Animations:** `react-native-reanimated` v3

## Directory Structure

- `app/`: Application screens and routing logic.
  - `(tabs)/`: Main tab-based navigation (Fahrten, Bericht, Einstellungen).
  - `entry/`: Screens for adding and editing trip entries.
- `components/ui/`: Atomic UI components and primitives. **All screens must import from here.**
- `db/`: Database schema definitions, migration scripts, and query logic.
- `utils/`: Shared utilities for formatting, PDF generation, and backups.
- `theme.ts`: Centralized design tokens (Colors, Spacing, Typography).
- `constants/`: Global constants and color definitions.

## Development Workflows

### Building and Running
- `npx expo start`: Starts the Expo development server.
- `npx expo run:ios`: Builds and runs the app on an iOS simulator.
- `npx expo run:android`: Builds and runs the app on an Android emulator.
- `npx expo lint`: Runs the linter to check for code style issues.
- `npx tsc --noEmit`: Performs TypeScript type checking.

### Database Management
- The database schema is defined in `db/schema.ts`.
- It uses `expo-sqlite` for local storage.
- The primary table is `trips`, storing all driver log entries.
- A `settings` table stores driver preferences (name, email, WhatsApp).

### PDF Generation & Preview
- **In-App Preview:** Uses `buildReportHtml` (in `utils/generatePdf.ts`) to generate an HTML string for the `WebView` on the `Bericht` screen.
- **Exported PDF:** Uses `pdfmake` for creating the actual PDF file. This involves a complex patching layer in `utils/generatePdf.ts` to handle font parsing and character encodings within the Expo/Hermes environment.
- **Layout Synchrony:** To modify the report layout, both the HTML generator (`buildReportHtml`) and the `pdfmake` document definition (`generatePdf`) in `utils/generatePdf.ts` must be updated.

## Engineering Standards & Conventions

### Language & Localization
- **All UI text must be in German.**
- Dates must follow the `DD.MM.YYYY` format.
- Times must use the 24-hour `HH:MM` format.
- Durations are displayed as `X Std. Y Min.`.

### UI/UX Rules (Non-negotiable)
- **Minimum Tap Target:** 48x48dp for all interactive elements.
- **Minimum Font Size:** 16 (defined as `base` in `theme.ts`).
- **Theming:** Never use hardcoded hex values, sizes, or spacing. Always use tokens from `theme.ts`.
- **Time Entry:** Use inline drum pickers (two columns: HH and MM). Never use standard text inputs for time.
- **Form Defaults:** Implement smart defaults. New entries prioritize: 
  1. User-defined "Standard-Werte" (Tour-Nr. and Times) from Settings.
  2. Weekday History (copies values from the same weekday of the previous week).
  3. System Baseline (Tour-Nr. from history chips, 07:00 - 09:00 times).
- **Offline-First:** The app must be fully functional without an internet connection.

### Code Style
- **Surgical Updates:** When modifying existing screens, maintain the established architectural patterns and styling.
- **Component Isolation:** Avoid defining components inline within screen files. Move them to `components/ui/` or a local `components/` folder if they are specific to a single screen.
- **Explicit Types:** Maintain strict TypeScript safety. Avoid `any`.

## Reference Documentation
- `PRD.md`: Product Requirements Document containing detailed feature specs.
- `DESIGN.md`: Visual and interaction design specifications, including color and spacing tokens.
- `CLAUDE.md`: Quick-reference guide for AI coding assistants.
- `AGENTS.md`: Specific instructions for autonomous agents.
