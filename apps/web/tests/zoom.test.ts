import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore, PanelState } from '../src/store/workspaceStore';

function seedPanels() {
  useWorkspaceStore.setState({
    activePanels: [
      { id: 'panel-0', nodeId: 'root', view: 'list', zoomPath: [] } as PanelState,
    ],
    activePanelIndex: 0,
  });
}

describe('Panel zoom navigation (REQ-1.3)', () => {
  beforeEach(seedPanels);

  it('zoomInto pushes onto the zoom path', () => {
    useWorkspaceStore.getState().zoomInto(0, 'child');
    useWorkspaceStore.getState().zoomInto(0, 'grandchild');
    expect(useWorkspaceStore.getState().activePanels[0].zoomPath).toEqual([
      'child',
      'grandchild',
    ]);
  });

  it('zoomOut pops one level and is a no-op at the base node', () => {
    useWorkspaceStore.getState().zoomInto(0, 'child');
    useWorkspaceStore.getState().zoomOut(0);
    expect(useWorkspaceStore.getState().activePanels[0].zoomPath).toEqual([]);

    useWorkspaceStore.getState().zoomOut(0);
    expect(useWorkspaceStore.getState().activePanels[0].zoomPath).toEqual([]);
  });

  it('zoomToDepth truncates the chain; depth 0 returns to the base node', () => {
    const store = useWorkspaceStore.getState();
    store.zoomInto(0, 'a');
    store.zoomInto(0, 'b');
    store.zoomInto(0, 'c');

    useWorkspaceStore.getState().zoomToDepth(0, 1);
    expect(useWorkspaceStore.getState().activePanels[0].zoomPath).toEqual(['a']);

    useWorkspaceStore.getState().zoomToDepth(0, 0);
    expect(useWorkspaceStore.getState().activePanels[0].zoomPath).toEqual([]);
  });

  it('openNode resets the zoom path', () => {
    useWorkspaceStore.getState().zoomInto(0, 'child');
    useWorkspaceStore.getState().openNode('elsewhere');
    const panel = useWorkspaceStore.getState().activePanels[0];
    expect(panel.nodeId).toBe('elsewhere');
    expect(panel.zoomPath).toEqual([]);
  });

  it('zoomInto the current zoom root is a no-op', () => {
    useWorkspaceStore.getState().zoomInto(0, 'child');
    useWorkspaceStore.getState().zoomInto(0, 'child');
    expect(useWorkspaceStore.getState().activePanels[0].zoomPath).toEqual(['child']);
  });

  it('togglePinNode flips meta.pinned and bumps version', async () => {
    const { MemoryStorageAdapter, HecateDatabase } = await import('@hecate/storage');
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const db = await HecateDatabase.create(adapter);
    const node = await db.nodes.create({ content: 'Pin me' });
    useWorkspaceStore.setState({ db, version: 0 });

    await useWorkspaceStore.getState().togglePinNode(node.id);
    const pinned = await db.nodes.getById(node.id);
    expect(pinned?.meta?.pinned).toBe(true);
    expect(useWorkspaceStore.getState().version).toBe(1);

    await useWorkspaceStore.getState().togglePinNode(node.id);
    const unpinned = await db.nodes.getById(node.id);
    expect(unpinned?.meta?.pinned).toBe(false);
  });

  it('pinned pages exclude pinned field instances from supertag templates', async () => {
    const { getPinnedNodes } = await import('../src/store/workspaceStore');
    const { MemoryStorageAdapter, HecateDatabase } = await import('@hecate/storage');
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    const db = await HecateDatabase.create(adapter);
    useWorkspaceStore.setState({ db, version: 0 });

    const taskTag = await db.tags.getTagByName('task');
    const node = await db.nodes.create({ content: 'A tagged note' });
    // Applying #task injects fields whose meta.pinned = true ("pinned field")
    await db.tags.applyTag(node.id, taskTag!.id);

    // No page pinned yet: the Pinned section must be empty
    expect(await getPinnedNodes(db)).toEqual([]);

    // Pin the page itself: only it appears, never its field children
    await useWorkspaceStore.getState().togglePinNode(node.id);
    const pinned = await getPinnedNodes(db);
    expect(pinned.length).toBe(1);
    expect(pinned[0].id).toBe(node.id);
    expect(pinned[0].kind).toBe('content');
  });
});
