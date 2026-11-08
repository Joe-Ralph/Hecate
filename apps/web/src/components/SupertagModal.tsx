import React, { useState, useEffect } from 'react';
import { X, Tag, Plus, Trash2, Check, Sparkles, ChevronDown } from 'lucide-react';
import { TagDefMeta, TagFieldDefConfig, NodeRecord, DefaultContentItem, parseTanaPaste } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export interface SupertagModalProps {
  isOpen: boolean;
  tagId?: string | null;
  initialName?: string;
  onClose: () => void;
  onSaved?: (tagId: string) => void;
}

const PRESET_COLORS = [
  'var(--green)', // Green (task)
  'var(--gold)', // Gold (book)
  'var(--blue)', // Soft blue (person)
  'var(--accent)', // Violet (default accent)
  '#f87171', // Red
  '#38bdf8', // Sky
  '#a78bfa', // Purple
  '#fb923c', // Orange
];

function serializeDefaultContent(items: DefaultContentItem[], depth = 0): string {
  return items
    .map(
      (i) =>
        `${'  '.repeat(depth)}- ${i.content}` +
        (i.children ? `\n${serializeDefaultContent(i.children, depth + 1)}` : '')
    )
    .join('\n');
}

function parseDefaultContent(text: string): DefaultContentItem[] {
  if (!text.trim()) return [];
  const parsed = parseTanaPaste(`%%tana%%\n${text}`);
  const map = (nodes: typeof parsed): DefaultContentItem[] =>
    nodes.map((n) => ({
      content: n.content,
      kind: 'content' as const,
      children: n.children.length > 0 ? map(n.children) : undefined,
    }));
  return map(parsed);
}

