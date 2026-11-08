/**
 * Workspace Store (Zustand)
 * Manages panels, outliner actions, undo/redo, and AI coaching.
 */

import { create } from 'zustand';
import {
  NodeRecord,
  MiniTaskRecord,
  UndoStack,
  formatDate,
  generateKeyBetween,
  getInitialKey,
  ExportableNode,
  serializeTanaPaste,
  CommandRecord,
  CommandStep,
  CommandContext,
  runCommand,
  ParsedTanaNode,
  WorkspaceDump,
  validateWorkspaceDump,
  remapWorkspaceDumpIds,
  exportableToMarkdown,
  ulid,
} from '@hecate/core';
import { HecateDatabase, MemoryStorageAdapter } from '@hecate/storage';
import { CoachEngine, MockProvider, AnthropicProvider, OpenAiProvider, OllamaProvider } from '@hecate/ai';
import { DefaultReflectionEngine, ReflectionEngine, Reflection, UserAction } from '@hecate/reflection';

export interface PanelState {
  id: string;
  nodeId: string;
  view: 'list' | 'table' | 'cards' | 'calendar';
  zoomPath: string[]; // zoomed-root chain; last entry is the current zoom root
}

export interface WorkspaceState {
  db: HecateDatabase | null;
  reflectionEngine: ReflectionEngine | null;
  todayReflections: Reflection[];
  sourceNodeTitles: Record<string, string>;
  isInitialized: boolean;
  initError: string | null;
  activePanels: PanelState[];
  activePanelIndex: number;
  todayNodeId: string | null;
  undoStack: UndoStack;
  todayMiniTasks: MiniTaskRecord[];
  isAiRunning: boolean;
  omnibarOpen: boolean;
  shortcutsModalOpen: boolean;
  consentModalOpen: boolean;
  digestInspectOpen: boolean;
  lastDigestPayload: any | null;
  version: number; // Increment to force re-render across tree
  activeNav: 'home' | 'panels' | 'library' | 'calendar' | 'graph' | 'reflections' | 'trash' | 'settings';

  // Actions
  init: () => Promise<void>;
  setActiveNav: (nav: 'home' | 'panels' | 'library' | 'calendar' | 'graph' | 'reflections' | 'trash' | 'settings') => void;
  openNode: (nodeId: string, openInSidePanel?: boolean) => void;
  zoomInto: (panelIndex: number, nodeId: string) => void;
  zoomToDepth: (panelIndex: number, depth: number) => void;
  zoomOut: (panelIndex: number) => void;
  togglePinNode: (nodeId: string) => Promise<void>;
  createSearchNode: () => Promise<NodeRecord>;
  updateSearchQuery: (nodeId: string, query: any) => Promise<void>;

  // Multi-select & DnD
  selectedNodeIds: string[];
  selectionAnchorId: string | null;
  setSelection: (ids: string[], anchorId?: string | null) => void;
  clearSelection: () => void;
  moveNodeTo: (nodeId: string, newParentId: string | null, newPosition: string) => Promise<void>;
  setFieldValue: (nodeId: string, fieldDefId: string, value: string) => Promise<void>;
  copyNodesAsTanaPaste: (nodeIds: string[]) => Promise<void>;

  // Safe delete with reference confirmation
  deleteConfirmInfo: { nodeId: string; refCount: number; title: string } | null;
  requestDeleteNode: (nodeId: string) => Promise<void>;
  confirmDeleteNode: () => Promise<void>;
  cancelDeleteNode: () => void;

  // Commands (REQ-6.2)
  focusedNodeId: string | null;
  setFocusedNode: (nodeId: string | null) => void;
  moveRequestNodeIds: string[] | null;
  requestMoveNodes: (nodeIds: string[]) => void;
  cancelMove: () => void;
  runBuiltinCommand: (nodeId: string, commandId: string) => Promise<void>;
  runCustomCommand: (nodeId: string, command: CommandRecord) => Promise<void>;
  duplicateNode: (nodeId: string) => Promise<NodeRecord | null>;

  // Import / Export (REQ-7.3)
  exportAllAsTanaPaste: () => Promise<string>;
  exportAllAsMarkdown: () => Promise<string>;
  insertParsedNodes: (nodes: ParsedTanaNode[], parentId: string | null) => Promise<void>;
  importWorkspaceDump: (dump: WorkspaceDump) => Promise<void>;
  loadSampleGraphData: (scale?: 'standard' | 'xl') => Promise<void>;
  closePanel: (index: number) => void;
  setPanelView: (panelIndex: number, view: 'list' | 'table' | 'cards' | 'calendar') => void;
  jumpToToday: () => void;
  setOmnibarOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setConsentModalOpen: (open: boolean) => void;
  setDigestInspectOpen: (open: boolean) => void;
  actReflection: (id: string, action: UserAction) => Promise<{ undoToken?: string; replacement?: Reflection } | void>;
  undoReflection: () => Promise<void>;
  refreshReflections: () => Promise<void>;

