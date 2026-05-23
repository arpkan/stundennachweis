# PWA Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PWA/web support to the Stundennachweis app so it runs in any browser, eliminating the need for Sideloadly.

**Architecture:** Platform abstraction via `.web.ts` file pairs in `utils/platform/`. Each file has a native version (re-exports Expo/native packages) and a `.web.ts` version (provides browser alternatives). Metro bundler resolves the correct one automatically. The largest piece is `db/web-database.ts` — a sql.js adapter implementing the same `SQLiteDatabase` interface so `db/queries.ts` stays unchanged.

**Tech Stack:** sql.js (WASM SQLite), signature_pad (HTML5 canvas), pdfmake (already works on web), react-native-web (already in project), Metro `.web.ts` platform extensions.

---

## File Map

### New files
| File | Responsibility |
|---|---|
| `db/web-database.ts` | sql.js adapter with IndexedDB persistence, implements SQLiteDatabase async interface |
| `components/ui/WebSignaturePad.tsx` | Direct signature_pad canvas component for web |
| `utils/platform/storage.ts` | Native: re-exports SQLiteProvider/useSQLiteContext from expo-sqlite |
| `utils/platform/storage.web.ts` | Web: exports WebSQLiteProvider/useSQLiteContext from web-database |
| `utils/platform/sharing.ts` | Native: re-exports expo-sharing |
| `utils/platform/sharing.web.ts` | Web: navigator.share / download fallback |
| `utils/platform/filesystem.ts` | Native: re-exports expo-file-system/legacy |
| `utils/platform/filesystem.web.ts` | Web: Blob/ObjectURL stubs |
| `utils/platform/document-picker.ts` | Native: re-exports expo-document-picker |
| `utils/platform/document-picker.web.ts` | Web: hidden `<input type="file">` wrapper |
| `utils/platform/signature.tsx` | Native: re-exports SignaturePad |
| `utils/platform/signature.web.tsx` | Web: re-exports WebSignaturePad |
| `utils/platform/date-picker.tsx` | Native: re-exports DateTimePicker |
| `utils/platform/date-picker.web.tsx` | Web: `<input type="date">` wrapper |
| `utils/platform/orientation.ts` | Native: re-exports expo-screen-orientation |
| `utils/platform/orientation.web.ts` | Web: no-ops |
| `utils/platform/notifications.ts` | Native: re-exports from utils/notifications |
| `utils/platform/notifications.web.ts` | Web: stubs |

### Modified files
| File | Change |
|---|---|
| `app/_layout.tsx` | Import provider from `utils/platform/storage` |
| `app/(tabs)/index.tsx` | Import useSQLiteContext from platform wrapper |
| `app/(tabs)/bericht.tsx` | Platform sharing + conditional WebView/div |
| `app/(tabs)/einstellungen.tsx` | Platform signature + notifications + web hint |
| `app/entry/[id].tsx` | Platform date-picker + useSQLiteContext |
| `utils/generatePdf.ts` | Web branch: pdfmake getBlob, skip polyfills |
| `utils/backup.ts` | Platform filesystem/sharing/document-picker |
| `package.json` | Add sql.js, signature_pad |
| `app.json` | Web manifest reference |
| `app/+html.tsx` | PWA meta tags (theme-color, apple-mobile-web-app-capable, manifest) |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install sql.js and signature_pad**

```bash
npm install sql.js signature_pad
```

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/sql.js/dist/sql-wasm.js node_modules/signature_pad/dist/signature_pad.umd.js
```

Expected: both files exist.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add sql.js and signature_pad dependencies for PWA support"
```

---

## Task 2: WebDatabase Adapter

This is the core piece — a class that wraps sql.js and provides the same async interface as expo-sqlite's `SQLiteDatabase`, so `db/queries.ts` and `db/schema.ts` work unchanged.

**Files:**
- Create: `db/web-database.ts`

- [ ] **Step 1: Create the WebDatabase class**

