import { StorageAdapter } from '@hecate/storage';
import { generateUlid } from '@hecate/core';

export interface ReflectionEventRecord {
  id: string;
  reflection_id: string;
  type: string;
  reason?: string;
  payload?: any;
  at: number;
}

export class EventLogger {
  constructor(private adapter: StorageAdapter) {}

  async logEvent(params: {
    reflectionId: string;
    type: 'shown' | 'start' | 'done' | 'skip' | 'snooze' | 'undo' | 'save' | 'why' | 'refresh';
    reason?: string;
    payload?: any;
    now?: number;
  }): Promise<string> {
    const id = generateUlid();
    const now = params.now || Date.now();
    await this.adapter.execute(
      `INSERT INTO reflection_event (id, reflection_id, type, reason, payload, at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.reflectionId,
        params.type,
        params.reason || null,
        params.payload ? JSON.stringify(params.payload) : null,
        now,
      ]
    );
    return id;
  }

  async getRecentEvents(limit = 100): Promise<ReflectionEventRecord[]> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM reflection_event ORDER BY at DESC LIMIT ?',
      [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      reflection_id: r.reflection_id,
      type: r.type,
      reason: r.reason || undefined,
      payload: r.payload ? JSON.parse(r.payload) : undefined,
      at: Number(r.at),
    }));
  }
}
