import React, { useState, useEffect, useRef } from 'react';
import { Tag, Plus } from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface TagPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tagDefId: string) => void;
}

export const TagPickerModal: React.FC<TagPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTag,
}) => {
  const store = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [allTags, setAllTags] = useState<NodeRecord[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
      if (store.db) {
        store.db.tags.getAllTags().then(setAllTags);
      }
    }
  }, [isOpen, store.db]);

  if (!isOpen) return null;

  const filteredTags = allTags.filter((t) =>
    t.content.toLowerCase().includes(query.toLowerCase())
  );

  const exactMatch = allTags.find(
    (t) => t.content.toLowerCase() === query.trim().toLowerCase()
  );

  const handleCreateNewTag = async () => {
    if (!store.db || !query.trim()) return;
    const newTag = await store.db.tags.createTag(query.trim(), {
      color: '#3b82f6',
    });
    onSelectTag(newTag.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-[#0a0a0a]/70 backdrop-blur-xs p-4">
      <div
        className="w-full max-w-sm bg-[#0a0a0a] border border-[#333333] shadow-2xl text-[#ffffff] font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[#222222] flex items-center space-x-2 bg-[#111111]">
          <Tag className="w-4 h-4 text-[#888888]" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or create tag..."
            className="flex-1 bg-transparent text-[#ffffff] text-[13px] focus:outline-none font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter') {
                if (filteredTags.length > 0) {
                  onSelectTag(filteredTags[0].id);
                  onClose();
                } else if (query.trim()) {
                  handleCreateNewTag();
                }
              }
            }}
          />
        </div>

        <div className="max-h-60 overflow-y-auto p-1 space-y-0.5">
          {filteredTags.map((t) => {
            const color = (t.meta as any)?.color || '#888888';
            return (
              <div
                key={t.id}
                onClick={() => {
                  onSelectTag(t.id);
                  onClose();
                }}
                className="px-3 py-2 hover:bg-[#161616] cursor-pointer flex items-center justify-between text-[13px]"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2" style={{ backgroundColor: color }} />
                  <span className="font-medium text-[#ffffff]">#{t.content}</span>
                </div>
                <span className="text-[10px] font-mono text-[#555555] uppercase">
                  {(t.meta as any)?.extends?.length ? 'Extends' : 'Tag'}
                </span>
              </div>
            );
          })}

          {!exactMatch && query.trim() && (
            <div
              onClick={handleCreateNewTag}
              className="px-3 py-2 hover:bg-[#161616] cursor-pointer flex items-center space-x-2 text-[12px] text-[#3b82f6] border-t border-[#222222] mt-1"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Create new tag "#{query.trim()}"</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
