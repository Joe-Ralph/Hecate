import React, { useState, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';

export interface ReferenceChipProps {
  targetId: string;
  title: string;
  previewContent?: string;
  previewChildren?: string[];
  loadPreview?: (targetId: string) => Promise<{ content: string; children: string[] }>;
  onClick?: (targetId: string, openInSidePanel: boolean) => void;
  variant?: 'inline' | 'chip';
  className?: string;
}

export const ReferenceChip: React.FC<ReferenceChipProps> = ({
  targetId,
  title,
  previewContent,
  previewChildren = [],
  loadPreview,
  onClick,
  variant = 'inline',
  className = '',
}) => {
  const [hovered, setHovered] = useState(false);
  const [loadedPreview, setLoadedPreview] = useState<{
    content: string;
    children: string[];
  } | null>(null);
  const hoverTimeoutRef = useRef<any>(null);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(true);
      if (!previewContent && !loadedPreview && loadPreview) {
        loadPreview(targetId).then(setLoadedPreview).catch(() => {});
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovered(false);
  };

  const displayTitle = title || 'Untitled Node';
  const effectivePreviewContent = previewContent ?? loadedPreview?.content;
  const effectivePreviewChildren =
    previewChildren.length > 0 ? previewChildren : (loadedPreview?.children ?? []);

  return (
    <span
      className={`relative inline-flex items-center align-baseline select-none min-w-0 max-w-full ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const isMetaOrCtrl = e.metaKey || e.ctrlKey;
          onClick?.(targetId, isMetaOrCtrl);
        }}
        className={
          variant === 'chip'
            ? 'inline-flex items-center gap-1 min-w-0 max-w-full text-[10px] font-mono text-[var(--accent)] hover:text-[var(--text-primary)] bg-[var(--bg-raised)] hover:bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-colors cursor-pointer'
            : 'inline-flex items-center min-w-0 max-w-full text-[var(--accent)] hover:text-[var(--text-primary)] underline decoration-[var(--accent-decoration)] decoration-dashed underline-offset-4 font-normal transition-colors duration-120 cursor-pointer'
        }
        title={`${displayTitle} (Click to open, Cmd+Click for side panel)`}
      >
        <span className="truncate min-w-0">{displayTitle}</span>
        {variant === 'chip' && (
          <ArrowUpRight className="w-2.5 h-2.5 text-[var(--text-faint)] shrink-0" />
        )}
      </button>

      {hovered && (effectivePreviewContent || effectivePreviewChildren.length > 0) && (
        <div
          className="absolute z-50 left-0 bottom-full mb-2 w-72 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[10px] p-3 font-sans shadow-[0_12px_40px_rgba(0,0,0,0.5)] pointer-events-none animate-in fade-in duration-140"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider border-b border-[var(--border-subtle)] pb-1 mb-2">
            Reference Preview
          </div>
          <div className="text-[14px] text-[var(--text-primary)] font-medium mb-1">
            {effectivePreviewContent || displayTitle}
          </div>
          {effectivePreviewChildren.length > 0 && (
            <div className="space-y-1.5 mt-2.5 pt-2 border-t border-[var(--border-subtle)]">
              {effectivePreviewChildren.slice(0, 5).map((child, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-[12px] text-[var(--text-muted)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-faint)]" />
                  <span className="truncate">{child}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </span>
  );
};
