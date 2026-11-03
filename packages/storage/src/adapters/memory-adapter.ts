/**
 * Memory & Local-First IndexedDB Storage Adapter using sql.js
 * In-memory SQLite engine with automatic local persistence and resilient multi-strategy loading.
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { StorageAdapter } from './storage-adapter';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJsPromise) return sqlJsPromise;

  sqlJsPromise = (async () => {
    if (typeof window !== 'undefined') {
      // Strategy 1: Local /sql-wasm.wasm served by Vite/PWA
      try {
        const sql = await initSqlJs({
          locateFile: (file) => `/${file}`,
        });
        return sql;
      } catch (err1) {
        console.warn('Local /sql-wasm.wasm load failed, trying CDN fallback...', err1);
      }

      // Strategy 2: CDN fallback
      try {
        const sql = await initSqlJs({
          locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
        });
        return sql;
      } catch (err2) {
        console.warn('CDN wasm load failed, attempting embedded inline wasm...', err2);
      }

      // Strategy 3: Inline WASM bundled inside JS (zero network needed)
      try {
        const inlineModule = (await import('sql.js/dist/sql-wasm-inline.js' as any)).default;
        const sql = await inlineModule();
        return sql;
      } catch (err3) {
        console.warn('Inline wasm fallback failed, falling back to default initSqlJs:', err3);
      }
    }

    // Default Node / standard loader
    return await initSqlJs();
  })();

  return sqlJsPromise;
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
  private db: Database | null = null;
  private saveTimeout: any = null;

  async init(initialBinary?: Uint8Array): Promise<void> {
    const SQL = await getSqlJs();

    let binaryToLoad = initialBinary;
    if (!binaryToLoad && typeof window !== 'undefined') {
      const persisted = await loadFromIndexedDb();
      if (persisted && persisted.byteLength > 0) {
        binaryToLoad = persisted;
      }
    }

    if (binaryToLoad) {
      this.db = new SQL.Database(binaryToLoad);
    } else {
      this.db = new SQL.Database();
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
          const binary = this.db.export();
          await saveToIndexedDb(binary);
        } catch (e) {
          console.warn('Failed to auto-persist to IndexedDB:', e);
        }
      }
    }, 250);
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    const db = this.ensureDb();
    if (params.length === 0) {
      db.run(sql);
      this.schedulePersist();
      return;
    }
    const stmt = db.prepare(sql);
    try {
      stmt.run(params);
      this.schedulePersist();
    } finally {
      stmt.free();
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const db = this.ensureDb();
    const results: T[] = [];
    const stmt = db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject() as T);
      }
    } finally {
      stmt.free();
    }
    return results;
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const db = this.ensureDb();
    db.run('BEGIN TRANSACTION');
    try {
      const result = await fn();
      db.run('COMMIT');
      this.schedulePersist();
      return result;
    } catch (err) {
      db.run('ROLLBACK');
      throw err;
    }
  }

  async exportBinary(): Promise<Uint8Array> {
    const db = this.ensureDb();
    return db.export();
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
