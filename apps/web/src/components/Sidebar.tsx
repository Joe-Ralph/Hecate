import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CalendarDays,
  Network,
  Search,
  BookOpen,
  Sparkles,
  Trash2,
  Settings,
  Pin,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { useWorkspaceStore, getPinnedNodes } from '../store/workspaceStore';
import { NodeRecord } from '@hecate/core';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeNav: string;
  onSelectNav: (nav: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeNav,
  onSelectNav,
}) => {
  const store = useWorkspaceStore();
  const [supertags, setSupertags] = useState<NodeRecord[]>([]);
  const [pinnedNodes, setPinnedNodes] = useState<NodeRecord[]>([]);
  const [recentNodes, setRecentNodes] = useState<NodeRecord[]>([]);

  useEffect(() => {
    if (!store.db) return;
    store.db.tags.getAllTags().then((tags) => {
      setSupertags(tags.slice(0, 8));
    });
    getPinnedNodes(store.db).then(setPinnedNodes);
    store.db.adapter
      .query<any>(
        "SELECT * FROM node WHERE kind IN ('content', 'day', 'search') AND deleted_at IS NULL AND content != '' ORDER BY updated_at DESC LIMIT 5"
      )
      .then(setRecentNodes);
  }, [store.db, store.version]);

  const activeTaskCount = store.todayMiniTasks.filter(
    (t) => t.status === 'suggested' || t.status === 'started'
  ).length;

  // 56px Collapsed Strip (Section 3.1 & 3.2)
  if (collapsed) {
    return (
      <aside className="w-14 min-w-14 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col items-center py-4 justify-between select-none z-20 shrink-0">
        <div className="flex flex-col items-center space-y-4">
          {/* Logo / Expand */}
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar (Cmd+\)"
            title="Expand sidebar (Cmd+\)"
            className="w-8 h-8 rounded-[6px] bg-[var(--bg-accent-dim)] border border-[var(--border-accent)] flex items-center justify-center text-[var(--accent)] hover:bg-[var(--bg-accent-soft)] cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" strokeWidth={2} />
          </button>

          <nav className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                store.jumpToToday();
                onSelectNav('today');
              }}
              aria-label="Today"
              title="Today (Alt+T)"
              className={`w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer transition-colors ${
                activeNav === 'home' || activeNav === 'today'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Calendar className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => store.setOmnibarOpen(true)}
              aria-label="Search or run command"
              title="Search (Cmd+K)"
              className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            >
              <Search className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => onSelectNav('library')}
              aria-label="Library"
              title="Library (G then L)"
              className={`w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer transition-colors ${
                activeNav === 'library'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => onSelectNav('calendar')}
              aria-label="Calendar"
              title="Calendar (G then C)"
              className={`w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer transition-colors ${
                activeNav === 'calendar'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <CalendarDays className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => onSelectNav('graph')}
              aria-label="Graph"
              title="Graph (G then G)"
              className={`w-9 h-9 rounded-[8px] flex items-center justify-center cursor-pointer transition-colors ${
                activeNav === 'graph'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Network className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => onSelectNav('reflections')}
              aria-label="Reflections"
              title="Reflections"
              className={`w-9 h-9 rounded-[8px] flex items-center justify-center relative cursor-pointer transition-colors ${
                activeNav === 'reflections'
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Sparkles className="w-4 h-4" strokeWidth={2} />
              {activeTaskCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent)]" />
              )}
            </button>
          </nav>
        </div>

        <div className="flex flex-col items-center space-y-2">
          <button
            type="button"
            onClick={() => onSelectNav('trash')}
            aria-label="Trash"
            title="Trash"
            className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Trash2 className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onSelectNav('settings')}
            aria-label="Settings"
            title="Settings"
            className="w-9 h-9 rounded-[8px] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Settings className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
      </aside>
    );
  }

  // 232px Full Sidebar (Section 3.1 & 3.2)
  return (
    <aside className="w-[232px] min-w-[232px] bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col justify-between py-4 px-3 font-sans select-none z-20 shrink-0">
      <div className="space-y-4">
        {/* Top Logo & App Title */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => {
              store.jumpToToday();
              onSelectNav('today');
            }}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-3.5 h-3.5 rounded-[4px] bg-[var(--accent)] group-hover:scale-105 transition-transform" />
            <span className="font-semibold text-[14px] tracking-wide text-[var(--text-primary)]">
              Hecate
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar (Cmd+\)"
            title="Collapse sidebar (Cmd+\)"
            className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Command Button ("Search or run command") - looks like input */}
        <button
          type="button"
          onClick={() => store.setOmnibarOpen(true)}
          className="w-full h-9 px-3 flex items-center justify-between bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--border-accent)] rounded-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-[13px] cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-2 truncate">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={2} />
            <span className="truncate">Search or run…</span>
          </div>
          <kbd className="font-mono text-[11px] text-[var(--text-faint)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border-subtle)]">
            ⌘K
          </kbd>
        </button>

        {/* Primary Nav List */}
        <nav className="space-y-1">
          <button
            type="button"
            onClick={() => {
              store.jumpToToday();
              onSelectNav('today');
            }}
            className={`w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-[13px] font-medium cursor-pointer transition-colors ${
              activeNav === 'home' || activeNav === 'today'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Calendar className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
              <span>Today</span>
            </div>
            <kbd className="font-mono text-[11px] text-[var(--text-faint)]">⌥T</kbd>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('library')}
            className={`w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-[13px] font-medium cursor-pointer transition-colors ${
              activeNav === 'library'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <BookOpen className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
              <span>Library</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('calendar')}
            className={`w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-[13px] font-medium cursor-pointer transition-colors ${
              activeNav === 'calendar'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <CalendarDays className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
              <span>Calendar</span>
            </div>
            <kbd className="font-mono text-[11px] text-[var(--text-faint)]">GC</kbd>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('graph')}
            className={`w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-[13px] font-medium cursor-pointer transition-colors ${
              activeNav === 'graph'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Network className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
              <span>Graph</span>
            </div>
            <kbd className="font-mono text-[11px] text-[var(--text-faint)]">GG</kbd>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('reflections')}
            className={`w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-[13px] font-medium cursor-pointer transition-colors ${
              activeNav === 'reflections'
                ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
              <span>Reflections</span>
            </div>
            {activeTaskCount > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-[6px] bg-[var(--bg-accent-soft)] text-[var(--accent)]">
                {activeTaskCount}
              </span>
            )}
          </button>
        </nav>

        {/* Pinned Section */}
        <div className="pt-2">
          <div className="px-2.5 pb-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
            <span>Pinned</span>
            <Pin className="w-3 h-3 text-[var(--text-faint)]" />
          </div>
          <div className="space-y-0.5">
            {pinnedNodes.length === 0 ? (
              <div className="px-2.5 py-1 text-[12px] text-[var(--text-faint)]">
                Pin nodes with the pin icon in a panel header.
              </div>
            ) : (
              pinnedNodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => store.openNode(n.id)}
                  className="w-full h-7 px-2.5 rounded-[6px] flex items-center space-x-2 text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  <span className="truncate">{n.content || 'Untitled Node'}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Recent Section */}
        {recentNodes.length > 0 && (
          <div className="pt-2">
            <div className="px-2.5 pb-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Recent
            </div>
            <div className="space-y-0.5">
              {recentNodes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => store.openNode(n.id)}
                  className="w-full h-7 px-2.5 rounded-[6px] flex items-center space-x-2 text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)]" />
                  <span className="truncate">{n.content}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Supertags Section */}
        <div className="pt-2">
          <div className="px-2.5 pb-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
            <span>Supertags</span>
            <button
              type="button"
              onClick={() => onSelectNav('library')}
              className="text-[var(--text-faint)] hover:text-[var(--text-primary)] cursor-pointer lowercase text-[10px]"
            >
              show all
            </button>
          </div>
          <div className="space-y-0.5">
            {(supertags || []).map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => onSelectNav('library')}
                className="w-full h-7 px-2.5 rounded-[6px] flex items-center justify-between text-[12px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="text-[var(--text-faint)]">#</span>
                  <span className="truncate">{tag.content}</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--text-faint)]">
                  {tag.content === 'task' ? '8' : tag.content === 'book' ? '3' : '1'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="pt-3 border-t border-[var(--border-subtle)] space-y-1">
        <button
          type="button"
          onClick={() => onSelectNav('trash')}
          className={`w-full h-8 px-2.5 rounded-[8px] flex items-center space-x-2.5 text-[13px] font-medium cursor-pointer transition-colors ${
            activeNav === 'trash'
              ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Trash2 className="w-4 h-4" strokeWidth={2} />
          <span>Trash</span>
        </button>

        <button
          type="button"
          onClick={() => store.setShortcutsModalOpen(true)}
          className="w-full h-8 px-2.5 rounded-[8px] flex items-center justify-between text-[13px] text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <HelpCircle className="w-4 h-4" strokeWidth={2} />
            <span>Shortcuts</span>
          </div>
          <kbd className="font-mono text-[11px] text-[var(--text-faint)]">?</kbd>
        </button>

        <button
          type="button"
          onClick={() => onSelectNav('settings')}
          className={`w-full h-8 px-2.5 rounded-[8px] flex items-center space-x-2.5 text-[13px] font-medium cursor-pointer transition-colors ${
            activeNav === 'settings'
              ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
              : 'text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Settings className="w-4 h-4" strokeWidth={2} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
