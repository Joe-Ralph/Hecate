import React from 'react';
import { X, HelpCircle, Layers, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Reflection } from '@hecate/reflection';

export interface ExplainModalProps {
  reflection: Reflection;
  onClose: () => void;
  sourceNodeTitles?: Record<string, string>;
  onOpenSourceNode?: (nodeId: string, openInSidePanel?: boolean) => void;
}

const SCORE_LABELS: Record<string, { label: string; desc: string }> = {
  maturityGap: { label: 'Maturity Gap', desc: 'Progression from seed to explored, planned or action' },
  staleness: { label: 'Staleness', desc: 'Days elapsed without note edits or descendant updates' },
  affinity: { label: 'Learned Affinity', desc: 'Thompson sample from your past completion vs skip feedback' },
  importance: { label: 'Importance', desc: 'Calculated from pinned state, ref count, priority, and recency' },
  novelty: { label: 'Novelty', desc: 'Dissimilarity to reflections shown in the past 14 days' },
  timeFit: { label: 'Time Fit', desc: 'Match between task duration and current time of day / settings' },
};

export const ExplainModal: React.FC<ExplainModalProps> = ({
  reflection,
  onClose,
  sourceNodeTitles = {},
  onOpenSourceNode,
}) => {
  const breakdown = reflection.scoreBreakdown || {};

  return (
    <div className="fixed inset-0 bg-[#000000]/70 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 font-sans text-[var(--text-primary)]">
      <div
        className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[12px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] bg-[var(--bg-hover)] flex items-center justify-center text-[var(--accent)]">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-medium leading-none">Why this reflection?</h2>
              <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider">
                Score: {(reflection.score * 100).toFixed(0)} / 100
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Reflection Title summary */}
          <div className="p-3 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[8px]">
            <div className="text-[10px] font-mono uppercase text-[var(--text-muted)] tracking-wider mb-1">
              {reflection.kind} • {reflection.category} • {reflection.wording.toUpperCase()}
            </div>
            <div className="text-[13px] font-medium text-[var(--text-primary)] leading-snug">
              {reflection.title}
            </div>
          </div>

          {/* Score Components */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Score Breakdown</span>
            </div>

            <div className="space-y-2.5">
              {Object.entries(SCORE_LABELS).map(([key, info]) => {
                const val = breakdown[key] !== undefined ? breakdown[key] : 0.5;
                const percentage = Math.round(val * 100);

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[var(--text-primary)]">{info.label}</span>
                      <span className="font-mono text-[11px] text-[var(--text-muted)]">{percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">{info.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sources Section */}
          {reflection.sourceNodeIds && reflection.sourceNodeIds.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <LinkIcon className="w-3.5 h-3.5 text-[var(--green)]" />
                <span>Source Nodes</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {reflection.sourceNodeIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={(e) => {
                      const isMetaOrCtrl = e.metaKey || e.ctrlKey;
                      onOpenSourceNode?.(id, isMetaOrCtrl);
                    }}
                    title="Click to open, Cmd+Click for side panel"
                    className="px-2.5 py-1 bg-[var(--bg-raised)] border border-[var(--border-subtle)] hover:border-[var(--green)]/60 rounded-[6px] text-[12px] text-[var(--green)] cursor-pointer transition-colors"
                  >
                    [[ {sourceNodeTitles[id] || id} ]]
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[var(--bg-app)] border-t border-[var(--border-subtle)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[#2c2925] text-[var(--text-primary)] rounded-[6px] text-[12px] font-mono cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
