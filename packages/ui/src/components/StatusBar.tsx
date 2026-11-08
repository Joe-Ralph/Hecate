import React from 'react';
import { Database, Wifi, Sparkles, Timer } from 'lucide-react';

export interface StatusBarProps {
  saveStatus?: 'saved' | 'saving' | 'error';
  onRetrySave?: () => void;
  onOpenDataSettings?: () => void;
  onOpenAiSettings?: () => void;
  activeTimerLabel?: string | null;
  className?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  saveStatus = 'saved',
  onRetrySave,
  onOpenDataSettings,
  onOpenAiSettings,
  activeTimerLabel,
  className = '',
}) => {
  return (
    <footer
      className={`h-8 px-4 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[11px] text-[var(--text-faint)] select-none shrink-0 ${className}`}
    >
      <div className="flex items-center space-x-4">
        {/* Save State */}
        <div className="flex items-center space-x-1.5">
          <Database className="w-3 h-3 text-[var(--text-muted)]" strokeWidth={2} />
          {saveStatus === 'saved' && (
            <span className="text-[var(--text-muted)]">Saved locally</span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-[var(--accent)] animate-pulse">Saving…</span>
          )}
          {saveStatus === 'error' && (
            <button
              type="button"
              onClick={onRetrySave}
              className="text-[var(--red)] hover:underline cursor-pointer"
            >
              Not saved — retry
            </button>
          )}
        </div>

        {/* Offline State */}
        <button
          type="button"
          onClick={onOpenDataSettings}
          className="flex items-center space-x-1 hover:text-[var(--text-primary)] cursor-pointer transition-colors"
          title="Open Data settings"
        >
          <Wifi className="w-3 h-3 text-[var(--green)]" strokeWidth={2} />
          <span>Offline ready</span>
        </button>
      </div>

      <div className="flex items-center space-x-3">
        {/* Active Timer Pill if running */}
        {activeTimerLabel && (
          <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--bg-accent-dim)] border border-[var(--border-accent)] text-[var(--accent)]">
            <Timer className="w-3 h-3 animate-spin" strokeWidth={2} />
            <span>{activeTimerLabel}</span>
          </div>
        )}

        {/* Coach / AI mode */}
        <button
          type="button"
          onClick={onOpenAiSettings}
          className="flex items-center space-x-1.5 hover:text-[var(--accent)] cursor-pointer transition-colors"
          title="Open AI settings"
        >
          <Sparkles className="w-3 h-3 text-[var(--accent)]" strokeWidth={2} />
          <span>Coach ready</span>
        </button>
      </div>
    </footer>
  );
};