The methods needed (determined from actual usage in `db/queries.ts`, `db/schema.ts`, and `entry/[id].tsx`):
- `execAsync(source: string): Promise<void>`
- `getAllAsync<T>(source: string, params: SQLiteBindParams): Promise<T[]>`
- `getFirstAsync<T>(source: string, params: SQLiteBindParams): Promise<T | null>`
- `runAsync(source: string, params: SQLiteBindParams): Promise<SQLiteRunResult>`
- `withTransactionAsync(task: () => Promise<void>): Promise<void>`

```ts
import initSqlJs, { type Database } from 'sql.js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type SQLiteRunResult = {
  lastInsertRowId: number;
  changes: number;
};

type SQLiteBindParams = unknown[] | Record<string, unknown>;

export class WebDatabase {
  private db: Database;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dbName: string;

  private constructor(db: Database, dbName: string) {
    this.db = db;
    this.dbName = dbName;
  }

  static async open(dbName: string): Promise<WebDatabase> {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });

    let db: Database;
    const saved = await loadFromIndexedDB(dbName);
    if (saved) {
      db = new SQL.Database(new Uint8Array(saved));
    } else {
      db = new SQL.Database();
    }
    return new WebDatabase(db, dbName);
  }

  async execAsync(source: string): Promise<void> {
    this.db.run(source);
    this.scheduleSave();
  }

  async getAllAsync<T>(source: string, params?: SQLiteBindParams): Promise<T[]> {
    const stmt = this.db.prepare(source);
    if (params) {
      if (Array.isArray(params)) {
        stmt.bind(params);
      } else {
        const keys = Object.keys(params);
        const values = keys.map((k) => params[k]);
        stmt.bind(values);
      }
    }
    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row as T);
    }
    stmt.free();
    return results;
  }

  async getFirstAsync<T>(source: string, params?: SQLiteBindParams): Promise<T | null> {
    const rows = await this.getAllAsync<T>(source, params);
    return rows[0] ?? null;
  }

  async runAsync(source: string, params?: SQLiteBindParams): Promise<SQLiteRunResult> {
    if (params) {
      if (Array.isArray(params)) {
        this.db.run(source, params);
      } else {
        const values = Object.keys(params).map((k) => params[k]);
        this.db.run(source, values);
      }
    } else {
      this.db.run(source);
    }
    const changes = this.db.getRowsModified();
    const idResult = this.db.exec('SELECT last_insert_rowid()');
    const lastInsertRowId = idResult.length && idResult[0].values.length
      ? (idResult[0].values[0][0] as number)
      : 0;
    this.scheduleSave();
    return { lastInsertRowId, changes };
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    this.db.run('BEGIN TRANSACTION');
    try {
      await task();
      this.db.run('COMMIT');
    } catch (e) {
      this.db.run('ROLLBACK');
      throw e;
    }
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 500);
  }

  private async save(): Promise<void> {
    const data = this.db.export();
    await saveToIndexedDB(this.dbName, data);
  }
}

const IDB_NAME = 'stundennachweis';
const IDB_STORE = 'databases';
const IDB_VERSION = 1;

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIndexedDB(dbName: string): Promise<ArrayBuffer | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(dbName);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIndexedDB(dbName: string, data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(data.buffer, dbName);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type ProviderProps = {
  databaseName: string;
  onInit?: (db: WebDatabase) => Promise<void>;
  useSuspense?: boolean;
  children: React.ReactNode;
};

const DbContext = createContext<WebDatabase | null>(null);

export function WebSQLiteProvider({ databaseName, onInit, useSuspense, children }: ProviderProps) {
  const [db, setDb] = useState<WebDatabase | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    WebDatabase.open(databaseName)
      .then(async (database) => {
        if (cancelled) return;
        if (onInit) await onInit(database);
        if (!cancelled) setDb(database);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => { cancelled = true; };
  }, [databaseName]);

  if (error) throw error;
  if (!db) {
    if (useSuspense) throw new Promise(() => {});
    return null;
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useSQLiteContext(): WebDatabase {
  const db = useContext(DbContext);
  if (!db) throw new Error('useSQLiteContext must be used within a WebSQLiteProvider');
  return db;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `db/web-database.ts` (there may be existing errors in other files from the `import * as SQLite from 'expo-sqlite'` in db files — that's fine, those are type-only and will resolve at runtime).

- [ ] **Step 3: Commit**

```bash
git add db/web-database.ts
git commit -m "feat(pwa): add sql.js WebDatabase adapter with IndexedDB persistence"
```

---

## Task 3: Platform Storage Wrapper

**Files:**
- Create: `utils/platform/storage.ts`
- Create: `utils/platform/storage.web.ts`

- [ ] **Step 1: Create native version**

```ts
export { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
```

- [ ] **Step 2: Create web version**

```ts
export { WebSQLiteProvider as SQLiteProvider, useSQLiteContext } from '@/db/web-database';
```

- [ ] **Step 3: Commit**

```bash
git add utils/platform/storage.ts utils/platform/storage.web.ts
git commit -m "feat(pwa): add platform storage wrapper"
```

---

## Task 4: Update Root Layout and Screen Imports

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/(tabs)/bericht.tsx`
- Modify: `app/(tabs)/einstellungen.tsx`
- Modify: `app/entry/[id].tsx`

- [ ] **Step 1: Update `app/_layout.tsx`**

Change line 5 from:
```ts
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
```
to:
```ts
import { SQLiteProvider, useSQLiteContext } from '@/utils/platform/storage';
```

- [ ] **Step 2: Update `app/(tabs)/index.tsx`**

Change line 5 from:
```ts
import { useSQLiteContext } from 'expo-sqlite';
```
to:
```ts
import { useSQLiteContext } from '@/utils/platform/storage';
```

- [ ] **Step 3: Update `app/(tabs)/bericht.tsx`**

Change line 3 from:
```ts
import { useSQLiteContext } from 'expo-sqlite';
```
to:
```ts
import { useSQLiteContext } from '@/utils/platform/storage';
```

- [ ] **Step 4: Update `app/(tabs)/einstellungen.tsx`**

Change line 6 from:
```ts
import { useSQLiteContext } from 'expo-sqlite';
```
to:
```ts
import { useSQLiteContext } from '@/utils/platform/storage';
```

- [ ] **Step 5: Update `app/entry/[id].tsx`**

Change line 6 from:
```ts
import { useSQLiteContext } from 'expo-sqlite';
```
to:
```ts
import { useSQLiteContext } from '@/utils/platform/storage';
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no new errors. Type errors from `expo-sqlite` imports in `db/queries.ts` and `db/schema.ts` are expected — those use `SQLite.SQLiteDatabase` as a type annotation only, and the structural typing matches our WebDatabase.

- [ ] **Step 7: Commit**

```bash
git add app/_layout.tsx app/(tabs)/index.tsx app/(tabs)/bericht.tsx app/(tabs)/einstellungen.tsx app/entry/[id].tsx
git commit -m "feat(pwa): use platform storage wrapper in all screens"
```

---

## Task 5: Web Signature Pad

**Files:**
- Create: `components/ui/WebSignaturePad.tsx`
- Create: `utils/platform/signature.tsx`
- Create: `utils/platform/signature.web.tsx`
- Modify: `app/(tabs)/einstellungen.tsx`

- [ ] **Step 1: Create WebSignaturePad**

Uses `signature_pad` (the same library wrapped by `react-native-signature-canvas`) directly on an HTML5 canvas. Same props interface as the native `SignaturePad`.

```tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import SignaturePad from 'signature_pad';
import { useThemeColors, typography, spacing, radii } from '@/theme';

type Props = {
  visible: boolean;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
};

export function WebSignaturePad({ visible, onSave, onClose }: Props) {
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (visible && canvasRef.current && !padRef.current) {
      padRef.current = new SignaturePad(canvasRef.current, {
        penColor: '#000000',
        backgroundColor: '#ffffff',
      });
    }
    if (!visible && padRef.current) {
      padRef.current.off();
      padRef.current = null;
    }
  }, [visible]);

  const handleSave = useCallback(() => {
    if (padRef.current && !padRef.current.isEmpty()) {
      onSave(padRef.current.toDataURL('image/png'));
    }
  }, [onSave]);

  const handleClear = useCallback(() => {
    padRef.current?.clear();
  }, []);

  return (
    <Modal visible={visible} animationType="slide">
      <View style={{ flex: 1, backgroundColor: colors.bg.screen }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            backgroundColor: colors.bg.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary }}>
              Abbrechen
            </Text>
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.text.primary }}>
              Unterschrift
            </Text>
            <Text style={{ fontSize: typography.sizes.xs, color: colors.text.secondary }}>
              Mit dem Finger oder der Maus zeichnen
            </Text>
          </View>
          <Pressable onPress={handleSave} hitSlop={12}>
            <Text style={{ fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.primary }}>
              Speichern
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            flex: 1,
            margin: spacing.base,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radii.md,
            backgroundColor: '#ffffff',
            overflow: 'hidden',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              touchAction: 'none',
            } as React.CSSProperties}
          />
        </View>

        <View style={{ paddingHorizontal: spacing.base, paddingBottom: spacing.base }}>
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => ({
              height: 44,
              borderRadius: radii.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: pressed ? colors.bg.subtle : colors.bg.card,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text style={{ fontSize: typography.sizes.base, color: colors.text.secondary }}>
              Löschen
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Create native signature wrapper**

`utils/platform/signature.tsx`:
```tsx
export { SignaturePad } from '@/components/ui/SignaturePad';
```

- [ ] **Step 3: Create web signature wrapper**

`utils/platform/signature.web.tsx`:
```tsx
export { WebSignaturePad as SignaturePad } from '@/components/ui/WebSignaturePad';
```

- [ ] **Step 4: Update `app/(tabs)/einstellungen.tsx`**

Change line 12 from:
```ts
import { SignaturePad } from '@/components/ui/SignaturePad';
```
to:
```ts
import { SignaturePad } from '@/utils/platform/signature';
```

- [ ] **Step 5: Commit**

```bash
git add components/ui/WebSignaturePad.tsx utils/platform/signature.tsx utils/platform/signature.web.tsx app/(tabs)/einstellungen.tsx
git commit -m "feat(pwa): add web signature pad with platform wrapper"
```

---

## Task 6: Platform Sharing + Filesystem

**Files:**
- Create: `utils/platform/sharing.ts`
- Create: `utils/platform/sharing.web.ts`
- Create: `utils/platform/filesystem.ts`
- Create: `utils/platform/filesystem.web.ts`

- [ ] **Step 1: Create native sharing wrapper**

`utils/platform/sharing.ts`:
```ts
export * from 'expo-sharing';
```

- [ ] **Step 2: Create web sharing wrapper**

`utils/platform/sharing.web.ts`:
```ts
export async function shareAsync(
  url: string,
  options?: { mimeType?: string; dialogTitle?: string; UTI?: string }
): Promise<void> {
  if (navigator.share) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const fileName = url.split('/').pop() || 'file';
      const file = new File([blob], fileName, { type: options?.mimeType || blob.type });
      await navigator.share({ files: [file], title: options?.dialogTitle });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = url.split('/').pop() || 'download';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

- [ ] **Step 3: Create native filesystem wrapper**

`utils/platform/filesystem.ts`:
```ts
export { EncodingType } from 'expo-file-system/legacy';
export * as FileSystem from 'expo-file-system/legacy';
```

- [ ] **Step 4: Create web filesystem wrapper**

`utils/platform/filesystem.web.ts`:
```ts
export const EncodingType = {
  UTF8: 'utf8',
  Base64: 'base64',
} as const;

export const FileSystem = {
  documentDirectory: '/tmp/',

  async writeAsStringAsync(
    path: string,
    content: string,
    options?: { encoding?: string }
  ): Promise<string> {
    if (options?.encoding === EncodingType.Base64) {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes]);
      const url = URL.createObjectURL(blob);
      return url;
    }
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    return url;
  },

  async readAsStringAsync(
    uri: string,
    _options?: { encoding?: string }
  ): Promise<string> {
    const response = await fetch(uri);
    return response.text();
  },
};
```

- [ ] **Step 5: Commit**

```bash
git add utils/platform/sharing.ts utils/platform/sharing.web.ts utils/platform/filesystem.ts utils/platform/filesystem.web.ts
git commit -m "feat(pwa): add platform sharing and filesystem wrappers"
```

---

## Task 7: Update generatePdf.ts for Web

**Files:**
- Modify: `utils/generatePdf.ts`

The key changes:
1. Import `Platform` from `react-native` to detect web
2. On web, skip `patchForPdfmake()` polyfills — they're for Hermes only
3. On web, use pdfmake's `getBlob()` instead of `getBase64()` + FileSystem write
4. Return a Blob URL on web instead of a file URI

- [ ] **Step 1: Update imports**

Add to the existing imports at the top:
```ts
import { Platform } from 'react-native';
```

Remove the direct import:
```ts
import * as FileSystem from 'expo-file-system/legacy';
```

Replace with:
```ts
import { FileSystem } from '@/utils/platform/filesystem';
```

- [ ] **Step 2: Guard patchForPdfmake**

Wrap the `patchForPdfmake()` call at the top of `generatePdf()`:
```ts
if (Platform.OS !== 'web') {
  patchForPdfmake();
}
```

- [ ] **Step 3: Add web branch for PDF output**

Replace the final section of `generatePdf` (from `const base64` to the end) with:

```ts
  if (Platform.OS === 'web') {
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    return new Promise<string>((resolve, reject) => {
      pdfDocGenerator.getBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        resolve(url);
      });
    });
  }

  const base64: string = await pdfMake.createPdf(docDefinition).getBase64();

  const fileName = buildFileName(settings, month, year);
  const destUri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: 'UTF8' as any,
  });

  return destUri;
