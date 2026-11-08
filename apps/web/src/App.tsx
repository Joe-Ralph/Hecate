import React, { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { Sidebar } from './components/Sidebar';
import { Panel } from './components/Panel';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { CalendarPage } from './pages/CalendarPage';
import { GraphPage } from './pages/GraphPage';
import { ReflectionsPage } from './pages/ReflectionsPage';
import { TrashPage } from './pages/TrashPage';
import { SettingsPage } from './pages/SettingsPage';
import {
  Omnibar,
  OmnibarItem,
  ShortcutsModal,
  CoachRail,
  StatusBar,
  AppLoader,
} from '@hecate/ui';
import { ConsentModal } from './components/ConsentModal';
import { DigestInspectModal } from './components/DigestInspectModal';
import { NodePickerModal } from './components/NodePickerModal';
import { TagPickerModal } from './components/TagPickerModal';
import { SupertagModal } from './components/SupertagModal';
import { FieldPickerModal } from './components/FieldPickerModal';
import { OnboardingTour } from './components/OnboardingTour';
import { MiniTaskRecord, generateKeyBetween, BUILTIN_COMMANDS, CommandRecord, SettingsMap } from '@hecate/core';

type NavId = 'home' | 'panels' | 'library' | 'calendar' | 'graph' | 'reflections' | 'trash' | 'settings';

// Hash-based routes so browser Back/Forward navigates inside the app
const NAV_HASHES: Record<NavId, string> = {
  home: '#/today',
  panels: '#/panels',
  library: '#/library',
  calendar: '#/calendar',
  graph: '#/graph',
  reflections: '#/reflections',
  trash: '#/trash',
  settings: '#/settings',
};

function navFromHash(hash: string): NavId | null {
  const entry = (Object.entries(NAV_HASHES) as [NavId, string][]).find(([, h]) => h === hash);
  return entry ? entry[0] : null;
}

export const App: React.FC = () => {
  const store = useWorkspaceStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [coachRailCollapsed, setCoachRailCollapsed] = useState(false);
  const activeNav = store.activeNav;
  const setActiveNav = store.setActiveNav;

  // Active pickers & modals
  const [nodePickerTargetId, setNodePickerTargetId] = useState<string | null>(null);
  const [tagPickerTargetId, setTagPickerTargetId] = useState<string | null>(null);
  const [fieldPickerTargetId, setFieldPickerTargetId] = useState<string | null>(null);
  const [customCommands, setCustomCommands] = useState<CommandRecord[]>([]);
  const [focusedNodeTagIds, setFocusedNodeTagIds] = useState<string[]>([]);
  const [supertagModalConfig, setSupertagModalConfig] = useState<{
    isOpen: boolean;
    tagId?: string | null;
    initialName?: string;
  }>({ isOpen: false });

  // Active timer pill state
  const [activeTimerLabel, setActiveTimerLabel] = useState<string | null>(null);
  const [aiSettings, setAiSettings] = useState<{ aiEnabled: boolean }>({ aiEnabled: true });

  // Initialize workspace
  useEffect(() => {
    store.init();
  }, []);

  // URL -> nav: honor the hash on load, and follow browser Back/Forward
  useEffect(() => {
    const initial = navFromHash(window.location.hash);
    if (initial) {
      store.setActiveNav(initial);
    } else {
      window.history.replaceState(null, '', NAV_HASHES.home);
    }

    const onPopState = () => {
      store.setActiveNav(navFromHash(window.location.hash) || 'home');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Nav -> URL: every in-app navigation gets its own history entry
  const lastNavRef = useRef(store.activeNav);
  useEffect(() => {
    if (lastNavRef.current === activeNav) return; // initial mount / no change
    lastNavRef.current = activeNav;
    const target = NAV_HASHES[activeNav as NavId] || NAV_HASHES.home;
    if (window.location.hash !== target) {
      window.history.pushState(null, '', target);
    }
  }, [activeNav]);

  // Sync AI settings
  const [appSettings, setAppSettings] = useState<SettingsMap>({});
  useEffect(() => {
    if (store.db) {
      store.db.settings.getSettings().then((s) => {
        setAiSettings({ aiEnabled: Boolean(s.aiEnabled ?? true) });
        setAppSettings(s);
      });
    }
  }, [store.db, store.version]);

  // Daily mini-task notification at the user-set time (REQ-AI-8)
  useEffect(() => {
    const time = appSettings.aiNotificationTime;
    if (!time) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      const [h, m] = time.split(':').map(Number);
      const next = new Date();
      next.setHours(h, m, 0, 0);
      if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
      timer = setTimeout(async () => {
        if (cancelled) return;
        if ('Notification' in window) {
          if (Notification.permission === 'default') {
            await Notification.requestPermission();
          }
          if (Notification.permission === 'granted') {
            new Notification('Hecate', {
              body: 'Your daily mini-tasks are ready. Take a small step today.',
            });
          }
        }
        useWorkspaceStore.getState().refreshReflections();
        schedule();
      }, next.getTime() - Date.now());
    };
    schedule();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [appSettings.aiNotificationTime]);
  useEffect(() => {
    const theme = appSettings.theme || 'dark';
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark'
        : theme;
    document.documentElement.dataset.theme = resolved;
    if (appSettings.accentColor) {
      document.documentElement.style.setProperty('--accent', appSettings.accentColor);
    } else {
      document.documentElement.style.removeProperty('--accent');
    }
    const root = document.getElementById('root');
    if (root) {
      root.style.zoom = appSettings.fontSize ? String(appSettings.fontSize / 16) : '';
    }
  }, [appSettings]);

  // Custom node commands (REQ-6.2)
  useEffect(() => {
    if (!store.db) return;
    store.db.adapter.query<any>('SELECT * FROM command ORDER BY name ASC').then((rows) =>
      setCustomCommands(
        rows.map((r) => ({ ...r, steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps }))
      )
    );
  }, [store.db, store.version]);

  // Tags of the focused node, for tag-scoped command visibility
  useEffect(() => {
    if (!store.db || !store.focusedNodeId) {
      setFocusedNodeTagIds([]);
      return;
    }
    store.db.tags.getTagsForNode(store.focusedNodeId).then((t) => {
      setFocusedNodeTagIds(t.map((x) => x.id));
    });
  }, [store.db, store.focusedNodeId, store.version]);

  // Omnibar full-text search state (hooks must live above the early returns)
  const [nodeSearchItems, setNodeSearchItems] = useState<OmnibarItem[]>([]);
  const [omnibarTags, setOmnibarTags] = useState<Array<{ id: string; name: string }>>([]);
  const [searchTagFilter, setSearchTagFilter] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOmnibarQueryRef = useRef('');

  useEffect(() => {
    if (!store.db) return;
    store.db.tags.getAllTags().then((tags) => {
      setOmnibarTags(tags.map((t) => ({ id: t.id, name: t.content })));
    });
  }, [store.db]);

  const runNodeSearch = async (q: string, tagId: string | null) => {
    if (!store.db || !q.trim()) {
      setNodeSearchItems([]);
      return;
    }
    const results = await store.db.search.globalSearch(q, { tagId: tagId ?? undefined });
    setNodeSearchItems(
      results.map((n) => ({
        id: `node-${n.id}`,
        group: 'NODES' as const,
        title: n.content.trim() || 'Untitled Node',
        subtitle: n.kind,
        onSelect: () => store.openNode(n.id),
        onSelectSplit: () => store.openNode(n.id, true),
      }))
    );
  };

  const handleOmnibarSearch = (q: string) => {
    lastOmnibarQueryRef.current = q;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim() || !store.db) {
      setNodeSearchItems([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      runNodeSearch(q, searchTagFilter);
    }, 150);
  };

  // Auto-collapse coach rail if 2 or more panels are open (Section 3.1)
  useEffect(() => {
    if (activeNav === 'panels' && store.activePanels.length >= 2) {
      setCoachRailCollapsed(true);
    }
  }, [store.activePanels.length, activeNav]);

  // Global keyboard shortcuts (Section 4.3)
  useEffect(() => {
    let gKeySequence = false;
    let gKeyTimer: any = null;

    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName;
      const isInput =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Cmd/Ctrl+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        store.setOmnibarOpen(true);
        return;
      }

      // Cmd/Ctrl+\: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
        return;
      }

      // Cmd/Ctrl+Shift+\: Toggle coach rail
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === '\\' || e.key === '|')) {
        e.preventDefault();
        setCoachRailCollapsed((prev) => !prev);
        return;
      }

      // Alt+T: Go to Today
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        store.jumpToToday();
        setActiveNav('home');
        return;
      }

      // Alt+Left: Zoom out one level in the active panel
      if (e.altKey && e.key === 'ArrowLeft') {
        const ws = useWorkspaceStore.getState();
        if (ws.activeNav === 'panels') {
          e.preventDefault();
          ws.zoomOut(ws.activePanelIndex);
        }
        return;
      }

      // ?: Cheat sheet
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        store.setShortcutsModalOpen(true);
        return;
      }

      // Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          store.redo();
        } else {
          e.preventDefault();
          store.undo();
        }
        return;
      }

      // G then L / R (Sequential navigation)
      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'g') {
          gKeySequence = true;
          clearTimeout(gKeyTimer);
          gKeyTimer = setTimeout(() => {
            gKeySequence = false;
          }, 1000);
          return;
        }
        if (gKeySequence) {
          if (e.key.toLowerCase() === 'l') {
            e.preventDefault();
            setActiveNav('library');
            gKeySequence = false;
          } else if (e.key.toLowerCase() === 'c') {
            e.preventDefault();
            setActiveNav('calendar');
            gKeySequence = false;
          } else if (e.key.toLowerCase() === 'g') {
            e.preventDefault();
            setActiveNav('graph');
            gKeySequence = false;
          } else if (e.key.toLowerCase() === 'r') {
            e.preventDefault();
            setActiveNav('reflections');
            gKeySequence = false;
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(gKeyTimer);
    };
  }, []);

  if (store.initError) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)] font-sans p-6 select-none">
        <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--red)] rounded-[10px] p-6 text-center shadow-2xl">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--red)] mb-2">
            Storage Initialization Error
          </div>
          <div className="text-[15px] text-[var(--text-primary)] font-semibold mb-3">
            Failed to initialize SQLite storage engine
          </div>
          <div className="text-[12px] font-mono text-[var(--text-muted)] bg-[var(--bg-raised)] p-3 rounded-[6px] border border-[var(--border-subtle)] mb-4 text-left overflow-auto max-h-32 select-text">
            {store.initError}
          </div>
          <button
            type="button"
            onClick={() => store.init()}
            className="h-9 px-4 bg-[var(--accent)] text-[var(--bg-app)] text-[13px] font-medium rounded-[8px] hover:bg-[var(--accent-hover)] cursor-pointer"
          >
            Retry Initialization
          </button>
        </div>
      </div>
    );
  }

  if (!store.isInitialized) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[var(--bg-app)] text-[var(--text-primary)] font-sans">
        <div className="w-64 text-center space-y-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)]">
            Hecate Outliner
          </div>
          <AppLoader mode="cursor" label="INITIALIZING STORAGE" />
        </div>
      </div>
    );
  }

  // Omnibar Items
  const omnibarItems: OmnibarItem[] = [
    // Node commands on the focused node (REQ-6.2)
    ...(store.focusedNodeId
      ? [
          ...BUILTIN_COMMANDS.map((c) => ({
            id: `builtin-${c.id}`,
            group: 'COMMANDS' as const,
            title: c.name,
            subtitle: c.description,
            onSelect: () => store.runBuiltinCommand(store.focusedNodeId!, c.id),
          })),
          ...customCommands
            .filter((cc) => !cc.scope || focusedNodeTagIds.includes(cc.scope))
            .map((cc) => ({
              id: `custom-${cc.id}`,
              group: 'COMMANDS' as const,
              title: cc.name,
              subtitle: cc.description || 'Custom command',
              onSelect: () => store.runCustomCommand(store.focusedNodeId!, cc),
            })),
        ]
      : []),
    {
      id: 'cmd-today',
      group: 'NAVIGATION',
      title: "Today's Daily Note",
      shortcut: '⌥T',
      onSelect: () => {
        store.jumpToToday();
        setActiveNav('home');
      },
    },
    {
      id: 'cmd-coach',
      group: 'COMMANDS',
      title: 'Run AI Mini-Task Coach',
      subtitle: 'Synthesizes knowledge digest and recommends actions',
      shortcut: '⌘R',
      onSelect: () => store.runAiCoaching(),
    },
    {
      id: 'cmd-library',
      group: 'NAVIGATION',
      title: 'Open Library',
      shortcut: 'G then L',
      onSelect: () => setActiveNav('library'),
    },
    {
      id: 'cmd-calendar',
      group: 'NAVIGATION',
      title: 'Open Calendar',
      shortcut: 'G then C',
      onSelect: () => setActiveNav('calendar'),
    },
    {
      id: 'cmd-graph',
      group: 'NAVIGATION',
      title: 'Open Graph',
      shortcut: 'G then G',
      onSelect: () => setActiveNav('graph'),
    },
    {
      id: 'cmd-reflections',
      group: 'NAVIGATION',
      title: 'Open Reflections',
      shortcut: 'G then R',
      onSelect: () => setActiveNav('reflections'),
    },
    {
      id: 'cmd-create-search',
      group: 'COMMANDS',
      title: 'Create live search',
      subtitle: 'A saved query that updates as your workspace changes',
      onSelect: () => {
        store.createSearchNode();
      },
    },
    {
      id: 'cmd-shortcuts',
      group: 'COMMANDS',
      title: 'Keyboard Shortcuts Cheat Sheet',
      shortcut: '?',
      onSelect: () => store.setShortcutsModalOpen(true),
    },
  ];

  const handlePromoteTask = (task: MiniTaskRecord) => {
    // Reorder tasks so this task is at index 0
    const current = [...store.todayMiniTasks];
    const idx = current.findIndex((t) => t.id === task.id);
    if (idx > 0) {
      const [item] = current.splice(idx, 1);
      current.unshift(item);
      useWorkspaceStore.setState({ todayMiniTasks: current });
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] select-none font-sans">
      {/* Column 1: Sidebar (232px / 56px) */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeNav={activeNav}
        onSelectNav={(nav) => {
          if (nav === 'today') {
            setActiveNav('home');
            store.jumpToToday();
          } else {
            setActiveNav(nav as any);
          }
        }}
      />

      {/* Column 2: Main Work Column with Status Bar */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-app)] overflow-hidden">
        {/* Scrollable Center Work Area */}
        <main className="flex-1 min-w-0 h-full flex overflow-hidden select-text">
          {activeNav === 'home' && (
            <HomePage
              onOpenNodePicker={(nid) => setNodePickerTargetId(nid)}
              onOpenTagPicker={(nid) => setTagPickerTargetId(nid)}
              onOpenFieldPicker={(nid) => setFieldPickerTargetId(nid)}
              onEditSupertag={(tid) => setSupertagModalConfig({ isOpen: true, tagId: tid })}
            />
          )}

          {activeNav === 'panels' && (
            <div className="flex-1 flex overflow-hidden">
              {store.activePanels.map((panel, idx) => (
                <Panel
                  key={panel.id}
                  panel={panel}
                  panelIndex={idx}
                  totalPanels={store.activePanels.length}
                  onOpenNodePicker={(nid) => setNodePickerTargetId(nid)}
                  onOpenTagPicker={(nid) => setTagPickerTargetId(nid)}
                  onOpenFieldPicker={(nid) => setFieldPickerTargetId(nid)}
                  onEditSupertag={(tid) => setSupertagModalConfig({ isOpen: true, tagId: tid })}
                  onClosePanel={(i) => store.closePanel(i)}
                  onOpenMovePicker={() => store.requestMoveNodes([...store.selectedNodeIds])}
                />
              ))}
            </div>
          )}

          {activeNav === 'library' && (
            <LibraryPage
              onOpenNodePicker={(nid) => setNodePickerTargetId(nid)}
              onOpenTagPicker={(nid) => setTagPickerTargetId(nid)}
              onOpenFieldPicker={(nid) => setFieldPickerTargetId(nid)}
            />
          )}
          {activeNav === 'calendar' && <CalendarPage />}
          {activeNav === 'graph' && <GraphPage />}
          {activeNav === 'reflections' && <ReflectionsPage />}
          {activeNav === 'trash' && <TrashPage />}
          {activeNav === 'settings' && <SettingsPage />}
        </main>

        {/* 3.11 Status Bar (32px strip) */}
        <StatusBar
          saveStatus="saved"
          onRetrySave={() => {}}
          onOpenDataSettings={() => setActiveNav('settings')}
          onOpenAiSettings={() => setActiveNav('settings')}
          activeTimerLabel={activeTimerLabel}
        />
      </div>

      {/* Column 3: AI Coach Rail (344px / 40px) */}
      <CoachRail
        collapsed={coachRailCollapsed}
        onToggleCollapse={() => setCoachRailCollapsed(!coachRailCollapsed)}
        aiEnabled={aiSettings.aiEnabled}
        onEnableAi={() => store.setConsentModalOpen(true)}
        isAiRunning={store.isAiRunning}
        onRefreshCoach={() => store.refreshReflections()}
        reflections={store.todayReflections}
        onActReflection={(id, action) => store.actReflection(id, action)}
        onUndoReflection={() => store.undoReflection()}
        onOpenSourceNode={(nodeId, side) => store.openNode(nodeId, side)}
        sourceNodeTitles={store.sourceNodeTitles}
        tasks={store.todayMiniTasks}
        onStartTimer={(t) => {
          setActiveTimerLabel(`${t.duration_min}m remaining`);
          store.updateMiniTaskStatus(t.id, 'started');
        }}
        onDoneTask={(t) => {
          setActiveTimerLabel(null);
          store.updateMiniTaskStatus(t.id, 'done');
        }}
        onSnoozeTask={(t) => store.updateMiniTaskStatus(t.id, 'snoozed')}
        onDismissTask={(t) => store.updateMiniTaskStatus(t.id, 'dismissed')}
        onSaveAsNode={(t) => store.saveMiniTaskAsNode(t)}
        onPromoteTask={handlePromoteTask}
        onOpenDigestInspect={() => store.setDigestInspectOpen(true)}
        onOpenReflections={() => setActiveNav('reflections')}
      />

      {/* Global Modals */}
      <Omnibar
        isOpen={store.omnibarOpen}
        onClose={() => store.setOmnibarOpen(false)}
        items={[...nodeSearchItems, ...omnibarItems]}
        onSearchChange={handleOmnibarSearch}
        filterChips={omnibarTags.slice(0, 8).map((t) => ({
          id: t.id,
          label: t.name,
          active: searchTagFilter === t.id,
          onToggle: () => {
            const next = searchTagFilter === t.id ? null : t.id;
            setSearchTagFilter(next);
            runNodeSearch(lastOmnibarQueryRef.current, next);
          },
        }))}
      />

      <ShortcutsModal
        isOpen={store.shortcutsModalOpen}
        onClose={() => store.setShortcutsModalOpen(false)}
      />

      <ConsentModal
        isOpen={store.consentModalOpen}
        onClose={() => store.setConsentModalOpen(false)}
      />

      <DigestInspectModal
        isOpen={store.digestInspectOpen}
        onClose={() => store.setDigestInspectOpen(false)}
      />

      <NodePickerModal
        isOpen={Boolean(nodePickerTargetId)}
        onClose={() => setNodePickerTargetId(null)}
        onSelectNode={(targetId) => {
          if (nodePickerTargetId && store.db) {
            store.db.nodes.getById(nodePickerTargetId).then((node) => {
              if (node) {
                const updated = `${node.content}[[node:${targetId}]]`;
                store.updateNodeContent(node.id, updated);
              }
            });
          }
        }}
      />

      {/* Move destination picker (multi-selection & Move to… command) */}
      <NodePickerModal
        isOpen={Boolean(store.moveRequestNodeIds)}
        onClose={() => store.cancelMove()}
        onSelectNode={async (targetId) => {
          const ids = store.moveRequestNodeIds || [];
          for (const id of ids) {
            if (id === targetId || !store.db) continue;
            const kids = await store.db.nodes.getChildren(targetId);
            const lastPos = kids.length > 0 ? kids[kids.length - 1].position : null;
            await store.moveNodeTo(id, targetId, generateKeyBetween(lastPos, null));
          }
          store.cancelMove();
          store.clearSelection();
        }}
      />

      {/* Referenced-node delete confirmation (FRD 3.3 invariant 2) */}
      {store.deleteConfirmInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => store.cancelDeleteNode()}
        >
          <div
            className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-5 text-[var(--text-primary)] font-sans shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[15px] font-semibold mb-2">Delete referenced node?</div>
            <div className="text-[13px] text-[var(--text-muted)] mb-4 leading-relaxed">
              &quot;{store.deleteConfirmInfo.title}&quot; is referenced by{' '}
              {store.deleteConfirmInfo.refCount}{' '}
              {store.deleteConfirmInfo.refCount === 1 ? 'node' : 'nodes'}. Those references will be
              converted to plain-text snapshots.
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => store.cancelDeleteNode()}
                className="h-8 px-3 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[6px] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => store.confirmDeleteNode()}
                className="h-8 px-3 bg-[var(--red)] text-[var(--bg-app)] rounded-[6px] text-[12px] font-medium cursor-pointer hover:bg-[var(--red)]"
              >
                Delete &amp; snapshot refs
              </button>
            </div>
          </div>
        </div>
      )}

      <TagPickerModal
        isOpen={Boolean(tagPickerTargetId)}
        onClose={() => setTagPickerTargetId(null)}
        onOpenSupertagCreator={(initialName) => {
          setSupertagModalConfig({ isOpen: true, tagId: null, initialName });
        }}
        onSelectTag={async (tagDefId) => {
          // Bulk mode: a multi-selection tags every selected node
          const selection = useWorkspaceStore.getState().selectedNodeIds;
          if (selection.length > 0) {
            for (const id of selection) {
              await store.applyTag(id, tagDefId);
            }
            store.clearSelection();
            setTagPickerTargetId(null);
            return;
          }
          if (tagPickerTargetId) {
            if (store.db) {
              const targetNode = await store.db.nodes.getById(tagPickerTargetId);
              if (targetNode && /#\s*$/.test(targetNode.content)) {
                const cleaned = targetNode.content.replace(/#\s*$/, '').trim();
                await store.updateNodeContent(tagPickerTargetId, cleaned);
              }
            }
            await store.applyTag(tagPickerTargetId, tagDefId);
          }
        }}
      />

      <FieldPickerModal
        isOpen={Boolean(fieldPickerTargetId)}
        nodeId={fieldPickerTargetId}
        onClose={() => setFieldPickerTargetId(null)}
      />

      <SupertagModal
        isOpen={supertagModalConfig.isOpen}
        tagId={supertagModalConfig.tagId}
        initialName={supertagModalConfig.initialName}
        onClose={() => setSupertagModalConfig({ isOpen: false })}
        onSaved={async (savedTagId) => {
          if (tagPickerTargetId && !supertagModalConfig.tagId) {
            if (store.db) {
              const targetNode = await store.db.nodes.getById(tagPickerTargetId);
              if (targetNode && /#\s*$/.test(targetNode.content)) {
                const cleaned = targetNode.content.replace(/#\s*$/, '').trim();
                await store.updateNodeContent(tagPickerTargetId, cleaned);
              }
            }
            await store.applyTag(tagPickerTargetId, savedTagId);
            setTagPickerTargetId(null);
          }
        }}
      />
      {/* First-run onboarding tour (Section 8) */}
      {store.isInitialized && !appSettings.onboarded && Object.keys(appSettings).length > 0 && (
        <OnboardingTour
          onFinish={async () => {
            await store.db?.settings.updateSettings({ onboarded: true });
            setAppSettings({ ...appSettings, onboarded: true });
          }}
        />
      )}
    </div>
  );
};
