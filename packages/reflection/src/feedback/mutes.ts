import { StorageAdapter } from '@hecate/storage';
import { generateUlid } from '@hecate/core';
import { Mute } from '../types';

export class MuteManager {
  constructor(private adapter: StorageAdapter) {}

  async addMute(params: {
    scope: 'node' | 'topic' | 'kind' | 'evergreen';
    targetId: string;
    until: number | null;
    reason?: string;
    now?: number;
  }): Promise<string> {
    const id = generateUlid();
    const now = params.now || Date.now();
    await this.adapter.execute(
      `INSERT INTO mute (id, scope, target_id, until, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, params.scope, params.targetId, params.until, params.reason || null, now]
    );
    return id;
  }

  async unmute(muteId: string): Promise<void> {
    await this.adapter.execute('DELETE FROM mute WHERE id = ?', [muteId]);
  }

  async getActiveMutes(now: number = Date.now()): Promise<Mute[]> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM mute WHERE until IS NULL OR until > ? ORDER BY created_at DESC',
      [now]
    );
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      target_id: r.target_id,
      until: r.until ? Number(r.until) : null,
      reason: r.reason || undefined,
      created_at: Number(r.created_at),
    }));
  }

  async resetAll(): Promise<void> {
    await this.adapter.execute('DELETE FROM mute');
  }
}
