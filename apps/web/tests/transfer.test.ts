import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStorageAdapter, HecateDatabase } from '@hecate/storage';
import {
  validateWorkspaceDump,
  remapWorkspaceDumpIds,
  exportableToMarkdown,
  parseTanaPaste,
  serializeTanaPaste,
  ulid,
} from '@hecate/core';
import { useWorkspaceStore, PanelState } from '../src/store/workspaceStore';

describe('Import / Export (REQ-7.3, REQ-6.3)', () => {
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
    });
  });

  it('validateWorkspaceDump rejects malformed dumps', () => {
    expect(validateWorkspaceDump(null)).toBeTruthy();
    expect(validateWorkspaceDump({ nodes: 'nope' })).toBeTruthy();
    expect(validateWorkspaceDump({ nodes: [], tags: [], refs: [] })).toBeNull();
    expect(validateWorkspaceDump({ nodes: [{ id: 1 }], tags: [], refs: [] })).toBeTruthy();
  });

  it('remapWorkspaceDumpIds remaps ids everywhere including meta JSON', () => {
    const dump = {
      nodes: [
        { id: 'AAA', parent_id: null, content: 'Root', meta: null },
        { id: 'BBB', parent_id: 'AAA', content: 'Child', meta: JSON.stringify({ fieldDefId: 'CCC' }) },
        { id: 'CCC', parent_id: null, content: 'Field', meta: null },
      ],
      tags: [{ node_id: 'BBB', tag_def_id: 'CCC' }],
      refs: [{ source_node_id: 'BBB', target_node_id: 'AAA', kind: 'inline' }],
    };
    const remapped = remapWorkspaceDumpIds(dump as any, () => ulid());

    const newA = remapped.nodes.find((n) => n.content === 'Root')!.id;
    const newB = remapped.nodes.find((n) => n.content === 'Child')!.id;
    const newC = remapped.nodes.find((n) => n.content === 'Field')!.id;
    expect(newA).not.toBe('AAA');
    expect(remapped.nodes.find((n) => n.content === 'Child')!.parent_id).toBe(newA);
    expect(JSON.parse(remapped.nodes.find((n) => n.content === 'Child')!.meta).fieldDefId).toBe(newC);
    expect(remapped.tags[0]).toEqual({ node_id: newB, tag_def_id: newC });
    expect(remapped.refs[0].source_node_id).toBe(newB);
    expect(remapped.refs[0].target_node_id).toBe(newA);
  });

  it('importWorkspaceDump imports without overwriting existing nodes', async () => {
    const existing = await db.nodes.create({ content: 'Existing node' });
    const dump = {
      nodes: [
        {
          id: 'DUMP1',
          parent_id: null,
          position: 'a0',
          kind: 'content',
          content: 'Imported root',
          collapsed: 0,
          done_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          meta: null,
        },
        {
          id: 'DUMP2',
          parent_id: 'DUMP1',
          position: 'a0',
          kind: 'content',
          content: 'Imported child',
          collapsed: 0,
          done_at: null,
          created_at: Date.now(),
          updated_at: Date.now(),
          deleted_at: null,
          meta: null,
        },
      ],
      tags: [],
      refs: [],
    };

    await useWorkspaceStore.getState().importWorkspaceDump(dump as any);

    // Existing node untouched, imported nodes present with new ids
    expect((await db.nodes.getById(existing.id))?.content).toBe('Existing node');
    expect(await db.nodes.getById('DUMP1')).toBeNull();
    const all = await db.adapter.query<any>(
      "SELECT * FROM node WHERE content IN ('Imported root', 'Imported child')"
    );
    expect(all.length).toBe(2);
    const child = all.find((n) => n.content === 'Imported child')!;
    const root = all.find((n) => n.content === 'Imported root')!;
    expect(child.parent_id).toBe(root.id);
  });

  it('insertParsedNodes creates fields, missing tags, and refs by title', async () => {
    const text = `%%tana%%
- Read Deep Work #book
  - Author:: Cal Newport
  - Rating:: 4
- Call [[Maya]] about the trip
  - Due:: [[date:2026-11-10]]`;
    const parsed = parseTanaPaste(text);
    await useWorkspaceStore.getState().insertParsedNodes(parsed, null);

    const bookTag = await db.tags.getTagByName('book');
    expect(bookTag).not.toBeNull();

    const all = await db.adapter.query<any>(
      "SELECT * FROM node WHERE content LIKE 'Read Deep Work%' AND deleted_at IS NULL"
    );
    expect(all.length).toBe(1);
    const fields = await db.nodes.getChildren(all[0].id);
    const fieldNodes = fields.filter((c) => c.kind === 'field');
    // #book's template injects Author, Status, Rating; pasted values fill them
    expect(fieldNodes.length).toBe(3);

    // Find the Author field by its def name and check the pasted value landed
    let foundAuthorValue = false;
    for (const f of fieldNodes) {
      const def = await db.nodes.getById(f.meta!.fieldDefId);
      if (def?.content === 'Author') {
        const vals = await db.nodes.getChildren(f.id);
        expect(vals[0].content).toBe('Cal Newport');
        foundAuthorValue = true;
      }
    }
    expect(foundAuthorValue).toBe(true);

    // [[Maya]] was created and converted to a real node reference
    const call = await db.adapter.query<any>(
      "SELECT * FROM node WHERE content LIKE 'Call [[node:%' AND deleted_at IS NULL"
    );
    expect(call.length).toBe(1);
    const refs = await db.adapter.query<any>(
      'SELECT * FROM ref WHERE source_node_id = ?',
      [call[0].id]
    );
    expect(refs.length).toBe(1);
  });

  it('Markdown export renders nested bullets with fields and checkboxes', () => {
    const md = exportableToMarkdown([
      {
        content: 'Task A',
        isDone: true,
        tags: ['task'],
        fields: [{ name: 'Due', value: '[[date:2026-11-10]]' }],
        children: [{ content: 'Subtask' }],
      },
    ]);
    expect(md).toContain('- [x] Task A #task');
    expect(md).toContain('  - Due:: [[date:2026-11-10]]');
    expect(md).toContain('  - Subtask');

    // Markdown round-trips through the outline parser
    const parsed = parseTanaPaste(md);
    expect(parsed[0].content).toContain('Task A');
    expect(parsed[0].children.length).toBeGreaterThan(0);
  });

  it('Tana Paste full export is recursive and re-parseable', async () => {
    const root = await db.nodes.create({ content: 'Export root' });
    const child = await db.nodes.create({ parent_id: root.id, content: 'Export child' });
    await db.nodes.create({ parent_id: child.id, content: 'Export grandchild' });

    const text = await useWorkspaceStore.getState().exportAllAsTanaPaste();
    const parsed = parseTanaPaste(text);
    const rootParsed = parsed.find((n) => n.content === 'Export root');
    expect(rootParsed).toBeDefined();
    expect(rootParsed!.children[0]?.content).toBe('Export child');
    expect(rootParsed!.children[0]?.children[0]?.content).toBe('Export grandchild');
  });
});
