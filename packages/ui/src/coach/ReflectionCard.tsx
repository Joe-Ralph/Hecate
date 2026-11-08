import React, { useState } from 'react';
import { Play, Check, Clock, MoreHorizontal, SkipForward, HelpCircle, EyeOff, Save, BellOff, X } from 'lucide-react';
import { Reflection, SkipReason } from '@hecate/reflection';
import { ReferenceChip } from '../components/ReferenceChip';

export interface ReflectionCardProps {
  reflection: Reflection;
  isFeatured?: boolean;
  onStart?: (ref: Reflection) => void;
  onDone: (ref: Reflection, notes?: string) => void;
  onSkip: (ref: Reflection, reason?: SkipReason) => void;
  onSnooze: (ref: Reflection) => void;
  onSaveAsNode: (ref: Reflection) => void;
  onExplain?: (ref: Reflection) => void;
  onNeverShowForNote?: (ref: Reflection) => void;
  onOpenSourceNode?: (nodeId: string, openInSidePanel?: boolean) => void;
  sourceNodeTitles?: Record<string, string>;
  className?: string;
}

const SKIP_REASONS: { reason: SkipReason; label: string }[] = [
  { reason: 'not_relevant', label: 'Not relevant right now' },
  { reason: 'too_big', label: 'Too big for right now' },
  { reason: 'not_now', label: 'Not now, later today' },
  { reason: 'already_did', label: 'Already did outside Hecate' },
  { reason: 'not_interested', label: 'Not interested in topic' },
];

