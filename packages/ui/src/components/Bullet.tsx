import React from 'react';

export interface BulletProps {
  hasChildren?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
  className?: string;
  title?: string;
}

export const Bullet: React.FC<BulletProps> = ({
  hasChildren = false,
  onClick,
  onDragStart,
  draggable = true,
  className = '',
  title = 'Click to zoom, drag to move',
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
      className={`w-4 h-4 flex items-center justify-center cursor-pointer select-none group border border-transparent hover:border-[#ffffff] transition-colors duration-150 ${className}`}
    >
      <div
        className={`w-[5px] h-[5px] transition-colors duration-150 ${
          hasChildren
            ? 'bg-[#ffffff] group-hover:bg-[#ffffff]'
            : 'bg-[#888888] group-hover:bg-[#ffffff]'
        }`}
      />
    </div>
  );
};
