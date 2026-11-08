import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Terminal } from 'lucide-react';
import { CommandStep, NodeRecord, ulid } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface CommandModalProps {
  isOpen: boolean;
  commandId?: string | null;
  onClose: () => void;
}

const STEP_TYPES: Array<{ id: CommandStep['type']; label: string }> = [
  { id: 'setField', label: 'Set field' },
  { id: 'addTag', label: 'Add tag' },
  { id: 'removeTag', label: 'Remove tag' },
  { id: 'setDone', label: 'Set done' },
  { id: 'shiftDate', label: 'Shift date' },
  { id: 'moveTo', label: 'Move to node' },
];

const inputClass =
  'h-8 px-2.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]';

export const CommandModal: React.FC<CommandModalProps> = ({ isOpen, commandId, onClose }) => {
  const store = useWorkspaceStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scopeTagId, setScopeTagId] = useState('');
  const [steps, setSteps] = useState<CommandStep[]>([]);
  const [tags, setTags] = useState<NodeRecord[]>([]);
  const [fieldDefs, setFieldDefs] = useState<NodeRecord[]>([]);

  useEffect(() => {
    if (!store.db || !isOpen) return;
    store.db.tags.getAllTags().then(setTags);
    store.db.tags.getAllFieldDefs().then(setFieldDefs);

    if (commandId) {
      store.db.adapter
        .query<any>('SELECT * FROM command WHERE id = ?', [commandId])
        .then((rows) => {
          const cmd = rows[0];
          if (!cmd) return;
          setName(cmd.name);
          setDescription(cmd.description || '');
          setScopeTagId(cmd.scope || '');
          setSteps(typeof cmd.steps === 'string' ? JSON.parse(cmd.steps) : cmd.steps);
        });
    } else {
      setName('');
      setDescription('');
      setScopeTagId('');
      setSteps([{ type: 'setDone', done: true }]);
    }
  }, [isOpen, commandId, store.db]);

  if (!isOpen) return null;

  const updateStep = (idx: number, step: CommandStep) => {
    const next = [...steps];
    next[idx] = step;
    setSteps(next);
  };

  const newStep = (type: CommandStep['type']): CommandStep => {
    switch (type) {
      case 'setField':
        return { type, fieldDefId: fieldDefs[0]?.id || '', value: '' };
      case 'addTag':
      case 'removeTag':
        return { type, tagId: tags[0]?.id || '' };
      case 'setDone':
        return { type, done: true };
      case 'shiftDate':
        return { type, fieldDefId: fieldDefs[0]?.id || '', days: 1 };
      case 'moveTo':
        return { type, targetParentId: '' };
    }
  };

  const handleSave = async () => {
    if (!store.db || !name.trim() || steps.length === 0) return;
    const id = commandId || ulid();
    await store.db.adapter.execute(
      `INSERT INTO command (id, name, description, steps, scope) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
         steps = excluded.steps, scope = excluded.scope`,
      [id, name.trim(), description.trim() || null, JSON.stringify(steps), scopeTagId || null]
    );
    useWorkspaceStore.setState({ version: useWorkspaceStore.getState().version + 1 });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-2xl text-[var(--text-primary)] font-sans p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] mb-4">
          <Terminal className="w-3.5 h-3.5" />
          <span>{commandId ? 'Edit Command' : 'New Command'}</span>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Command name (e.g. Mark as done & delay)"
            className={inputClass + ' w-full'}
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className={inputClass + ' w-full'}
          />

          <div>
            <label className="block text-[11px] text-[var(--text-faint)] mb-1">
              Scope (only show on nodes with this tag)
            </label>
            <select
              value={scopeTagId}
              onChange={(e) => setScopeTagId(e.target.value)}
              className={inputClass + ' w-full cursor-pointer'}
            >
              <option value="">All nodes</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.content}
                </option>
              ))}
            </select>
          </div>

          {/* Steps editor */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Steps (run in order)
            </div>
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center space-x-2 flex-wrap gap-y-1.5">
                <select
                  value={step.type}
                  onChange={(e) => updateStep(idx, newStep(e.target.value as CommandStep['type']))}
                  className={inputClass + ' cursor-pointer'}
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>

                {(step.type === 'setField' || step.type === 'shiftDate') && (
                  <select
                    value={step.fieldDefId}
                    onChange={(e) => updateStep(idx, { ...step, fieldDefId: e.target.value })}
                    className={inputClass + ' cursor-pointer'}
                  >
                    {fieldDefs.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.content}
                      </option>
                    ))}
                  </select>
                )}
                {step.type === 'setField' && (
                  <input
                    type="text"
                    value={String(step.value ?? '')}
                    onChange={(e) => updateStep(idx, { ...step, value: e.target.value })}
                    placeholder="value"
                    className={inputClass + ' w-28'}
                  />
                )}
                {step.type === 'shiftDate' && (
                  <input
                    type="number"
                    value={step.days}
                    onChange={(e) => updateStep(idx, { ...step, days: Number(e.target.value) })}
                    className={inputClass + ' w-20'}
                  />
                )}
                {(step.type === 'addTag' || step.type === 'removeTag') && (
                  <select
                    value={step.tagId}
                    onChange={(e) => updateStep(idx, { ...step, tagId: e.target.value })}
                    className={inputClass + ' cursor-pointer'}
                  >
                    {tags.map((t) => (
                      <option key={t.id} value={t.id}>
                        #{t.content}
                      </option>
                    ))}
                  </select>
                )}
                {step.type === 'setDone' && (
                  <select
                    value={String(step.done)}
                    onChange={(e) => updateStep(idx, { ...step, done: e.target.value === 'true' })}
                    className={inputClass + ' cursor-pointer'}
                  >
                    <option value="true">Done</option>
                    <option value="false">Not done</option>
                  </select>
                )}
                {step.type === 'moveTo' && (
                  <input
                    type="text"
                    value={step.targetParentId}
                    onChange={(e) => updateStep(idx, { ...step, targetParentId: e.target.value })}
                    placeholder="target node id"
                    className={inputClass + ' w-40 font-mono'}
                  />
                )}

                <button
                  type="button"
                  onClick={() => setSteps(steps.filter((_, i) => i !== idx))}
                  aria-label="Remove step"
                  className="p-1 text-[var(--text-faint)] hover:text-[var(--red)] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSteps([...steps, newStep('setDone')])}
              className="flex items-center space-x-1 text-[12px] text-[var(--accent)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add step</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end space-x-2.5 pt-5 mt-5 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 bg-[var(--bg-raised)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-[8px] text-[13px] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!name.trim() || steps.length === 0}
            className="h-9 px-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer disabled:opacity-50"
          >
            Save Command
          </button>
        </div>
      </div>
    </div>
  );
};
