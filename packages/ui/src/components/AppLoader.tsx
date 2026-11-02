import React, { useEffect, useState } from 'react';

export interface AppLoaderProps {
  mode?: 'determinate' | 'cursor' | 'pulse';
  progress?: number; // 0 to 100
  total?: number;
  current?: number;
  label?: string;
  className?: string;
}

export const AppLoader: React.FC<AppLoaderProps> = ({
  mode = 'cursor',
  progress = 0,
  total,
  current,
  label = 'PROCESSING',
  className = '',
}) => {
  const [cursorVisible, setCursorVisible] = useState(true);

  useEffect(() => {
    if (mode !== 'cursor') return;
    const interval = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 530);
    return () => clearInterval(interval);
  }, [mode]);

  if (mode === 'determinate') {
    const pct = total && current !== undefined ? Math.round((current / total) * 100) : progress;
    return (
      <div className={`w-full font-mono text-[11px] ${className}`}>
        <div className="flex justify-between items-center text-[#888888] mb-1 uppercase tracking-[1.5px]">
          <span>{label}</span>
          <span>{total && current !== undefined ? `${current}/${total}` : `${pct}%`}</span>
        </div>
        <div className="w-full h-[2px] bg-[#222222]">
          <div
            className="h-full bg-[#ffffff] transition-all duration-150 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      </div>
    );
  }

  if (mode === 'pulse') {
    return (
      <div className={`flex items-center space-x-2 text-[#888888] animate-pulse ${className}`}>
        <span className="text-[11px] uppercase tracking-[1.5px] font-medium">{label}</span>
      </div>
    );
  }

  // Terminal cursor mode
  return (
    <div className={`inline-flex items-center space-x-1 font-mono text-[11px] text-[#888888] ${className}`}>
      <span className="uppercase tracking-[1.5px] font-medium">{label}</span>
      <span className={`text-[#ffffff] ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>█</span>
    </div>
  );
};
