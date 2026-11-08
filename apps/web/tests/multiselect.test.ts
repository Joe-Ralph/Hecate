import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { useWorkspaceStore, PanelState } from '../src/store/workspaceStore';
import { isTanaPaste, parseTanaPaste } from '@hecate/core';

describe('Multi-select, DnD moves & safe delete (REQ-1.2, 1.7, 3.3.2)', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
    useWorkspaceStore.setState({
      db,
      version: 0,
      activePanels: [{ id: 'panel-0', nodeId: 'root', view: 'list', zoomPath: [] } as PanelState],
      activePanelIndex: 0,
      selectedNodeIds: [],
      selectionAnchorId: null,
      deleteConfirmInfo: null,
      undoStack: new (await import('@hecate/core')).UndoStack(200),
    });
  });

  it('setSelection / clearSelection manage the selection set', () => {
    useWorkspaceStore.getState().setSelection(['a', 'b'], 'a');
    expect(useWorkspaceStore.getState().selectedNodeIds).toEqual(['a', 'b']);
    expect(useWorkspaceStore.getState().selectionAnchorId).toBe('a');

    useWorkspaceStore.getState().clearSelection();
    expect(useWorkspaceStore.getState().selectedNodeIds).toEqual([]);
    expect(useWorkspaceStore.getState().selectionAnchorId).toBeNull();
  });

  it('moveNodeTo reparents and is undoable', async () => {
    const a = await db.nodes.create({ content: 'A' });
    const b = await db.nodes.create({ content: 'B' });
    const child = await db.nodes.create({ parent_id: a.id, content: 'Child' });

    await useWorkspaceStore.getState().moveNodeTo(child.id, b.id, 'a0');
    expect((await db.nodes.getById(child.id))?.parent_id).toBe(b.id);

    await useWorkspaceStore.getState().undo();
    expect((await db.nodes.getById(child.id))?.parent_id).toBe(a.id);
  });

  it('moveNodeTo rejects moves into own subtree (cycle guard)', async () => {
    const parent = await db.nodes.create({ content: 'Parent' });
    const child = await db.nodes.create({ parent_id: parent.id, content: 'Child' });

    await expect(
      useWorkspaceStore.getState().moveNodeTo(parent.id, child.id, 'a0')
    ).rejects.toThrow(/cycle/i);
  });

  it('requestDeleteNode prompts for confirmation when referenced', async () => {
    const target = await db.nodes.create({ content: 'Referenced note' });
    await db.nodes.create({ content: `Links to [[node:${target.id}]]` });

    await useWorkspaceStore.getState().requestDeleteNode(target.id);
    const info = useWorkspaceStore.getState().deleteConfirmInfo;
    expect(info?.nodeId).toBe(target.id);
    expect(info?.refCount).toBe(1);
    expect((await db.nodes.getById(target.id))?.deleted_at).toBeNull();
  });

  it('requestDeleteNode deletes immediately when unreferenced', async () => {
    const node = await db.nodes.create({ content: 'Unreferenced note' });
    await useWorkspaceStore.getState().requestDeleteNode(node.id);
    expect(useWorkspaceStore.getState().deleteConfirmInfo).toBeNull();
    expect((await db.nodes.getNodeRaw(node.id))?.deleted_at).not.toBeNull();
  });

  it('confirmDeleteNode converts incoming refs to plain-text snapshots', async () => {
    const target = await db.nodes.create({ content: 'Snapshot target' });
    const source = await db.nodes.create({ content: `See [[node:${target.id}]] here` });

    await useWorkspaceStore.getState().requestDeleteNode(target.id);
    await useWorkspaceStore.getState().confirmDeleteNode();

    expect(useWorkspaceStore.getState().deleteConfirmInfo).toBeNull();
    expect((await db.nodes.getNodeRaw(target.id))?.deleted_at).not.toBeNull();
    const updatedSource = await db.nodes.getById(source.id);
    expect(updatedSource?.content).toBe('See Snapshot target here');
  });

  it('setFieldValue creates then updates a field value', async () => {
    const fieldDef = await db.tags.createFieldDef('DueTest', { type: 'date' });
    const node = await db.nodes.create({ content: 'Dated node' });

    await useWorkspaceStore.getState().setFieldValue(node.id, fieldDef.id, '[[date:2026-11-05]]');
    let children = await db.nodes.getChildren(node.id);
    const field = children.find((c) => c.kind === 'field' && c.meta?.fieldDefId === fieldDef.id);
    expect(field).toBeDefined();

    await useWorkspaceStore.getState().setFieldValue(node.id, fieldDef.id, '[[date:2026-11-06]]');
    children = await db.nodes.getChildren(node.id);
    const fields = children.filter((c) => c.kind === 'field' && c.meta?.fieldDefId === fieldDef.id);
    expect(fields.length).toBe(1);
    const values = await db.nodes.getChildren(field!.id);
    expect(values[0].content).toBe('[[date:2026-11-06]]');
  });

  it('copyNodesAsTanaPaste serializes subtrees with fields, tags and refs', async () => {
    const taskTag = await db.tags.getTagByName('task');
    const fieldDef = await db.tags.createFieldDef('CopyDue', { type: 'date' });
    const target = await db.nodes.create({ content: 'RefTarget' });
    const root = await db.nodes.create({ content: `Root [[node:${target.id}]]` });
    await db.tags.applyTag(root.id, taskTag!.id);
    await db.tags.addFieldToNode(root.id, fieldDef.id, '[[date:2026-11-10]]');
    await db.nodes.create({ parent_id: root.id, content: 'Nested child' });

    let written = '';
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { clipboard: { writeText: async (t: string) => { written = t; } } },
    });

    await useWorkspaceStore.getState().copyNodesAsTanaPaste([root.id]);
    expect(isTanaPaste(written)).toBe(true);

    const parsed = parseTanaPaste(written);
    expect(parsed[0].content).toContain('[[RefTarget]]');
    expect(parsed[0].tags).toContain('task');
    expect(parsed[0].fields.some((f) => f.name === 'CopyDue')).toBe(true);
    expect(parsed[0].children[0]?.content).toBe('Nested child');
  });
});
