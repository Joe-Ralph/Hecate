import React, { useState, useEffect } from 'react';
import { useWorkspaceStore } from './store/workspaceStore';
import { Sidebar } from './components/Sidebar';
import { Panel } from './components/Panel';
import { HomePage } from './pages/HomePage';
import { LibraryPage } from './pages/LibraryPage';
import { ReflectionsPage } from './pages/ReflectionsPage';
import { TrashPage } from './pages/TrashPage';
import { SettingsPage } from './pages/SettingsPage';
import { Omnibar, OmnibarItem } from '@hecate/ui';
import { ShortcutsModal } from '@hecate/ui';
import { ConsentModal } from './components/ConsentModal';
import { DigestInspectModal } from './components/DigestInspectModal';
import { NodePickerModal } from './components/NodePickerModal';
import { TagPickerModal } from './components/TagPickerModal';
import { AppLoader } from '@hecate/ui';

export const App: React.FC = () => {
  const store = useWorkspaceStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNav, setActiveNav] = useState<'home' | 'panels' | 'library' | 'reflections' | 'trash' | 'settings'>('home');

  // Active pickers
  const [nodePickerTargetId, setNodePickerTargetId] = useState<string | null>(null);
  const [tagPickerTargetId, setTagPickerTargetId] = useState<string | null>(null);

  // Initialize workspace
  useEffect(() => {
    store.init();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if inside an input or textarea unless Cmd+K or ?
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA';

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        store.setOmnibarOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        store.jumpToToday();
        setActiveNav('home');
      } else if (e.key === '?' && !isInput) {
        e.preventDefault();
        store.setShortcutsModalOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          store.redo();
        } else {
          e.preventDefault();
          store.undo();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!store.isInitialized) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-[#ffffff] font-sans">
        <div className="w-64">
          <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-2 text-center">
            HECATE GRAPH OUTLINER
          </div>
          <AppLoader mode="cursor" label="INITIALIZING OPFS STORAGE" />
        </div>
      </div>
    );
  }

  // Build items for Omnibar
  const omnibarItems: OmnibarItem[] = [
    {
      id: 'cmd-today',
      group: 'NAVIGATION',
      title: "Today's Daily Note",
      shortcut: '⌘⌥T',
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
      onSelect: () => setActiveNav('library'),
    },
    {
      id: 'cmd-reflections',
      group: 'NAVIGATION',
      title: 'Open Reflections',
      onSelect: () => setActiveNav('reflections'),
    },
    {
      id: 'cmd-shortcuts',
      group: 'COMMANDS',
      title: 'Keyboard Shortcuts Cheat Sheet',
      shortcut: '?',
      onSelect: () => store.setShortcutsModalOpen(true),
    },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0a0a] text-[#ffffff] select-none">
      {/* Sidebar */}
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

      {/* Main Work Area */}
      <main className="flex-1 min-w-0 h-full flex bg-[#0a0a0a] overflow-hidden select-text">
        {activeNav === 'home' && <HomePage />}
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
              />
            ))}
          </div>
        )}
        {activeNav === 'library' && <LibraryPage />}
        {activeNav === 'reflections' && <ReflectionsPage />}
        {activeNav === 'trash' && <TrashPage />}
        {activeNav === 'settings' && <SettingsPage />}
      </main>

      {/* Global Modals */}
      <Omnibar
        isOpen={store.omnibarOpen}
        onClose={() => store.setOmnibarOpen(false)}
        items={omnibarItems}
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
        onSelectNode={(targetId, title) => {
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

      <TagPickerModal
        isOpen={Boolean(tagPickerTargetId)}
        onClose={() => setTagPickerTargetId(null)}
        onSelectTag={(tagDefId) => {
          if (tagPickerTargetId) {
            store.applyTag(tagPickerTargetId, tagDefId);
          }
        }}
      />
    </div>
  );
};