```

On native, use the platform wrapper's `EncodingType` for the write:

```ts
import { FileSystem, EncodingType } from '@/utils/platform/filesystem';
```

- [ ] **Step 4: Commit**

```bash
git add utils/generatePdf.ts
git commit -m "feat(pwa): add web PDF generation branch using pdfmake getBlob"
```

---

## Task 8: Update bericht.tsx for Web

**Files:**
- Modify: `app/(tabs)/bericht.tsx`

Changes:
1. Replace `expo-sharing` import with platform wrapper
2. Replace `react-native-webview` WebView with conditional rendering

- [ ] **Step 1: Update imports**

Change:
```ts
import { WebView } from 'react-native-webview';
import * as Sharing from 'expo-sharing';
```

To:
```ts
import { Platform } from 'react-native';
import { shareAsync } from '@/utils/platform/sharing';
```

- [ ] **Step 2: Update handleSend**

Change:
```ts
await Sharing.shareAsync(uri, {
  mimeType: 'application/pdf',
  dialogTitle: `Stundennachweis ${MONTH_NAMES[month - 1]} ${year}`,
  UTI: 'com.adobe.pdf',
});
```

To:
```ts
await shareAsync(uri, {
  mimeType: 'application/pdf',
  dialogTitle: `Stundennachweis ${MONTH_NAMES[month - 1]} ${year}`,
  UTI: 'com.adobe.pdf',
});
```

- [ ] **Step 3: Replace WebView with conditional rendering**

Replace the `<WebView>` block:
```tsx
<WebView
  source={{ html: previewHtml }}
  style={{ flex: 1 }}
  scrollEnabled
  originWhitelist={['*']}
