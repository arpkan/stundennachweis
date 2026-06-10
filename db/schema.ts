import * as SQLite from 'expo-sqlite';

export async function migrateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS trips (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      datum            TEXT    NOT NULL,
      datum_iso        TEXT    NOT NULL,
      beginn_fahrt     TEXT    NOT NULL,
      ankunft_schule   TEXT    NOT NULL,
      abfahrt_schule   TEXT    NOT NULL,
      ende_fahrt       TEXT    NOT NULL,
      gesamtzeit       INTEGER NOT NULL,
      tour_nr          TEXT    NOT NULL,
      besonderheiten   TEXT,
      aufgezeichnet_am TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const v = versionRow?.user_version ?? 0;

  if (v < 1) {
    // Migration 1: add bericht_monat (YYYY-MM) — which report a trip belongs to
    await db.execAsync('ALTER TABLE trips ADD COLUMN bericht_monat TEXT');
    await db.execAsync("UPDATE trips SET bericht_monat = substr(datum_iso, 1, 7) WHERE bericht_monat IS NULL");
    await db.execAsync('PRAGMA user_version = 1');
  }

  if (v < 2) {
    // Migration 2: add ist_sonderfahrt — Beginn→Ende formula, Ankunft/Abfahrt empty
    await db.execAsync('ALTER TABLE trips ADD COLUMN ist_sonderfahrt INTEGER NOT NULL DEFAULT 0');
    await db.execAsync('PRAGMA user_version = 2');
  }
}