export const ReflectionCard: React.FC<ReflectionCardProps> = ({
  reflection,
  isFeatured = false,
  onStart,
  onDone,
  onSkip,
  onSnooze,
  onSaveAsNode,
  onExplain,
  onNeverShowForNote,
  onOpenSourceNode,
  sourceNodeTitles = {},
  className = '',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [skipPopoverOpen, setSkipPopoverOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [reflectionNotes, setReflectionNotes] = useState('');

  const handleSkipReason = (reason: SkipReason) => {
    setSkipPopoverOpen(false);
    onSkip(reflection, reason);
  };

  const handleQuickSkip = () => {
    setSkipPopoverOpen(true);
  };

  const handleDoneWithNotes = () => {
    onDone(reflection, reflectionNotes.trim() ? reflectionNotes : undefined);
    setNotesOpen(false);
    setReflectionNotes('');
  };

  return (
    <div
      className={`group relative bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[#3e3a35] transition-all duration-150 font-sans text-[var(--text-primary)] rounded-[10px] ${
        isFeatured ? 'p-5 shadow-lg border-[#3e3a35]/60' : 'p-3.5'
      } ${className}`}
      onKeyDown={(e) => {
        if ((e.key === 's' || e.key === 'S') && !skipPopoverOpen && !notesOpen) {
          handleQuickSkip();
        }
      }}
      tabIndex={0}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[10px] font-mono uppercase tracking-[1.5px] px-2 py-0.5 rounded-[4px] bg-[var(--bg-hover)] text-[var(--accent)] border border-[var(--border-strong)] shrink-0">
            {reflection.category}
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-[var(--text-muted)]" strokeWidth={2} />
            <span>{reflection.durationMin} MIN</span>
          </span>
          {reflection.wording === 'llm' && (
            <span className="text-[9px] font-mono text-[var(--text-muted)] border border-[var(--border-subtle)] px-1 py-0.2 rounded shrink-0">
              AI
            </span>
          )}
        </div>

        {/* Source Reference or General Chip + Menu */}
        <div className="flex items-center gap-1.5 min-w-0 shrink-0">
          {reflection.sourceNodeIds && Array.isArray(reflection.sourceNodeIds) && reflection.sourceNodeIds.length > 0 ? (
            reflection.sourceNodeIds.length === 1 ? (
              <ReferenceChip
                targetId={reflection.sourceNodeIds[0]}
                title={(sourceNodeTitles && sourceNodeTitles[reflection.sourceNodeIds[0]]) || 'Source Note'}
                onClick={(id, side) => onOpenSourceNode?.(id, side)}
                variant="chip"
                className="max-w-[130px] sm:max-w-[150px] truncate"
              />
            ) : (
              <span
                className="text-[10px] font-mono text-[var(--accent)] px-1.5 py-0.5 bg-[var(--bg-raised)] rounded border border-[var(--border-subtle)] shrink-0"
                title={`${reflection.sourceNodeIds.length} source notes linked`}
              >
                {`${reflection.sourceNodeIds.length} sources`}
              </span>
            )
          ) : (
            <span className="text-[10px] font-mono text-[var(--text-muted)] px-1.5 py-0.5 bg-[var(--bg-raised)] rounded border border-[var(--border-subtle)] shrink-0">
              General
            </span>
          )}

          {/* Overflow Menu trigger */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              title="More options"
              className="w-6 h-6 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--bg-hover)] transition-colors"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-7 w-48 bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-xl rounded-[8px] py-1.5 z-30 font-sans text-[12px]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSnooze(reflection);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <BellOff className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Snooze until tomorrow</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSaveAsNode(reflection);
                  }}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <Save className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Save as node</span>
                </button>

                {onExplain && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onExplain(reflection);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                    <span>Why this? (Breakdown)</span>
                  </button>
                )}

                {reflection.sourceNodeIds && reflection.sourceNodeIds.length > 0 && onNeverShowForNote && (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onNeverShowForNote(reflection);
                    }}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[#f28b82] hover:bg-[var(--bg-hover)]"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-[#f28b82]" />
                    <span>
                      {reflection.sourceNodeIds.length > 1
                        ? 'Never show for these notes'
                        : 'Never show for this note'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Title */}
      <h3
        className={`font-medium tracking-tight text-[var(--text-primary)] mb-1.5 ${
          isFeatured ? 'text-[17px] leading-snug' : 'text-[14px] leading-tight'
        }`}
      >
        {reflection.title}
      </h3>

      {/* Rationale */}
      {reflection.rationale && (
        <p className="text-[12px] text-[var(--text-muted)] italic mb-2 leading-relaxed">
          "{reflection.rationale}"
        </p>
      )}

      {/* Multiple Source Notes (e.g. for connect reflections linking 2+ notes) */}
      {reflection.sourceNodeIds && Array.isArray(reflection.sourceNodeIds) && reflection.sourceNodeIds.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap my-2.5 text-[11px] text-[var(--text-muted)]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            Sources:
          </span>
          {reflection.sourceNodeIds.map((srcId) => {
            const title = (sourceNodeTitles && sourceNodeTitles[srcId]) || 'Source Note';
            return (
              <ReferenceChip
                key={srcId}
                targetId={srcId}
                title={title}
                variant="chip"
                onClick={(id, side) => onOpenSourceNode?.(id, side)}
                className="max-w-[220px] truncate"
              />
            );
          })}
        </div>
      )}

      {/* Steps (featured or expanded) */}
      {isFeatured && reflection.steps && reflection.steps.length > 0 && (
        <div className="my-3 space-y-1.5 pt-2 border-t border-[var(--bg-hover)]">
          {reflection.steps.map((st, idx) => (
            <div key={idx} className="flex items-start gap-2 text-[12px] text-[var(--text-tertiary)] leading-relaxed">
              <span className="w-4 h-4 rounded-full bg-[var(--bg-hover)] text-[var(--text-muted)] font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span>{st}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes drawer (for saving thoughts on Done) */}
      {notesOpen && (
        <div className="mt-3 p-3 bg-[var(--bg-app)] border border-[var(--border-subtle)] rounded-[8px] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span>Save notes with this reflection:</span>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <textarea
            value={reflectionNotes}
            onChange={(e) => setReflectionNotes(e.target.value)}
            placeholder="Key answers, takeaways, or first prototype steps..."
            rows={2}
            className="w-full bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-[6px] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] placeholder-[#555047] focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDoneWithNotes}
              className="px-2.5 py-1 bg-[var(--green)] text-[var(--bg-surface)] text-[11px] font-medium rounded hover:bg-[#a6e2a4] cursor-pointer"
            >
              Complete & Save
            </button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--bg-hover)]">
        <div className="flex items-center gap-2">
          {/* Action button */}
          {onStart && (
            <button
              type="button"
              onClick={() => onStart(reflection)}
              className="h-7 px-2.5 bg-[var(--text-primary)] text-[var(--bg-surface)] text-[10px] font-mono uppercase tracking-[1px] font-medium rounded-[5px] hover:bg-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Start</span>
            </button>
          )}

          {/* Done button */}
          <button
            type="button"
            onClick={() => onDone(reflection)}
            className="h-7 px-2.5 bg-[var(--bg-raised)] border border-[#3e3a35] hover:border-[var(--green)]/60 text-[var(--green)] text-[10px] font-mono uppercase tracking-[1px] font-medium rounded-[5px] flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Check className="w-3 h-3" strokeWidth={2.5} />
            <span>Done</span>
          </button>

          {/* Notes toggle */}
          <button
            type="button"
            onClick={() => setNotesOpen(!notesOpen)}
            className="h-7 px-2 text-[var(--text-muted)] hover:text-[var(--text-muted)] text-[10px] font-mono tracking-wider cursor-pointer"
          >
            + Notes
          </button>
        </div>

        {/* Skip Button (visible on hover/focus per Section 15) */}
        <div className="relative">
          <button
            type="button"
            onClick={handleQuickSkip}
            title="Skip (Press 'S')"
            className="h-7 px-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-[5px] text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors opacity-80 group-hover:opacity-100"
          >
            <SkipForward className="w-3 h-3" />
            <span>Skip (S)</span>
          </button>

          {/* Skip Reasons Popover (anchored to card per Section 15) */}
          {skipPopoverOpen && (
            <div
              className="absolute right-0 bottom-8 w-60 bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl rounded-[10px] p-2.5 z-40 space-y-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-1 border-b border-[var(--bg-hover)]">
                <span>Why skip?</span>
                <button
                  type="button"
                  onClick={() => onSkip(reflection)}
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Skip anyway
                </button>
              </div>

              {SKIP_REASONS.map((sr) => (
                <button
                  key={sr.reason}
                  type="button"
                  onClick={() => handleSkipReason(sr.reason)}
                  className="w-full px-2 py-1.5 rounded-[6px] text-left text-[11px] text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                >
                  {sr.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