  // Node Mutations
  createNode: (options: { parent_id?: string | null; content?: string }) => Promise<NodeRecord>;
  toggleDone: (nodeId: string) => Promise<void>;
  toggleCollapse: (nodeId: string) => Promise<void>;
  updateNodeContent: (nodeId: string, content: string) => Promise<void>;
  createSiblingNode: (refNodeId: string, content?: string) => Promise<NodeRecord>;
  createChildNode: (parentId: string, content?: string) => Promise<NodeRecord>;
  indentNode: (nodeId: string) => Promise<void>;
  outdentNode: (nodeId: string) => Promise<void>;
  moveSibling: (nodeId: string, direction: 'up' | 'down') => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  permanentlyDeleteNode: (nodeId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  applyTag: (nodeId: string, tagDefId: string) => Promise<void>;
  removeTag: (nodeId: string, tagDefId: string) => Promise<void>;

  // AI Actions
  runAiCoaching: () => Promise<void>;
  updateMiniTaskStatus: (id: string, status: any) => Promise<void>;
  saveMiniTaskAsNode: (task: MiniTaskRecord) => Promise<void>;

  // Undo / Redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

async function resolveSourceTitles(
  db: HecateDatabase | null,
  reflections: Reflection[],
  currentMap: Record<string, string>
): Promise<Record<string, string>> {
  if (!db) return currentMap;
  const ids = Array.from(new Set(reflections.flatMap((r) => r.sourceNodeIds || [])));
  const missing = ids.filter((id) => id && currentMap[id] === undefined);
  if (missing.length === 0) return currentMap;

  const next = { ...currentMap };
  for (const id of missing) {
    try {
      const node = await db.nodes.getById(id);
      if (node) {
        next[id] = node.content.trim() || 'Untitled Node';
      }
    } catch {
      // ignore
    }
  }
  return next;
}

/** Recursively builds an exportable subtree (content, tags, fields, children). */
async function buildExportableNode(
  db: HecateDatabase,
  id: string
): Promise<ExportableNode | null> {
  const n = await db.nodes.getById(id);
  if (!n) return null;
  const children = await db.nodes.getChildren(id);
  const tags = await db.tags.getTagsForNode(id);

  const fields: Array<{ name: string; value: string }> = [];
  const contentChildren: ExportableNode[] = [];
  for (const c of children) {
    if (c.kind === 'field') {
      const def = c.meta?.fieldDefId ? await db.nodes.getById(c.meta.fieldDefId) : null;
      const vals = await db.nodes.getChildren(c.id);
      fields.push({ name: def?.content || 'Field', value: vals[0]?.content || '' });
    } else if (c.kind === 'content') {
      const built = await buildExportableNode(db, c.id);
      if (built) contentChildren.push(built);
    }
  }

  // Convert [[node:id]] tokens to [[Title]] for portable export
  let content = n.content;
  const refIds = Array.from(content.matchAll(/\[\[node:([A-Za-z0-9_-]+)\]\]/g)).map((m) => m[1]);
  for (const rid of refIds) {
    const target = await db.nodes.getById(rid);
    content = content.split(`[[node:${rid}]]`).join(`[[${target?.content || rid}]]`);
  }

  return {
    content,
    isDone: n.done_at ? true : undefined,
    tags: tags.map((t) => t.content),
    fields,
    children: contentChildren,
  };
}

function buildCommandContext(
  get: () => WorkspaceState,
  set: (partial: Partial<WorkspaceState>) => void
): CommandContext {
  return {
    getFieldValue: async (nodeId, fieldDefId) => {
      const { db } = get();
      if (!db) return null;
      const children = await db.nodes.getChildren(nodeId);
      const field = children.find(
        (c) => c.kind === 'field' && c.meta?.fieldDefId === fieldDefId
      );
      if (!field) return null;
      const values = await db.nodes.getChildren(field.id);
      return values[0]?.content ?? null;
    },
    setField: (nodeId, fieldDefId, value) => get().setFieldValue(nodeId, fieldDefId, value),
    addTag: (nodeId, tagId) => get().applyTag(nodeId, tagId),
    removeTag: (nodeId, tagId) => get().removeTag(nodeId, tagId),
    setDone: async (nodeId, done) => {
      const { db, version } = get();
      if (!db) return;
      await db.nodes.updateDone(nodeId, done);
      set({ version: version + 1 });
    },
    moveTo: async (nodeId, targetParentId) => {
      const { db } = get();
      if (!db) return;
      const kids = await db.nodes.getChildren(targetParentId);
      const lastPos = kids.length > 0 ? kids[kids.length - 1].position : null;
      await get().moveNodeTo(nodeId, targetParentId, generateKeyBetween(lastPos, null));
    },
  };
}

/** Nodes pinned for the sidebar — only content-like pages, never field instances
 * (field nodes also carry meta.pinned, which means "pinned field", not "pinned page"). */
export async function getPinnedNodes(db: HecateDatabase) {
  return db.adapter.query<any>(
    "SELECT * FROM node WHERE deleted_at IS NULL AND kind IN ('content', 'day', 'search') AND json_extract(meta, '$.pinned') = 1 ORDER BY updated_at DESC LIMIT 8"
  );
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  db: null,
  reflectionEngine: null,
  todayReflections: [],
  sourceNodeTitles: {},
  isInitialized: false,
  initError: null,
  activePanels: [],
  activePanelIndex: 0,
  todayNodeId: null,
  undoStack: new UndoStack(200),
  todayMiniTasks: [],
  isAiRunning: false,
  omnibarOpen: false,
  shortcutsModalOpen: false,
  consentModalOpen: false,
  digestInspectOpen: false,
  lastDigestPayload: null,
  version: 0,
  activeNav: 'home',
  selectedNodeIds: [],
  selectionAnchorId: null,
  deleteConfirmInfo: null,
  focusedNodeId: null,
  moveRequestNodeIds: null,

  setActiveNav: (nav) => set({ activeNav: nav }),

  init: async () => {
    if (get().db) return;

    try {
      const adapter = new MemoryStorageAdapter();
      await adapter.init();
      const db = await HecateDatabase.create(adapter);

      // Get or create today's node
      const todayIso = formatDate(new Date());
      const todayNode = await db.nodes.getOrCreateDayNode(todayIso);

      // Ensure sample initial content if today is empty
      const children = await db.nodes.getChildren(todayNode.id);
      if (children.length === 0) {
        const taskTag = await db.tags.getTagByName('task');
        const n1 = await db.nodes.create({
          parent_id: todayNode.id,
          content: 'Review Hecate System Architecture',
          position: 'a0',
        });
        if (taskTag) {
          await db.tags.applyTag(n1.id, taskTag.id);
        }

        await db.nodes.create({
          parent_id: todayNode.id,
          content: 'Explore universal references using [[',
          position: 'a1',
        });
      }

      const tasks = await db.ai.getTodayMiniTasks();

      // Initialize Reflection Engine (pure TS + optional AI wording)
      const settings = await db.settings.getSettings();
      let aiProvider;
      if (settings.aiProvider === 'anthropic' && settings.aiApiKey) {
        aiProvider = new AnthropicProvider(settings.aiApiKey, settings.aiModel, settings.aiEndpoint);
      } else if (settings.aiProvider === 'openai-compatible' && settings.aiApiKey) {
        aiProvider = new OpenAiProvider(settings.aiApiKey, settings.aiEndpoint, settings.aiModel);
      } else if (settings.aiProvider === 'ollama') {
        aiProvider = new OllamaProvider(settings.aiEndpoint, settings.aiModel);
      }

      const reflectionEngine = new DefaultReflectionEngine(adapter, aiProvider, {
        aiEnabled: Boolean(settings.aiConsentGiven),
      });

      const todayReflections = await reflectionEngine.getToday();
      const sourceNodeTitles = await resolveSourceTitles(db, todayReflections, {});

      reflectionEngine.on('changed', async () => {
        const refs = await reflectionEngine.getToday();
        const titles = await resolveSourceTitles(get().db, refs, get().sourceNodeTitles);
        set({ todayReflections: refs, sourceNodeTitles: titles, version: get().version + 1 });
      });

      set({
        db,
        reflectionEngine,
        todayReflections,
        sourceNodeTitles,
        isInitialized: true,
        initError: null,
        todayNodeId: todayNode.id,
        todayMiniTasks: tasks,
        activePanels: [{ id: 'panel-0', nodeId: todayNode.id, view: 'list', zoomPath: [] }],
        activePanelIndex: 0,
      });
    } catch (err: any) {
      console.error('Failed to initialize Hecate database:', err);
      set({
        initError: err?.message || String(err),
      });
    }
  },

  openNode: (nodeId: string, openInSidePanel = false) => {
    get().reflectionEngine?.markNodeOpened(nodeId);
    const { activePanels, activePanelIndex } = get();
    if (openInSidePanel) {
      if (activePanels.length < 3) {
        // Add new side panel
        const newPanel: PanelState = {
          id: `panel-${Date.now()}`,
          nodeId,
          view: 'list',
          zoomPath: [],
        };
        set({
          activePanels: [...activePanels, newPanel],
          activePanelIndex: activePanels.length,
          activeNav: 'panels',
        });
      } else {
        // Replace rightmost panel
        const updated = [...activePanels];
        updated[2] = { ...updated[2], nodeId, zoomPath: [] };
        set({ activePanels: updated, activePanelIndex: 2, activeNav: 'panels' });
      }
    } else {
      // Open in currently active panel
      const updated = [...activePanels];
      updated[activePanelIndex] = { ...updated[activePanelIndex], nodeId, zoomPath: [] };
      set({ activePanels: updated, activeNav: 'panels' });
    }

    // Restore persisted view preference for this node (REQ-5.3)
    const { db } = get();
    if (db) {
      db.nodes.getById(nodeId).then((n) => {
        const v = n?.meta?.viewConfig?.view;
        if (v && ['list', 'table', 'cards', 'calendar'].includes(v)) {
          const idx = get().activePanelIndex;
          const panels = [...get().activePanels];
          if (panels[idx] && panels[idx].nodeId === nodeId) {
            panels[idx] = { ...panels[idx], view: v };
            set({ activePanels: panels });
          }
        }
      });
    }
  },

  zoomInto: (panelIndex: number, nodeId: string) => {
    get().reflectionEngine?.markNodeOpened(nodeId);
    const { activePanels } = get();
    const panel = activePanels[panelIndex];
    if (!panel) return;
    if (panel.zoomPath[panel.zoomPath.length - 1] === nodeId) return;
    const updated = [...activePanels];
    updated[panelIndex] = { ...panel, zoomPath: [...panel.zoomPath, nodeId] };
    set({ activePanels: updated, activePanelIndex: panelIndex });
  },

  zoomToDepth: (panelIndex: number, depth: number) => {
    const { activePanels } = get();
    const panel = activePanels[panelIndex];
    if (!panel) return;
    const updated = [...activePanels];
    updated[panelIndex] = { ...panel, zoomPath: panel.zoomPath.slice(0, Math.max(0, depth)) };
    set({ activePanels: updated });
  },

  zoomOut: (panelIndex: number) => {
    const { activePanels } = get();
    const panel = activePanels[panelIndex];
    if (!panel || panel.zoomPath.length === 0) return;
    const updated = [...activePanels];
    updated[panelIndex] = { ...panel, zoomPath: panel.zoomPath.slice(0, -1) };
    set({ activePanels: updated });
  },

  togglePinNode: async (nodeId: string) => {
    const { db, version } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;
    const meta = { ...(node.meta || {}), pinned: !node.meta?.pinned };
    await db.adapter.execute('UPDATE node SET meta = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(meta),
      Date.now(),
      nodeId,
    ]);
    set({ version: version + 1 });
  },

  createSearchNode: async () => {
    const { db, version } = get();
    if (!db) throw new Error('DB not initialized');
    const created = await db.nodes.create({
      kind: 'search',
      content: 'Live search',
      meta: { query: { op: 'AND', clauses: [] } },
    });
    set({ version: version + 1 });
    get().openNode(created.id);
    return created;
  },

  updateSearchQuery: async (nodeId: string, query: any) => {
    const { db, version } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;
    const meta = { ...(node.meta || {}), query };
    await db.adapter.execute('UPDATE node SET meta = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(meta),
      Date.now(),
      nodeId,
    ]);
    set({ version: version + 1 });
  },

