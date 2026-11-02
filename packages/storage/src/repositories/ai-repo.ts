/**
 * AI Repository
 * Manages summaries, generated mini-tasks, and feedback loop statistics.
 */

import {
  AiSummaryRecord,
  MiniTaskRecord,
  MiniTaskStatus,
  ulid,
} from '@hecate/core';
import { StorageAdapter } from '../adapters/storage-adapter';

export class AiRepository {
  constructor(private adapter: StorageAdapter) {}

  async saveSummary(summary: Partial<AiSummaryRecord>): Promise<AiSummaryRecord> {
    const now = Date.now();
    const id = summary.id || ulid(now);
    const windowStart = summary.window_start || now - 7 * 24 * 60 * 60 * 1000;
    const windowEnd = summary.window_end || now;
    const text = summary.text || '';
    const topics = JSON.stringify(summary.topics || []);
    const nodeCount = summary.node_count || 0;
    const provider = summary.provider || 'mock';
    const model = summary.model || 'mock-v1';

    await this.adapter.execute(
      `INSERT INTO ai_summary (id, window_start, window_end, text, topics, node_count, created_at, provider, model)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, windowStart, windowEnd, text, topics, nodeCount, now, provider, model]
    );

    return {
      id,
      window_start: windowStart,
      window_end: windowEnd,
      text,
      topics: summary.topics || [],
      node_count: nodeCount,
      created_at: now,
      provider,
      model,
    };
  }

  async getSummaries(): Promise<AiSummaryRecord[]> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM ai_summary ORDER BY created_at DESC'
    );
    return rows.map((r) => ({
      id: r.id,
      window_start: Number(r.window_start),
      window_end: Number(r.window_end),
      text: r.text,
      topics: JSON.parse(r.topics || '[]'),
      node_count: Number(r.node_count),
      created_at: Number(r.created_at),
      provider: r.provider,
      model: r.model,
    }));
  }

  async saveMiniTasks(tasks: Partial<MiniTaskRecord>[]): Promise<MiniTaskRecord[]> {
    const now = Date.now();
    const saved: MiniTaskRecord[] = [];

    for (const t of tasks) {
      const id = t.id || ulid(now);
      const title = t.title || 'Untitled task';
      const rationale = t.rationale || '';
      const category = t.category || 'learning';
      const durationMin = Math.min(Math.max(t.duration_min || 10, 5), 60);
      const status = t.status || 'suggested';
      const sourceSummaryId = t.source_summary_id || null;
      const dueAt = t.due_at || now;

      await this.adapter.execute(
        `INSERT INTO mini_task (id, title, rationale, category, duration_min, status, source_summary_id, created_at, due_at, done_at, snoozed_until, feedback)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
        [id, title, rationale, category, durationMin, status, sourceSummaryId, now, dueAt]
      );

      saved.push({
        id,
        title,
        rationale,
        category,
        duration_min: durationMin,
        status,
        source_summary_id: sourceSummaryId,
        created_at: now,
        due_at: dueAt,
        done_at: null,
        snoozed_until: null,
        feedback: null,
      });
    }

    return saved;
  }

  async getTodayMiniTasks(): Promise<MiniTaskRecord[]> {
    const now = Date.now();
    const rows = await this.adapter.query<any>(
      `SELECT * FROM mini_task
       WHERE (status IN ('suggested', 'started') OR done_at >= ?)
         AND (snoozed_until IS NULL OR snoozed_until <= ?)
       ORDER BY created_at DESC`,
      [now - 24 * 60 * 60 * 1000, now]
    );

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      rationale: r.rationale,
      category: r.category,
      duration_min: Number(r.duration_min),
      status: r.status,
      source_summary_id: r.source_summary_id,
      created_at: Number(r.created_at),
      due_at: r.due_at ? Number(r.due_at) : null,
      done_at: r.done_at ? Number(r.done_at) : null,
      snoozed_until: r.snoozed_until ? Number(r.snoozed_until) : null,
      feedback: r.feedback,
    }));
  }

  async updateMiniTaskStatus(id: string, status: MiniTaskStatus, feedback?: string): Promise<void> {
    const now = Date.now();
    let doneAt: number | null = null;
    let snoozedUntil: number | null = null;

    if (status === 'done') {
      doneAt = now;
    } else if (status === 'snoozed') {
      snoozedUntil = now + 24 * 60 * 60 * 1000; // Snooze 1 day
    }

    await this.adapter.execute(
      `UPDATE mini_task
       SET status = ?, done_at = ?, snoozed_until = ?, feedback = COALESCE(?, feedback)
       WHERE id = ?`,
      [status, doneAt, snoozedUntil, feedback || null, id]
    );
  }

  async getRecentTasks(days: number = 14): Promise<MiniTaskRecord[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = await this.adapter.query<any>(
      'SELECT * FROM mini_task WHERE created_at >= ? ORDER BY created_at DESC',
      [cutoff]
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      rationale: r.rationale,
      category: r.category,
      duration_min: Number(r.duration_min),
      status: r.status,
      source_summary_id: r.source_summary_id,
      created_at: Number(r.created_at),
      due_at: r.due_at ? Number(r.due_at) : null,
      done_at: r.done_at ? Number(r.done_at) : null,
      snoozed_until: r.snoozed_until ? Number(r.snoozed_until) : null,
      feedback: r.feedback,
    }));
  }

  async getCategoryStats(): Promise<Record<string, { done: number; snoozed: number; dismissed: number }>> {
    const rows = await this.adapter.query<any>(
      `SELECT category, status, count(*) as count
       FROM mini_task
       GROUP BY category, status`
    );

    const stats: Record<string, { done: number; snoozed: number; dismissed: number }> = {};
    for (const r of rows) {
      if (!stats[r.category]) {
        stats[r.category] = { done: 0, snoozed: 0, dismissed: 0 };
      }
      const cnt = Number(r.count);
      if (r.status === 'done') stats[r.category].done += cnt;
      else if (r.status === 'snoozed') stats[r.category].snoozed += cnt;
      else if (r.status === 'dismissed') stats[r.category].dismissed += cnt;
    }
    return stats;
  }
}
