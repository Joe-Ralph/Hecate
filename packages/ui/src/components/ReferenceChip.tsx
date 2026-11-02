import React, { useState, useRef } from 'react';
import { Link2 } from 'lucide-react';

export interface ReferenceChipProps {
  targetId: string;
  title: string;
  previewContent?: string;
  previewChildren?: string[];
  onClick?: (targetId: string, openInSidePanel: boolean) => void;
  className?: string;
}

export const ReferenceChip: React.FC<ReferenceChipProps> = ({
  targetId,
  title,
  previewContent,
  previewChildren = [],
  onClick,
  className = '',
}) => {
  const [hovered, setHovered] = useState(false);
  const hoverTimeoutRef = useRef<any>(null);

  const handleMouseEnter = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHovered(true);
    }, 250);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHovered(false);
  };

  return (
    <span
      className={`relative inline-flex items-center align-middle mx-1 select-none ${className}`}
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
        className="h-[22px] px-1.5 inline-flex items-center space-x-1 bg-[#141414] border border-[#333333] hover:border-[#ffffff] transition-colors duration-150 cursor-pointer text-[#ffffff]"
        title="Click to navigate, Cmd+Click to open in side panel"
      >
        <Link2 className="w-[11px] h-[11px] text-[#888888]" strokeWidth={2} />
        <span className="text-[13px] font-medium leading-none">{title || 'Untitled Node'}</span>
      </button>

      {hovered && (previewContent || previewChildren.length > 0) && (
        <div
          className="absolute z-50 left-0 bottom-full mb-1.5 w-64 bg-[#0a0a0a] border border-[#333333] p-2.5 font-sans shadow-2xl pointer-events-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-[#555555] font-mono uppercase tracking-[1.5px] border-b border-[#222222] pb-1 mb-1.5">
            NODE PREVIEW
          </div>
          <div className="text-[13px] text-[#ffffff] font-medium mb-1">
            {previewContent || title}
          </div>
          {previewChildren.length > 0 && (
            <div className="space-y-1 mt-2 pt-1 border-t border-[#222222]">
              {previewChildren.slice(0, 3).map((child, idx) => (
                <div key={idx} className="flex items-center space-x-1.5 text-[11px] text-[#888888]">
                  <div className="w-1 h-1 bg-[#555555]" />
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
