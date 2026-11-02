/**
 * StorageAdapter interface for Hecate
 * Abstracts underlying SQLite database implementation across web, native, and tests.
 */

export interface StorageAdapter {
  execute(sql: string, params?: any[]): Promise<void>;
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  exportBinary?(): Promise<Uint8Array>;
  close(): Promise<void>;
}
