import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, Tag, Compass, FileText, CornerDownLeft } from 'lucide-react';

export interface OmnibarItem {
  id: string;
  group: 'NODES' | 'COMMANDS' | 'TAGS' | 'NAVIGATION';
  title: string;
  subtitle?: string;
  shortcut?: string;
  onSelect: () => void;
  onSelectSplit?: () => void;
}

export interface OmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  items: OmnibarItem[];
  onSearchChange?: (q: string) => void;
  filterChips?: Array<{ id: string; label: string; active: boolean; onToggle: () => void }>;
}

export const Omnibar: React.FC<OmnibarProps> = ({
  isOpen,
  onClose,
  items,
  onSearchChange,
  filterChips = [],
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredItems = items.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((idx) => (idx + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((idx) => (idx - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          if ((e.metaKey || e.ctrlKey) && item.onSelectSplit) {
            item.onSelectSplit();
          } else {
            item.onSelect();
          }
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  const groups: Array<'NODES' | 'COMMANDS' | 'TAGS' | 'NAVIGATION'> = [
    'NODES',
    'COMMANDS',
    'TAGS',
    'NAVIGATION',
  ];

  let flatCounter = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[640px] bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans flex flex-col max-h-[500px] overflow-hidden animate-in fade-in zoom-in-95 duration-140"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 56px Search Input */}
        <div className="h-14 px-4 flex items-center space-x-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] shrink-0" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            placeholder="Search or run command..."
            className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder-[var(--text-faint)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[11px] font-mono text-[var(--text-faint)] hover:text-[var(--text-primary)] px-1.5 py-0.5 rounded-[4px] hover:bg-[var(--bg-hover)]"
            >
              Clear
            </button>
          )}
        </div>

        {/* Tag filter chips */}
        {query && filterChips.length > 0 && (
          <div className="px-4 py-2 border-b border-[var(--border-subtle)] flex items-center space-x-1.5 overflow-x-auto">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={chip.onToggle}
                className={`px-2 py-0.5 rounded-[6px] text-[11px] font-mono whitespace-nowrap cursor-pointer transition-colors ${
                  chip.active
                    ? 'bg-[var(--bg-accent-soft)] text-[var(--accent)] border border-[var(--border-accent)]'
                    : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                }`}
              >
                #{chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {groups.map((group) => {
            const groupItems = filteredItems.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;

            return (
              <div key={group} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  {group}
                </div>
                {groupItems.map((item) => {
                  flatCounter++;
                  const isSelected = flatCounter === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        item.onSelect();
                        onClose();
                      }}
                      className={`px-3 py-2 rounded-[8px] flex items-center justify-between cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-[var(--bg-active)] text-[var(--text-primary)]'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {group === 'NODES' && (
                          <FileText className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                        )}
                        {group === 'COMMANDS' && (
                          <Terminal className="w-4 h-4 text-[var(--accent)] shrink-0" />
                        )}
                        {group === 'TAGS' && (
                          <Tag className="w-4 h-4 text-[var(--green)] shrink-0" />
                        )}
                        {group === 'NAVIGATION' && (
                          <Compass className="w-4 h-4 text-[var(--blue)] shrink-0" />
                        )}

                        <div className="truncate">
                          <div className="text-[14px] font-medium leading-snug">
                            {item.title}
                          </div>
                          {item.subtitle && (
                            <div className="text-[12px] text-[var(--text-faint)] truncate">
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      {item.shortcut && (
                        <kbd className="font-mono text-[11px] text-[var(--text-faint)] bg-[var(--bg-raised)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border-subtle)]">
                          {item.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-[var(--text-faint)] text-[13px]">
              No results for "{query}"
            </div>
          )}
        </div>

        {/* Footer Key Hints */}
        <div className="px-4 py-2.5 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[11px] text-[var(--text-faint)] select-none">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>⌘↵ Open split</span>
          </div>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
};
