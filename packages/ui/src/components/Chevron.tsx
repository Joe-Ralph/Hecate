import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface ChevronProps {
  expanded: boolean;
  hasChildren: boolean;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export const Chevron: React.FC<ChevronProps> = ({
  expanded,
  hasChildren,
  onClick,
  className = '',
}) => {
  if (!hasChildren) {
    return <div className="w-[14px] h-[14px]" />;
  }

  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      className={`w-[14px] h-[14px] flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-transform duration-100 ease-out ${className}`}
      title={expanded ? 'Collapse' : 'Expand'}
    >
      <ChevronRight
        className={`w-3.5 h-3.5 transition-transform duration-100 ${
          expanded ? 'rotate-90 text-[var(--text-muted)]' : ''
        }`}
        strokeWidth={2}
      />
    </button>
  );
};
