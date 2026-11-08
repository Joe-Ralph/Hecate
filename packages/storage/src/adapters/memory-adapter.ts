/**
 * Memory & Local-First IndexedDB Storage Adapter using @sqlite.org/sqlite-wasm
 * Official SQLite WASM build (includes FTS5) with automatic local persistence.
 */

import initSqlite, { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { StorageAdapter } from './storage-adapter';

let sqlitePromise: Promise<Sqlite3Static> | null = null;

async function getSqlite(): Promise<Sqlite3Static> {
  if (sqlitePromise) return sqlitePromise;
  // The browser build resolves sqlite3.wasm via `new URL(..., import.meta.url)`,
  // which Vite emits as a build asset automatically.
  sqlitePromise = initSqlite();
  return sqlitePromise;
}

const IDB_NAME = 'hecate_pkm';
const IDB_STORE = 'sqlite_storage';
const IDB_KEY = 'hecate_sqlite_binary';

function getIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('IndexedDB open failed:', request.error);
      resolve(null);
    };
  });
}

async function loadFromIndexedDb(): Promise<Uint8Array | null> {
  const db = await getIndexedDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_KEY);
      req.onsuccess = () => {
        if (req.result instanceof Uint8Array) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToIndexedDb(data: Uint8Array): Promise<void> {
  const db = await getIndexedDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put(data, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export class MemoryStorageAdapter implements StorageAdapter {
  private sqlite: Sqlite3Static | null = null;
  private db: Database | null = null;
  private saveTimeout: any = null;

  async init(initialBinary?: Uint8Array): Promise<void> {
    this.sqlite = await getSqlite();
    this.db = new this.sqlite.oo1.DB(':memory:');

    let binaryToLoad = initialBinary;
    if (!binaryToLoad && typeof window !== 'undefined') {
      const persisted = await loadFromIndexedDb();
      if (persisted && persisted.byteLength > 0) {
        binaryToLoad = persisted;
      }
    }

    if (binaryToLoad) {
      const capi = this.sqlite.capi;
      const ptr = this.sqlite.wasm.allocFromTypedArray(binaryToLoad);
      const rc = capi.sqlite3_deserialize(
        this.db.pointer!,
        'main',
        ptr,
        binaryToLoad.byteLength,
        binaryToLoad.byteLength,
        capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE
      );
      if (rc !== capi.SQLITE_OK) {
        throw new Error(`Failed to load persisted database (sqlite3_deserialize rc=${rc})`);
      }
    }
  }

  private ensureDb(): Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  private schedulePersist() {
    if (typeof window === 'undefined') return;
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      if (this.db) {
        try {
          const binary = await this.exportBinary();
          await saveToIndexedDb(binary);
        } catch (e) {
          console.warn('Failed to auto-persist to IndexedDB:', e);
        }
      }
    }, 250);
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const db = this.ensureDb();
    db.exec({ sql, bind: params });
    this.schedulePersist();
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = this.ensureDb();
    return db.exec({
      sql,
      bind: params,
      rowMode: 'object',
      returnValue: 'resultRows',
    }) as T[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = this.ensureDb();
    db.exec('BEGIN TRANSACTION');
    try {
      const result = await fn();
      db.exec('COMMIT');
      this.schedulePersist();
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  async exportBinary(): Promise<Uint8Array> {
    const db = this.ensureDb();
    if (!this.sqlite) throw new Error('SQLite not initialized');
    return this.sqlite.capi.sqlite3_js_db_export(db);
  }

  async close(): Promise<void> {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
