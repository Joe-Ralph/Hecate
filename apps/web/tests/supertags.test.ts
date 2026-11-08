import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';

describe('Supertag templates & field lifecycle (REQ-3.2, 3.3)', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('applyTag deep-copies nested default content recursively', async () => {
    const tag = await db.tags.createTag('meeting_tpl', {
      color: '#c4b2ff',
      showCheckbox: false,
      defaultContent: [
        {
          content: 'Agenda',
          children: [{ content: 'Topic A', children: [{ content: 'Sub-note' }] }],
        },
        { content: 'Action items' },
      ],
    });
    const node = await db.nodes.create({ content: 'Weekly sync' });
    await db.tags.applyTag(node.id, tag.id);

    const children = await db.nodes.getChildren(node.id);
    const agenda = children.find((c) => c.content === 'Agenda');
    expect(agenda).toBeDefined();
    expect(children.some((c) => c.content === 'Action items')).toBe(true);

    const agendaChildren = await db.nodes.getChildren(agenda!.id);
    const topicA = agendaChildren.find((c) => c.content === 'Topic A');
    expect(topicA).toBeDefined();

    const subNotes = await db.nodes.getChildren(topicA!.id);
    expect(subNotes[0]?.content).toBe('Sub-note');
  });

  it('removeTag deletes empty injected fields but keeps filled ones', async () => {
    const emptyField = await db.tags.createFieldDef('EmptyField', { type: 'text' });
    const filledField = await db.tags.createFieldDef('FilledField', { type: 'text' });
    const tag = await db.tags.createTag('removal_test', {
      color: '#c4b2ff',
      showCheckbox: false,
      fieldDefs: [
        { fieldDefId: emptyField.id, pinned: false },
        { fieldDefId: filledField.id, pinned: false },
      ],
    });

    const node = await db.nodes.create({ content: 'Node under test' });
    await db.tags.applyTag(node.id, tag.id);

    // Fill one of the two injected fields
    const children = await db.nodes.getChildren(node.id);
    const filledFieldNode = children.find(
      (c) => c.kind === 'field' && c.meta?.fieldDefId === filledField.id
    );
    const values = await db.nodes.getChildren(filledFieldNode!.id);
    await db.nodes.updateContent(values[0].id, 'important value');

    await db.tags.removeTag(node.id, tag.id);

    const after = await db.nodes.getChildren(node.id);
    expect(
      after.some((c) => c.kind === 'field' && c.meta?.fieldDefId === emptyField.id)
    ).toBe(false);
    expect(
      after.some((c) => c.kind === 'field' && c.meta?.fieldDefId === filledField.id)
    ).toBe(true);
    // Content node itself is untouched
    expect((await db.nodes.getById(node.id))?.deleted_at).toBeNull();
  });

  it('multi-extends injects fields from all parent tags', async () => {
    const fieldA = await db.tags.createFieldDef('FieldA', { type: 'text' });
    const fieldB = await db.tags.createFieldDef('FieldB', { type: 'text' });
    const parentA = await db.tags.createTag('parent_a', {
      color: '#c4b2ff',
      showCheckbox: false,
      fieldDefs: [{ fieldDefId: fieldA.id, pinned: false }],
    });
    const parentB = await db.tags.createTag('parent_b', {
      color: '#c4b2ff',
      showCheckbox: false,
      fieldDefs: [{ fieldDefId: fieldB.id, pinned: false }],
    });
    const child = await db.tags.createTag('multi_child', {
      color: '#c4b2ff',
      showCheckbox: false,
      extends: [parentA.id, parentB.id],
    });

    const node = await db.nodes.create({ content: 'Multi-inherit node' });
    await db.tags.applyTag(node.id, child.id);

    const children = await db.nodes.getChildren(node.id);
    const fieldDefIds = children
      .filter((c) => c.kind === 'field')
      .map((c) => c.meta?.fieldDefId);
    expect(fieldDefIds).toContain(fieldA.id);
    expect(fieldDefIds).toContain(fieldB.id);
  });
});
