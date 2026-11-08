import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { useWorkspaceStore, PanelState } from '../src/store/workspaceStore';

describe('Per-node view config persistence (REQ-5.3)', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
    useWorkspaceStore.setState({
      db,
      version: 0,
      activePanels: [] as PanelState[],
      activePanelIndex: 0,
    });
  });

  it('setPanelView persists the view to node.meta.viewConfig', async () => {
    const node = await db.nodes.create({ content: 'Viewed node' });
    useWorkspaceStore.setState({
      activePanels: [{ id: 'panel-0', nodeId: node.id, view: 'list', zoomPath: [] }],
    });

    useWorkspaceStore.getState().setPanelView(0, 'table');
    expect(useWorkspaceStore.getState().activePanels[0].view).toBe('table');

    // meta write is fire-and-forget; wait for it
    await new Promise((r) => setTimeout(r, 20));
    const reloaded = await db.nodes.getById(node.id);
    expect(reloaded?.meta?.viewConfig?.view).toBe('table');
  });

  it('openNode restores the persisted view preference', async () => {
    const node = await db.nodes.create({ content: 'Card fan' });
    await db.adapter.execute('UPDATE node SET meta = ? WHERE id = ?', [
      JSON.stringify({ viewConfig: { view: 'cards' } }),
      node.id,
    ]);
    useWorkspaceStore.setState({
      activePanels: [{ id: 'panel-0', nodeId: 'elsewhere', view: 'list', zoomPath: [] }],
    });

    useWorkspaceStore.getState().openNode(node.id);
    await new Promise((r) => setTimeout(r, 20));
    expect(useWorkspaceStore.getState().activePanels[0].view).toBe('cards');
  });
});