  setSelection: (ids, anchorId = null) => set({ selectedNodeIds: ids, selectionAnchorId: anchorId }),
  clearSelection: () => set({ selectedNodeIds: [], selectionAnchorId: null }),

  moveNodeTo: async (nodeId, newParentId, newPosition) => {
    const { db, version, undoStack } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;
    await db.nodes.moveNode(nodeId, newParentId, newPosition);
    undoStack.push({
      type: 'moveNode',
      nodeId,
      beforeParentId: node.parent_id,
      afterParentId: newParentId,
      beforePosition: node.position,
      afterPosition: newPosition,
    });
    set({ version: version + 1 });
  },

  setFieldValue: async (nodeId, fieldDefId, value) => {
    const { db, version } = get();
    if (!db) return;
    const children = await db.nodes.getChildren(nodeId);
    const fieldNode = children.find(
      (c) => c.kind === 'field' && c.meta?.fieldDefId === fieldDefId
    );
    if (!fieldNode) {
      await db.tags.addFieldToNode(nodeId, fieldDefId, value, false);
    } else {
      const values = await db.nodes.getChildren(fieldNode.id);
      if (values[0]) {
        await db.nodes.updateContent(values[0].id, value);
      } else {
        await db.nodes.create({
          parent_id: fieldNode.id,
          kind: 'fieldValue',
          content: value,
          position: 'a0',
        });
      }
    }
    set({ version: version + 1 });
  },

