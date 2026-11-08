import React, { useState, useRef, useEffect } from 'react';
import { ExternalLink, ListFilter, Trash2, Edit3 } from 'lucide-react';
import { COLORS } from '../tokens';

export interface TagChipProps {
  id: string;
  name: string;
  color?: string;
  onOpenDefinition?: (id: string) => void;
  onViewInstances?: (id: string) => void;
  onRemove?: (id: string) => void;
  className?: string;
}

export const TagChip: React.FC<TagChipProps> = ({
  id,
  name,
  onOpenDefinition,
  onViewInstances,
  onRemove,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Match tag colors from the design system palette
  const normalizedName = name.toLowerCase().replace(/^#/, '');
  let textColor = 'var(--accent)';
  let bgColor = 'var(--bg-accent-soft)';

  if (normalizedName === 'task') {
    textColor = COLORS.supertags.task.text;
    bgColor = COLORS.supertags.task.bg;
  } else if (normalizedName === 'book') {
    textColor = COLORS.supertags.book.text;
    bgColor = COLORS.supertags.book.bg;
  } else if (normalizedName === 'person') {
    textColor = COLORS.supertags.person.text;
    bgColor = COLORS.supertags.person.bg;
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative inline-flex items-center select-none ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey) {
            onViewInstances?.(id);
          } else {
            setOpen(!open);
          }
        }}
        className="h-[22px] px-2 inline-flex items-center space-x-1 rounded-[6px] text-[12px] font-medium transition-opacity duration-120 hover:opacity-85 cursor-pointer"
        style={{
          backgroundColor: bgColor,
          color: textColor,
        }}
        title={`#${normalizedName} (Cmd+Click to view instances)`}
      >
        <span>#{normalizedName}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 top-full mt-1.5 w-48 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-1.5 font-sans text-[13px] text-[var(--text-primary)] shadow-[0_12px_40px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-120"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2.5 py-1 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)] mb-1">
            #{normalizedName}
          </div>
          {onOpenDefinition && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenDefinition(id);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-[6px] hover:bg-[var(--bg-hover)] text-left text-[var(--text-primary)] cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[var(--accent)]" strokeWidth={2} />
              <span>Edit definition</span>
            </button>
          )}
          {onViewInstances && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onViewInstances(id);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-[6px] hover:bg-[var(--bg-hover)] text-left text-[var(--text-primary)] cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-[var(--text-muted)]" strokeWidth={2} />
              <span>View all instances</span>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove(id);
              }}
              className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-[6px] hover:bg-[var(--bg-hover)] text-[var(--red)] text-left cursor-pointer border-t border-[var(--border-subtle)] mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Remove tag</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
