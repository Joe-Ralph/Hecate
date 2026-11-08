import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  ChevronRight,
  Clock,
  RotateCcw,
  Check,
} from 'lucide-react';
import { MiniTaskRecord } from '@hecate/core';
import { Reflection, SkipReason, UserAction } from '@hecate/reflection';
import { ReflectionCard } from './ReflectionCard';
import { ExplainModal } from './ExplainModal';

export interface CoachRailProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  aiEnabled: boolean;
  onEnableAi: () => void;
  isAiRunning: boolean;
  onRefreshCoach: () => void;
  summaryText?: string;
  topics?: string[];
  tasks?: MiniTaskRecord[];
  reflections?: Reflection[];
  onActReflection?: (id: string, action: UserAction) => Promise<{ undoToken?: string; replacement?: Reflection } | void>;
  onUndoReflection?: () => Promise<void>;
  onOpenSourceNode?: (nodeId: string, openInSidePanel?: boolean) => void;
  sourceNodeTitles?: Record<string, string>;
  onStartTimer?: (task: MiniTaskRecord) => void;
  onDoneTask?: (task: MiniTaskRecord) => void;
  onSnoozeTask?: (task: MiniTaskRecord) => void;
  onDismissTask?: (task: MiniTaskRecord, reason?: string) => void;
  onSaveAsNode?: (task: MiniTaskRecord) => void;
  onPromoteTask?: (task: MiniTaskRecord) => void;
  onOpenDigestInspect: () => void;
  onOpenReflections: () => void;
  onSelectTopic?: (topic: string) => void;
  weeklyStreak?: number;
  completedDaysCount?: number;
  className?: string;
}

