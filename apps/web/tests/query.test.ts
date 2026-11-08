import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import { compileQueryToSql, SearchQuery } from '@hecate/core';

describe('Live search nodes (REQ-5.1, REQ-5.2)', () => {
  let db: HecateDatabase;

  beforeEach(async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('hasTag returns tagged nodes only', async () => {
    const taskTag = await db.tags.getTagByName('task');
    const tagged = await db.nodes.create({ content: 'Tagged task' });
    await db.tags.applyTag(tagged.id, taskTag!.id);
    await db.nodes.create({ content: 'Untagged note' });

    const results = await db.search.executeSearch({
      op: 'AND',
      clauses: [{ type: 'hasTag', tagId: taskTag!.id }],
    });
    expect(results.some((n) => n.id === tagged.id)).toBe(true);
    expect(results.some((n) => n.content === 'Untagged note')).toBe(false);
  });

  it('hasTag with includeDescendants matches child-tag instances', async () => {
    const taskTag = await db.tags.getTagByName('task');
    const subTag = await db.tags.createTag('designtask', {
      color: '#c4b2ff',
      extends: [taskTag!.id],
      showCheckbox: true,
    });
    const instance = await db.nodes.create({ content: 'Design review' });
    await db.tags.applyTag(instance.id, subTag.id);

    const results = await db.search.executeSearch({
      op: 'AND',
      clauses: [{ type: 'hasTag', tagId: taskTag!.id, includeDescendants: true }],
    });
    expect(results.some((n) => n.id === instance.id)).toBe(true);
  });

  it('text + done clauses compose with AND', async () => {
    const open = await db.nodes.create({ content: 'Write report draft' });
    const done = await db.nodes.create({ content: 'Write report final' });
    await db.nodes.updateDone(done.id, true);

    const results = await db.search.executeSearch({
      op: 'AND',
      clauses: [
        { type: 'text', q: 'report' },
        { type: 'done', value: false },
      ],
    });
    expect(results.some((n) => n.id === open.id)).toBe(true);
    expect(results.some((n) => n.id === done.id)).toBe(false);
  });

  it('OR groups return the union of matches', async () => {
    await db.nodes.create({ content: 'alpha unique' });
    await db.nodes.create({ content: 'beta unique' });
    await db.nodes.create({ content: 'gamma unique' });

    const results = await db.search.executeSearch({
      op: 'OR',
      clauses: [
        { type: 'text', q: 'alpha' },
        { type: 'text', q: 'beta' },
      ],
    });
    const contents = results.map((n) => n.content);
    expect(contents).toContain('alpha unique');
    expect(contents).toContain('beta unique');
    expect(contents).not.toContain('gamma unique');
  });

  it('childOf with deep traverses the subtree recursively', async () => {
    const parent = await db.nodes.create({ content: 'Parent' });
    const child = await db.nodes.create({ parent_id: parent.id, content: 'Child' });
    const grandchild = await db.nodes.create({ parent_id: child.id, content: 'Grandchild' });
    await db.nodes.create({ content: 'Unrelated' });

    const results = await db.search.executeSearch({
      op: 'AND',
      clauses: [{ type: 'childOf', nodeId: parent.id, deep: true }],
    });
    const ids = results.map((n) => n.id);
    expect(ids).toContain(child.id);
    expect(ids).toContain(grandchild.id);
    expect(ids).not.toContain(parent.id);
  });

  it('field clause matches field values (eq / contains)', async () => {
    const fieldDef = await db.tags.createFieldDef('PriorityTest', { type: 'text' });
    const node = await db.nodes.create({ content: 'Prioritized node' });
    await db.tags.addFieldToNode(node.id, fieldDef.id, 'high');
    await db.nodes.create({ content: 'Unprioritized node' });

    const eq = await db.search.executeSearch({
      op: 'AND',
      clauses: [{ type: 'field', fieldDefId: fieldDef.id, cmp: 'eq', value: 'high' }],
    });
    expect(eq.some((n) => n.id === node.id)).toBe(true);

    const neq = await db.search.executeSearch({
      op: 'AND',
      clauses: [{ type: 'field', fieldDefId: fieldDef.id, cmp: 'eq', value: 'low' }],
    });
    expect(neq.some((n) => n.id === node.id)).toBe(false);
  });

  it('FRD scenario 6: contextual $thisNode finds meetings referencing a person', async () => {
    const personTag = await db.tags.getTagByName('person') ??
      (await db.tags.createTag('person', { color: '#c4b2ff', showCheckbox: false }));
    const meetingTag = await db.tags.getTagByName('meeting') ??
      (await db.tags.createTag('meeting', { color: '#c4b2ff', showCheckbox: false }));

    const maya = await db.nodes.create({ content: 'Maya' });
    await db.tags.applyTag(maya.id, personTag.id);
    const meeting = await db.nodes.create({ content: `Sync with [[node:${maya.id}]]` });
    await db.tags.applyTag(meeting.id, meetingTag.id);

    const results = await db.search.executeSearch(
      {
        op: 'AND',
        clauses: [
          { type: 'hasTag', tagId: meetingTag.id },
          { type: 'references', nodeId: '$thisNode' },
        ],
      },
      maya.id
    );
    expect(results.some((n) => n.id === meeting.id)).toBe(true);
  });

  it('$thisNode without a context node throws a clear error', async () => {
    await expect(
      db.search.executeSearch({
        op: 'AND',
        clauses: [{ type: 'references', nodeId: '$thisNode' }],
      })
    ).rejects.toThrow(/contextNodeId/);
  });

  it('compiler parameterizes values (no SQL injection through clause values)', () => {
    const query: SearchQuery = {
      op: 'AND',
      clauses: [{ type: 'text', q: "'; DROP TABLE node; --" }],
    };
    const compiled = compileQueryToSql(query);
    expect(compiled.sql).not.toContain('DROP TABLE');
    expect(compiled.params).toContain("%'; DROP TABLE node; --%");
  });
});