/>
```

With:
```tsx
{Platform.OS === 'web' ? (
  <div
    style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}
    dangerouslySetInnerHTML={{ __html: previewHtml }}
  />
) : (
  <WebView
    source={{ html: previewHtml }}
    style={{ flex: 1 }}
    scrollEnabled
    originWhitelist={['*']}
  />
)}
```

Note: Use an `HtmlPreview` helper component to avoid bundling WebView on web:

At the top of the file, add:
```ts
import { Platform } from 'react-native';
```

Create a helper component (outside the main component):
```tsx
const HtmlPreview = ({ html }: { html: string }) => {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{ flex: 1, overflow: 'auto' } as any}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  const { WebView } = require('react-native-webview');
  return <WebView source={{ html }} style={{ flex: 1 }} scrollEnabled originWhitelist={['*']} />;
};
```

Then in the JSX, replace `<WebView .../>` with `<HtmlPreview html={previewHtml} />`.

Remove the `import { WebView } from 'react-native-webview'` line.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/bericht.tsx
git commit -m "feat(pwa): conditional WebView/div for report preview on web"
```

---

## Task 9: Platform Document Picker + Update backup.ts

**Files:**
- Create: `utils/platform/document-picker.ts`
- Create: `utils/platform/document-picker.web.ts`
- Modify: `utils/backup.ts`

