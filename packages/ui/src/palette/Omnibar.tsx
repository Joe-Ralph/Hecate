import React, { useState, useEffect, useRef } from 'react';
import { Search, Terminal, Tag, Compass, FileText, CornerDownLeft } from 'lucide-react';

export interface OmnibarItem {
  id: string;
  group: 'NODES' | 'COMMANDS' | 'TAGS' | 'NAVIGATION';
  title: string;
  subtitle?: string;
  shortcut?: string;
  onSelect: () => void;
}

export interface OmnibarProps {
  isOpen: boolean;
  onClose: () => void;
  items: OmnibarItem[];
  onSearchChange?: (q: string) => void;
}

export const Omnibar: React.FC<OmnibarProps> = ({
  isOpen,
  onClose,
  items,
  onSearchChange,
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
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].onSelect();
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  // Group items
  const groups: Array<'NODES' | 'COMMANDS' | 'TAGS' | 'NAVIGATION'> = [
    'NODES',
    'COMMANDS',
    'TAGS',
    'NAVIGATION',
  ];

  let flatCounter = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-[#0a0a0a]/80 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-[640px] bg-[#0a0a0a] border border-[#333333] shadow-2xl text-[#ffffff] font-sans flex flex-col max-h-[500px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Terminal Input Prompt */}
        <div className="flex items-center px-4 py-3 border-b border-[#222222] bg-[#111111]">
          <span className="font-mono text-[#888888] text-sm mr-2 select-none">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            placeholder="Type a command, search nodes, or tags..."
            className="flex-1 bg-transparent text-[#ffffff] text-[14px] placeholder-[#555555] focus:outline-none font-mono"
          />
          <kbd className="text-[10px] font-mono text-[#555555] border border-[#333333] px-1 py-0.5 select-none">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto flex-1 p-2 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-[#555555] text-[12px] font-mono uppercase tracking-[1.5px]">
              No matches found
            </div>
          ) : (
            groups.map((group) => {
              const groupItems = filteredItems.filter((i) => i.group === group);
              if (groupItems.length === 0) return null;

              return (
                <div key={group} className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-[2px] text-[#555555]">
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
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors duration-100 ${
                          isSelected
                            ? 'bg-[#ffffff] text-[#000000]'
                            : 'hover:bg-[#161616] text-[#ffffff]'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          {group === 'NODES' && (
                            <FileText
                              className={`w-3.5 h-3.5 ${isSelected ? 'text-[#000000]' : 'text-[#888888]'}`}
                              strokeWidth={2}
                            />
                          )}
                          {group === 'COMMANDS' && (
                            <Terminal
                              className={`w-3.5 h-3.5 ${isSelected ? 'text-[#000000]' : 'text-[#888888]'}`}
                              strokeWidth={2}
                            />
                          )}
                          {group === 'TAGS' && (
                            <Tag
                              className={`w-3.5 h-3.5 ${isSelected ? 'text-[#000000]' : 'text-[#888888]'}`}
                              strokeWidth={2}
                            />
                          )}
                          {group === 'NAVIGATION' && (
                            <Compass
                              className={`w-3.5 h-3.5 ${isSelected ? 'text-[#000000]' : 'text-[#888888]'}`}
                              strokeWidth={2}
                            />
                          )}
                          <span className="text-[13px] font-medium truncate">{item.title}</span>
                          {item.subtitle && (
                            <span
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-[#444444]' : 'text-[#888888]'
                              }`}
                            >
                              {item.subtitle}
                            </span>
                          )}
                        </div>

                        {item.shortcut && (
                          <span
                            className={`text-[10px] font-mono uppercase tracking-[1px] px-1 py-0.5 border ${
                              isSelected
                                ? 'border-[#000000] text-[#000000]'
                                : 'border-[#333333] text-[#555555]'
                            }`}
                          >
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-[#0c0c0c] border-t border-[#222222] flex items-center justify-between text-[10px] font-mono text-[#555555] uppercase tracking-[1px]">
          <span>Use ↑↓ to navigate</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  );
};
