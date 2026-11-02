/**
 * Memory Storage Adapter using sql.js
 * In-memory SQLite implementation for Node tests, web fallback, and fast execution.
 */

import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { StorageAdapter } from './storage-adapter';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private db: Database | null = null;

  async init(initialBinary?: Uint8Array): Promise<void> {
    const SQL = await getSqlJs();
    if (initialBinary) {
      this.db = new SQL.Database(initialBinary);
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

  async execute(sql: string, params: any[] = []): Promise<void> {
    const db = this.ensureDb();
    if (params.length === 0) {
      db.run(sql);
      return;
    }
    const stmt = db.prepare(sql);
    try {
      stmt.run(params);
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
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