- [ ] **Step 1: Create native document picker wrapper**

`utils/platform/document-picker.ts`:
```ts
export * from 'expo-document-picker';
```

- [ ] **Step 2: Create web document picker wrapper**

`utils/platform/document-picker.web.ts`:
```ts
export async function getDocumentAsync(options?: {
  type?: string | string[];
  copyToCacheDirectory?: boolean;
}): Promise<{
  canceled: boolean;
  assets?: Array<{ uri: string; name: string }>;
}> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = Array.isArray(options?.type) ? options.type.join(',') : (options?.type || '*/*');
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ canceled: true });
        return;
      }
      const uri = URL.createObjectURL(file);
      resolve({
        canceled: false,
        assets: [{ uri, name: file.name }],
      });
    };
    input.oncancel = () => resolve({ canceled: true });
    input.click();
  });
}
```

- [ ] **Step 3: Update `utils/backup.ts`**

Change imports from:
```ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
```

To:
```ts
import { FileSystem } from '@/utils/platform/filesystem';
import { shareAsync } from '@/utils/platform/sharing';
import * as DocumentPicker from '@/utils/platform/document-picker';
```

Update `exportData` — change the file writing and sharing to use platform wrappers:
```ts
const content = JSON.stringify(backup, null, 2);
const date = new Date().toISOString().slice(0, 10);
const path = `${FileSystem.documentDirectory}stundennachweis_backup_${date}.json`;
const uri = await FileSystem.writeAsStringAsync(path, content);
await shareAsync(uri, {
  mimeType: 'application/json',
  dialogTitle: 'Backup speichern oder teilen',
});
```

