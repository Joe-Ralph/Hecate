import React from 'react';

export interface BulletProps {
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
  className?: string;
  title?: string;
}

export const Bullet: React.FC<BulletProps> = ({
  hasChildren = false,
  isCollapsed = false,
  onClick,
  onDragStart,
  draggable = true,
  className = '',
  title = 'Click to zoom, Cmd+Click to open in side panel, drag to move',
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(e as any);
        }
      }}
      className={`w-5 h-5 flex items-center justify-center cursor-pointer select-none group shrink-0 ${className}`}
    >
      <div
        className={`w-[6px] h-[6px] rounded-full transition-all duration-120 ${
          hasChildren
            ? isCollapsed
              ? 'bg-[var(--text-primary)] ring-2 ring-[var(--accent)]/40'
              : 'bg-[var(--text-secondary)] group-hover:bg-[var(--accent)]'
            : 'bg-[var(--text-faint)] group-hover:bg-[var(--text-primary)]'
        }`}
      />
    </div>
  );
};
