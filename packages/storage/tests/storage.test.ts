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

  it('permanently deletes untitled entry with no content and does not store in trash', async () => {
    // 1. Create an empty untitled node
    const emptyNode = await db.nodes.create({ content: '' });
    const untitledNode = await db.nodes.create({ content: 'Untitled' });

    // 2. Delete them
    const res1 = await db.nodes.deleteNode(emptyNode.id);
    expect(res1.permanentlyDeleted).toBe(true);

    const res2 = await db.nodes.deleteNode(untitledNode.id);
    expect(res2.permanentlyDeleted).toBe(true);

    // 3. Verify neither is in trash
    const trash = await db.nodes.getTrash();
    expect(trash.some((n) => n.id === emptyNode.id)).toBe(false);
    expect(trash.some((n) => n.id === untitledNode.id)).toBe(false);

    // 4. Verify completely gone from database
    const raw1 = await db.nodes.getNodeRaw(emptyNode.id);
    expect(raw1).toBeNull();
    const raw2 = await db.nodes.getNodeRaw(untitledNode.id);
    expect(raw2).toBeNull();
  });

  it('soft-deletes nodes with content to trash and allows permanent deletion from trash', async () => {
    // 1. Create node with content
    const node = await db.nodes.create({ content: 'Important Architecture Note' });

    // 2. Delete it
    const res = await db.nodes.deleteNode(node.id);
    expect(res.permanentlyDeleted).toBe(false);

    // 3. Verify it is present in trash
    let trash = await db.nodes.getTrash();
    expect(trash.some((n) => n.id === node.id)).toBe(true);

    // 4. Permanently delete from trash
    await db.nodes.permanentlyDeleteNode(node.id);

    // 5. Verify gone from trash and database
    trash = await db.nodes.getTrash();
    expect(trash.some((n) => n.id === node.id)).toBe(false);

    const raw = await db.nodes.getNodeRaw(node.id);
    expect(raw).toBeNull();
  });

  it('removes template fields when tag is removed from node', async () => {
    // 1. Create a note and apply #task
    const note = await db.nodes.create({ content: 'Launch Hecate v1.0' });
    const taskTag = await db.tags.getTagByName('task');
    expect(taskTag).toBeDefined();

    await db.tags.applyTag(note.id, taskTag!.id);

    // Verify fields were injected
    const childrenWithTag = await db.nodes.getChildren(note.id);
    const fieldChildren = childrenWithTag.filter((c) => c.kind === 'field');
    expect(fieldChildren.length).toBeGreaterThanOrEqual(2); // Status, Due, Priority

    // Verify tag is attached
    const attachedTags = await db.tags.getTagsForNode(note.id);
    expect(attachedTags.some((t) => t.id === taskTag!.id)).toBe(true);

    // 2. Remove tag
    await db.tags.removeTag(note.id, taskTag!.id);

    // Verify tag is no longer attached
    const afterTags = await db.tags.getTagsForNode(note.id);
    expect(afterTags.some((t) => t.id === taskTag!.id)).toBe(false);

    // Verify introduced template fields are removed (REQ-3.2: only EMPTY injected
    // fields are removed; the auto-initialized Status = 'Inbox' has a value and stays)
    const childrenAfterRemove = await db.nodes.getChildren(note.id);
    const fieldChildrenAfter = childrenAfterRemove.filter((c) => c.kind === 'field');
    expect(fieldChildrenAfter.length).toBe(1);

    const remainingValues = await db.nodes.getChildren(fieldChildrenAfter[0].id);
    expect(remainingValues[0]?.content).toBe('Inbox');
  });
});