Note: `FileSystem.writeAsStringAsync` returns `Promise<string>` — on native it returns the file path, on web it returns a Blob URL. This lets us use the same share call on both platforms.

**Key design decision:** `FileSystem.writeAsStringAsync` returns `Promise<string>` in both platform wrappers. On native, it wraps `expo-file-system/legacy`'s `writeAsStringAsync` and returns the path. On web, it creates a Blob URL and returns it. This unified return type simplifies all consumers.

The `utils/platform/filesystem.ts` (native) from Task 6 needs to be:
```ts
import * as NativeFS from 'expo-file-system/legacy';
export { EncodingType } from 'expo-file-system/legacy';
export const FileSystem = {
  documentDirectory: NativeFS.documentDirectory,
  async writeAsStringAsync(path: string, content: string, options?: any): Promise<string> {
    await NativeFS.writeAsStringAsync(path, content, options);
    return path;
  },
  readAsStringAsync: NativeFS.readAsStringAsync,
};
```

The `utils/platform/filesystem.web.ts` from Task 6 needs to be:
```ts
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;
export const FileSystem = {
  documentDirectory: '',
  async writeAsStringAsync(_path: string, content: string, options?: any): Promise<string> {
    if (options?.encoding === 'base64') {
      const binary = atob(content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes]));
    }
    return URL.createObjectURL(new Blob([content]));
  },
  async readAsStringAsync(uri: string): Promise<string> {
    const res = await fetch(uri);
    return res.text();
  },
};
```

Go back and update the filesystem wrapper code in **Task 6 Steps 1 and 2** to match these final versions before implementing.

`utils/platform/filesystem.web.ts`:
```ts
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;

export const FileSystem = {
  documentDirectory: '',
  async writeAsStringAsync(
    _path: string,
    content: string,
    _options?: { encoding?: string }
  ): Promise<string> {
    const blob = new Blob([content], { type: 'application/json' });
    return URL.createObjectURL(blob);
  },
  async readAsStringAsync(uri: string): Promise<string> {
    const response = await fetch(uri);
    return response.text();
  },
};
```

**Key design decision:**

