import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { runCommand, CommandContext, formatDate } from '@hecate/core';
import { useWorkspaceStore, PanelState } from '../src/store/workspaceStore';

function makeCtx(db: HecateDatabase): CommandContext {
  return {
    getFieldValue: async (nodeId, fieldDefId) => {
      const children = await db.nodes.getChildren(nodeId);
      const field = children.find(
        (c) => c.kind === 'field' && c.meta?.fieldDefId === fieldDefId
      );
      if (!field) return null;
      const values = await db.nodes.getChildren(field.id);
      return values[0]?.content ?? null;
    },
    setField: async (nodeId, fieldDefId, value) => {
      const children = await db.nodes.getChildren(nodeId);
      const existing = children.find(
        (c) => c.kind === 'field' && c.meta?.fieldDefId === fieldDefId
      );
      if (!existing) {
        await db.tags.addFieldToNode(nodeId, fieldDefId, value);
        return;
      }
      const values = await db.nodes.getChildren(existing.id);
      if (values[0]) await db.nodes.updateContent(values[0].id, value);
    },
    addTag: (nodeId, tagId) => db.tags.applyTag(nodeId, tagId),
    removeTag: (nodeId, tagId) => db.tags.removeTag(nodeId, tagId),
    setDone: (nodeId, done) => db.nodes.updateDone(nodeId, done),
    moveTo: async (nodeId, targetParentId) => {
      await db.nodes.moveNode(nodeId, targetParentId, 'a0');
    },
  };
}

describe('Command executor (REQ-6.2)', () => {
  let db: HecateDatabase;
  let ctx: CommandContext;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
    ctx = makeCtx(db);
  });

  it('setField / setDone / addTag steps run in order', async () => {
    const tag = await db.tags.createTag('command_test', { color: '#c4b2ff', showCheckbox: true });
    const fieldDef = await db.tags.createFieldDef('CmdField', { type: 'text' });
    const node = await db.nodes.create({ content: 'Command target' });

    await runCommand(
      node.id,
      [
        { type: 'addTag', tagId: tag.id },
        { type: 'setField', fieldDefId: fieldDef.id, value: 'done-value' },
        { type: 'setDone', done: true },
      ],
      ctx
    );

    expect((await db.tags.getTagsForNode(node.id)).some((t) => t.id === tag.id)).toBe(true);
    expect((await db.nodes.getById(node.id))?.done_at).not.toBeNull();
    expect(await ctx.getFieldValue(node.id, fieldDef.id)).toBe('done-value');
  });

  it('shiftDate moves an existing date by N days', async () => {
    const fieldDef = await db.tags.createFieldDef('ShiftDue', { type: 'date' });
    const node = await db.nodes.create({ content: 'Dated task' });
    await ctx.setField(node.id, fieldDef.id, '[[date:2026-11-04]]');

    await runCommand(node.id, [{ type: 'shiftDate', fieldDefId: fieldDef.id, days: 1 }], ctx);
    expect(await ctx.getFieldValue(node.id, fieldDef.id)).toBe('[[date:2026-11-05]]');

    await runCommand(node.id, [{ type: 'shiftDate', fieldDefId: fieldDef.id, days: 7 }], ctx);
    expect(await ctx.getFieldValue(node.id, fieldDef.id)).toBe('[[date:2026-11-12]]');
  });

  it('shiftDate from an empty field starts from today', async () => {
    const fieldDef = await db.tags.createFieldDef('EmptyDue', { type: 'date' });
    const node = await db.nodes.create({ content: 'Undated task' });

    await runCommand(node.id, [{ type: 'shiftDate', fieldDefId: fieldDef.id, days: 1 }], ctx);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(await ctx.getFieldValue(node.id, fieldDef.id)).toBe(
      `[[date:${formatDate(tomorrow)}]]`
    );
  });

  it('moveTo reparents the node', async () => {
    const target = await db.nodes.create({ content: 'Destination' });
    const node = await db.nodes.create({ content: 'Move me' });

    await runCommand(node.id, [{ type: 'moveTo', targetParentId: target.id }], ctx);
    expect((await db.nodes.getById(node.id))?.parent_id).toBe(target.id);
  });
});

describe('Built-in commands via store (FRD scenario 8)', () => {
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
      undoStack: new (await import('@hecate/core')).UndoStack(200),
    });
  });

  it('"Delay one day" on a task with Due set moves the date by exactly one day', async () => {
    const node = await db.nodes.create({ content: 'Task with due date' });
    await useWorkspaceStore
      .getState()
      .setFieldValue(node.id, (await db.tags.createFieldDef('Due', { type: 'date' })).id, '[[date:2026-11-04]]');

    await useWorkspaceStore.getState().runBuiltinCommand(node.id, 'delay-one-day');

    const children = await db.nodes.getChildren(node.id);
    const dueField = children.find((c) => c.kind === 'field');
    const values = await db.nodes.getChildren(dueField!.id);
    expect(values[0].content).toBe('[[date:2026-11-05]]');
  });

  it('"Set date to today" writes today into Due', async () => {
    const node = await db.nodes.create({ content: 'Undated task' });
    await useWorkspaceStore.getState().runBuiltinCommand(node.id, 'set-due-today');

    const children = await db.nodes.getChildren(node.id);
    const dueField = children.find((c) => c.kind === 'field');
    const values = await db.nodes.getChildren(dueField!.id);
    expect(values[0].content).toBe(`[[date:${formatDate(new Date())}]]`);
  });

  it('"Duplicate" deep-copies the subtree as a sibling', async () => {
    const parent = await db.nodes.create({ content: 'Parent' });
    const node = await db.nodes.create({ parent_id: parent.id, content: 'Original' });
    await db.nodes.create({ parent_id: node.id, content: 'Original child' });

    const dup = await useWorkspaceStore.getState().duplicateNode(node.id);
    expect(dup).not.toBeNull();
    expect(dup!.id).not.toBe(node.id);
    expect(dup!.parent_id).toBe(parent.id);
    expect(dup!.content).toBe('Original');

    const dupChildren = await db.nodes.getChildren(dup!.id);
    expect(dupChildren[0]?.content).toBe('Original child');

    // Original and duplicate coexist as siblings
    const siblings = await db.nodes.getChildren(parent.id);
    expect(siblings.filter((s) => s.content === 'Original').length).toBe(2);
  });
});
