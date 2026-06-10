import * as SQLite from 'expo-sqlite';
import type { Trip, NewTrip, Settings } from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

function rowToTrip(row: Record<string, unknown>): Trip {
  const datumIso = row.datum_iso as string;
  return {
    id:              row.id as number,
    datum:           row.datum as string,
    datumIso,
    berichtMonat:    (row.bericht_monat as string | null) ?? datumIso.slice(0, 7),
    istSonderfahrt:  Boolean(row.ist_sonderfahrt),
    beginFahrt:      row.beginn_fahrt as string,
    ankunftSchule:   row.ankunft_schule as string,
    abfahrtSchule:   row.abfahrt_schule as string,
    endeFahrt:       row.ende_fahrt as string,
    gesamtzeit:      row.gesamtzeit as number,
    tourNr:          row.tour_nr as string,
    besonderheiten:  row.besonderheiten as string | null,
    aufgezeichnetAm: row.aufgezeichnet_am as string,
  };
}

// ─── trips ───────────────────────────────────────────────────────────────────

export async function getTripsForMonth(
  db: SQLite.SQLiteDatabase,
  month: number,
  year: number,
): Promise<Trip[]> {
  const bm = `${year}-${String(month).padStart(2, '0')}`;
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM trips WHERE bericht_monat = ? ORDER BY datum_iso ASC`,
    [bm],
  );
  return rows.map(rowToTrip);
}

export async function getTripById(
  db: SQLite.SQLiteDatabase,
  id: number,
): Promise<Trip | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM trips WHERE id = ?`,
    [id],
  );
  return row ? rowToTrip(row) : null;
}

export async function insertTrip(
  db: SQLite.SQLiteDatabase,
  trip: NewTrip,
): Promise<number> {
  const berichtMonat = trip.berichtMonat || trip.datumIso.slice(0, 7);
  const result = await db.runAsync(
    `INSERT INTO trips
       (datum, datum_iso, bericht_monat, ist_sonderfahrt, beginn_fahrt, ankunft_schule,
        abfahrt_schule, ende_fahrt, gesamtzeit, tour_nr, besonderheiten, aufgezeichnet_am)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trip.datum,
      trip.datumIso,
      berichtMonat,
      trip.istSonderfahrt ? 1 : 0,
      trip.beginFahrt,
      trip.ankunftSchule,
      trip.abfahrtSchule,
      trip.endeFahrt,
      trip.gesamtzeit,
      trip.tourNr,
      trip.besonderheiten ?? null,
      trip.aufgezeichnetAm,
    ],
  );
  return result.lastInsertRowId;
}

export async function updateTrip(
  db: SQLite.SQLiteDatabase,
  id: number,
  trip: NewTrip,
): Promise<void> {
  const berichtMonat = trip.berichtMonat || trip.datumIso.slice(0, 7);
  await db.runAsync(
    `UPDATE trips SET
       datum = ?, datum_iso = ?, bericht_monat = ?, ist_sonderfahrt = ?,
       beginn_fahrt = ?, ankunft_schule = ?, abfahrt_schule = ?,
       ende_fahrt = ?, gesamtzeit = ?, tour_nr = ?, besonderheiten = ?, aufgezeichnet_am = ?
     WHERE id = ?`,
    [
      trip.datum,
      trip.datumIso,
      berichtMonat,
      trip.istSonderfahrt ? 1 : 0,
      trip.beginFahrt,
      trip.ankunftSchule,
      trip.abfahrtSchule,
      trip.endeFahrt,
      trip.gesamtzeit,
      trip.tourNr,
      trip.besonderheiten ?? null,
      trip.aufgezeichnetAm,
      id,
    ],
  );
}

export async function deleteTrip(
  db: SQLite.SQLiteDatabase,
  id: number,
): Promise<void> {
  await db.runAsync(`DELETE FROM trips WHERE id = ?`, [id]);
}

export async function getAllTrips(db: SQLite.SQLiteDatabase): Promise<Trip[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM trips ORDER BY datum_iso ASC`,
  );
  return rows.map(rowToTrip);
}

export async function clearAllData(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`DELETE FROM trips; DELETE FROM settings;`);
}

export async function deleteAllTrips(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(`DELETE FROM trips`);
}

export async function bulkInsertTrips(
  db: SQLite.SQLiteDatabase,
  trips: NewTrip[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const trip of trips) {
      await insertTrip(db, trip);
    }
  });
}

// ─── smart defaults ──────────────────────────────────────────────────────────

/** Returns the most common beginn_fahrt from the last 5 trips on the same weekday (0=Sun…6=Sat). */
export async function getDefaultBeginFahrt(
  db: SQLite.SQLiteDatabase,
  isoWeekday: number,
): Promise<string> {
  // SQLite strftime('%w') returns 0=Sun, 1=Mon … 6=Sat
  const row = await db.getFirstAsync<{ beginn_fahrt: string }>(
    `SELECT beginn_fahrt
     FROM (
       SELECT beginn_fahrt FROM trips
       WHERE CAST(strftime('%w', datum_iso) AS INTEGER) = ?
       ORDER BY datum_iso DESC
       LIMIT 5
     )
     GROUP BY beginn_fahrt
     ORDER BY COUNT(*) DESC
     LIMIT 1`,
    [isoWeekday],
  );
  return row?.beginn_fahrt ?? '07:00';
}

/** Returns the last N distinct tour numbers used, most recent first. */
export async function getRecentTourNumbers(
  db: SQLite.SQLiteDatabase,
  limit = 3,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ tour_nr: string }>(
    `SELECT DISTINCT tour_nr
     FROM trips
     ORDER BY id DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((r) => r.tour_nr);
}

/** Returns the most recently saved trip (for "Wiederholen"). */
export async function getLastTrip(
  db: SQLite.SQLiteDatabase,
): Promise<Trip | null> {
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM trips ORDER BY id DESC LIMIT 1`,
  );
  return row ? rowToTrip(row) : null;
}

// ─── settings ────────────────────────────────────────────────────────────────

export async function getSetting(
  db: SQLite.SQLiteDatabase,
  key: keyof Settings,
): Promise<string> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`,
    [key],
  );
  return row?.value ?? '';
}

export async function setSetting(
  db: SQLite.SQLiteDatabase,
  key: keyof Settings,
  value: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getAllSettings(
  db: SQLite.SQLiteDatabase,
): Promise<Settings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    fahrerName:     map['fahrerName']     ?? '',
    unterschrift:   map['unterschrift']   ?? '',
    defaultBeginn:  map['defaultBeginn']  ?? '07:00',
    defaultAnkunft: map['defaultAnkunft'] ?? '07:30',
    defaultAbfahrt: map['defaultAbfahrt'] ?? '07:45',
    defaultEnde:    map['defaultEnde']    ?? '09:00',
    defaultTour:    map['defaultTour']    ?? '',
    reminderEnabled: map['reminderEnabled'] === 'true',
    reminderTime:   map['reminderTime']   ?? '17:00',
    theme:          (map['theme'] as 'light' | 'dark' | 'system') ?? 'system',
  };
}