`utils/platform/filesystem.ts`:
```ts
import * as NativeFS from 'expo-file-system/legacy';
export { EncodingType } from 'expo-file-system/legacy';

export const FileSystem = {
  documentDirectory: NativeFS.documentDirectory,
  async writeAsStringAsync(path: string, content: string, options?: any): Promise<string> {
    await NativeFS.writeAsStringAsync(path, content, options);
    return path;
  },
  readAsStringAsync: NativeFS.readAsStringAsync,
};
```

`utils/platform/filesystem.web.ts`:
```ts
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' } as const;
export const FileSystem = {
  documentDirectory: '',
  async writeAsStringAsync(_path: string, content: string, _options?: any): Promise<string> {
    const blob = new Blob([content]);
    return URL.createObjectURL(blob);
  },
  async readAsStringAsync(uri: string): Promise<string> {
    const response = await fetch(uri);
    return response.text();
  },
};
```

Go back and update the filesystem wrapper code in **Task 6 Steps 1 and 2** to match these final versions before implementing.

- [ ] **Step 5: Commit**

```bash
git add utils/backup.ts utils/platform/document-picker.ts utils/platform/document-picker.web.ts
git commit -m "feat(pwa): platform document picker and update backup.ts"
```

---

## Task 10: Platform Orientation Wrapper

**Files:**
- Create: `utils/platform/orientation.ts`
- Create: `utils/platform/orientation.web.ts`

- [ ] **Step 1: Create native orientation wrapper**

`utils/platform/orientation.ts`:
```ts
export * as ScreenOrientation from 'expo-screen-orientation';
```

- [ ] **Step 2: Create web orientation wrapper (no-ops)**

`utils/platform/orientation.web.ts`:
```ts
export const ScreenOrientation = {
  OrientationLock: {
    LANDSCAPE: 'landscape',
    PORTRAIT_UP: 'portrait',
  },
  lockAsync: async () => {},
  unlockAsync: async () => {},
};
```

- [ ] **Step 3: Update `components/ui/SignaturePad.tsx`**

Change line 4 from:
```ts
import * as ScreenOrientation from 'expo-screen-orientation';
```
to:
```ts
import { ScreenOrientation } from '@/utils/platform/orientation';
```

- [ ] **Step 4: Commit**

```bash
git add utils/platform/orientation.ts utils/platform/orientation.web.ts components/ui/SignaturePad.tsx
git commit -m "feat(pwa): add platform orientation wrapper"
```

---

## Task 11: Platform Date Picker + Update entry/[id].tsx

**Files:**
- Create: `utils/platform/date-picker.tsx`
- Create: `utils/platform/date-picker.web.tsx`
- Modify: `app/entry/[id].tsx`

- [ ] **Step 1: Create native date picker wrapper**

`utils/platform/date-picker.tsx`:
```tsx
export { default as DateTimePicker } from '@react-native-community/datetimepicker';
export type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
```

- [ ] **Step 2: Create web date picker wrapper**

`utils/platform/date-picker.web.tsx`:
```tsx
import React from 'react';
import { View } from 'react-native';

export type DateTimePickerEvent = {
  type: string;
  nativeEvent: { timestamp: number };
};

type Props = {
  value: Date;
  mode: string;
  display: string;
  onChange: (event: DateTimePickerEvent, date?: Date) => void;
  maximumDate?: Date;
  locale?: string;
  themeVariant?: string;
  textColor?: string;
};

export function DateTimePicker({ value, onChange, maximumDate }: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined;
    if (date) {
      onChange({ type: 'set', nativeEvent: { timestamp: date.getTime() } }, date);
    }
  };

  return (
    <View style={{ padding: 8 }}>
      <input
        type="date"
        value={value.toISOString().slice(0, 10)}
        onChange={handleChange}
        max={maximumDate?.toISOString().slice(0, 10)}
        style={{
          fontSize: 16,
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #ccc',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    </View>
  );
}
```

- [ ] **Step 3: Update `app/entry/[id].tsx`**

Change line 8 from:
```ts
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
```
to:
```ts
import { DateTimePicker, type DateTimePickerEvent } from '@/utils/platform/date-picker';
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add utils/platform/date-picker.tsx utils/platform/date-picker.web.tsx app/entry/[id].tsx
git commit -m "feat(pwa): add platform date picker with HTML date input for web"
```