export const CoachRail: React.FC<CoachRailProps> = ({
  collapsed,
  onToggleCollapse,
  aiEnabled,
  onEnableAi,
  isAiRunning,
  onRefreshCoach,
  summaryText = 'You focused on the core architecture and completed your review note.',
  topics = ['Architecture', 'Outliner', 'Design System'],
  tasks = [],
  reflections = [],
  onActReflection,
  onUndoReflection,
  onOpenSourceNode,
  sourceNodeTitles = {},
  onStartTimer,
  onDoneTask,
  onSnoozeTask,
  onDismissTask,
  onSaveAsNode,
  onPromoteTask,
  onOpenDigestInspect,
  onOpenReflections,
  onSelectTopic,
  weeklyStreak = 4,
  completedDaysCount = 1,
  className = '',
}) => {
  const [explainingRef, setExplainingRef] = useState<Reflection | null>(null);
  const [undoToast, setUndoToast] = useState<{ id: string; secondsLeft: number } | null>(null);
  const [consecutiveSkips, setConsecutiveSkips] = useState(0);
  const [hideUntilTomorrow, setHideUntilTomorrow] = useState(false);
  const [evergreenOnly, setEvergreenOnly] = useState(false);

  // Undo countdown timer (5 s per Section 15)
  useEffect(() => {
    let timer: any = null;
    if (undoToast && undoToast.secondsLeft > 0) {
      timer = setInterval(() => {
        setUndoToast((prev) => {
          if (!prev || prev.secondsLeft <= 1) return null;
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [undoToast]);

  const handleSkip = async (ref: Reflection, reason?: SkipReason) => {
    const nextSkips = consecutiveSkips + 1;
    setConsecutiveSkips(nextSkips);

    if (onActReflection) {
      const res = await onActReflection(ref.id, {
        type: 'skip',
        reason,
      });
      if (res && res.undoToken) {
        setUndoToast({ id: res.undoToken, secondsLeft: 5 });
      }
    }
  };

  const handleDone = async (ref: Reflection, notes?: string) => {
    setConsecutiveSkips(0);
    if (onActReflection) {
      await onActReflection(ref.id, {
        type: 'done',
        notes,
      });
    }
  };

  const handleSnooze = async (ref: Reflection) => {
    if (onActReflection) {
      await onActReflection(ref.id, {
        type: 'snooze',
        until: Date.now() + 24 * 60 * 60 * 1000,
      });
    }
  };

  const handleSaveAsNode = async (ref: Reflection) => {
    if (onSaveAsNode) {
      onSaveAsNode({
        id: ref.id,
        title: ref.title,
        rationale: ref.rationale || '',
        category: (ref.category as any) || 'reflection',
        duration_min: ref.durationMin,
        status: 'suggested',
        source_summary_id: null,
        due_at: null,
        done_at: null,
        snoozed_until: null,
        feedback: null,
        created_at: Date.now(),
      });
    }
    if (onActReflection) {
      await onActReflection(ref.id, {
        type: 'done',
      });
    }
  };

  const handleNeverShowForNote = async (ref: Reflection) => {
    if (onActReflection && ref.sourceNodeIds[0]) {
      await onActReflection(ref.id, {
        type: 'skip',
        reason: 'not_relevant',
      });
    }
  };

  const handleUndo = async () => {
    setUndoToast(null);
    if (onUndoReflection) {
      await onUndoReflection();
    }
  };

  // If collapsed: 40px tab
  if (collapsed) {
    return (
      <aside
        className={`w-10 min-w-10 bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col items-center py-4 select-none shrink-0 z-20 ${className}`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label="Expand coach rail (Cmd+Shift+\)"
          title="Expand coach rail (Cmd+Shift+\)"
          className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
        >
          <Sparkles className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
        </button>
        {reflections.length > 0 && (
          <div className="w-2 h-2 rounded-full bg-[var(--green)] mt-3 animate-pulse" />
        )}
      </aside>
    );
  }

  if (hideUntilTomorrow) {
    return (
      <aside
        className={`w-[344px] min-w-[344px] bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col justify-between p-6 font-sans text-[var(--text-primary)] select-none shrink-0 z-20 ${className}`}
      >
        <div className="space-y-4 text-center my-auto">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] text-[var(--green)] mx-auto flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
          <h3 className="text-[16px] font-medium text-[var(--text-primary)]">Rail paused for today</h3>
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Take a breather. Your reflections and coach cards will reset tomorrow morning.
          </p>
          <button
            type="button"
            onClick={() => setHideUntilTomorrow(false)}
            className="px-3 py-1.5 bg-[var(--bg-hover)] hover:bg-[#2c2925] text-[var(--text-primary)] rounded-[6px] text-[12px] font-mono cursor-pointer transition-colors"
          >
            Resume coach
          </button>
        </div>
      </aside>
    );
  }

  // Active reflections sorted by slot (1 to 4)
  const sortedReflections = [...reflections].sort((a, b) => (a.slot || 99) - (b.slot || 99));
  const visibleReflections = evergreenOnly
    ? sortedReflections.filter((r) => r.kind === 'evergreen')
    : sortedReflections;

  const slot1 = visibleReflections.find((r) => r.slot === 1) || visibleReflections[0];
  const upNext = visibleReflections.filter((r) => r.id !== slot1?.id).slice(0, 3);

  return (
    <>
      <aside
        className={`w-[344px] min-w-[344px] bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] flex flex-col justify-between p-4 font-sans text-[var(--text-primary)] select-none shrink-0 z-20 overflow-y-auto ${className}`}
      >
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" strokeWidth={2} />
              <span className="font-mono text-[11px] font-medium tracking-wider text-[var(--accent)] uppercase">
                Coach
              </span>
              {!aiEnabled && (
                <button
                  type="button"
                  onClick={onEnableAi}
                  title="AI is off. Using deterministic templates. Click to enable AI wording."
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-strong)] hover:text-[var(--accent)] transition-colors"
                >
                  Template
                </button>
              )}
            </div>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={onRefreshCoach}
                disabled={isAiRunning}
                aria-label="Refresh coach reflections"
                title="Refresh coach reflections"
                className={`p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors ${
                  isAiRunning ? 'animate-spin text-[var(--accent)]' : ''
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse coach rail (Cmd+Shift+\)"
                title="Collapse coach rail (Cmd+Shift+\)"
                className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              >
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* 3-skips prompt (Section 11) */}
          {consecutiveSkips >= 3 && (
            <div className="p-3 bg-[#1e1b18] border border-[var(--gold)]/40 rounded-[10px] space-y-2 text-[var(--text-primary)]">
              <div className="text-[12px] font-medium text-[var(--gold)]">
                Want to skip the rest today?
              </div>
              <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                You've skipped 3 reflections in a row. Take it easy or switch to simple habits.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setHideUntilTomorrow(true)}
                  className="px-2.5 py-1 bg-[#2a2620] hover:bg-[#342f27] text-[11px] font-mono rounded text-[var(--text-primary)] cursor-pointer"
                >
                  Yes, pause today
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEvergreenOnly(true);
                    setConsecutiveSkips(0);
                  }}
                  className="px-2.5 py-1 bg-[var(--bg-hover)] hover:bg-[#2c2925] text-[11px] font-mono rounded text-[var(--accent)] cursor-pointer"
                >
                  Simple habits only
                </button>
              </div>
            </div>
          )}

          {/* Slot 1: Do This Now */}
          {slot1 && (
            <section className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)] flex items-center justify-between">
                <span>Do This Now</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">Slot 1</span>
              </div>

              <ReflectionCard
                reflection={slot1}
                isFeatured={true}
                onDone={handleDone}
                onSkip={handleSkip}
                onSnooze={handleSnooze}
                onSaveAsNode={handleSaveAsNode}
                onExplain={setExplainingRef}
                onNeverShowForNote={handleNeverShowForNote}
                onOpenSourceNode={onOpenSourceNode}
                sourceNodeTitles={sourceNodeTitles}
              />
            </section>
          )}

          {/* Slots 2-4: Up Next */}
          {upNext.length > 0 && (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                <span>Up Next</span>
                <button
                  type="button"
                  onClick={onOpenReflections}
                  className="hover:text-[var(--text-primary)] cursor-pointer"
                >
                  History
                </button>
              </div>

              <div className="space-y-2">
                {upNext.map((ref) => (
                  <ReflectionCard
                    key={ref.id}
                    reflection={ref}
                    isFeatured={false}
                    onDone={handleDone}
                    onSkip={handleSkip}
                    onSnooze={handleSnooze}
                    onSaveAsNode={handleSaveAsNode}
                    onExplain={setExplainingRef}
                    onNeverShowForNote={handleNeverShowForNote}
                    onOpenSourceNode={onOpenSourceNode}
                    sourceNodeTitles={sourceNodeTitles}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Fallback for legacy tasks if no reflections yet */}
          {visibleReflections.length === 0 && tasks.length > 0 && (
            <section className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--accent)]">
                Mini Tasks
              </div>
              <div className="space-y-2">
                {tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px]">
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">{t.title}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Weekly Strip */}
          <section className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span className="uppercase tracking-wider">This Week</span>
              {weeklyStreak > 0 && (
                <span className="text-[var(--green)] font-medium">{weeklyStreak}-day streak</span>
              )}
            </div>

            <div className="grid grid-cols-7 gap-1.5 select-none">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => {
                const isToday = idx === 1; // Tuesday
                const isDoneDay = idx <= 1;
                return (
                  <div
                    key={idx}
                    title={`${day}: ${isDoneDay ? 'Reflections completed' : 'No reflections'}`}
                    className={`h-7 rounded-[6px] flex flex-col items-center justify-center text-[10px] font-mono border transition-colors ${
                      isDoneDay
                        ? 'bg-[var(--green-dim)] border-[var(--green)]/30 text-[var(--green)]'
                        : 'bg-[var(--bg-raised)] border-[var(--border-subtle)] text-[var(--text-faint)]'
                    } ${isToday ? 'ring-1 ring-[var(--accent)]' : ''}`}
                  >
                    <span>{day}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between font-mono text-[11px] text-[var(--text-faint)]">
          <button
            type="button"
            onClick={onOpenDigestInspect}
            className="hover:text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4 cursor-pointer transition-colors"
          >
            What was sent to the AI?
          </button>
          <span>{aiEnabled ? 'Ollama / Cloud' : 'Offline / Pure TS'}</span>
        </div>
      </aside>

      {/* Undo Toast (5 s per Section 15) */}
      {undoToast && (
        <div className="fixed bottom-6 right-96 z-50 bg-[#1e1b18] border border-[var(--border-strong)] text-[var(--text-primary)] px-4 py-2.5 rounded-[10px] shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-150 font-sans">
          <span className="text-[12px] text-[var(--text-tertiary)]">Reflection skipped</span>
          <button
            type="button"
            onClick={handleUndo}
            className="px-2 py-1 bg-[var(--accent)] text-[var(--bg-app)] text-[11px] font-mono font-medium rounded hover:bg-[var(--accent-hover)] cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Undo ({undoToast.secondsLeft}s)</span>
          </button>
        </div>
      )}

      {/* Explain Breakdown Sheet / Modal */}
      {explainingRef && (
        <ExplainModal
          reflection={explainingRef}
          onClose={() => setExplainingRef(null)}
          onOpenSourceNode={onOpenSourceNode}
          sourceNodeTitles={sourceNodeTitles}
        />
      )}
    </>
  );
};
