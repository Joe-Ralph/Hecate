import React, { useState, useEffect, useRef } from 'react';
import { Database, Plus, Search, Calendar, List, Type, Hash, ToggleLeft } from 'lucide-react';
import { NodeRecord, FieldType } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface FieldPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
}

export const FieldPickerModal: React.FC<FieldPickerModalProps> = ({
  isOpen,
  onClose,
  nodeId,
}) => {
  const store = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const [allFields, setAllFields] = useState<NodeRecord[]>([]);
  const [selectedType, setSelectedType] = useState<FieldType>('text');
  const [optionsStr, setOptionsStr] = useState('Option 1, Option 2, Option 3');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
      if (store.db) {
        store.db.tags.getAllFieldDefs().then(setAllFields);
      }
    }
  }, [isOpen, store.db]);

  if (!isOpen || !nodeId) return null;

  const filtered = allFields.filter((f) =>
    f.content.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectField = async (fieldDefId: string) => {
    if (!store.db || !nodeId) return;
    await store.db.tags.addFieldToNode(nodeId, fieldDefId);
    store.init(); // Refresh store data
    onClose();
  };

  const handleCreateNewField = async () => {
    if (!store.db || !nodeId || !query.trim()) return;

    let optionsList: any[] | undefined = undefined;
    if (selectedType === 'options') {
      optionsList = optionsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((label, idx) => ({
          id: `opt-${idx}-${label.toLowerCase().replace(/\s+/g, '-')}`,
          label,
        }));
    }

    const created = await store.db.tags.createFieldDef(query.trim(), {
      type: selectedType,
      options: optionsList,
    });

    await store.db.tags.addFieldToNode(nodeId, created.id);
    store.init();
    onClose();
  };

  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-[var(--gold)]" />;
      case 'options':
        return <List className="w-3.5 h-3.5 text-[var(--blue)]" />;
      case 'number':
        return <Hash className="w-3.5 h-3.5 text-[var(--green)]" />;
      case 'boolean':
        return <ToggleLeft className="w-3.5 h-3.5 text-[var(--accent)]" />;
      default:
        return <Type className="w-3.5 h-3.5 text-[var(--text-muted)]" />;
    }
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
          <Database className="w-4 h-4 text-[var(--text-muted)]" strokeWidth={2} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or add field..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-[13px] focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter') {
                if (filtered.length > 0) {
                  handleSelectField(filtered[0].id);
                } else if (query.trim()) {
                  handleCreateNewField();
                }
              }
            }}
          />
        </div>

        <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
          {filtered.map((f) => {
            const ftype = (f.meta as any)?.type || 'text';
            return (
              <div
                key={f.id}
                onClick={() => handleSelectField(f.id)}
                className="px-3 py-2 rounded-[6px] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-between text-[13px] transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  {getFieldIcon(ftype)}
                  <span className="font-medium text-[var(--text-primary)]">{f.content}</span>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-faint)] uppercase">
                  {ftype}
                </span>
              </div>
            );
          })}

          {query.trim() && !filtered.some((f) => f.content.toLowerCase() === query.trim().toLowerCase()) && (
            <div className="p-2.5 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[6px] mt-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--text-primary)] font-medium">
                  Create field: "{query.trim()}"
                </span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="h-6 px-1.5 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[4px] text-[11px] text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="text">Text</option>
                  <option value="date">Date</option>
                  <option value="options">Options</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>

              {selectedType === 'options' && (
                <div>
                  <input
                    type="text"
                    value={optionsStr}
                    onChange={(e) => setOptionsStr(e.target.value)}
                    placeholder="Options (comma separated)"
                    className="w-full h-6 px-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[4px] text-[11px] text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleCreateNewField}
                className="w-full h-7 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[4px] text-[12px] font-medium flex items-center justify-center space-x-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create & Attach Field</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
