import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

export interface CaptureBarTagOption {
  id: string;
  name: string;
  color?: string;
  fieldCount?: number;
}

export interface CaptureBarProps {
  onCapture: (content: string) => void;
  placeholder?: string;
  className?: string;
  availableTags?: CaptureBarTagOption[];
}

export const CaptureBar: React.FC<CaptureBarProps> = ({
  onCapture,
  placeholder = 'Capture anything…',
  className = '',
  availableTags = [],
}) => {
  const [value, setValue] = useState('');
  const [hashState, setHashState] = useState<{
    active: boolean;
    prefix: string;
    from: number;
    to: number;
  }>({
    active: false,
    prefix: '',
    from: 0,
    to: 0,
  });
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global 'C' shortcut to focus capture bar when not editing
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName;
      const isInput =
        activeTag === 'INPUT' ||
        activeTag === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable;
      if (e.key.toLowerCase() === 'c' && !isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setHashState({ active: false, prefix: '', from: 0, to: 0 });
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkHashTrigger = (val: string, cursor: number) => {
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/(?:^|\s)#([a-zA-Z0-9_\-]*)$/);
    if (match) {
      const prefix = match[1];
      const hashPos = cursor - prefix.length - 1;
      setHashState({
        active: true,
        prefix,
        from: hashPos,
        to: cursor,
      });
      setActiveIndex(0);
    } else {
      setHashState({ active: false, prefix: '', from: 0, to: 0 });
    }
  };

  const getFilteredTags = () => {
    const cleanPrefix = (hashState.prefix || '').toLowerCase().trim();
    if (!cleanPrefix) return availableTags;
    return availableTags
      .filter((t) => t.name.toLowerCase().includes(cleanPrefix))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(cleanPrefix);
        const bStarts = b.name.toLowerCase().startsWith(cleanPrefix);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.name.localeCompare(b.name);
      });
  };

  const handleSelectTag = (tagName: string) => {
    const { from, to } = hashState;
    const cleanName = tagName.trim().replace(/^#/, '');
    const before = value.slice(0, from);
    const after = value.slice(to);
    const hasSpaceBefore = from === 0 || /\s$/.test(before);
    const prefixStr = hasSpaceBefore ? '' : ' ';
    const newValue = `${before}${prefixStr}#${cleanName} ${after.trimStart()}`;
    setValue(newValue);
    setHashState({ active: false, prefix: '', from: 0, to: 0 });

    const newCursor = from + prefixStr.length + cleanName.length + 2; // '#' + cleanName + ' '
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (hashState.active) {
      const filtered = getFilteredTags();
      const prefix = hashState.prefix.trim();
      const canCreate = Boolean(
        prefix && !filtered.some((t) => t.name.toLowerCase() === prefix.toLowerCase())
      );
      const totalCount = filtered.length + (canCreate ? 1 : 0);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(1, totalCount));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + totalCount) % Math.max(1, totalCount));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (activeIndex < filtered.length) {
          handleSelectTag(filtered[activeIndex].name);
        } else if (canCreate) {
          handleSelectTag(prefix);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setHashState({ active: false, prefix: '', from: 0, to: 0 });
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onCapture(value.trim());
        setValue('');
        setHashState({ active: false, prefix: '', from: 0, to: 0 });
      }
    } else if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setValue(val);
    checkHashTrigger(val, cursor);
  };

  const handleInsertTrigger = (trigger: string) => {
    const newVal = value ? `${value} ${trigger}` : trigger;
    setValue(newVal);
    if (trigger === '#') {
      const cursor = newVal.length;
      setHashState({
        active: true,
        prefix: '',
        from: cursor - 1,
        to: cursor,
      });
      setActiveIndex(0);
    }
    inputRef.current?.focus();
  };

  const filteredTags = getFilteredTags();
  const currentPrefix = hashState.prefix.trim();
  const canCreate = Boolean(
    currentPrefix && !filteredTags.some((t) => t.name.toLowerCase() === currentPrefix.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="h-12 px-3 bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-[var(--border-accent)] focus-within:border-[var(--accent)] rounded-[10px] flex items-center space-x-2 transition-colors duration-120"
      >
        <button
          type="button"
          aria-label="Add note"
          onClick={() => {
            if (value.trim()) {
              onCapture(value.trim());
              setValue('');
              setHashState({ active: false, prefix: '', from: 0, to: 0 });
            } else {
              inputRef.current?.focus();
            }
          }}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
        />

        {/* Triggers: # tag, [[ link, > field, @ date */}
        <div className="hidden sm:flex items-center space-x-1.5 select-none font-mono text-[11px] text-[var(--text-faint)]">
          <button
            type="button"
            onClick={() => handleInsertTrigger('#')}
            className="px-1.5 py-0.5 rounded-[4px] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            title="Insert Tag trigger"
          >
            # tag
          </button>
          <button
            type="button"
            onClick={() => handleInsertTrigger('[[')}
            className="px-1.5 py-0.5 rounded-[4px] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            title="Insert Reference trigger"
          >
            [[ link
          </button>
          <button
            type="button"
            onClick={() => handleInsertTrigger('>')}
            className="px-1.5 py-0.5 rounded-[4px] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            title="Insert Field trigger"
          >
            &gt; field
          </button>
          <button
            type="button"
            onClick={() => handleInsertTrigger('@')}
            className="px-1.5 py-0.5 rounded-[4px] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            title="Insert Date trigger"
          >
            @ date
          </button>
        </div>
      </div>

      {/* Supertag Autocomplete Dropdown */}
      {hashState.active && (
        <div
          className="absolute z-50 left-3 top-full mt-1.5 w-64 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] font-sans text-[var(--text-primary)] select-none animate-in fade-in zoom-in-95 duration-100"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="px-2 py-1 text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
            <span>Supertags</span>
            {currentPrefix && <span className="text-[var(--accent)]">#{currentPrefix}</span>}
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredTags.map((t, idx) => {
              const isSelected = idx === activeIndex;
              const color = t.color || 'var(--accent)';

              return (
                <div
                  key={t.id || t.name}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => handleSelectTag(t.name)}
                  className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center justify-between text-[13px] transition-colors ${
                    isSelected
                      ? 'bg-[var(--bg-active)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]/40'
                      : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
                    <span className="font-medium">#{t.name}</span>
                  </div>
                  {t.fieldCount !== undefined && t.fieldCount > 0 && (
                    <span className="text-[11px] font-mono text-[var(--text-faint)]">
                      {t.fieldCount} {t.fieldCount === 1 ? 'field' : 'fields'}
                    </span>
                  )}
                </div>
              );
            })}

            {canCreate && (
              <div
                onMouseEnter={() => setActiveIndex(filteredTags.length)}
                onClick={() => handleSelectTag(currentPrefix)}
                className={`px-2.5 py-1.5 rounded-[6px] cursor-pointer flex items-center space-x-2 text-[13px] text-[var(--accent)] transition-colors ${
                  activeIndex === filteredTags.length
                    ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent)]/40'
                    : 'hover:bg-[var(--bg-hover)]'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create #{currentPrefix}</span>
              </div>
            )}

            {filteredTags.length === 0 && !canCreate && (
              <div className="px-2.5 py-2 text-[12px] text-[var(--text-faint)] text-center">
                No matching supertags
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
