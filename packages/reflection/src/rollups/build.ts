import { StorageAdapter } from '@hecate/storage';
import { generateUlid } from '@hecate/core';
import { AiProvider } from '@hecate/ai';
import { Rollup } from '../types';

export class RollupBuilder {
  constructor(private adapter: StorageAdapter) {}

  async buildDailyRollup(now: number = Date.now()): Promise<Rollup> {
    const d = new Date(now);
    const startAt = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endAt = startAt + 24 * 60 * 60 * 1000 - 1;

    // Count created/edited nodes
    const nodeRows = await this.adapter.query<{ count: number }>(
      `SELECT count(*) as count FROM node
       WHERE deleted_at IS NULL AND updated_at >= ? AND updated_at <= ? AND kind != 'field'`,
      [startAt, endAt]
    );
    const nodeCount = Number(nodeRows[0]?.count || 0);

    // Count completed reflections
    const doneRows = await this.adapter.query<{ count: number }>(
      `SELECT count(*) as count FROM reflection
       WHERE status = 'done' AND resolved_at >= ? AND resolved_at <= ?`,
      [startAt, endAt]
    );
    const doneCount = Number(doneRows[0]?.count || 0);

    // Topics active today
    const topicRows = await this.adapter.query<{ content: string }>(
      `SELECT DISTINCT n.content FROM node_tag nt
       JOIN node n ON n.id = nt.tag_def_id
       JOIN node src ON src.id = nt.node_id
       WHERE src.updated_at >= ? AND src.updated_at <= ?
       LIMIT 8`,
      [startAt, endAt]
    );
    const topics = topicRows.map((t) => t.content);

    const inputHash = `daily:${startAt}:${nodeCount}:${doneCount}:${topics.join(',')}`;

    // Check existing
    const existing = await this.adapter.query<any>(
      "SELECT * FROM rollup WHERE period = 'day' AND start_at = ?",
      [startAt]
    );
    if (existing.length > 0 && existing[0].input_hash === inputHash) {
      return {
        id: existing[0].id,
        period: 'day',
        start_at: Number(existing[0].start_at),
        end_at: Number(existing[0].end_at),
        text: existing[0].text,
        topics: existing[0].topics ? JSON.parse(existing[0].topics) : [],
        node_count: Number(existing[0].node_count),
        source: existing[0].source,
        created_at: Number(existing[0].created_at),
      };
    }

    const text = `Today you captured and edited ${nodeCount} notes and completed ${doneCount} reflection mini-tasks across ${
      topics.length > 0 ? topics.join(', ') : 'your active work'
    }.`;

    const id = generateUlid();
    await this.adapter.execute(
      `INSERT INTO rollup (id, period, start_at, end_at, text, topics, node_count, source, input_hash, created_at)
       VALUES (?, 'day', ?, ?, ?, ?, ?, 'extractive', ?, ?)
       ON CONFLICT(id) DO UPDATE SET text = excluded.text, input_hash = excluded.input_hash`,
      [id, startAt, endAt, text, JSON.stringify(topics), nodeCount, inputHash, now]
    );

    return {
      id,
      period: 'day',
      start_at: startAt,
      end_at: endAt,
      text,
      topics,
      node_count: nodeCount,
      source: 'extractive',
      created_at: now,
    };
  }

  async buildWeeklyRollup(provider?: AiProvider, now: number = Date.now()): Promise<Rollup> {
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const nodeRows = await this.adapter.query<{ count: number }>(
      `SELECT count(*) as count FROM node
       WHERE deleted_at IS NULL AND updated_at >= ? AND kind != 'field'`,
      [sevenDaysAgo]
    );
    const nodeCount = Number(nodeRows[0]?.count || 0);

    const doneRows = await this.adapter.query<{ count: number }>(
      `SELECT count(*) as count FROM reflection
       WHERE status = 'done' AND resolved_at >= ?`,
      [sevenDaysAgo]
    );
    const doneCount = Number(doneRows[0]?.count || 0);

    const topicRows = await this.adapter.query<{ content: string }>(
      `SELECT DISTINCT n.content FROM node_tag nt
       JOIN node n ON n.id = nt.tag_def_id
       JOIN node src ON src.id = nt.node_id
       WHERE src.updated_at >= ?
       LIMIT 8`,
      [sevenDaysAgo]
    );
    const topics = topicRows.map((t) => t.content);

    let text = `This week you moved ${nodeCount} items forward, resolved ${doneCount} reflection actions, and stayed focused on ${
      topics.length > 0 ? topics.join(', ') : 'core priorities'
    }.`;
    let source: 'extractive' | 'llm' = 'extractive';

    if (provider) {
      try {
        const prompt = `Write a short 2-sentence weekly reflection summary (max 60 words). Facts: ${nodeCount} notes active, ${doneCount} reflections finished, topics: ${topics.join(', ')}. Return plain text only.`;
        const generated = await provider.complete({
          system: 'You summarize personal knowledge progress warmly and concisely.',
          user: prompt,
          maxTokens: 100,
        });
        if (generated?.trim()) {
          text = generated.trim();
          source = 'llm';
        }
      } catch {}
    }

    const id = generateUlid();
    await this.adapter.execute(
      `INSERT INTO rollup (id, period, start_at, end_at, text, topics, node_count, source, input_hash, created_at)
       VALUES (?, 'week', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sevenDaysAgo, now, text, JSON.stringify(topics), nodeCount, source, `week:${sevenDaysAgo}`, now]
    );

    return {
      id,
      period: 'week',
      start_at: sevenDaysAgo,
      end_at: now,
      text,
      topics,
      node_count: nodeCount,
      source,
      created_at: now,
    };
  }

  async getRollups(period: 'day' | 'week' | 'month'): Promise<Rollup[]> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM rollup WHERE period = ? ORDER BY start_at DESC LIMIT 30',
      [period]
    );
    return rows.map((r) => ({
      id: r.id,
      period: r.period,
      start_at: Number(r.start_at),
      end_at: Number(r.end_at),
      text: r.text,
      topics: r.topics ? JSON.parse(r.topics) : [],
      node_count: Number(r.node_count),
      source: r.source,
      created_at: Number(r.created_at),
    }));
  }
}