  copyNodesAsTanaPaste: async (nodeIds) => {
    const { db } = get();
    if (!db || nodeIds.length === 0) return;

    const exported: ExportableNode[] = [];
    for (const id of nodeIds) {
      const built = await buildExportableNode(db, id);
      if (built) exported.push(built);
    }
    await navigator.clipboard.writeText(serializeTanaPaste(exported));
  },

  exportAllAsTanaPaste: async () => {
    const { db } = get();
    if (!db) return '';
    const roots = await db.adapter.query<any>(
      "SELECT * FROM node WHERE parent_id IS NULL AND kind = 'content' AND deleted_at IS NULL ORDER BY position ASC"
    );
    const exported: ExportableNode[] = [];
    for (const r of roots) {
      const built = await buildExportableNode(db, r.id);
      if (built) exported.push(built);
    }
    return serializeTanaPaste(exported);
  },

  exportAllAsMarkdown: async () => {
    const { db } = get();
    if (!db) return '';
    const roots = await db.adapter.query<any>(
      "SELECT * FROM node WHERE parent_id IS NULL AND kind = 'content' AND deleted_at IS NULL ORDER BY position ASC"
    );
    const exported: ExportableNode[] = [];
    for (const r of roots) {
      const built = await buildExportableNode(db, r.id);
      if (built) exported.push(built);
    }
    return exportableToMarkdown(exported);
  },

  insertParsedNodes: async (nodes, parentId) => {
    const { db } = get();
    if (!db) return;

    for (const p of nodes) {
      // Resolve [[Title]] references to [[node:id]], creating missing targets (REQ-6.3)
      let content = p.content;
      const titleRefs = Array.from(content.matchAll(/\[\[([^\]\:][^\]]*)\]\]/g));
      for (const m of titleRefs) {
        const title = m[1];
        const existing = await db.adapter.query<any>(
          "SELECT * FROM node WHERE content = ? AND kind = 'content' AND deleted_at IS NULL LIMIT 1",
          [title]
        );
        const targetId = existing[0]?.id ?? (await db.nodes.create({ content: title })).id;
        content = content.split(m[0]).join(`[[node:${targetId}]]`);
      }

