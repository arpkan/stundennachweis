import type * as SQLite from 'expo-sqlite';
import { insertTrip } from './queries';

const SAMPLES = [
  { datum: '04.05.2026', datumIso: '2026-05-04', beginFahrt: '06:45', ankunftSchule: '07:18', abfahrtSchule: '07:33', endeFahrt: '08:28', tourNr: '12', besonderheiten: null },
  { datum: '05.05.2026', datumIso: '2026-05-05', beginFahrt: '06:45', ankunftSchule: '07:20', abfahrtSchule: '07:35', endeFahrt: '08:30', tourNr: '12', besonderheiten: null },
  { datum: '05.05.2026', datumIso: '2026-05-05', beginFahrt: '13:00', ankunftSchule: '13:38', abfahrtSchule: '13:52', endeFahrt: '14:28', tourNr: '5',  besonderheiten: null },
  { datum: '06.05.2026', datumIso: '2026-05-06', beginFahrt: '06:45', ankunftSchule: '07:22', abfahrtSchule: '07:38', endeFahrt: '08:35', tourNr: '12', besonderheiten: null },
  { datum: '06.05.2026', datumIso: '2026-05-06', beginFahrt: '13:00', ankunftSchule: '13:40', abfahrtSchule: '13:55', endeFahrt: '14:30', tourNr: '5',  besonderheiten: null },
  { datum: '07.05.2026', datumIso: '2026-05-07', beginFahrt: '07:00', ankunftSchule: '07:45', abfahrtSchule: '08:00', endeFahrt: '09:15', tourNr: 'A3', besonderheiten: 'Baustelle Hauptstraße – Umweg ca. 10 Min.' },
  { datum: '08.05.2026', datumIso: '2026-05-08', beginFahrt: '06:45', ankunftSchule: '07:20', abfahrtSchule: '07:35', endeFahrt: '08:30', tourNr: '12', besonderheiten: null },
  { datum: '08.05.2026', datumIso: '2026-05-08', beginFahrt: '13:00', ankunftSchule: '13:42', abfahrtSchule: '13:57', endeFahrt: '14:32', tourNr: '5',  besonderheiten: null },
  { datum: '11.05.2026', datumIso: '2026-05-11', beginFahrt: '06:50', ankunftSchule: '07:24', abfahrtSchule: '07:39', endeFahrt: '08:36', tourNr: '12', besonderheiten: null },
  { datum: '12.05.2026', datumIso: '2026-05-12', beginFahrt: '13:00', ankunftSchule: '13:40', abfahrtSchule: '13:55', endeFahrt: '14:30', tourNr: '5',  besonderheiten: null },
  { datum: '13.05.2026', datumIso: '2026-05-13', beginFahrt: '06:50', ankunftSchule: '07:25', abfahrtSchule: '07:40', endeFahrt: '08:40', tourNr: '12', besonderheiten: null },
  { datum: '13.05.2026', datumIso: '2026-05-13', beginFahrt: '13:00', ankunftSchule: '13:37', abfahrtSchule: '13:51', endeFahrt: '14:27', tourNr: '5',  besonderheiten: null },
  { datum: '14.05.2026', datumIso: '2026-05-14', beginFahrt: '07:00', ankunftSchule: '07:50', abfahrtSchule: '08:05', endeFahrt: '09:10', tourNr: 'A3', besonderheiten: null },
  { datum: '15.05.2026', datumIso: '2026-05-15', beginFahrt: '13:00', ankunftSchule: '13:35', abfahrtSchule: '13:50', endeFahrt: '14:25', tourNr: '5',  besonderheiten: null },
  { datum: '18.05.2026', datumIso: '2026-05-18', beginFahrt: '06:45', ankunftSchule: '07:19', abfahrtSchule: '07:34', endeFahrt: '08:29', tourNr: '12', besonderheiten: null },
  { datum: '19.05.2026', datumIso: '2026-05-19', beginFahrt: '06:45', ankunftSchule: '07:20', abfahrtSchule: '07:35', endeFahrt: '08:30', tourNr: '12', besonderheiten: null },
  { datum: '19.05.2026', datumIso: '2026-05-19', beginFahrt: '13:00', ankunftSchule: '13:41', abfahrtSchule: '13:56', endeFahrt: '14:31', tourNr: '5',  besonderheiten: null },
  { datum: '20.05.2026', datumIso: '2026-05-20', beginFahrt: '07:00', ankunftSchule: '07:48', abfahrtSchule: '08:02', endeFahrt: '09:05', tourNr: 'A3', besonderheiten: 'Schüler vergessen – Rückfahrt zur Haltestelle' },
  { datum: '21.05.2026', datumIso: '2026-05-21', beginFahrt: '06:45', ankunftSchule: '07:21', abfahrtSchule: '07:36', endeFahrt: '08:32', tourNr: '12', besonderheiten: null },
  { datum: '21.05.2026', datumIso: '2026-05-21', beginFahrt: '13:00', ankunftSchule: '13:39', abfahrtSchule: '13:54', endeFahrt: '14:29', tourNr: '5',  besonderheiten: null },
  { datum: '22.05.2026', datumIso: '2026-05-22', beginFahrt: '06:45', ankunftSchule: '07:22', abfahrtSchule: '07:37', endeFahrt: '08:33', tourNr: '12', besonderheiten: null },
  { datum: '22.05.2026', datumIso: '2026-05-22', beginFahrt: '13:00', ankunftSchule: '13:43', abfahrtSchule: '13:58', endeFahrt: '14:33', tourNr: '5',  besonderheiten: null },
  { datum: '26.05.2026', datumIso: '2026-05-26', beginFahrt: '06:50', ankunftSchule: '07:26', abfahrtSchule: '07:41', endeFahrt: '08:38', tourNr: '12', besonderheiten: null },
  { datum: '26.05.2026', datumIso: '2026-05-26', beginFahrt: '13:00', ankunftSchule: '13:36', abfahrtSchule: '13:50', endeFahrt: '14:26', tourNr: '5',  besonderheiten: null },
  { datum: '27.05.2026', datumIso: '2026-05-27', beginFahrt: '07:00', ankunftSchule: '07:47', abfahrtSchule: '08:01', endeFahrt: '09:08', tourNr: 'A3', besonderheiten: null },
  { datum: '28.05.2026', datumIso: '2026-05-28', beginFahrt: '06:45', ankunftSchule: '07:20', abfahrtSchule: '07:35', endeFahrt: '08:30', tourNr: '12', besonderheiten: null },
  { datum: '28.05.2026', datumIso: '2026-05-28', beginFahrt: '13:00', ankunftSchule: '13:44', abfahrtSchule: '13:59', endeFahrt: '14:34', tourNr: '5',  besonderheiten: null },
  { datum: '29.05.2026', datumIso: '2026-05-29', beginFahrt: '06:45', ankunftSchule: '07:23', abfahrtSchule: '07:38', endeFahrt: '08:34', tourNr: '12', besonderheiten: 'Verspätung – Zug am Bahnübergang' },
  { datum: '29.05.2026', datumIso: '2026-05-29', beginFahrt: '13:00', ankunftSchule: '13:37', abfahrtSchule: '13:52', endeFahrt: '14:27', tourNr: '5',  besonderheiten: null },
  { datum: '30.05.2026', datumIso: '2026-05-30', beginFahrt: '06:45', ankunftSchule: '07:21', abfahrtSchule: '07:36', endeFahrt: '08:31', tourNr: '12', besonderheiten: null },
];

export async function seedSampleData(db: SQLite.SQLiteDatabase): Promise<void> {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const aufgezeichnetAm = `${pad(today.getDate())}.${pad(today.getMonth() + 1)}.${today.getFullYear()}`;

  // Clear existing trips for the seed month before inserting
  await db.runAsync(`DELETE FROM trips WHERE datum_iso LIKE '2026-05-%'`);

  for (const s of SAMPLES) {
    const [bh, bm] = s.beginFahrt.split(':').map(Number);
    const [eh, em] = s.endeFahrt.split(':').map(Number);
    const gesamtzeit = (eh * 60 + em) - (bh * 60 + bm);
    await insertTrip(db, { ...s, gesamtzeit, aufgezeichnetAm });
  }
}
