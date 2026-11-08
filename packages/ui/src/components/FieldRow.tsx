import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Plus, FileText, ExternalLink } from 'lucide-react';
import { FieldType, FieldOption } from '@hecate/core';
import { DatePicker } from './DatePicker';

export interface NodeReferenceOption {
  id: string;
  title: string;
  tags?: string[];
}

export interface FieldRowProps {
  name: string;
  type?: FieldType;
  value: string;
  options?: FieldOption[];
  onChange: (newValue: string) => void;
  className?: string;
  min?: number;
  max?: number;
  required?: boolean;
  onSearchNodes?: (query: string) => Promise<NodeReferenceOption[]>;
  onCreateNode?: (title: string) => Promise<{ id: string; title: string }>;
  onOpenNode?: (nodeId: string, openInSidePanel: boolean) => void;
  resolveNodeTitle?: (nodeId: string) => Promise<string | null>;
}

export const FieldRow: React.FC<FieldRowProps> = ({
  name,
  type = 'text',
  value,
  options = [],
  onChange,
  className = '',
  min,
  max,
  required = false,
  onSearchNodes,
  onCreateNode,
  onOpenNode,
  resolveNodeTitle,
}) => {
  const [editing, setEditing] = useState(false);
  const [tempVal, setTempVal] = useState(value);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Bracket trigger [[ auto-completion state
  const [bracketState, setBracketState] = useState<{
    active: boolean;
    query: string;
    from: number;
    to: number;
  }>({
    active: false,
    query: '',
    from: 0,
    to: 0,
  });
  const [nodeResults, setNodeResults] = useState<NodeReferenceOption[]>([]);
  const [activeNodeIndex, setActiveNodeIndex] = useState(0);
  const [resolvedTitles, setResolvedTitles] = useState<Record<string, string>>({});

  // Sync tempVal when value changes externally
  useEffect(() => {
    setTempVal(value);
  }, [value]);

  // Resolve titles for any referenced nodes in value
  useEffect(() => {
    if (!value || !resolveNodeTitle) return;
    const regex = /\[\[node:([A-Za-z0-9_-]+)\]\]/g;
    let m: RegExpExecArray | null;
    const ids: string[] = [];
    while ((m = regex.exec(value)) !== null) {
      ids.push(m[1]);
    }
    for (const id of ids) {
      if (!resolvedTitles[id]) {
        resolveNodeTitle(id).then((t) => {
          if (t) {
            setResolvedTitles((prev) => ({ ...prev, [id]: t }));
          }
        });
      }
    }
  }, [value, resolveNodeTitle]);

  // Query nodes when bracket trigger is active
  useEffect(() => {
    if (!bracketState.active || !onSearchNodes) {
      setNodeResults([]);
      return;
    }
    let isMounted = true;
    const q = bracketState.query.trim().toLowerCase();

    onSearchNodes(bracketState.query).then((results) => {
      if (!isMounted) return;
      const sorted = (results || []).sort((a, b) => {
        const aStarts = a.title.toLowerCase().startsWith(q);
        const bStarts = b.title.toLowerCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.title.localeCompare(b.title);
      });
      setNodeResults(sorted);
    });

    return () => {
      isMounted = false;
    };
  }, [bracketState.active, bracketState.query, onSearchNodes]);

  // Normalize field type: if name is "due" or "date", treat as date
  const isDateField = type === 'date' || name.toLowerCase() === 'due' || name.toLowerCase().includes('date');
  const isOptionsField = type === 'options' || (options && options.length > 0);
  const isBooleanField = type === 'boolean';
  const isNumberField = type === 'number';
  const isUrlField = type === 'url';

  // Format date display & raw date value
  const dateMatch = value ? value.match(/\b(\d{4}-\d{2}-\d{2})\b/) : null;
  const rawDate = dateMatch ? dateMatch[1] : '';

  const formatDateDisplay = (isoDate: string) => {
    if (!isoDate || isoDate.trim() === '' || isoDate.toLowerCase() === 'empty') return '';
    try {
      const parts = isoDate.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {}
    return isoDate;
  };

  useEffect(() => {
    if (isDateField && (popoverOpen || editing)) {
      try {
        dateInputRef.current?.showPicker?.();
      } catch {}
    }
  }, [isDateField, popoverOpen, editing]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
        if (editing) {
          handleBlur();
        }
      }
    }
    if (popoverOpen || editing) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen, editing, tempVal, value]);

  const handleBlur = () => {
    setEditing(false);
    setBracketState({ active: false, query: '', from: 0, to: 0 });
    let next = tempVal;

    // REQ-4.6: type mismatches rejected at input; number clamped to min/max
    if (isNumberField && next.trim() !== '') {
      const num = Number(next);
      if (Number.isNaN(num)) {
        setTempVal(value);
        return;
      }
      let clamped = num;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      next = String(clamped);
      setTempVal(next);
    }

    if (isUrlField && next.trim() !== '') {
      const normalized = /^https?:\/\//i.test(next) ? next : `https://${next}`;
      try {
        new URL(normalized);
        next = normalized;
        setTempVal(next);
      } catch {
        setTempVal(value);
        return;
      }
    }

    if (next !== value) {
      onChange(next);
    }
  };

  const handleDateSelect = (isoDate: string) => {
    onChange(isoDate ? `[[date:${isoDate}]]` : '');
    setPopoverOpen(false);
    setEditing(false);
  };

  const checkBracketTrigger = (val: string, cursorPos: number) => {
    if (!onSearchNodes) return;
    const beforeCursor = val.slice(0, cursorPos);
    const match = beforeCursor.match(/(?:^|\s)\[\[([^\]]*)$/);
    if (match) {
      const query = match[1];
      const matchStart = beforeCursor.lastIndexOf('[[');
      setBracketState({
        active: true,
        query,
        from: matchStart,
        to: cursorPos,
      });
      setActiveNodeIndex(0);
    } else {
      setBracketState((prev) => (prev.active ? { active: false, query: '', from: 0, to: 0 } : prev));
    }
  };

  const handleSelectNode = (selectedNode: NodeReferenceOption) => {
    const { from, to } = bracketState;
    const before = tempVal.slice(0, from);
    const after = tempVal.slice(to);
    const insertText = `[[node:${selectedNode.id}]]`;
    const newVal = (before + insertText + after).trim();
    setTempVal(newVal);
    setBracketState({ active: false, query: '', from: 0, to: 0 });
    setResolvedTitles((prev) => ({ ...prev, [selectedNode.id]: selectedNode.title }));
    onChange(newVal);
    setEditing(false);
  };

  const handleCreateAndSelectNode = async (queryText: string) => {
    if (!onCreateNode || !queryText.trim()) return;
    const created = await onCreateNode(queryText.trim());
    const { from, to } = bracketState;
    const before = tempVal.slice(0, from);
    const after = tempVal.slice(to);
    const insertText = `[[node:${created.id}]]`;
    const newVal = (before + insertText + after).trim();
    setTempVal(newVal);
    setBracketState({ active: false, query: '', from: 0, to: 0 });
    setResolvedTitles((prev) => ({ ...prev, [created.id]: created.title }));
    onChange(newVal);
    setEditing(false);
  };

  const isEmpty =
    !value ||
    value.trim() === '' ||
    value.trim().toLowerCase() === 'empty' ||
    (isDateField && !rawDate);

  // Helper to render formatted field value with node references
  const renderFieldValue = () => {
    if (isBooleanField) {
      return value === '1' ? 'Yes' : 'No';
    }
    if (isUrlField) {
      try {
        const u = new URL(value);
        return (
          <span className="inline-flex items-center gap-1.5">
            <img
              src={`https://www.google.com/s2/favicons?domain=${u.hostname}&sz=16`}
              alt=""
              className="w-3 h-3 rounded-[2px]"
            />
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[var(--blue)] hover:text-[var(--text-primary)] underline underline-offset-2"
            >
              {u.hostname}
            </a>
          </span>
        );
      } catch {
        return <span>{value}</span>;
      }
    }
    if (isDateField) {
      return formatDateDisplay(rawDate) || 'Set date';
    }
    // Check if contains [[node:<id>]]
    const parts = value.split(/(\[\[node:[A-Za-z0-9_-]+\]\])/g);
    if (parts.length === 1 && !parts[0].startsWith('[[node:')) {
      return <span>{value}</span>;
    }

    return (
      <span className="inline-flex items-center flex-wrap gap-1">
        {parts.map((part, i) => {
          const match = part.match(/^\[\[node:([A-Za-z0-9_-]+)\]\]$/);
          if (match) {
            const targetId = match[1];
            const displayTitle = resolvedTitles[targetId] || 'Referenced note';
            return (
              <span
                key={i}
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNode?.(targetId, e.metaKey || e.ctrlKey);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    onOpenNode?.(targetId, e.metaKey || e.ctrlKey);
                  }
                }}
                className="text-[var(--accent)] hover:text-[var(--text-primary)] underline decoration-[var(--accent-decoration)] decoration-dashed underline-offset-2 font-medium cursor-pointer transition-colors"
                title="Click to open node, Cmd+Click for side panel"
              >
                {displayTitle}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  // 1. Empty field renders as dashed pill with "+ Name"
  if (isEmpty && !editing && !popoverOpen) {
    return (
      <div ref={containerRef} className={`relative inline-flex items-center my-0.5 mr-2 ${className}`}>
        <button
          type="button"
          onClick={() => {
            if (isDateField) {
              setPopoverOpen(true);
            } else if (isOptionsField) {
              setPopoverOpen(true);
            } else if (isBooleanField) {
              onChange('1');
            } else {
              setTempVal('');
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          className="h-6 px-2 inline-flex items-center space-x-1 border border-dashed border-[var(--border-strong)] hover:border-[var(--text-muted)] rounded-[6px] text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors duration-120 cursor-pointer bg-transparent"
        >
          {isDateField && <Calendar className="w-3 h-3 text-[var(--text-muted)]" />}
          <span>+ {name}</span>
          {required && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--red)]"
              title="Required field is empty"
            />
          )}
        </button>
      </div>
    );
  }

  const queryTrimmed = bracketState.query.trim();
  const canCreateInField = Boolean(
    onCreateNode &&
      queryTrimmed &&
      !nodeResults.some((n) => n.title.toLowerCase() === queryTrimmed.toLowerCase())
  );
  const totalItemCount = nodeResults.length + (canCreateInField ? 1 : 0);

  return (
    <div ref={containerRef} className={`relative inline-flex items-center my-0.5 mr-2 select-none ${className}`}>
      {/* Custom Date Picker Popover */}
      {isDateField && (popoverOpen || editing) ? (
        <div className="relative inline-flex items-center">
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              setEditing(false);
            }}
            className="h-6 px-2 inline-flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--accent)] rounded-[6px] text-[12px] cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span className="text-[var(--text-muted)] font-normal">{name}:</span>
            <span className="text-[var(--text-primary)] font-medium">
              {formatDateDisplay(rawDate) || 'Pick date...'}
            </span>
          </button>

          <div className="absolute left-0 top-full mt-1.5 z-50">
            <DatePicker
              value={rawDate}
              onChange={(newIso) => handleDateSelect(newIso)}
              onClose={() => {
                setPopoverOpen(false);
                setEditing(false);
              }}
            />
          </div>
        </div>
      ) : isOptionsField && (popoverOpen || editing) ? (
        /* Options Dropdown */
        <div className="relative inline-flex items-center">
          <div className="h-6 inline-flex items-center bg-[var(--bg-raised)] border border-[var(--accent)] rounded-[6px] px-2 text-[12px]">
            <span className="text-[var(--text-muted)] mr-1.5">{name}:</span>
            <select
              autoFocus
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setPopoverOpen(false);
                setEditing(false);
              }}
              onBlur={() => {
                setPopoverOpen(false);
                setEditing(false);
              }}
              className="bg-transparent text-[var(--text-primary)] text-[12px] focus:outline-none cursor-pointer"
            >
              <option value="" disabled>Select option...</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.label} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : editing ? (
        /* Text / Number Input with Inline [[ Autocomplete */
        <div className="relative inline-flex items-center">
          <div className="h-6 inline-flex items-center bg-[var(--bg-raised)] border border-[var(--accent)] rounded-[6px] px-2 text-[12px]">
            <span className="text-[var(--text-muted)] mr-1.5 shrink-0">{name}:</span>
            <input
              ref={inputRef}
              autoFocus
              type={isNumberField ? 'number' : 'text'}
              value={tempVal}
              onChange={(e) => {
                const val = e.target.value;
                const cursorPos = e.target.selectionStart ?? val.length;
                setTempVal(val);
                checkBracketTrigger(val, cursorPos);
              }}
              onSelect={(e) => {
                const target = e.target as HTMLInputElement;
                checkBracketTrigger(target.value, target.selectionStart ?? target.value.length);
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (!bracketState.active) {
                    handleBlur();
                  }
                }, 120);
              }}
              onKeyDown={(e) => {
                if (bracketState.active) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveNodeIndex((prev) => (prev + 1) % Math.max(1, totalItemCount));
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveNodeIndex((prev) => (prev - 1 + totalItemCount) % Math.max(1, totalItemCount));
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    if (activeNodeIndex < nodeResults.length) {
                      handleSelectNode(nodeResults[activeNodeIndex]);
                    } else if (canCreateInField) {
                      handleCreateAndSelectNode(queryTrimmed);
                    }
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setBracketState({ active: false, query: '', from: 0, to: 0 });
                    return;
                  }
                }

                if (e.key === 'Enter') handleBlur();
                if (e.key === 'Escape') {
                  setTempVal(value);
                  setEditing(false);
                  setBracketState({ active: false, query: '', from: 0, to: 0 });
                }
              }}
              className="bg-transparent text-[var(--text-primary)] text-[12px] focus:outline-none min-w-[140px] max-w-[260px]"
              placeholder="Type or [[ to link note"
            />
          </div>

          {/* Inline [[ Autocomplete Dropdown */}
          {bracketState.active && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] font-sans text-[var(--text-primary)] select-none animate-in fade-in zoom-in-95 duration-100"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="px-2 py-1 text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
                <span>Link Note</span>
                {queryTrimmed && <span className="text-[var(--accent)]">[[{queryTrimmed}]]</span>}
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5">
                {nodeResults.map((node, idx) => {
                  const isSelected = idx === activeNodeIndex;
                  return (
                    <div
                      key={node.id}
                      onMouseEnter={() => setActiveNodeIndex(idx)}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectNode(node);
                      }}
                      className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center justify-between text-[13px] transition-colors ${
                        isSelected
                          ? 'bg-[var(--bg-active)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]/40'
                          : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <span className="font-medium truncate mr-2">{node.title}</span>
                      {node.tags && node.tags.length > 0 && (
                        <div className="flex items-center space-x-1 shrink-0">
                          {node.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-active)] text-[var(--accent)] border border-[var(--border-strong)]"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {canCreateInField && (
                  <div
                    onMouseEnter={() => setActiveNodeIndex(nodeResults.length)}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateAndSelectNode(queryTrimmed);
                    }}
                    className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center space-x-2 text-[13px] text-[var(--accent)] transition-colors ${
                      activeNodeIndex === nodeResults.length
                        ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent)]/40'
                        : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create note &quot;{queryTrimmed}&quot;</span>
                  </div>
                )}

                {nodeResults.length === 0 && !canCreateInField && (
                  <div className="px-2 py-3 text-center text-[12px] text-[var(--text-faint)]">
                    No matching notes found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Display Pill */
        <div
          onClick={() => {
            if (isBooleanField) {
              onChange(value === '1' ? '0' : '1');
            } else if (isDateField || isOptionsField) {
              setPopoverOpen(true);
            } else {
              setTempVal(value);
              setEditing(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          className="h-6 px-2 inline-flex items-center space-x-1.5 bg-[var(--bg-raised)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] rounded-[6px] text-[12px] cursor-pointer transition-colors duration-120"
        >
          {isDateField && <Calendar className="w-3 h-3 text-[var(--text-muted)]" />}
          <span className="text-[var(--text-muted)] font-normal">{name}:</span>
          <span className="text-[var(--text-secondary)] font-medium">{renderFieldValue()}</span>
          {isOptionsField && <ChevronDown className="w-3 h-3 text-[var(--text-faint)]" />}
        </div>
      )}
    </div>
  );
};
