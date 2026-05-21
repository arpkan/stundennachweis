import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Settings } from '@/db/types';
import type { NewTrip } from '@/db/types';
import {
  getAllTrips, getAllSettings,
  clearAllData, bulkInsertTrips, setSetting,
} from '@/db/queries';

const BACKUP_VERSION = 1;

type BackupFile = {
  version: number;
  exportedAt: string;
  settings: Settings;
  trips: NewTrip[];
};

export async function exportData(db: SQLiteDatabase): Promise<void> {
  const [trips, settings] = await Promise.all([
    getAllTrips(db),
    getAllSettings(db),
  ]);

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings,
    trips: trips.map(({ id, ...rest }) => rest),
  };

  const date = new Date().toISOString().slice(0, 10);
  const path = `${FileSystem.documentDirectory}stundennachweis_backup_${date}.json`;

  await FileSystem.writeAsStringAsync(path, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(path, {
    mimeType: 'application/json',
    dialogTitle: 'Backup speichern oder teilen',
  });
}

export type ImportPreview = {
  tripCount: number;
  fahrerName: string;
  exportedAt: string;
  raw: BackupFile;
};

export async function readBackupFile(): Promise<ImportPreview> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    throw new Error('CANCELLED');
  }

  const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Ungültige Datei — kein gültiges JSON.');
  }

  const backup = parsed as BackupFile;
  if (!backup.version || !Array.isArray(backup.trips) || !backup.settings) {
    throw new Error('Ungültige Backup-Datei.');
  }

  return {
    tripCount: backup.trips.length,
    fahrerName: backup.settings.fahrerName || '—',
    exportedAt: backup.exportedAt,
    raw: backup,
  };
}

export async function importData(db: SQLiteDatabase, backup: BackupFile): Promise<void> {
  await clearAllData(db);
  await bulkInsertTrips(db, backup.trips);
  for (const [key, value] of Object.entries(backup.settings) as [keyof Settings, string][]) {
    if (value) await setSetting(db, key, value);
  }
}
