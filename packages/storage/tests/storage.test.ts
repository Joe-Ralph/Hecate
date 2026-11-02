import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter } from '../src/adapters/memory-adapter';
import { HecateDatabase } from '../src/database';

describe('Hecate Database & Storage Layer', () => {
  let db: HecateDatabase;
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  it('runs migrations and seeds starter tags on initialization', async () => {
    const tags = await db.tags.getAllTags();
    expect(tags.length).toBeGreaterThanOrEqual(8);
    const tagNames = tags.map((t) => t.content);
    expect(tagNames).toContain('task');
    expect(tagNames).toContain('book');
    expect(tagNames).toContain('meeting');
    expect(tagNames).toContain('private');
  });

  it('supports node CRUD and hierarchy', async () => {
    const parent = await db.nodes.create({ content: 'Parent Node' });
    expect(parent.id).toBeDefined();

    const child = await db.nodes.create({
      parent_id: parent.id,
      content: 'Child Node',
    });
    expect(child.parent_id).toBe(parent.id);

    const children = await db.nodes.getChildren(parent.id);
    expect(children.length).toBe(1);
    expect(children[0].content).toBe('Child Node');

    await db.nodes.updateContent(child.id, 'Updated Child Node');
    const updated = await db.nodes.getById(child.id);
    expect(updated?.content).toBe('Updated Child Node');

    await db.nodes.updateDone(child.id, true);
    const doneNode = await db.nodes.getById(child.id);
    expect(doneNode?.done_at).not.toBeNull();
  });

  it('prevents cycle creation during node moves', async () => {
    const a = await db.nodes.create({ content: 'Node A' });
    const b = await db.nodes.create({ parent_id: a.id, content: 'Node B' });
    const c = await db.nodes.create({ parent_id: b.id, content: 'Node C' });

    // Moving A under C would cause cycle A -> B -> C -> A
    await expect(db.nodes.moveNode(a.id, c.id, 'a0')).rejects.toThrow(/Cycle detected/);
  });

  it('automatically registers and updates backlinks', async () => {
    const maya = await db.nodes.create({ content: 'Maya Lin' });
    const meeting = await db.nodes.create({ content: `Call with [[node:${maya.id}]] tomorrow` });

    const backlinks = await db.refs.getBacklinks(maya.id);
    expect(backlinks.length).toBe(1);
    expect(backlinks[0].id).toBe(meeting.id);

    // Update meeting content to remove reference
    await db.nodes.updateContent(meeting.id, 'Call cancelled');
    const backlinksAfter = await db.refs.getBacklinks(maya.id);
    expect(backlinksAfter.length).toBe(0);
  });

  it('converts references to plain text snapshots on target deletion', async () => {
    const target = await db.nodes.create({ content: 'Design Specs' });
    const refNode = await db.nodes.create({ content: `Read [[node:${target.id}]] carefully` });

    // Delete target
    const result = await db.nodes.deleteNode(target.id);
    expect(result.refCount).toBe(1);

    // refNode should now have plain text snapshot
    const updatedRefNode = await db.nodes.getById(refNode.id);
    expect(updatedRefNode?.content).toBe('Read Design Specs carefully');
  });

  it('applies supertag and injects fields automatically', async () => {
    const taskTag = await db.tags.getTagByName('task');
    expect(taskTag).toBeDefined();

    const node = await db.nodes.create({ content: 'Buy groceries' });
    await db.tags.applyTag(node.id, taskTag!.id);

    // Node should have tag
    const nodeTags = await db.tags.getTagsForNode(node.id);
    expect(nodeTags.length).toBe(1);
    expect(nodeTags[0].content).toBe('task');

    // Fields should have been injected as children
    const fields = await db.nodes.getChildren(node.id);
    expect(fields.length).toBeGreaterThan(0);
    expect(fields[0].kind).toBe('field');
  });

  it('executes live search query', async () => {
    const taskTag = await db.tags.getTagByName('task');
    const node1 = await db.nodes.create({ content: 'My first task' });
    await db.tags.applyTag(node1.id, taskTag!.id);

    const results = await db.search.executeSearch({
      clauses: [{ type: 'hasTag', tagId: taskTag!.id }],
    });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(node1.id);
  });
});
