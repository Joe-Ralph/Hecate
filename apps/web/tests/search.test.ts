import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';

describe('Global FTS5 search (REQ-5.4)', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('finds nodes by full-text match', async () => {
    await db.nodes.create({ content: 'Read Deep Work by Cal Newport' });
    await db.nodes.create({ content: 'Buy groceries' });

    const results = await db.search.globalSearch('Deep Work');
    expect(results.some((n) => n.content.includes('Deep Work'))).toBe(true);
    expect(results.some((n) => n.content === 'Buy groceries')).toBe(false);
  });

  it('supports prefix matching on partial tokens', async () => {
    await db.nodes.create({ content: 'Architecture decision record' });

    const results = await db.search.globalSearch('archit');
    expect(results.some((n) => n.content === 'Architecture decision record')).toBe(true);
  });

  it('boosts exact-title matches above partial matches', async () => {
    await db.nodes.create({ content: 'Notes about the roadmap planning session' });
    await db.nodes.create({ content: 'roadmap' });

    const results = await db.search.globalSearch('roadmap');
    expect(results[0]?.content).toBe('roadmap');
  });

  it('excludes soft-deleted nodes from results', async () => {
    const node = await db.nodes.create({ content: 'Unique ephemeral note' });
    expect((await db.search.globalSearch('ephemeral')).length).toBe(1);

    await db.nodes.deleteNode(node.id);
    expect((await db.search.globalSearch('ephemeral')).length).toBe(0);
  });

  it('trigger syncs content updates into the index', async () => {
    const node = await db.nodes.create({ content: 'original wording' });
    await db.nodes.updateContent(node.id, 'completely rephrased');

    expect((await db.search.globalSearch('original')).some((n) => n.id === node.id)).toBe(false);
    expect((await db.search.globalSearch('rephrased')).some((n) => n.id === node.id)).toBe(true);
  });

  it('does not double-index seed content on fresh databases', async () => {
    // A backfill bug on a fresh DB would index seed nodes twice (once via
    // triggers during seeding, once via backfill). Assert no duplicate rows.
    const dupes = await db.adapter.query<any>(
      'SELECT rowid, COUNT(*) AS c FROM fts_node GROUP BY rowid HAVING c > 1'
    );
    expect(dupes).toEqual([]);
  });

  it('returns recent nodes for an empty query', async () => {
    await db.nodes.create({ content: 'Recent node A' });
    const results = await db.search.globalSearch('');
    expect(results.length).toBeGreaterThan(0);
  });

  it('handles special characters without SQL/FTS errors', async () => {
    await db.nodes.create({ content: 'C++ and "quoted" text' });
    const results = await db.search.globalSearch('"quoted"');
    expect(Array.isArray(results)).toBe(true);
  });
});
