import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-[#0a0a0a]/70 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-lg bg-[#0a0a0a] border border-[#333333] shadow-2xl text-[#ffffff] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[#222222] flex items-center space-x-2 bg-[#111111]">
          <Search className="w-4 h-4 text-[#888888]" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reference a node..."
            className="flex-1 bg-transparent text-[#ffffff] text-[13px] focus:outline-none font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
          {results.length === 0 ? (
            <div className="py-6 text-center text-[#555555] font-mono text-[11px] uppercase tracking-[1px]">
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
                className="px-3 py-2 hover:bg-[#161616] cursor-pointer flex items-center justify-between text-[13px]"
              >
                <span className="font-medium text-[#ffffff] truncate">
                  {r.content || 'Untitled'}
                </span>
                <span className="text-[10px] font-mono text-[#555555] uppercase">
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
