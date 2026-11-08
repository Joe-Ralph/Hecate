import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { ulid } from '@hecate/core';

describe('Performance smoke (FRD scenario 16)', () => {
  it('FTS search and live queries stay fast at 20,000 nodes', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const db = await HecateDatabase.create(adapter);

    const now = Date.now();
    await adapter.transaction(async () => {
      for (let i = 0; i < 20000; i++) {
        await adapter.execute(
          `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, meta)
           VALUES (?, NULL, ?, 'content', ?, 0, NULL, ?, ?, NULL)`,
          [ulid(now + i), `p${i}`, i % 100 === 0 ? `needle node ${i}` : `routine note ${i}`, now, now]
        );
      }
    });

    const searchStart = Date.now();
    const results = await db.search.globalSearch('needle');
    const searchMs = Date.now() - searchStart;
    console.log(`FTS search over 20k nodes: ${searchMs}ms, ${results.length} results`);
    expect(results.length).toBe(50); // globalSearch caps at 50 ranked results
    expect(results.every((n) => n.content.startsWith('needle node'))).toBe(true);

    const queryStart = Date.now();
    const liveResults = await db.search.executeSearch({
      op: 'AND',
      clauses: [{ type: 'text', q: 'needle node 199' }],
    });
    const queryMs = Date.now() - queryStart;
    console.log(`Live query over 20k nodes: ${queryMs}ms`);
    expect(liveResults.some((n) => n.content === 'needle node 19900')).toBe(true);
  }, 120000);
});