export const SupertagModal: React.FC<SupertagModalProps> = ({
  isOpen,
  tagId,
  initialName = '',
  onClose,
  onSaved,
}) => {
  const store = useWorkspaceStore();

  const [name, setName] = useState(initialName);
  const [color, setColor] = useState('var(--accent)');
  const [showCheckbox, setShowCheckbox] = useState(false);
  const [extendsIds, setExtendsIds] = useState<string[]>([]);
  const [defaultContentText, setDefaultContentText] = useState('');
  const [fieldConfigs, setFieldConfigs] = useState<Array<TagFieldDefConfig & { name: string; type: string }>>([]);

  const [allTags, setAllTags] = useState<NodeRecord[]>([]);
  const [allFieldDefs, setAllFieldDefs] = useState<NodeRecord[]>([]);

  // Add field form state
  const [showAddField, setShowAddField] = useState(false);
  const [selectedFieldDefId, setSelectedFieldDefId] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'date' | 'options' | 'number' | 'boolean' | 'url' | 'nodeRef'>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('Inbox, Doing, Done');
  const [newFieldDefault, setNewFieldDefault] = useState('');

  useEffect(() => {
    if (!store.db || !isOpen) return;

    // Load all tags and fieldDefs
    store.db.tags.getAllTags().then((tags) => {
      setAllTags(tags.filter((t) => t.id !== tagId));
    });

    store.db.tags.getAllFieldDefs().then(setAllFieldDefs);

    if (tagId) {
      store.db.tags.getTag(tagId).then(async (tag) => {
        if (!tag || !store.db) return;
        setName(tag.content);
        const meta = (tag.meta as TagDefMeta) || {};
        setColor(meta.color || 'var(--accent)');
        setShowCheckbox(Boolean(meta.showCheckbox));
        setExtendsIds(meta.extends || []);
        setDefaultContentText(serializeDefaultContent(meta.defaultContent || []));

        // Resolve field names and types for existing configs
        const configs = meta.fieldDefs || [];
        const resolved: Array<TagFieldDefConfig & { name: string; type: string }> = [];
        for (const cfg of configs) {
          const fdef = await store.db.nodes.getById(cfg.fieldDefId);
          resolved.push({
            ...cfg,
            name: fdef?.content || 'Field',
            type: (fdef?.meta as any)?.type || 'text',
          });
        }
        setFieldConfigs(resolved);
      });
    } else {
      setName(initialName);
      setColor('var(--accent)');
      setShowCheckbox(initialName.toLowerCase() === 'task');
      setExtendsIds([]);
      setDefaultContentText('');
      setFieldConfigs([]);
    }
  }, [isOpen, tagId, initialName, store.db]);

  if (!isOpen) return null;

  const handleAddFieldToTag = async () => {
    if (!store.db) return;

    let targetFieldDefId = selectedFieldDefId;

    // If creating a brand new field definition
    if (!targetFieldDefId && newFieldName.trim()) {
      let optionsList: any[] | undefined = undefined;
      if (newFieldType === 'options') {
        optionsList = newFieldOptions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label, idx) => ({
            id: `opt-${idx}-${label.toLowerCase().replace(/\s+/g, '-')}`,
            label,
          }));
      }

      const created = await store.db.tags.createFieldDef(newFieldName.trim(), {
        type: newFieldType,
        options: optionsList,
        defaultValue: newFieldDefault || undefined,
      });
      targetFieldDefId = created.id;

      // Update local cache of allFieldDefs
      const updated = await store.db.tags.getAllFieldDefs();
      setAllFieldDefs(updated);
    }

    if (!targetFieldDefId) return;

    // Get field definition info
    const fdef = await store.db.nodes.getById(targetFieldDefId);
    const fName = fdef?.content || newFieldName || 'Field';
    const fType = (fdef?.meta as any)?.type || newFieldType;

    // Add to list if not already present
    if (!fieldConfigs.some((f) => f.fieldDefId === targetFieldDefId)) {
      setFieldConfigs([
        ...fieldConfigs,
        {
          fieldDefId: targetFieldDefId,
          pinned: true,
          default: newFieldDefault || undefined,
          name: fName,
          type: fType,
        },
      ]);
    }

    // Reset add form
    setShowAddField(false);
    setSelectedFieldDefId('');
    setNewFieldName('');
    setNewFieldDefault('');
  };

  const handleRemoveField = (fieldDefId: string) => {
    setFieldConfigs(fieldConfigs.filter((f) => f.fieldDefId !== fieldDefId));
  };

  const handleSave = async () => {
    if (!store.db || !name.trim()) return;

    const cleanName = name.trim().replace(/^#/, '');
    const metaToSave: TagDefMeta = {
      color,
      extends: extendsIds,
      showCheckbox,
      fieldDefs: fieldConfigs.map((f) => ({
        fieldDefId: f.fieldDefId,
        pinned: f.pinned ?? true,
        default: f.default,
        required: f.required ?? false,
      })),
      defaultContent: parseDefaultContent(defaultContentText),
    };

    let savedId = tagId;
    if (tagId) {
      await store.db.tags.updateTag(tagId, cleanName, metaToSave);
    } else {
      const created = await store.db.tags.createTag(cleanName, metaToSave);
      savedId = created.id;
    }

    store.init(); // Refresh store data
    onSaved?.(savedId!);
    onClose();
  };

  const handleDeleteTag = async () => {
    if (!store.db || !tagId) return;
    if (confirm(`Are you sure you want to delete supertag #${name}? This cannot be undone.`)) {
      await store.db.tags.deleteTag(tagId);
      store.init();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.5)] text-[var(--text-primary)] font-sans p-6 relative max-h-[90vh] overflow-y-auto animate-in fade-in duration-140"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-5 right-5 p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        <div className="flex items-center space-x-2 text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] mb-1 font-medium">
          <Tag className="w-3.5 h-3.5" />
          <span>{tagId ? 'Edit Supertag' : 'New Supertag'}</span>
        </div>

        <h3 className="text-xl font-semibold mb-5 text-[var(--text-primary)]">
          {tagId ? `Configure #${name}` : 'Create Supertag'}
        </h3>

        <div className="space-y-5">
          {/* Tag Name */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1.5">
              Supertag Name
            </label>
            <div className="flex items-center bg-[var(--bg-raised)] border border-[var(--border-strong)] focus-within:border-[var(--accent)] rounded-[8px] px-3 h-10">
              <span className="text-[var(--text-faint)] mr-1">#</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="tag_name (e.g. task, book, project)"
                className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] focus:outline-none"
              />
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1.5">
              Tag Color
            </label>
            <div className="flex items-center space-x-2.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                    color === c ? 'scale-110 ring-2 ring-white/60' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="w-4 h-4 text-[var(--bg-app)]" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          {/* Checkbox Toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[8px]">
            <div>
              <div className="text-[13px] font-medium text-[var(--text-primary)]">Show Task Checkbox</div>
              <div className="text-[11px] text-[var(--text-faint)]">
                Nodes with this tag will display a completion checkbox (18px)
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowCheckbox(!showCheckbox)}
              className={`w-11 h-6 rounded-full transition-colors duration-150 p-1 flex items-center cursor-pointer ${
                showCheckbox ? 'bg-[var(--green)] justify-end' : 'bg-[var(--border-subtle)] justify-start'
              }`}
            >
              <div className={`w-4 h-4 rounded-full ${showCheckbox ? 'bg-[var(--bg-app)]' : 'bg-[var(--text-muted)]'}`} />
            </button>
          </div>

          {/* Inheritance / Extends (multi-select per REQ-3.3) */}
          <div>
            <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1.5">
              Inherit Fields from (Extends, multi-select)
            </label>
            <div className="max-h-32 overflow-y-auto bg-[var(--bg-raised)] border border-[var(--border-strong)] rounded-[8px] p-2 space-y-1">
              {allTags.length === 0 && (
                <div className="text-[12px] text-[var(--text-faint)] px-1 py-1">No other tags yet</div>
              )}
              {allTags.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center space-x-2 px-1.5 py-1 rounded-[6px] hover:bg-[var(--bg-active)] text-[13px] text-[var(--text-secondary)] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={extendsIds.includes(t.id)}
                    onChange={(e) =>
                      setExtendsIds(
                        e.target.checked
                          ? [...extendsIds, t.id]
                          : extendsIds.filter((id) => id !== t.id)
                      )
                    }
                  />
                  <span>#{t.content}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Fields Template Section */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[13px] font-medium text-[var(--text-primary)]">Template Fields</span>
                <span className="text-[11px] text-[var(--text-faint)] ml-2">
                  (Injected when #{name || 'tag'} is applied)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddField(!showAddField)}
                className="h-7 px-2.5 flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--border-strong)] hover:border-[var(--accent)] text-[var(--accent)] rounded-[6px] text-[12px] font-medium cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Field</span>
              </button>
            </div>

            {/* List of current fields */}
            {fieldConfigs.length === 0 ? (
              <div className="p-4 border border-dashed border-[var(--border-subtle)] rounded-[8px] text-center text-[12px] text-[var(--text-faint)]">
                No fields attached yet. Click "Add Field" to attach fields like Status, Due, or Priority.
              </div>
            ) : (
              <div className="space-y-1.5 mb-3">
                {fieldConfigs.map((f) => (
                  <div
                    key={f.fieldDefId}
                    className="p-2.5 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[8px] flex items-center justify-between text-[13px]"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-[var(--text-primary)]">{f.name}</span>
                      <span className="px-1.5 py-0.5 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-muted)]">
                        {f.type}
                      </span>
                      {f.default && (
                        <span className="text-[11px] text-[var(--text-faint)]">
                          (Default: {f.default})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFieldConfigs(
                            fieldConfigs.map((c) =>
                              c.fieldDefId === f.fieldDefId ? { ...c, pinned: !c.pinned } : c
                            )
                          )
                        }
                        title="Pinned fields show even when the node is collapsed"
                        className={`px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] border cursor-pointer ${
                          f.pinned
                            ? 'bg-[var(--bg-accent-soft)] text-[var(--accent)] border-[var(--border-accent)]'
                            : 'bg-[var(--bg-surface)] text-[var(--text-faint)] border-[var(--border-subtle)]'
                        }`}
                      >
                        pin
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFieldConfigs(
                            fieldConfigs.map((c) =>
                              c.fieldDefId === f.fieldDefId ? { ...c, required: !c.required } : c
                            )
                          )
                        }
                        title="Required fields warn when empty"
                        className={`px-1.5 py-0.5 rounded-[4px] font-mono text-[10px] border cursor-pointer ${
                          f.required
                            ? 'bg-[var(--red-dim)] text-[var(--red)] border-[var(--red)]/40'
                            : 'bg-[var(--bg-surface)] text-[var(--text-faint)] border-[var(--border-subtle)]'
                        }`}
                      >
                        req
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(f.fieldDefId)}
                        aria-label="Remove field"
                        className="p-1 rounded-[4px] text-[var(--text-faint)] hover:text-[var(--red)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Inline Add Field Form */}
            {showAddField && (
              <div className="p-3 bg-[var(--bg-track)] border border-[var(--border-strong)] rounded-[8px] space-y-3 mt-2 animate-in fade-in duration-100">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Attach Field Definition
                </div>

                {/* Choose from existing */}
                <div>
                  <label className="block text-[11px] text-[var(--text-faint)] mb-1">
                    Choose existing field:
                  </label>
                  <select
                    value={selectedFieldDefId}
                    onChange={(e) => {
                      setSelectedFieldDefId(e.target.value);
                      if (e.target.value) setNewFieldName('');
                    }}
                    className="w-full h-8 px-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="">Or create new field below...</option>
                    {allFieldDefs.map((fd) => (
                      <option key={fd.id} value={fd.id} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                        {fd.content} ({(fd.meta as any)?.type || 'text'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Or create new */}
                {!selectedFieldDefId && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[var(--text-faint)] mb-1">
                        New field name:
                      </label>
                      <input
                        type="text"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        placeholder="e.g. Assignee, Due Date"
                        className="w-full h-8 px-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-faint)] mb-1">
                        Type:
                      </label>
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as any)}
                        className="w-full h-8 px-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="date">Date</option>
                        <option value="options">Options (Select)</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean (Toggle)</option>
                        <option value="url">URL</option>
                        <option value="nodeRef">Node Reference</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* If options type, enter comma separated choices */}
                {!selectedFieldDefId && newFieldType === 'options' && (
                  <div>
                    <label className="block text-[11px] text-[var(--text-faint)] mb-1">
                      Options (comma separated):
                    </label>
                    <input
                      type="text"
                      value={newFieldOptions}
                      onChange={(e) => setNewFieldOptions(e.target.value)}
                      placeholder="e.g. Inbox, Doing, Done"
                      className="w-full h-8 px-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none"
                    />
                  </div>
                )}

                {/* Optional default value */}
                <div>
                  <label className="block text-[11px] text-[var(--text-faint)] mb-1">
                    Default Value (optional):
                  </label>
                  <input
                    type="text"
                    value={newFieldDefault}
                    onChange={(e) => setNewFieldDefault(e.target.value)}
                    placeholder="e.g. Inbox, High, etc."
                    className="w-full h-8 px-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] text-[12px] text-[var(--text-primary)] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddField(false)}
                    className="h-7 px-2.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddFieldToTag}
                    disabled={!selectedFieldDefId && !newFieldName.trim()}
                    className="h-7 px-3 bg-[var(--accent)] text-[var(--bg-app)] rounded-[6px] text-[12px] font-medium hover:bg-[var(--accent-hover)] cursor-pointer disabled:opacity-50"
                  >
                    Attach Field
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Default Content Template (REQ-3.2) */}
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <label className="block text-[12px] font-medium text-[var(--text-muted)] mb-1.5">
              Default Content
            </label>
            <div className="text-[11px] text-[var(--text-faint)] mb-2">
              One node per line, two-space indent for children. Deep-copied into every node when
              this tag is applied.
            </div>
            <textarea
              value={defaultContentText}
              onChange={(e) => setDefaultContentText(e.target.value)}
              placeholder={'- First template node\n  - Nested child node\n- Second template node'}
              rows={4}
              className="w-full px-3 py-2 bg-[var(--bg-raised)] border border-[var(--border-strong)] focus:border-[var(--accent)] rounded-[8px] text-[13px] font-mono text-[var(--text-primary)] focus:outline-none resize-y"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-[var(--border-subtle)]">
          {tagId ? (
            <button
              type="button"
              onClick={handleDeleteTag}
              className="h-9 px-3 flex items-center space-x-1.5 text-[var(--red)] hover:bg-[var(--red)]/10 border border-[var(--red)]/30 rounded-[8px] text-[12px] font-medium cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Tag</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-[var(--bg-raised)] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-[8px] text-[13px] font-medium hover:border-[var(--text-muted)] cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim()}
              className="h-9 px-5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--bg-app)] rounded-[8px] text-[13px] font-medium cursor-pointer transition-colors disabled:opacity-50"
            >
              {tagId ? 'Save Changes' : 'Create Supertag'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
