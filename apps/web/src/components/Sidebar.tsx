import React from 'react';
import {
  Calendar,
  Search,
  BookOpen,
  Sparkles,
  Trash2,
  Settings,
  Pin,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { useWorkspaceStore } from '../store/workspaceStore';

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

  const activeTaskCount = store.todayMiniTasks.filter(
    (t) => t.status === 'suggested' || t.status === 'started'
  ).length;

  if (collapsed) {
    return (
      <aside className="w-12 bg-[#0a0a0a] border-r border-[#222222] flex flex-col items-center py-3 select-none z-20 shrink-0">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 text-[#888888] hover:text-[#ffffff] hover:bg-[#111111] cursor-pointer mb-4"
          title="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onSelectNav('today')}
            className={`p-2 cursor-pointer ${activeNav === 'today' ? 'text-[#ffffff]' : 'text-[#888888] hover:text-[#ffffff]'}`}
            title="Today"
          >
            <Calendar className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => store.setOmnibarOpen(true)}
            className="p-2 text-[#888888] hover:text-[#ffffff] cursor-pointer"
            title="Search (Cmd+K)"
          >
            <Search className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onSelectNav('library')}
            className={`p-2 cursor-pointer ${activeNav === 'library' ? 'text-[#ffffff]' : 'text-[#888888] hover:text-[#ffffff]'}`}
            title="Library"
          >
            <BookOpen className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onSelectNav('reflections')}
            className={`p-2 cursor-pointer relative ${activeNav === 'reflections' ? 'text-[#ffffff]' : 'text-[#888888] hover:text-[#ffffff]'}`}
            title="AI Coach Reflections"
          >
            <Sparkles className="w-4 h-4" strokeWidth={2} />
            {activeTaskCount > 0 && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#22c55e]" />
            )}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-[240px] min-w-[240px] bg-[#0a0a0a] border-r border-[#222222] flex flex-col justify-between py-3 px-2 font-sans select-none z-20 shrink-0">
      <div>
        {/* Top App Header */}
        <div className="flex items-center justify-between px-2 mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-3.5 h-3.5 bg-[#ffffff]" />
            <span className="font-mono text-[13px] font-medium tracking-[2px] text-[#ffffff] uppercase">
              HECATE
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 text-[#555555] hover:text-[#ffffff] hover:bg-[#111111] cursor-pointer"
            title="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Quick Search Button */}
        <button
          type="button"
          onClick={() => store.setOmnibarOpen(true)}
          className="w-full h-8 px-2.5 mb-4 flex items-center justify-between bg-[#111111] border border-[#222222] hover:border-[#333333] text-[#888888] text-[12px] font-mono cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-[#555555]" strokeWidth={2} />
            <span>Search...</span>
          </div>
          <kbd className="text-[10px] text-[#555555] border border-[#222222] px-1">
            ⌘K
          </kbd>
        </button>

        {/* Primary Nav List */}
        <nav className="space-y-0.5">
          <button
            type="button"
            onClick={() => {
              store.jumpToToday();
              onSelectNav('today');
            }}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium cursor-pointer transition-colors duration-100 ${
              activeNav === 'today'
                ? 'bg-[#161616] text-[#ffffff] border-l-2 border-[#ffffff]'
                : 'text-[#888888] hover:bg-[#111111] hover:text-[#ffffff]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Today</span>
            </div>
            <kbd className="text-[10px] font-mono text-[#555555]">⌥T</kbd>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('library')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium cursor-pointer transition-colors duration-100 ${
              activeNav === 'library'
                ? 'bg-[#161616] text-[#ffffff] border-l-2 border-[#ffffff]'
                : 'text-[#888888] hover:bg-[#111111] hover:text-[#ffffff]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Library</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('reflections')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium cursor-pointer transition-colors duration-100 ${
              activeNav === 'reflections'
                ? 'bg-[#161616] text-[#ffffff] border-l-2 border-[#ffffff]'
                : 'text-[#888888] hover:bg-[#111111] hover:text-[#ffffff]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Sparkles className="w-3.5 h-3.5 text-[#eab308]" strokeWidth={2} />
              <span>Reflections</span>
            </div>
            {activeTaskCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30">
                {activeTaskCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onSelectNav('trash')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] font-medium cursor-pointer transition-colors duration-100 ${
              activeNav === 'trash'
                ? 'bg-[#161616] text-[#ffffff] border-l-2 border-[#ffffff]'
                : 'text-[#888888] hover:bg-[#111111] hover:text-[#ffffff]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Trash</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Bottom Settings & Help */}
      <div className="pt-3 border-t border-[#222222] space-y-0.5">
        <button
          type="button"
          onClick={() => store.setShortcutsModalOpen(true)}
          className="w-full flex items-center justify-between px-2.5 py-1.5 text-[12px] text-[#888888] hover:text-[#ffffff] hover:bg-[#111111] cursor-pointer"
        >
          <div className="flex items-center space-x-2.5">
            <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} />
            <span>Shortcuts</span>
          </div>
          <kbd className="text-[10px] font-mono text-[#555555]">?</kbd>
        </button>

        <button
          type="button"
          onClick={() => onSelectNav('settings')}
          className={`w-full flex items-center space-x-2.5 px-2.5 py-1.5 text-[12px] font-medium cursor-pointer ${
            activeNav === 'settings'
              ? 'bg-[#161616] text-[#ffffff]'
              : 'text-[#888888] hover:bg-[#111111] hover:text-[#ffffff]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