      const created = await get().createNode({ parent_id: parentId, content });
      if (p.isDone !== undefined) {
        await db.nodes.updateDone(created.id, p.isDone);
      }
      for (const tagName of p.tags) {
        let tagDef = await db.tags.getTagByName(tagName);
        if (!tagDef) {
          tagDef = await db.tags.createTag(tagName, { color: 'var(--accent)', showCheckbox: false });
        }
        await get().applyTag(created.id, tagDef.id);
      }
      for (const field of p.fields || []) {
        const isDate = /\[\[date:\d{4}-\d{2}-\d{2}\]\]/.test(field.value);
        const fieldDef = await db.tags.createFieldDef(field.name, {
          type: isDate ? 'date' : 'text',
        });
        await get().setFieldValue(created.id, fieldDef.id, field.value);
      }
      if (p.children && p.children.length > 0) {
        await get().insertParsedNodes(p.children, created.id);
      }
    }
  },

  importWorkspaceDump: async (dump) => {
    const { db, version } = get();
    if (!db) throw new Error('DB not initialized');
    const validationError = validateWorkspaceDump(dump);
    if (validationError) throw new Error(validationError);

    const remapped = remapWorkspaceDumpIds(dump, () => ulid());

    await db.adapter.transaction(async () => {
      for (const n of remapped.nodes) {
        await db.adapter.execute(
          `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, deleted_at, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            n.id,
            n.parent_id,
            n.position || 'a0',
            n.kind || 'content',
            n.content,
            n.collapsed || 0,
            n.done_at ?? null,
            n.created_at || Date.now(),
            n.updated_at || Date.now(),
            n.deleted_at ?? null,
            n.meta ?? null,
          ]
        );
      }
      for (const t of remapped.tags) {
        await db.adapter.execute(
          'INSERT OR IGNORE INTO node_tag (node_id, tag_def_id) VALUES (?, ?)',
          [t.node_id, t.tag_def_id]
        );
      }
      for (const r of remapped.refs) {
        await db.adapter.execute(
          'INSERT OR IGNORE INTO ref (source_node_id, target_node_id, kind) VALUES (?, ?, ?)',
          [r.source_node_id, r.target_node_id, r.kind || 'inline']
        );
      }
      for (const c of remapped.commands || []) {
        await db.adapter.execute(
          'INSERT OR IGNORE INTO command (id, name, description, steps, scope) VALUES (?, ?, ?, ?, ?)',
          [c.id, c.name, c.description ?? null, c.steps, c.scope ?? null]
        );
      }
    });

    set({ version: version + 1 });
  },

  loadSampleGraphData: async (scale = 'standard') => {
    const { db, version } = get();
    if (!db) return;

    if (scale === 'xl') {
      const { loadSampleXL } = await import('../components/graph/sampleXL');
      await loadSampleXL(db);
      set({ version: version + 1 });
      return;
    }

    // Idempotent: the whole demo lives under one root, so it loads only once
    // and can be deleted as a single subtree.
    const existing = await db.adapter.query<any>(
      "SELECT id FROM node WHERE content = 'Sample Workspace' AND deleted_at IS NULL"
    );
    if (existing.length > 0) return;

    const tagCache = new Map<string, string>();
    async function tagId(name: string): Promise<string> {
      if (tagCache.has(name)) return tagCache.get(name)!;
      let tag = await db!.tags.getTagByName(name);
      if (!tag) tag = await db!.tags.createTag(name, { color: '#c4b2ff', showCheckbox: name === 'task' });
      tagCache.set(name, tag.id);
      return tag.id;
    }

    async function mk(content: string, parentId: string, tagName?: string): Promise<NodeRecord> {
      const node = await db!.nodes.create({ parent_id: parentId, content });
      if (tagName) await db!.tags.applyTag(node.id, await tagId(tagName));
      return node;
    }

    const root = await db.nodes.create({ content: 'Sample Workspace' });

    // 1. Project cluster: 6 workstreams with tasks and subtasks
    const project = await mk('Hecate v1 (sample project)', root.id, 'project');
    const workstreams = ['Graph engine', 'Outliner', 'Supertags', 'AI coach', 'Mobile', 'Design system'];
    const taskPool: NodeRecord[] = [];
    for (const ws of workstreams) {
      const stream = await mk(ws, project.id, 'project');
      for (let i = 1; i <= 8; i++) {
        const task = await mk(`${ws} task ${i}`, stream.id, 'task');
        taskPool.push(task);
        const subCount = i % 3;
        for (let s = 1; s <= subCount; s++) {
          await mk(`Subtask ${s} of ${ws} task ${i}`, task.id);
        }
      }
    }

    // 2. Library cluster: books with chapter notes
    const library = await mk('Reading list (sample)', root.id);
    const bookTitles = [
      'Deep Work', 'Atomic Habits', 'The Pragmatic Programmer', 'Thinking in Systems',
      'Flow', 'The Design of Everyday Things', 'Sapiens', 'The Creative Act',
      'Building a Second Brain', 'How to Take Smart Notes', 'The Mother of All Demos', 'Gödel Escher Bach',
    ];
    const bookPool: NodeRecord[] = [];
    for (const title of bookTitles) {
      const book = await mk(title, library.id, 'book');
      bookPool.push(book);
      for (let c = 1; c <= 5; c++) {
        await mk(`Chapter ${c} notes`, book.id);
      }
    }

    // 3. People + meetings cluster
    const peopleRoot = await mk('People (sample)', root.id);
    const names = ['Maya', 'Jonas', 'Priya', 'Sam', 'Alex', 'Nina', 'Theo', 'Ravi', 'Lena', 'Omar', 'Iris', 'Kai'];
    const peoplePool: NodeRecord[] = [];
    for (const name of names) {
      peoplePool.push(await mk(name, peopleRoot.id, 'person'));
    }
    const meetingsRoot = await mk('Meetings (sample)', root.id);
    for (let i = 0; i < 18; i++) {
      const a = peoplePool[i % peoplePool.length];
      const b = peoplePool[(i + 5) % peoplePool.length];
      await mk(`Sync ${i + 1} with [[node:${a.id}]] and [[node:${b.id}]]`, meetingsRoot.id, 'meeting');
    }

    // 4. Daily notes for the last 14 days, cross-linked to tasks and books
    for (let d = 0; d < 14; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dayNode = await db.nodes.getOrCreateDayNode(formatDate(date));
      for (let j = 0; j < 5; j++) {
        const task = taskPool[(d * 5 + j) % taskPool.length];
        const book = bookPool[(d + j) % bookPool.length];
        await mk(`Worked on [[node:${task.id}]] and read [[node:${book.id}]]`, dayNode.id);
      }
    }

    // 5. Idea web: ideas referencing each other (dense reference mesh)
    const ideasRoot = await mk('Idea web (sample)', root.id);
    const ideaPool: NodeRecord[] = [];
    for (let i = 1; i <= 8; i++) {
      ideaPool.push(await mk(`Idea ${i}: fractal knowledge structures`, ideasRoot.id, 'idea'));
    }
    for (const idea of ideaPool) {
      for (let n = 1; n <= 5; n++) {
        const other = ideaPool[(ideaPool.indexOf(idea) + n) % ideaPool.length];
        await mk(`Note ${n} linking [[node:${idea.id}]] to [[node:${other.id}]]`, idea.id);
      }
    }

    set({ version: version + 1 });
  },

  requestDeleteNode: async (nodeId) => {
    const { db } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;
    const links = await db.refs.getBacklinks(nodeId);
    if (links.length > 0) {
      set({
        deleteConfirmInfo: {
          nodeId,
          refCount: links.length,
          title: node.content || 'Untitled Node',
        },
      });
      return;
    }
    await get().deleteNode(nodeId);
  },

  confirmDeleteNode: async () => {
    const { deleteConfirmInfo } = get();
    if (!deleteConfirmInfo) return;
    await get().deleteNode(deleteConfirmInfo.nodeId);
    set({ deleteConfirmInfo: null });
  },

  cancelDeleteNode: () => set({ deleteConfirmInfo: null }),

  setFocusedNode: (nodeId) => set({ focusedNodeId: nodeId }),
  requestMoveNodes: (nodeIds) => set({ moveRequestNodeIds: nodeIds }),
  cancelMove: () => set({ moveRequestNodeIds: null }),

  runBuiltinCommand: async (nodeId, commandId) => {
    const { db } = get();
    if (!db) return;
    const ctx = buildCommandContext(get, set);

    switch (commandId) {
      case 'set-due-today': {
        const due = await db.tags.createFieldDef('Due', { type: 'date' });
        await runCommand(
          nodeId,
          [{ type: 'setField', fieldDefId: due.id, value: `[[date:${formatDate(new Date())}]]` }],
          ctx
        );
        break;
      }
      case 'delay-one-day':
      case 'delay-one-week': {
        const due = await db.tags.createFieldDef('Due', { type: 'date' });
        await runCommand(
          nodeId,
          [
            {
              type: 'shiftDate',
              fieldDefId: due.id,
              days: commandId === 'delay-one-day' ? 1 : 7,
            },
          ],
          ctx
        );
        break;
      }
      case 'status-done': {
        const status = await db.tags.createFieldDef('Status', { type: 'options' });
        await runCommand(nodeId, [{ type: 'setField', fieldDefId: status.id, value: 'Done' }], ctx);
        break;
      }
      case 'toggle-done':
        await get().toggleDone(nodeId);
        break;
      case 'duplicate':
        await get().duplicateNode(nodeId);
        break;
      case 'copy-tana-paste':
        await get().copyNodesAsTanaPaste([nodeId]);
        break;
      case 'move-to':
        set({ moveRequestNodeIds: [nodeId] });
        break;
    }
  },

  runCustomCommand: async (nodeId, command) => {
    const steps: CommandStep[] =
      typeof (command as any).steps === 'string'
        ? JSON.parse((command as any).steps)
        : command.steps;
    await runCommand(nodeId, steps, buildCommandContext(get, set));
  },

  duplicateNode: async (nodeId) => {
    const { db, version } = get();
    if (!db) return null;

    async function copySubtree(id: string, parentId: string | null, position: string) {
      if (!db) return null;
      const src = await db.nodes.getById(id);
      if (!src) return null;
      const created = await db.nodes.create({
        parent_id: parentId,
        kind: src.kind,
        content: src.content,
        position,
        meta: src.meta ?? undefined,
      });
      const tags = await db.tags.getTagsForNode(id);
      for (const t of tags) {
        await db.tags.applyTag(created.id, t.id);
      }
      const children = await db.nodes.getChildren(id);
      for (const c of children) {
        await copySubtree(c.id, created.id, c.position);
      }
      return created;
    }

    const src = await db.nodes.getById(nodeId);
    if (!src) return null;
    const siblings = await db.nodes.getChildren(src.parent_id);
    const idx = siblings.findIndex((s) => s.id === nodeId);
    const nextPos = idx < siblings.length - 1 ? siblings[idx + 1].position : null;
    const dup = await copySubtree(nodeId, src.parent_id, generateKeyBetween(src.position, nextPos));
    set({ version: version + 1 });
    return dup;
  },

  closePanel: (index: number) => {
    const { activePanels } = get();
    if (activePanels.length <= 1) return;
    const updated = activePanels.filter((_, i) => i !== index);
    set({
      activePanels: updated,
      activePanelIndex: Math.max(0, index - 1),
    });
  },

  setPanelView: (panelIndex: number, view: 'list' | 'table' | 'cards' | 'calendar') => {
    const { activePanels, db } = get();
    const updated = [...activePanels];
    if (updated[panelIndex]) {
      updated[panelIndex] = { ...updated[panelIndex], view };
      set({ activePanels: updated });

      // Persist the chosen view per node (REQ-5.3)
      const rootId = updated[panelIndex].nodeId;
      if (db && rootId) {
        db.nodes.getById(rootId).then((n) => {
          if (!n) return;
          const meta = {
            ...(n.meta || {}),
            viewConfig: { ...(n.meta?.viewConfig || {}), view },
          };
          db.adapter.execute('UPDATE node SET meta = ? WHERE id = ?', [
            JSON.stringify(meta),
            rootId,
          ]);
        });
      }
    }
  },

  jumpToToday: () => {
    const { todayNodeId, openNode } = get();
    if (todayNodeId) {
      openNode(todayNodeId);
    }
  },

  setOmnibarOpen: (open: boolean) => set({ omnibarOpen: open }),
  setShortcutsModalOpen: (open: boolean) => set({ shortcutsModalOpen: open }),
  setConsentModalOpen: (open: boolean) => set({ consentModalOpen: open }),
  setDigestInspectOpen: (open: boolean) => set({ digestInspectOpen: open }),

  createNode: async ({ parent_id = null, content = '' }: { parent_id?: string | null; content?: string }) => {
    const { db, version } = get();
    if (!db) throw new Error('DB not initialized');
    const children = await db.nodes.getChildren(parent_id);
    const lastPos = children.length > 0 ? children[children.length - 1].position : null;
    const newPos = generateKeyBetween(lastPos, null);
    const created = await db.nodes.create({
      parent_id,
      position: newPos,
      content,
    });
    if (parent_id) {
      await db.nodes.updateCollapsed(parent_id, false);
    }
    get().reflectionEngine?.markNodeDirty(created.id);
    if (parent_id) get().reflectionEngine?.markNodeDirty(parent_id);
    set({ version: version + 1 });
    return created;
  },

  toggleDone: async (nodeId: string) => {
    const { db, undoStack, version, reflectionEngine } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;

    const newDone = !node.done_at;
    await db.nodes.updateDone(nodeId, newDone);
    reflectionEngine?.markNodeDirty(nodeId);

    undoStack.push({
      type: 'setDone',
      nodeId,
      before: node.done_at,
      after: newDone ? Date.now() : null,
    });

    set({ version: version + 1 });
  },

  toggleCollapse: async (nodeId: string) => {
    const { db, undoStack, version } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;

    const newCollapsed = node.collapsed ? 0 : 1;
    await db.nodes.updateCollapsed(nodeId, newCollapsed === 1);

    undoStack.push({
      type: 'setCollapsed',
      nodeId,
      before: node.collapsed,
      after: newCollapsed,
    });

    set({ version: version + 1 });
  },

  updateNodeContent: async (nodeId: string, content: string) => {
    const { db, undoStack, version, reflectionEngine } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node || node.content === content) return;

    await db.nodes.updateContent(nodeId, content);
    reflectionEngine?.markNodeDirty(nodeId);

    undoStack.push({
      type: 'updateContent',
      nodeId,
      before: node.content,
      after: content,
    });

    const { sourceNodeTitles } = get();
    if (sourceNodeTitles[nodeId] !== undefined) {
      set({
        sourceNodeTitles: {
          ...sourceNodeTitles,
          [nodeId]: content.trim() || 'Untitled Node',
        },
        version: version + 1,
      });
    } else {
      set({ version: version + 1 });
    }
  },

  createSiblingNode: async (refNodeId: string, content = '') => {
    const { db, version } = get();
    if (!db) throw new Error('DB not initialized');
    const refNode = await db.nodes.getById(refNodeId);
    if (!refNode) throw new Error('Reference node not found');

    const siblings = await db.nodes.getChildren(refNode.parent_id);
    const refIdx = siblings.findIndex((s) => s.id === refNodeId);

    const prevPos = refNode.position;
    const nextPos = refIdx < siblings.length - 1 ? siblings[refIdx + 1].position : null;
    const newPos = generateKeyBetween(prevPos, nextPos);

    const created = await db.nodes.create({
      parent_id: refNode.parent_id,
      position: newPos,
      content,
    });

    set({ version: version + 1 });
    return created;
  },

  createChildNode: async (parentId: string, content = '') => {
    const { db, version } = get();
    if (!db) throw new Error('DB not initialized');

    const children = await db.nodes.getChildren(parentId);
    const lastPos = children.length > 0 ? children[children.length - 1].position : null;
    const newPos = generateKeyBetween(lastPos, null);

    const created = await db.nodes.create({
      parent_id: parentId,
      position: newPos,
      content,
    });

    // Expand parent if collapsed
    await db.nodes.updateCollapsed(parentId, false);

    set({ version: version + 1 });
    return created;
  },

  indentNode: async (nodeId: string) => {
    const { db, version, undoStack } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;

    const siblings = await db.nodes.getChildren(node.parent_id);
    const nodeIdx = siblings.findIndex((s) => s.id === nodeId);
    if (nodeIdx <= 0) return; // Cannot indent if first child

    const prevSibling = siblings[nodeIdx - 1];
    const newParentId = prevSibling.id;

    // Get children of new parent to place at the end
    const targetChildren = await db.nodes.getChildren(newParentId);
    const lastPos = targetChildren.length > 0 ? targetChildren[targetChildren.length - 1].position : null;
    const newPos = generateKeyBetween(lastPos, null);

    await db.nodes.moveNode(nodeId, newParentId, newPos);
    await db.nodes.updateCollapsed(newParentId, false);

    undoStack.push({
      type: 'moveNode',
      nodeId,
      beforeParentId: node.parent_id,
      afterParentId: newParentId,
      beforePosition: node.position,
      afterPosition: newPos,
    });

    set({ version: version + 1 });
  },

  outdentNode: async (nodeId: string) => {
    const { db, version, undoStack } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node || !node.parent_id) return; // Cannot outdent root

    const currentParent = await db.nodes.getById(node.parent_id);
    if (!currentParent) return;

    const grandParentId = currentParent.parent_id;
    const parentSiblings = await db.nodes.getChildren(grandParentId);
    const parentIdx = parentSiblings.findIndex((s) => s.id === currentParent.id);

    const prevPos = currentParent.position;
    const nextPos = parentIdx < parentSiblings.length - 1 ? parentSiblings[parentIdx + 1].position : null;
    const newPos = generateKeyBetween(prevPos, nextPos);

    await db.nodes.moveNode(nodeId, grandParentId, newPos);

    undoStack.push({
      type: 'moveNode',
      nodeId,
      beforeParentId: currentParent.id,
      afterParentId: grandParentId,
      beforePosition: node.position,
      afterPosition: newPos,
    });

    set({ version: version + 1 });
  },

  moveSibling: async (nodeId: string, direction: 'up' | 'down') => {
    const { db, version, undoStack } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;

    const siblings = await db.nodes.getChildren(node.parent_id);
    const idx = siblings.findIndex((s) => s.id === nodeId);
    if (idx === -1) return;

    if (direction === 'up' && idx > 0) {
      const prevPrevPos = idx > 1 ? siblings[idx - 2].position : null;
      const targetPos = generateKeyBetween(prevPrevPos, siblings[idx - 1].position);
      await db.nodes.moveNode(nodeId, node.parent_id, targetPos);
      undoStack.push({
        type: 'moveNode',
        nodeId,
        beforeParentId: node.parent_id,
        afterParentId: node.parent_id,
        beforePosition: node.position,
        afterPosition: targetPos,
      });
    } else if (direction === 'down' && idx < siblings.length - 1) {
      const nextNextPos = idx < siblings.length - 2 ? siblings[idx + 2].position : null;
      const targetPos = generateKeyBetween(siblings[idx + 1].position, nextNextPos);
      await db.nodes.moveNode(nodeId, node.parent_id, targetPos);
      undoStack.push({
        type: 'moveNode',
        nodeId,
        beforeParentId: node.parent_id,
        afterParentId: node.parent_id,
        beforePosition: node.position,
        afterPosition: targetPos,
      });
    }

    set({ version: version + 1 });
  },

  deleteNode: async (nodeId: string) => {
    const { db, version } = get();
    if (!db) return;
    await db.nodes.deleteNode(nodeId);
    set({ version: version + 1 });
  },

  permanentlyDeleteNode: async (nodeId: string) => {
    const { db, version } = get();
    if (!db) return;
    await db.nodes.permanentlyDeleteNode(nodeId);
    set({ version: version + 1 });
  },

  emptyTrash: async () => {
    const { db, version } = get();
    if (!db) return;
    await db.nodes.emptyTrash();
    set({ version: version + 1 });
  },

  applyTag: async (nodeId: string, tagDefId: string) => {
    const { db, version, undoStack } = get();
    if (!db) return;
    await db.tags.applyTag(nodeId, tagDefId);
    undoStack.push({ type: 'addTag', nodeId, tagId: tagDefId });
    set({ version: version + 1 });
  },

  removeTag: async (nodeId: string, tagDefId: string) => {
    const { db, version, undoStack } = get();
    if (!db) return;
    await db.tags.removeTag(nodeId, tagDefId);
    undoStack.push({ type: 'removeTag', nodeId, tagId: tagDefId });
    set({ version: version + 1 });
  },

  runAiCoaching: async () => {
    const { reflectionEngine } = get();
    if (!reflectionEngine) return;
    set({ isAiRunning: true });
    try {
      const today = await reflectionEngine.refresh({ reason: 'manual' });
      const titles = await resolveSourceTitles(get().db, today, get().sourceNodeTitles);
      set({ todayReflections: today, sourceNodeTitles: titles, isAiRunning: false, version: get().version + 1 });
    } catch (e) {
      console.error(e);
      set({ isAiRunning: false });
    }
  },

  actReflection: async (id: string, action: UserAction) => {
    const { reflectionEngine } = get();
    if (!reflectionEngine) return;
    const res = await reflectionEngine.act(id, action);
    const today = await reflectionEngine.getToday();
    const titles = await resolveSourceTitles(get().db, today, get().sourceNodeTitles);
    set({ todayReflections: today, sourceNodeTitles: titles, version: get().version + 1 });
    return res;
  },

  undoReflection: async () => {
    const { reflectionEngine } = get();
    if (!reflectionEngine) return;
    await reflectionEngine.act('', { type: 'undo' });
    const today = await reflectionEngine.getToday();
    const titles = await resolveSourceTitles(get().db, today, get().sourceNodeTitles);
    set({ todayReflections: today, sourceNodeTitles: titles, version: get().version + 1 });
  },

  refreshReflections: async () => {
    const { reflectionEngine } = get();
    if (!reflectionEngine) return;
    set({ isAiRunning: true });
    try {
      const today = await reflectionEngine.refresh({ reason: 'manual' });
      const titles = await resolveSourceTitles(get().db, today, get().sourceNodeTitles);
      set({ todayReflections: today, sourceNodeTitles: titles, isAiRunning: false, version: get().version + 1 });
    } catch (e) {
      console.error(e);
      set({ isAiRunning: false });
    }
  },

  updateMiniTaskStatus: async (id: string, status: any) => {
    const { db } = get();
    if (!db) return;
    await db.ai.updateMiniTaskStatus(id, status);
    const tasks = await db.ai.getTodayMiniTasks();
    set({ todayMiniTasks: tasks });
  },

  saveMiniTaskAsNode: async (task: MiniTaskRecord) => {
    const { db, todayNodeId, version } = get();
    if (!db || !todayNodeId) return;

    const taskTag = await db.tags.getTagByName('task');
    const created = await db.nodes.create({
      parent_id: todayNodeId,
      content: task.title,
    });

    if (taskTag) {
      await db.tags.applyTag(created.id, taskTag.id);
    }

    await db.ai.updateMiniTaskStatus(task.id, 'saved');
    const tasks = await db.ai.getTodayMiniTasks();
    set({ todayMiniTasks: tasks, version: version + 1 });
  },

  undo: async () => {
    const { undoStack, db, version } = get();
    if (!db || !undoStack.canUndo()) return;
    const op = undoStack.undo();
    if (!op) return;

    if (op.type === 'updateContent') {
      await db.nodes.updateContent(op.nodeId, op.before);
    } else if (op.type === 'moveNode') {
      await db.nodes.moveNode(op.nodeId, op.beforeParentId, op.beforePosition);
    } else if (op.type === 'setDone') {
      await db.nodes.updateDone(op.nodeId, op.before !== null);
    } else if (op.type === 'setCollapsed') {
      await db.nodes.updateCollapsed(op.nodeId, op.before === 1);
    } else if (op.type === 'addTag') {
      await db.tags.applyTag(op.nodeId, op.tagId);
    } else if (op.type === 'removeTag') {
      await db.tags.removeTag(op.nodeId, op.tagId);
    }

    set({ version: version + 1 });
  },

  redo: async () => {
    const { undoStack, db, version } = get();
    if (!db || !undoStack.canRedo()) return;
    const op = undoStack.redo();
    if (!op) return;

    if (op.type === 'updateContent') {
      await db.nodes.updateContent(op.nodeId, op.after);
    } else if (op.type === 'moveNode') {
      await db.nodes.moveNode(op.nodeId, op.afterParentId, op.afterPosition);
    } else if (op.type === 'setDone') {
      await db.nodes.updateDone(op.nodeId, op.after !== null);
    } else if (op.type === 'setCollapsed') {
      await db.nodes.updateCollapsed(op.nodeId, op.after === 1);
    } else if (op.type === 'addTag') {
      await db.tags.applyTag(op.nodeId, op.tagId);
    } else if (op.type === 'removeTag') {
      await db.tags.removeTag(op.nodeId, op.tagId);
    }

    set({ version: version + 1 });
  },
}));
