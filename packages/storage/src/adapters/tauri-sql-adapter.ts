/**
 * Tauri SQLite Storage Adapter
 * Talks to tauri-plugin-sql via invoke or dynamic import when running inside Tauri.
 */

import { StorageAdapter } from './storage-adapter';

export class TauriSqlAdapter implements StorageAdapter {
  private db: any = null;
  private path: string;

  constructor(path: string = 'sqlite:hecate.db') {
    this.path = path;
  }

  async init(): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
      // Dynamic import of @tauri-apps/plugin-sql in Tauri environment only
      try {
        const pluginName = '@tauri-apps/plugin-sql';
        const Database = (await import(/* @vite-ignore */ pluginName)).default;
        this.db = await Database.load(this.path);
      } catch (err) {
        console.warn('Tauri SQL plugin load failed, running in fallback mode', err);
      }
    }
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.db) {
      throw new Error('Tauri SQL database not initialized');
    }
    await this.db.execute(sql, params);
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Tauri SQL database not initialized');
    }
    return (await this.db.select(sql, params)) as T[];
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.execute('BEGIN TRANSACTION');
    try {
      const res = await fn();
      await this.execute('COMMIT');
      return res;
    } catch (err) {
      await this.execute('ROLLBACK');
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
