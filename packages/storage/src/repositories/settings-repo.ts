/**
 * Settings Repository
 */

import { SettingsMap } from '@hecate/core';
import { StorageAdapter } from '../adapters/storage-adapter';

export class SettingsRepository {
  constructor(private adapter: StorageAdapter) {}

  async getSettings(): Promise<SettingsMap> {
    const rows = await this.adapter.query<any>(
      'SELECT value FROM settings WHERE key = ?',
      ['general']
    );
    if (rows.length === 0) {
      return {
        theme: 'dark',
        aiEnabled: false,
        aiProvider: 'mock',
        aiWindowDays: 7,
        aiMaxTasks: 4,
      };
    }
    try {
      return JSON.parse(rows[0].value);
    } catch {
      return {};
    }
  }

  async updateSettings(partial: Partial<SettingsMap>): Promise<SettingsMap> {
    const current = await this.getSettings();
    const updated = { ...current, ...partial };
    await this.adapter.execute(
      `INSERT INTO settings (key, value) VALUES ('general', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [JSON.stringify(updated)]
    );
    return updated;
  }
}
