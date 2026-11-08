import { StorageAdapter } from '@hecate/storage';
import { SkipReason } from '../types';

export class PreferenceLearner {
  constructor(private adapter: StorageAdapter) {}

  async getWeight(key: string): Promise<{ alpha: number; beta: number }> {
    const rows = await this.adapter.query<{ alpha: number; beta: number }>(
      'SELECT alpha, beta FROM preference_weight WHERE key = ?',
      [key]
    );
    if (rows.length > 0) {
      return { alpha: Number(rows[0].alpha), beta: Number(rows[0].beta) };
    }
    return { alpha: 2, beta: 2 };
  }

  async getAllWeights(): Promise<Map<string, { alpha: number; beta: number }>> {
    const rows = await this.adapter.query<{ key: string; alpha: number; beta: number }>(
      'SELECT key, alpha, beta FROM preference_weight'
    );
    const map = new Map<string, { alpha: number; beta: number }>();
    for (const r of rows) {
      map.set(r.key, { alpha: Number(r.alpha), beta: Number(r.beta) });
    }
    return map;
  }

  async adjustWeight(key: string, deltaAlpha: number, deltaBeta: number, now: number = Date.now()): Promise<void> {
    const curr = await this.getWeight(key);
    const newAlpha = Math.max(0.1, curr.alpha + deltaAlpha);
    const newBeta = Math.max(0.1, curr.beta + deltaBeta);

    await this.adapter.execute(
      `INSERT INTO preference_weight (key, alpha, beta, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         alpha = excluded.alpha,
         beta = excluded.beta,
         updated_at = excluded.updated_at`,
      [key, newAlpha, newBeta, now]
    );
  }

  /**
   * Applies learning update from a skip (Section 10.2)
   */
  async applySkip(
    keys: { kindKey: string; kindTagKey?: string; categoryKey: string },
    reason?: SkipReason,
    now: number = Date.now()
  ): Promise<{ deltaAlpha: number; deltaBeta: number }> {
    let deltaBeta = 0.5;
    let deltaAlpha = 0;

    switch (reason) {
      case 'not_relevant':
        deltaBeta = 1.0;
        break;
      case 'not_interested':
        deltaBeta = 0.5;
        break;
      case 'already_did':
        deltaAlpha = 0.3;
        deltaBeta = 0;
        break;
      case 'not_now':
      case 'too_big':
        deltaBeta = 0;
        break;
      default:
        deltaBeta = 0.5;
        break;
    }

    if (deltaAlpha > 0 || deltaBeta > 0) {
      await this.adjustWeight(keys.kindKey, deltaAlpha, deltaBeta, now);
      if (keys.kindTagKey) {
        await this.adjustWeight(keys.kindTagKey, deltaAlpha, deltaBeta, now);
      }
    }

    return { deltaAlpha, deltaBeta };
  }

  /**
   * Applies learning update from done (Section 10.2): alpha += 1
   */
  async applyDone(
    keys: { kindKey: string; kindTagKey?: string; categoryKey: string },
    now: number = Date.now()
  ): Promise<void> {
    await this.adjustWeight(keys.kindKey, 1.0, 0, now);
    if (keys.kindTagKey) {
      await this.adjustWeight(keys.kindTagKey, 1.0, 0, now);
    }
    await this.adjustWeight(keys.categoryKey, 1.0, 0, now);
  }

  /**
   * Daily decay toward Beta(2, 2): x <- 2 + (x - 2) * 0.98 (Section 10.3)
   */
  async applyDailyDecay(decay = 0.98, now: number = Date.now()): Promise<void> {
    const rows = await this.adapter.query<{ key: string; alpha: number; beta: number }>(
      'SELECT key, alpha, beta FROM preference_weight'
    );
    for (const r of rows) {
      const a = 2 + (Number(r.alpha) - 2) * decay;
      const b = 2 + (Number(r.beta) - 2) * decay;
      await this.adapter.execute(
        'UPDATE preference_weight SET alpha = ?, beta = ?, updated_at = ? WHERE key = ?',
        [a, b, now, r.key]
      );
    }
  }

  async resetAll(): Promise<void> {
    await this.adapter.execute('DELETE FROM preference_weight');
  }
}
