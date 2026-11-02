import React, { useState, useRef, useEffect } from 'react';
import { Tag, ExternalLink, ListFilter, Trash2 } from 'lucide-react';

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
  color = '#888888',
  onOpenDefinition,
  onViewInstances,
  onRemove,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
          setOpen(!open);
        }}
        className="h-5 px-1.5 flex items-center space-x-1.5 bg-[#111111] border border-[#333333] hover:border-[#888888] transition-colors duration-150 cursor-pointer"
        style={{ borderLeft: `2px solid ${color}` }}
        title={`#${name}`}
      >
        <span className="text-[10px] text-[#888888]">#</span>
        <span className="text-[11px] font-medium uppercase tracking-[1px] text-[#ffffff]">
          {name}
        </span>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 top-full mt-1 w-48 bg-[#0a0a0a] border border-[#333333] p-1 font-mono text-[11px] text-[#ffffff] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[10px] text-[#555555] uppercase tracking-[2px] border-b border-[#222222] mb-1">
            #{name}
          </div>
          {onOpenDefinition && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onOpenDefinition(id);
              }}
              className="w-full flex items-center space-x-2 px-2 py-1.5 hover:bg-[#161616] text-left text-[#ffffff] cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#888888]" strokeWidth={2} />
              <span>OPEN DEFINITION</span>
            </button>
          )}
          {onViewInstances && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onViewInstances(id);
              }}
              className="w-full flex items-center space-x-2 px-2 py-1.5 hover:bg-[#161616] text-left text-[#ffffff] cursor-pointer"
            >
              <ListFilter className="w-3.5 h-3.5 text-[#888888]" strokeWidth={2} />
              <span>VIEW INSTANCES</span>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove(id);
              }}
              className="w-full flex items-center space-x-2 px-2 py-1.5 hover:bg-[#161616] text-[#cc3333] text-left cursor-pointer border-t border-[#222222] mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
              <span>REMOVE TAG</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
