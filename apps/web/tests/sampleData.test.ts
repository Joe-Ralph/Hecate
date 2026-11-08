import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { useWorkspaceStore } from '../src/store/workspaceStore';
import { buildGraphData } from '../src/components/graph/layout';

describe('Sample graph data loader', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
    useWorkspaceStore.setState({ db, version: 0 });
  });

  it('creates a large, richly linked demo cluster', async () => {
    await useWorkspaceStore.getState().loadSampleGraphData();

    const data = await buildGraphData(db);
    expect(data.nodes.length).toBeGreaterThan(300);
    expect(data.links.length).toBeGreaterThan(100);

    // Multiple clusters: project, library, people, daily notes, idea web
    const roots = data.childrenOf.get(null) || [];
    expect(roots.length).toBeGreaterThan(3);

    // Tagged nodes exist for cluster coloring
    expect(data.nodes.some((n) => n.tagNames.includes('task'))).toBe(true);
    expect(data.nodes.some((n) => n.tagNames.includes('book'))).toBe(true);
    expect(data.nodes.some((n) => n.tagNames.includes('person'))).toBe(true);
    expect(data.nodes.some((n) => n.tagNames.includes('meeting'))).toBe(true);
  }, 60000);

  it('is idempotent — a second load adds nothing', async () => {
    await useWorkspaceStore.getState().loadSampleGraphData();
    const before = (await buildGraphData(db)).nodes.length;

    await useWorkspaceStore.getState().loadSampleGraphData();
    const after = (await buildGraphData(db)).nodes.length;
    expect(after).toBe(before);
  }, 60000);

  it('Sample XL loads ~2,000 nodes with dense cross-links, once', async () => {
    await useWorkspaceStore.getState().loadSampleGraphData('xl');

    const data = await buildGraphData(db);
    expect(data.nodes.length).toBeGreaterThan(1500);
    expect(data.links.length).toBeGreaterThan(800);

    // Community diversity: projects, books, people, meetings, ideas, habits, days
    expect(data.nodes.some((n) => n.tagNames.includes('project'))).toBe(true);
    expect(data.nodes.some((n) => n.tagNames.includes('book'))).toBe(true);
    expect(data.nodes.some((n) => n.tagNames.includes('person'))).toBe(true);
    expect(data.nodes.some((n) => n.tagNames.includes('habit'))).toBe(true);
    expect(data.nodes.some((n) => n.kind === 'day')).toBe(true);

    // Second load is a no-op
    await useWorkspaceStore.getState().loadSampleGraphData('xl');
    expect((await buildGraphData(db)).nodes.length).toBe(data.nodes.length);
  }, 180000);
});
