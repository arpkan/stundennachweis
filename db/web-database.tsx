import initSqlJs, { type Database } from 'sql.js/dist/sql-wasm-browser';
import React, { createContext, useContext, useEffect, useState } from 'react';

type SQLiteRunResult = {
  lastInsertRowId: number;
  changes: number;
};

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
      locateFile: (file: string) => `/${file}`,
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

  async getAllAsync<T>(source: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(source);
    if (params && Array.isArray(params)) {
      stmt.bind(params as (string | number | null | Uint8Array)[]);
    }
    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push(row as T);
    }
    stmt.free();
    return results;
  }

  async getFirstAsync<T>(source: string, params?: unknown[]): Promise<T | null> {
    const rows = await this.getAllAsync<T>(source, params);
    return rows[0] ?? null;
  }

  async runAsync(source: string, params?: unknown[]): Promise<SQLiteRunResult> {
    if (params && Array.isArray(params)) {
      this.db.run(source, params as (string | number | null | Uint8Array)[]);
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

function loadFromIndexedDB(dbName: string): Promise<ArrayBuffer | null> {
  return openIDB().then(
    (idb) =>
      new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(dbName);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      })
  );
}

function saveToIndexedDB(dbName: string, data: Uint8Array): Promise<void> {
  return openIDB().then(
    (idb) =>
      new Promise((resolve, reject) => {
        const tx = idb.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(data.buffer, dbName);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

type ProviderProps = {
  databaseName: string;
  onInit?: (db: WebDatabase) => Promise<void>;
  useSuspense?: boolean;
  children: React.ReactNode;
};

const DbContext = createContext<WebDatabase | null>(null);

export function WebSQLiteProvider({
  databaseName,
  onInit,
  useSuspense,
  children,
}: ProviderProps) {
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
    return () => {
      cancelled = true;
    };
  }, [databaseName]);

  if (error) throw error;
  if (!db) return null;

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useSQLiteContext(): WebDatabase {
  const db = useContext(DbContext);
  if (!db)
    throw new Error(
      'useSQLiteContext must be used within a WebSQLiteProvider'
    );
  return db;
}
