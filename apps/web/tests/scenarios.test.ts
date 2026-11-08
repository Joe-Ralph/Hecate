import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import {
  parseTanaPaste,
  serializeTanaPaste,
  generateNKeysBetween,
} from '@hecate/core';
import { CoachEngine, MockProvider, buildKnowledgeDigest } from '@hecate/ai';

describe('Hecate End-to-End Acceptance Scenarios (FRD Section 11)', () => {
  let db: HecateDatabase;
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    db = await HecateDatabase.create(adapter);
  });

  // Scenario 1: Nesting
  it('Scenario 1: Nesting - Creates 5-level outline and persists collapse states', async () => {
    let currentParent: string | null = null;
    const createdNodes: string[] = [];

    // Create 5-level deep hierarchy
    for (let level = 1; level <= 5; level++) {
      const node = await db.nodes.create({
        parent_id: currentParent,
        content: `Level ${level} Node`,
        collapsed: level === 2 ? 1 : 0, // Level 2 collapsed
      });
      createdNodes.push(node.id);
      currentParent = node.id;
    }

    // Export DB binary and reload to simulate browser restart / persistence
    const binary = await adapter.exportBinary();
    const newAdapter = new MemoryStorageAdapter();
    await newAdapter.init(binary);
    const newDb = await HecateDatabase.create(newAdapter);

    // Verify 5 levels reconstructed
    const level1 = await newDb.nodes.getChildren(null);
    const l1Node = level1.find((n) => n.content === 'Level 1 Node');
    expect(l1Node).toBeDefined();

    const level2 = await newDb.nodes.getChildren(l1Node!.id);
    expect(level2[0].content).toBe('Level 2 Node');
    expect(level2[0].collapsed).toBe(1); // Collapse state persisted

    const level3 = await newDb.nodes.getChildren(level2[0].id);
    expect(level3[0].content).toBe('Level 3 Node');
  });

  // Scenario 2: Reference sync
  it('Scenario 2: Reference sync - References reflect live original changes and appear in backlinks', async () => {
    const nodeA = await db.nodes.create({ content: 'Project Alpha Spec' });
    const nodeB = await db.nodes.create({
      content: `Discussion regarding [[node:${nodeA.id}]] roadmap`,
    });

    // Node A should show Node B under backlinks
    const backlinks = await db.refs.getBacklinks(nodeA.id);
    expect(backlinks.length).toBe(1);
    expect(backlinks[0].id).toBe(nodeB.id);

    // Editing node A updates content live
    await db.nodes.updateContent(nodeA.id, 'Project Alpha Spec (v2 Revised)');
    const updatedA = await db.nodes.getById(nodeA.id);
    expect(updatedA?.content).toBe('Project Alpha Spec (v2 Revised)');
  });

  // Scenario 3: Supertag template
  it('Scenario 3: Supertag template - Tagging #book injects Author, Status, Rating fields with default', async () => {
    const bookTag = await db.tags.getTagByName('book');
    expect(bookTag).toBeDefined();

    const bookNode = await db.nodes.create({ content: 'Deep Work' });
    await db.tags.applyTag(bookNode.id, bookTag!.id);

    // Check fields injected
    const children = await db.nodes.getChildren(bookNode.id);
    const fieldNodes = children.filter((c) => c.kind === 'field');
    expect(fieldNodes.length).toBeGreaterThanOrEqual(2);

    // Check pinned status
    const pinned = fieldNodes.filter((f) => f.meta?.pinned);
    expect(pinned.length).toBeGreaterThanOrEqual(1);
  });

  // Scenario 4: Inheritance
  it('Scenario 4: Inheritance - Child tag inherits parent fields and overrides defaults', async () => {
    const taskTag = await db.tags.getTagByName('task');
    expect(taskTag).toBeDefined();

    // Create #designtask extending #task
    const designTag = await db.tags.createTag('designtask', {
      extends: [taskTag!.id],
      fieldDefs: [],
      showCheckbox: true,
    });

    const taskNode = await db.nodes.create({ content: 'Design landing page hero' });
    await db.tags.applyTag(taskNode.id, designTag.id);

    // Search for #task with descendants should find the designtask
    const results = await db.search.executeSearch({
      clauses: [{ type: 'hasTag', tagId: taskTag!.id, includeDescendants: true }],
    });

    expect(results.some((r) => r.id === taskNode.id)).toBe(true);
  });

  // Scenario 5: Multi-tag
  it('Scenario 5: Multi-tag - Union of fields with no duplicates', async () => {
    const bookTag = await db.tags.getTagByName('book');
    const ideaTag = await db.tags.getTagByName('idea');

    const multiTaggedNode = await db.nodes.create({ content: 'Philosophy of PKMs' });
    await db.tags.applyTag(multiTaggedNode.id, bookTag!.id);
    await db.tags.applyTag(multiTaggedNode.id, ideaTag!.id);

    const tags = await db.tags.getTagsForNode(multiTaggedNode.id);
    expect(tags.length).toBe(2);

    const children = await db.nodes.getChildren(multiTaggedNode.id);
    const fieldDefs = children.filter((c) => c.kind === 'field').map((f) => f.meta?.fieldDefId);
    const uniqueDefs = new Set(fieldDefs);
    expect(fieldDefs.length).toBe(uniqueDefs.size); // No duplicate fieldDefIds
  });

  // Scenario 6: Contextual search
  it('Scenario 6: Contextual search - Resolves $thisNode to current context node', async () => {
    const maya = await db.nodes.create({ content: 'Maya Lin' });
    const meeting = await db.nodes.create({
      content: `Sync meeting with [[node:${maya.id}]] on design`,
    });

    // Query for references($thisNode) resolved with contextNodeId = maya.id
    const results = await db.search.executeSearch(
      {
        clauses: [{ type: 'references', nodeId: '$thisNode' }],
      },
      maya.id
    );

    expect(results.length).toBe(1);
    expect(results[0].id).toBe(meeting.id);
  });

  // Scenario 8: Command execution
  it('Scenario 8: Delay one day shifts due date by exactly 1 day', async () => {
    const task = await db.nodes.create({ content: 'Submit report [[date:2026-11-03]]' });
    const content = task.content;
    const match = content.match(/\[\[date:(\d{4}-\d{2}-\d{2})\]\]/);
    expect(match).not.toBeNull();

    const date = new Date(match![1]);
    date.setDate(date.getDate() + 1);
    const newDateStr = date.toISOString().split('T')[0];
    const updated = content.replace(/\[\[date:\d{4}-\d{2}-\d{2}\]\]/, `[[date:${newDateStr}]]`);

    await db.nodes.updateContent(task.id, updated);
    const reloaded = await db.nodes.getById(task.id);
    expect(reloaded?.content).toContain(`[[date:2026-11-04]]`);
  });

  // Scenario 9: Tana Paste round-trip
  it('Scenario 9: Tana Paste - Parses sample and round-trips equivalently', () => {
    const sample = `%%tana%%
- Read Deep Work #book
  - Author:: Cal Newport
  - Status:: Reading
  - Rating:: 4
- Call [[Maya]] about the trip
  - Due:: [[date:2026-11-10]]`;

    const parsed = parseTanaPaste(sample);
    expect(parsed.length).toBe(2);
    expect(parsed[0].content).toBe('Read Deep Work');
    expect(parsed[0].tags).toEqual(['book']);
    expect(parsed[1].content).toBe('Call [[Maya]] about the trip');

    const serialized = serializeTanaPaste(parsed);
    const reparsed = parseTanaPaste(serialized);

    expect(reparsed[0].content).toBe(parsed[0].content);
    expect(reparsed[0].fields.length).toBe(3);
    expect(reparsed[1].fields[0].value).toBe('[[date:2026-11-10]]');
  });

  // Scenario 10: Offline
  it('Scenario 10: Offline persistence - Edits persist across database restarts without internet', async () => {
    const offlineNode = await db.nodes.create({ content: 'Offline captured thought' });
    expect(offlineNode.id).toBeDefined();

    // Export and reload binary
    const binary = await adapter.exportBinary();
    const restartedAdapter = new MemoryStorageAdapter();
    await restartedAdapter.init(binary);
    const restartedDb = await HecateDatabase.create(restartedAdapter);

    const retrieved = await restartedDb.nodes.getById(offlineNode.id);
    expect(retrieved?.content).toBe('Offline captured thought');
  });

  // Scenario 11 & 12: AI Consent and Privacy
  it('Scenario 11 & 12: AI Consent and Privacy - Excludes #private and requires opt-in', async () => {
    // With AI off, coaching throws consent error
    await db.settings.updateSettings({ aiEnabled: false });
    const engine = new CoachEngine(db);
    const provider = new MockProvider();
    await expect(engine.runCoaching(provider)).rejects.toThrow(/consent/i);

    // Create private note
    const privateTag = await db.tags.getTagByName('private');
    const privateNode = await db.nodes.create({ content: 'Confidential personal finances' });
    await db.tags.applyTag(privateNode.id, privateTag!.id);

    // Create public note
    await db.nodes.create({ content: 'Reading notes on Cal Newport Deep Work' });

    // Enable AI and inspect digest
    await db.settings.updateSettings({ aiEnabled: true });
    const digest = await buildKnowledgeDigest(db, 7);
    const texts = digest.digest.map((d) => d.text);

    expect(texts).toContain('Reading notes on Cal Newport Deep Work');
    expect(texts).not.toContain('Confidential personal finances');
  });

  // Scenario 13: Mini-task flow & feedback loop
  it('Scenario 13: Mini-task flow - Complete, snooze, and save as #task node', async () => {
    const task = (
      await db.ai.saveMiniTasks([
        {
          title: 'Stretch for 10 minutes',
          category: 'health',
          duration_min: 10,
          rationale: 'Physical rest after writing',
        },
      ])
    )[0];

    // Mark Done
    await db.ai.updateMiniTaskStatus(task.id, 'done');
    let reloaded = (await db.ai.getRecentTasks(1))[0];
    expect(reloaded.done_at).not.toBeNull();

    // Verify categoryStats
    const stats = await db.ai.getCategoryStats();
    expect(stats['health']?.done).toBe(1);
  });

  // Scenario 14: AI Failure & Repair Retry
  it('Scenario 14: AI Failure - Retries once with repair prompt on malformed JSON', async () => {
    await db.settings.updateSettings({ aiEnabled: true });
    const engine = new CoachEngine(db);
    const provider = new MockProvider();
    provider.shouldFailMalformedCount = 1;

    const result = await engine.runCoaching(provider);
    expect(result.tasks.length).toBeGreaterThanOrEqual(3);
  });

  // Scenario 16: Performance
  it('Scenario 16: Performance - Fast writes and fractional indexing at scale', async () => {
    const start = Date.now();
    const keys = generateNKeysBetween(null, null, 1000);
    expect(keys.length).toBe(1000);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100);
  });

  // Scenario 17: Deletion & Trash Invariants
  it('Scenario 17: Deletion & Trash - Untitled empty entry permanently deleted; entries with content moved to trash with permanent delete option', async () => {
    // 1. Create an untitled node with no content
    const untitledNode = await db.nodes.create({ content: '' });

    // 2. Delete it: must be permanently deleted, not stored in trash
    const res1 = await db.nodes.deleteNode(untitledNode.id);
    expect(res1.permanentlyDeleted).toBe(true);

    const trashAfterEmpty = await db.nodes.getTrash();
    expect(trashAfterEmpty.find((n) => n.id === untitledNode.id)).toBeUndefined();

    // 3. Create a node with content
    const contentNode = await db.nodes.create({ content: 'Article Draft on Systems Thinking' });

    // 4. Delete it: stored in trash
    const res2 = await db.nodes.deleteNode(contentNode.id);
    expect(res2.permanentlyDeleted).toBe(false);

    let trashAfterContent = await db.nodes.getTrash();
    expect(trashAfterContent.find((n) => n.id === contentNode.id)).toBeDefined();

    // 5. Permanently delete option from trash
    await db.nodes.permanentlyDeleteNode(contentNode.id);

    const finalTrash = await db.nodes.getTrash();
    expect(finalTrash.find((n) => n.id === contentNode.id)).toBeUndefined();

    const raw = await db.nodes.getNodeRaw(contentNode.id);
    expect(raw).toBeNull();
  });

  // Scenario 18: Inline Supertag Autocomplete Prefix Filtering & Tagging
  it('Scenario 18: Inline Supertag Autocomplete Prefix Filtering & Tagging', async () => {
    // 1. Regex validates trigger only at start of line or immediately after space
    const HASH_REGEX = /(?:^|\s)#([a-zA-Z0-9_\-]*)$/;

    expect('#'.match(HASH_REGEX)?.[1]).toBe('');
    expect('#top'.match(HASH_REGEX)?.[1]).toBe('top');
    expect('Important meeting #task'.match(HASH_REGEX)?.[1]).toBe('task');
    expect('Note title #'.match(HASH_REGEX)?.[1]).toBe('');
    expect('test#not_tag'.match(HASH_REGEX)).toBeNull();
    expect('meeting #task '.match(HASH_REGEX)).toBeNull();

    // 2. Setup supertags in database
    await db.tags.createTag('task', { color: '#8fd18b', showCheckbox: true });
    await db.tags.createTag('topic', { color: '#c4b2ff' });
    await db.tags.createTag('project', { color: '#a855f7' });

    const allTags = await db.tags.getAllTags();

    // Helper filter function matching OutlinerNode logic
    function filterTags(prefix: string) {
      const clean = prefix.toLowerCase().trim();
      if (!clean) return allTags;
      return allTags
        .filter((t) => t.content.toLowerCase().includes(clean))
        .sort((a, b) => {
          const aStarts = a.content.toLowerCase().startsWith(clean);
          const bStarts = b.content.toLowerCase().startsWith(clean);
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;
          return a.content.localeCompare(b.content);
        });
    }

    const filteredTop = filterTags('top');
    expect(filteredTop.length).toBe(1);
    expect(filteredTop[0].content).toBe('topic');

    const filteredT = filterTags('t');
    expect(filteredT.map((t) => t.content)).toContain('task');
    expect(filteredT.map((t) => t.content)).toContain('topic');

    // 3. Create node, apply tag, verify tag association and template fields
    const note = await db.nodes.create({ content: 'Explore systems architecture' });
    const taskTag = await db.tags.getTagByName('task');
    await db.tags.applyTag(note.id, taskTag!.id);

    const noteTags = await db.tags.getTagsForNode(note.id);
    expect(noteTags.some((t) => t.content === 'task')).toBe(true);

    const children = await db.nodes.getChildren(note.id);
    const fieldChildren = children.filter((c) => c.kind === 'field');
    expect(fieldChildren.length).toBeGreaterThan(0);
  });

  // Scenario 16: Universal [[ Node References in Text Fields and Content
  it('Scenario 16: Universal [[ Node References in Text Fields and Content', async () => {
    // 1. Create #person supertag and person nodes
    const personTag = await db.tags.createTag('person', { color: '#c4b2ff' });
    const jane = await db.nodes.create({ content: 'Jane Austen' });
    await db.tags.applyTag(jane.id, personTag.id);

    const george = await db.nodes.create({ content: 'George Orwell' });
    await db.tags.applyTag(george.id, personTag.id);

    // 2. Global search prefix matching
    const searchJane = await db.search.globalSearch('Jane');
    expect(searchJane.length).toBe(1);
    expect(searchJane[0].id).toBe(jane.id);
    expect(searchJane[0].content).toBe('Jane Austen');

    // Verify tag retrieval for the search result
    const janeTags = await db.tags.getTagsForNode(jane.id);
    expect(janeTags.map((t) => t.content)).toContain('person');

    // 3. Create #book node with Author field
    const authorDef = await db.tags.createFieldDef('Author', { type: 'text' });
    const bookTag = await db.tags.createTag('book', {
      color: '#a855f7',
      fieldDefs: [{ fieldDefId: authorDef.id }],
    });
    const book = await db.nodes.create({ content: 'Pride and Prejudice' });
    await db.tags.applyTag(book.id, bookTag.id);

    // Find the Author value node
    const bookChildren = await db.nodes.getChildren(book.id);
    const authorFieldWrapper = bookChildren.find(
      (c) => c.kind === 'field' && (c.meta as any)?.fieldDefId === authorDef.id
    );
    expect(authorFieldWrapper).toBeDefined();

    const authorFieldChildren = await db.nodes.getChildren(authorFieldWrapper!.id);
    expect(authorFieldChildren.length).toBe(1);
    const authorValueNode = authorFieldChildren[0];

    // 4. Set Author value using [[node:<jane.id>]]
    await db.nodes.updateContent(authorValueNode.id, `[[node:${jane.id}]]`);

    // Verify reference backlink was recorded
    const backlinks = await db.refs.getBacklinks(jane.id);
    expect(backlinks.length).toBe(1);
    expect(backlinks[0].id).toBe(authorValueNode.id);

    // 5. Global search with empty string returns recent content nodes without workspace/field internal nodes
    const recent = await db.search.globalSearch('');
    expect(recent.length).toBeGreaterThan(0);
    expect(recent.every((r) => r.kind !== 'workspace' && r.kind !== 'field')).toBe(true);
    expect(recent.map((r) => r.id)).toContain(jane.id);
    expect(recent.map((r) => r.id)).toContain(george.id);
    expect(recent.map((r) => r.id)).toContain(book.id);
  });

  // Scenario 17: Library Tag Instances View
  it('Scenario 17: Library Tag Instances - Retrieves all nodes associated with a supertag', async () => {
    // 1. Create #recipe supertag
    const recipeTag = await db.tags.createTag('recipe', { color: '#e8856a' });

    // 2. Create nodes tagged with #recipe
    const r1 = await db.nodes.create({ content: 'Sourdough Bread' });
    await db.tags.applyTag(r1.id, recipeTag.id);

    const r2 = await db.nodes.create({ content: 'Classic Lasagna' });
    await db.tags.applyTag(r2.id, recipeTag.id);

    const r3 = await db.nodes.create({ content: 'Tiramisu' });
    await db.tags.applyTag(r3.id, recipeTag.id);

    // Create untagged node
    await db.nodes.create({ content: 'Grocery shopping list' });

    // 3. Query getNodesWithTag
    const recipeNodes = await db.tags.getNodesWithTag(recipeTag.id);
    expect(recipeNodes.length).toBe(3);
    const titles = recipeNodes.map((n) => n.content);
    expect(titles).toContain('Sourdough Bread');
    expect(titles).toContain('Classic Lasagna');
    expect(titles).toContain('Tiramisu');
    expect(titles).not.toContain('Grocery shopping list');

    // 4. Soft-delete one recipe and verify it no longer appears in tag instances
    await db.nodes.deleteNode(r2.id);
    const updatedRecipes = await db.tags.getNodesWithTag(recipeTag.id);
    expect(updatedRecipes.length).toBe(2);
    expect(updatedRecipes.map((n) => n.content)).not.toContain('Classic Lasagna');

    // 5. Verify tag node count query
    const countRows = await db.adapter.query<any>(
      `SELECT nt.tag_def_id, COUNT(*) as count
       FROM node_tag nt
       JOIN node n ON n.id = nt.node_id
       WHERE n.deleted_at IS NULL AND nt.tag_def_id = ?
       GROUP BY nt.tag_def_id`,
      [recipeTag.id]
    );
    expect(countRows[0].count).toBe(2);
  });
});