---

## Task 12: Platform Notifications + Update einstellungen.tsx

**Files:**
- Create: `utils/platform/notifications.ts`
- Create: `utils/platform/notifications.web.ts`
- Modify: `app/(tabs)/einstellungen.tsx`

- [ ] **Step 1: Create native notifications wrapper**

`utils/platform/notifications.ts`:
```ts
export { updateReminders } from '@/utils/notifications';
```

- [ ] **Step 2: Create web notifications wrapper (stubs)**

`utils/platform/notifications.web.ts`:
```ts
export async function updateReminders(_enabled: boolean, _timeStr: string): Promise<void> {}
```

- [ ] **Step 3: Update `app/(tabs)/einstellungen.tsx`**

Change line 16 from:
```ts
import { updateReminders } from '@/utils/notifications';
```
to:
```ts
import { Platform } from 'react-native';
import { updateReminders } from '@/utils/platform/notifications';
```

In the `handleReminderToggle` function, after calling `updateReminders`, add a web hint:

```ts
const handleReminderToggle = async (enabled: boolean) => {
  const value = enabled ? 'true' : 'false';
  await setSetting(db, 'reminderEnabled', value);
  await updateReminders(enabled, settings?.reminderTime ?? '17:00');
  if (enabled && Platform.OS === 'web') {
    Alert.alert('Hinweis', 'Erinnerungen sind nur in der nativen App verfügbar.');
  }
  load();
};
```

- [ ] **Step 4: Commit**

```bash
git add utils/platform/notifications.ts utils/platform/notifications.web.ts app/(tabs)/einstellungen.tsx
git commit -m "feat(pwa): add platform notifications wrapper with web hint"
```

---

## Task 13: PWA Configuration

**Files:**
- Create: `public/manifest.json`
- Modify: `app.json`
- Modify: `app/+html.tsx`

- [ ] **Step 1: Create PWA manifest**

`public/manifest.json`:
```json
{
  "name": "Stundennachweis",
  "short_name": "Stundennachweis",
  "description": "Fahrtenbuch für Fahrer",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1A56DB",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/assets/images/adaptive-icon.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2: Update `app.json` web section**

Add manifest reference to the existing `web` config:

```json
"web": {
  "bundler": "metro",
  "output": "static",
  "favicon": "./assets/images/favicon.png",
  "name": "Stundennachweis",
  "themeColor": "#1A56DB",
  "backgroundColor": "#ffffff"
}
```

Note: Expo's static web output copies files from `public/` to the build output automatically.

- [ ] **Step 3: Update `app/+html.tsx`**

Add PWA meta tags inside the `<head>` element:

```tsx
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#1A56DB" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="manifest" href="/manifest.json" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json app.json app/+html.tsx
git commit -m "feat(pwa): add PWA manifest, meta tags, and standalone mode"
```

---

## Task 14: Integration Verification

- [ ] **Step 1: Verify TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are type mismatches in the platform wrappers, fix them before proceeding.

- [ ] **Step 2: Start web dev server**

```bash
npx expo start --web
```

Expected: Metro bundles successfully and opens in browser. If there are bundling errors (e.g., sql.js WASM loading), check the `locateFile` config in `db/web-database.ts`.

- [ ] **Step 3: Smoke test in browser**

Verify these flows work:
1. App loads, shows home screen with month selector
2. Tap "+" to create a new trip — form opens, time pickers work
3. Fill in a trip, save — appears in trip list
4. Open Settings — change Fahrer name, verify it saves
5. Open Signature pad — canvas renders, draw and save
6. Open Bericht — HTML preview renders, PDF download works
7. Export backup — file downloads
8. Import backup — file picker opens, data restores

- [ ] **Step 4: Test PWA installability**

In Chrome/Edge on desktop: check if the install icon appears in the address bar. On iOS Safari: check "Add to Home Screen" option.

- [ ] **Step 5: Verify native build still works**

```bash
npx tsc --noEmit
npx expo start --ios
```

Expected: iOS app runs unchanged with expo-sqlite, native signature pad, notifications, etc.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(pwa): complete PWA support with web platform adapters"
```
