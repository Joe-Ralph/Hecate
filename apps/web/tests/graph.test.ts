import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { buildGraphData, neighborhood, GraphData } from '../src/components/graph/layout';
import { detectCommunities } from '../src/components/graph/communities';
import { ForceEngine, nodeRadius } from '../src/components/graph/physics';

describe('Graph data assembly', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('builds nodes, reference links, and hierarchy from the database', async () => {
    const parent = await db.nodes.create({ content: 'Parent' });
    const child = await db.nodes.create({ parent_id: parent.id, content: 'Child' });
    const other = await db.nodes.create({ content: `Ref to [[node:${child.id}]]` });

    const data = await buildGraphData(db);
    const ids = data.nodes.map((n) => n.id);
    expect(ids).toContain(parent.id);
    expect(ids).toContain(child.id);
    expect(ids).toContain(other.id);

    expect(data.links.some((l) => l.source === other.id && l.target === child.id)).toBe(true);
    expect(data.childrenOf.get(parent.id)).toContain(child.id);
    expect(data.childrenOf.get(null)).toContain(parent.id);
    expect(data.nodes.find((n) => n.id === parent.id)?.hasChildren).toBe(true);
    expect(data.nodes.find((n) => n.id === child.id)?.degree).toBe(1);
  });

  it('excludes soft-deleted nodes and their links', async () => {
    const dead = await db.nodes.create({ content: 'Deleted node' });
    await db.nodes.create({ content: `Link to [[node:${dead.id}]]` });
    await db.nodes.deleteNode(dead.id);

    const data = await buildGraphData(db);
    expect(data.nodes.some((n) => n.id === dead.id)).toBe(false);
    expect(data.links.some((l) => l.target === dead.id)).toBe(false);
  });

  it('neighborhood returns 1–2 hop sets including hierarchy and references', async () => {
    const a = await db.nodes.create({ content: 'A' });
    const b = await db.nodes.create({ parent_id: a.id, content: 'B' });
    const c = await db.nodes.create({ content: `C [[node:${b.id}]]` });
    const far = await db.nodes.create({ content: 'Far' });

    const data = await buildGraphData(db);
    const oneHop = neighborhood(data, a.id, 1);
    expect(oneHop.has(b.id)).toBe(true);
    expect(oneHop.has(c.id)).toBe(false);

    const twoHop = neighborhood(data, a.id, 2);
    expect(twoHop.has(b.id)).toBe(true);
    expect(twoHop.has(c.id)).toBe(true);
    expect(twoHop.has(far.id)).toBe(false);
  });
});

function syntheticTwoClusters(): GraphData {
  // Two tightly linked clusters A and B with one weak bridge
  const nodes: GraphData['nodes'] = [];
  const links: GraphData['links'] = [];
  const childrenOf = new Map<string | null, string[]>();
  for (const prefix of ['a', 'b']) {
    for (let i = 0; i < 8; i++) {
      const id = `${prefix}${i}`;
      nodes.push({ id, title: id, kind: 'content', tagIds: [], tagNames: [prefix === 'a' ? 'task' : 'book'], hasChildren: false, degree: 2 });
      childrenOf.set(null, [...(childrenOf.get(null) || []), id]);
      if (i > 0) links.push({ source: `${prefix}${i - 1}`, target: id, kind: 'reference' });
      links.push({ source: `${prefix}0`, target: id, kind: 'reference' });
    }
  }
  links.push({ source: 'a0', target: 'b0', kind: 'reference' });
  return { nodes, links, childrenOf };
}

describe('Community detection & multi-scale physics', () => {
  it('label propagation separates disjoint communities and names them by majority tag', () => {
    const data = syntheticTwoClusters();
    const { communities, communityOf } = detectCommunities(data);

    expect(communities.length).toBe(2);
    const communityA = communityOf.get('a0')!;
    const communityB = communityOf.get('b0')!;
    expect(communityA).not.toBe(communityB);
    expect(communityOf.get('a7')).toBe(communityA);
    expect(communityOf.get('b7')).toBe(communityB);

    const labels = communities.map((c) => c.label);
    expect(labels).toContain('#task');
    expect(labels).toContain('#book');
  });

  it('simulation is deterministic for identical input', () => {
    const data = syntheticTwoClusters();
    const run = () => {
      const engine = new ForceEngine(data, detectCommunities(data));
      for (let i = 0; i < 50; i++) engine.tick();
      return engine.positions.get('a3')!;
    };
    const p1 = run();
    const p2 = run();
    expect(p1.x).toBeCloseTo(p2.x, 5);
    expect(p1.y).toBeCloseTo(p2.y, 5);
  });

  it('settles: alpha decreases and eventually drops below the settle threshold', () => {
    const data = syntheticTwoClusters();
    const engine = new ForceEngine(data, detectCommunities(data));
    const alphaBefore = engine.alpha;
    for (let i = 0; i < 400; i++) engine.tick();
    expect(engine.alpha).toBeLessThan(alphaBefore);
    expect(engine.tick()).toBe(false); // settled
  });

  it('communities end up as distinct centers of gravity', () => {
    const data = syntheticTwoClusters();
    const cm = detectCommunities(data);
    const engine = new ForceEngine(data, cm);
    for (let i = 0; i < 200; i++) engine.tick();

    const centerA = engine.getCenter(cm.communityOf.get('a0')!);
    const centerB = engine.getCenter(cm.communityOf.get('b0')!);
    // Each member sits closer to its own community center than to the other
    const a3 = engine.positions.get('a3')!;
    const distOwn = Math.hypot(a3.x - centerA.x, a3.y - centerA.y);
    const distOther = Math.hypot(a3.x - centerB.x, a3.y - centerB.y);
    expect(distOwn).toBeLessThan(distOther);
  });

  it('nodeRadius follows a bounded logarithmic scale', () => {
    expect(nodeRadius(0)).toBeLessThanOrEqual(3);
    expect(nodeRadius(5)).toBeGreaterThan(nodeRadius(0));
    expect(nodeRadius(10000)).toBeLessThanOrEqual(9);
  });

  it('reheat wakes the simulation after it settled', () => {
    const data = syntheticTwoClusters();
    const engine = new ForceEngine(data, detectCommunities(data));
    for (let i = 0; i < 400; i++) engine.tick();
    expect(engine.tick()).toBe(false);

    engine.reheat(0.3);
    expect(engine.alpha).toBeGreaterThan(0.005);
    expect(engine.tick()).toBe(true);
  });

  it('large graph (2k nodes, 6k links) produces finite positions in reasonable time', async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const db = await HecateDatabase.create(adapter);

    const ids: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const n = await db.nodes.create({ content: `Node ${i}` });
      ids.push(n.id);
    }
    for (let i = 0; i < 6000; i++) {
      const a = ids[i % 2000];
      const b = ids[(i * 7 + 13) % 2000];
      if (a !== b) {
        await db.nodes.create({ content: `Link ${i} to [[node:${a}]] and [[node:${b}]]` });
      }
    }

    const data = await buildGraphData(db);
    const engine = new ForceEngine(data, detectCommunities(data));
    const start = Date.now();
    for (let i = 0; i < 100; i++) engine.tick();
    console.log(`100 ticks at ${data.nodes.length} nodes / ${data.links.length} links: ${Date.now() - start}ms`);

    expect(engine.positions.size).toBeGreaterThan(2000);
    for (const p of engine.positions.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  }, 120000);
});
