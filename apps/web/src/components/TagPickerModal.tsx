import React, { useState, useEffect, useRef } from 'react';
import { Tag, Plus, Settings } from 'lucide-react';
import { NodeRecord, TagDefMeta } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface TagPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTag: (tagDefId: string) => void;
  onOpenSupertagCreator?: (initialName: string) => void;
}

export const TagPickerModal: React.FC<TagPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTag,
  onOpenSupertagCreator,
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

  const handleQuickCreateTag = async () => {
    if (!store.db || !query.trim()) return;
    const cleanName = query.trim().replace(/^#/, '');
    const newTag = await store.db.tags.createTag(cleanName, {
      color: 'var(--accent)',
      showCheckbox: cleanName.toLowerCase() === 'task',
    });
    onSelectTag(newTag.id);
    onClose();
  };

  const handleConfigureCreate = () => {
    const cleanName = query.trim().replace(/^#/, '');
    onClose();
    onOpenSupertagCreator?.(cleanName);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-28 bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans overflow-hidden animate-in fade-in zoom-in-95 duration-120"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-[var(--border-subtle)] flex items-center space-x-2.5 bg-[var(--bg-surface)]">
          <Tag className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or add supertag..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-[13px] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter') {
                if (filteredTags.length > 0) {
                  onSelectTag(filteredTags[0].id);
                  onClose();
                } else if (query.trim()) {
                  handleQuickCreateTag();
                }
              }
            }}
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
          {filteredTags.map((t) => {
            const meta = (t.meta as TagDefMeta) || {};
            const color = meta.color || 'var(--accent)';
            const fieldCount = meta.fieldDefs?.length || 0;

            return (
              <div
                key={t.id}
                onClick={() => {
                  onSelectTag(t.id);
                  onClose();
                }}
                className="px-3 py-2 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-between text-[13px] transition-colors group"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
                  <span className="font-medium text-[var(--text-primary)]">#{t.content}</span>
                </div>
                <div className="flex items-center space-x-2 text-[11px] font-mono text-[var(--text-faint)]">
                  {fieldCount > 0 && <span>{fieldCount} fields</span>}
                  <span className="uppercase">{meta.extends?.length ? 'Extends' : 'Tag'}</span>
                </div>
              </div>
            );
          })}

          {/* New tag options when query is typed */}
          {query.trim() && !filteredTags.some((t) => t.content.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="p-1 pt-1.5 border-t border-[var(--border-subtle)] space-y-1">
              <button
                type="button"
                onClick={handleQuickCreateTag}
                className="w-full px-3 py-2 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center space-x-2 text-[13px] text-[var(--accent)] text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Apply new tag #{query.trim().replace(/^#/, '')}</span>
              </button>

              <button
                type="button"
                onClick={handleConfigureCreate}
                className="w-full px-3 py-2 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center space-x-2 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-left transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Configure fields & create #{query.trim().replace(/^#/, '')}…</span>
              </button>
            </div>
          )}

          {/* Create new supertag option when not matching */}
          {!query.trim() && (
            <div className="p-1 pt-1 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSupertagCreator?.('');
                }}
                className="w-full px-3 py-1.5 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center space-x-2 text-[12px] text-[var(--accent)] text-left transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create new supertag with fields…</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
