import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface NodePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (nodeId: string, nodeTitle: string) => void;
}

export const NodePickerModal: React.FC<NodePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectNode,
}) => {
  const store = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NodeRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!store.db || !isOpen) return;
    store.db.search.globalSearch(query).then(setResults);
  }, [query, isOpen, store.db]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-120"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[var(--border-subtle)] flex items-center space-x-2.5 bg-[var(--bg-surface)]">
          <Search className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reference a node..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-[13px] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        <div className="max-h-60 overflow-y-auto p-1.5 space-y-0.5">
          {results.length === 0 ? (
            <div className="py-6 text-center text-[var(--text-muted)] font-mono text-[11px] uppercase tracking-wider">
              No matching nodes found
            </div>
          ) : (
            results.map((r) => (
              <div
                key={r.id}
                onClick={() => {
                  onSelectNode(r.id, r.content);
                  onClose();
                }}
                className="px-3 py-2 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-between text-[13px] transition-colors"
              >
                <span className="font-medium text-[var(--text-primary)] truncate">
                  {r.content || 'Untitled'}
                </span>
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase">
                  {r.kind}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
