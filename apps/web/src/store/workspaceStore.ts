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
} from '@hecate/core';
import { HecateDatabase, MemoryStorageAdapter } from '@hecate/storage';
import { CoachEngine, MockProvider, AnthropicProvider, OpenAiProvider, OllamaProvider } from '@hecate/ai';

export interface PanelState {
  id: string;
  nodeId: string;
  view: 'list' | 'table' | 'cards' | 'calendar';
}

export interface WorkspaceState {
  db: HecateDatabase | null;
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

  // Actions
  init: () => Promise<void>;
  openNode: (nodeId: string, openInSidePanel?: boolean) => void;
  closePanel: (index: number) => void;
  setPanelView: (panelIndex: number, view: 'list' | 'table' | 'cards' | 'calendar') => void;
  jumpToToday: () => void;
  setOmnibarOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setConsentModalOpen: (open: boolean) => void;
  setDigestInspectOpen: (open: boolean) => void;

  // Node Mutations
  toggleDone: (nodeId: string) => Promise<void>;
  toggleCollapse: (nodeId: string) => Promise<void>;
  updateNodeContent: (nodeId: string, content: string) => Promise<void>;
  createSiblingNode: (refNodeId: string, content?: string) => Promise<NodeRecord>;
  createChildNode: (parentId: string, content?: string) => Promise<NodeRecord>;
  indentNode: (nodeId: string) => Promise<void>;
  outdentNode: (nodeId: string) => Promise<void>;
  moveSibling: (nodeId: string, direction: 'up' | 'down') => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  db: null,
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

      set({
        db,
        isInitialized: true,
        initError: null,
        todayNodeId: todayNode.id,
        todayMiniTasks: tasks,
        activePanels: [{ id: 'panel-0', nodeId: todayNode.id, view: 'list' }],
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
    const { activePanels, activePanelIndex } = get();
    if (openInSidePanel) {
      if (activePanels.length < 3) {
        // Add new side panel
        const newPanel: PanelState = {
          id: `panel-${Date.now()}`,
          nodeId,
          view: 'list',
        };
        set({
          activePanels: [...activePanels, newPanel],
          activePanelIndex: activePanels.length,
        });
      } else {
        // Replace rightmost panel
        const updated = [...activePanels];
        updated[2] = { ...updated[2], nodeId };
        set({ activePanels: updated, activePanelIndex: 2 });
      }
    } else {
      // Open in currently active panel
      const updated = [...activePanels];
      updated[activePanelIndex] = { ...updated[activePanelIndex], nodeId };
      set({ activePanels: updated });
    }
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
    const { activePanels } = get();
    const updated = [...activePanels];
    if (updated[panelIndex]) {
      updated[panelIndex] = { ...updated[panelIndex], view };
      set({ activePanels: updated });
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

  toggleDone: async (nodeId: string) => {
    const { db, undoStack, version } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node) return;

    const newDone = !node.done_at;
    await db.nodes.updateDone(nodeId, newDone);

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
    const { db, undoStack, version } = get();
    if (!db) return;
    const node = await db.nodes.getById(nodeId);
    if (!node || node.content === content) return;

    await db.nodes.updateContent(nodeId, content);

    undoStack.push({
      type: 'updateContent',
      nodeId,
      before: node.content,
      after: content,
    });

    set({ version: version + 1 });
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
    const { db } = get();
    if (!db) return;
    const settings = await db.settings.getSettings();

    if (!settings.aiEnabled) {
      set({ consentModalOpen: true });
      return;
    }

    set({ isAiRunning: true });
    try {
      let provider;
      if (settings.aiProvider === 'anthropic' && settings.aiApiKey) {
        provider = new AnthropicProvider(settings.aiApiKey, settings.aiModel, settings.aiEndpoint);
      } else if (settings.aiProvider === 'openai-compatible' && settings.aiApiKey) {
        provider = new OpenAiProvider(settings.aiApiKey, settings.aiEndpoint, settings.aiModel);
      } else if (settings.aiProvider === 'ollama') {
        provider = new OllamaProvider(settings.aiEndpoint, settings.aiModel);
      } else {
        provider = new MockProvider();
      }

      const engine = new CoachEngine(db);
      const result = await engine.runCoaching(provider);
      const tasks = await db.ai.getTodayMiniTasks();

      set({
        todayMiniTasks: tasks,
        lastDigestPayload: result.digestPayload,
        isAiRunning: false,
      });
    } catch (err) {
      console.error('Coaching failed:', err);
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
