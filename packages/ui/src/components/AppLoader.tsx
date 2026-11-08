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
        <div className="flex justify-between items-center text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">
          <span>{label}</span>
          <span>{total && current !== undefined ? `${current}/${total}` : `${pct}%`}</span>
        </div>
        <div className="w-full h-1 bg-[var(--border-subtle)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-150 ease-out rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          />
        </div>
      </div>
    );
  }

  if (mode === 'pulse') {
    return (
      <div className={`flex items-center space-x-2 text-[var(--text-muted)] animate-pulse ${className}`}>
        <span className="text-[11px] font-mono uppercase tracking-wider font-medium">{label}</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center space-x-1.5 font-mono text-[11px] text-[var(--text-muted)] ${className}`}>
      <span className="uppercase tracking-wider font-medium">{label}</span>
      <span className={`text-[var(--accent)] ${cursorVisible ? 'opacity-100' : 'opacity-0'}`}>▌</span>
    </div>
  );
};
