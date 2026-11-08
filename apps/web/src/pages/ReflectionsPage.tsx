import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  History,
  RotateCcw,
  Clock,
  Layers,
  Calendar,
  VolumeX,
  Volume2,
  Trash2,
  Check,
  TrendingUp,
} from 'lucide-react';
import { Rollup, Mute, KindStats, Reflection } from '@hecate/reflection';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ReflectionsPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<'history' | 'learning'>('history');
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [rollups, setRollups] = useState<Rollup[]>([]);
  const [allReflections, setAllReflections] = useState<Reflection[]>([]);
  const [mutes, setMutes] = useState<Mute[]>([]);
  const [kindStats, setKindStats] = useState<KindStats[]>([]);
  const [isResetting, setIsResetting] = useState(false);
  const [weeklyTasks, setWeeklyTasks] = useState({ completed: 0, streak: 0 });

  useEffect(() => {
    if (!store.db) return;
    (async () => {
      const weekStart = new Date();
      weekStart.setHours(0, 0, 0, 0);
      weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7)); // Monday
      const rows = await store.db!.adapter.query<any>(
        'SELECT done_at FROM mini_task WHERE done_at IS NOT NULL ORDER BY done_at DESC'
      );
      const completed = rows.filter((r) => r.done_at >= weekStart.getTime()).length;

      // Streak: consecutive days ending today (or yesterday) with a done task
      const days = new Set(rows.map((r) => new Date(r.done_at).toDateString()));
      let streak = 0;
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
      while (days.has(cursor.toDateString())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      setWeeklyTasks({ completed, streak });
    })();
  }, [store.db, store.version]);

  const loadData = async () => {
    if (!store.reflectionEngine || !store.db) return;

    try {
      // 1. Rollups
      const fetchedRollups = await store.reflectionEngine.getRollups(selectedPeriod);
      setRollups(fetchedRollups);

      // 2. Learning state
      const learning = await store.reflectionEngine.getLearning();
      setMutes(learning.mutes);
      setKindStats(learning.stats);

      // 3. Past reflections
      const rows = await store.db.adapter.query<any>(
        'SELECT * FROM reflection ORDER BY created_at DESC LIMIT 50'
      );
      setAllReflections(
        (rows || []).map((r: any) => ({
          id: r.id,
          kind: r.kind,
          status: r.status,
          slot: r.slot !== null ? Number(r.slot) : null,
          title: r.title,
          rationale: r.rationale,
          steps: r.steps ? (typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps) : [],
          category: r.category,
          durationMin: Number(r.duration_min),
          sourceNodeIds: r.source_node_ids
            ? (typeof r.source_node_ids === 'string' ? JSON.parse(r.source_node_ids) : r.source_node_ids)
            : [],
          evergreenId: r.evergreen_id || undefined,
          wording: r.wording || 'template',
          score: Number(r.score),
          createdAt: r.created_at ? Number(r.created_at) : undefined,
          shownAt: r.shown_at ? Number(r.shown_at) : undefined,
          resolvedAt: r.resolved_at ? Number(r.resolved_at) : undefined,
          skipReason: r.skip_reason || undefined,
        }))
      );
    } catch (err) {
      console.error('Failed to load reflections page data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [store.reflectionEngine, store.version, selectedPeriod]);

  const handleUnmute = async (muteId: string) => {
    if (!store.reflectionEngine) return;
    await store.reflectionEngine.unmute(muteId);
    await loadData();
  };

  const handleResetLearning = async () => {
    if (!store.reflectionEngine) return;
    setIsResetting(true);
    try {
      await store.reflectionEngine.resetLearning();
      await loadData();
    } finally {
      setIsResetting(false);
    }
  };

  const totalCompleted = allReflections.filter((r) => r.status === 'done').length;
  const totalShown = allReflections.length;
  const overallDoneRate = totalShown > 0 ? Math.round((totalCompleted / totalShown) * 100) : 0;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-[760px] mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-[var(--border-subtle)] flex items-end justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1 font-medium">
              AI Coach History & Metrics
            </div>
            <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)]">
              Reflections
            </h1>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[8px]">
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1 text-[12px] font-mono rounded-[6px] transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              History & Rollups
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('learning')}
              className={`px-3 py-1 text-[12px] font-mono rounded-[6px] transition-colors cursor-pointer ${
                activeTab === 'learning'
                  ? 'bg-[var(--bg-hover)] text-[var(--accent)] font-medium'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Learning & Mutes
            </button>
          </div>
        </div>

        {/* Stats Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Done Rate
            </div>
            <div className="text-2xl font-semibold text-[var(--green)] font-mono flex items-center gap-2">
              <span>{overallDoneRate}%</span>
              <span className="text-[12px] font-normal text-[var(--text-muted)]">
                ({totalCompleted} / {totalShown})
              </span>
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Active Mutes
            </div>
            <div className="text-2xl font-semibold text-[var(--text-primary)] font-mono">
              {mutes.length}
            </div>
          </div>

          <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Tracked Kinds
            </div>
            <div className="text-2xl font-semibold text-[var(--accent)] font-mono">
              11 kinds
            </div>
          </div>
        </div>

        {/* Weekly mini-task stats (REQ-AI-7) */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
              This Week's Mini-Tasks
            </div>
            <div className="text-2xl font-semibold text-[var(--green)] font-mono">
              {weeklyTasks.completed} completed
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1">
              Streak
            </div>
            <div className="text-2xl font-semibold text-[var(--gold)] font-mono">
              {weeklyTasks.streak} {weeklyTasks.streak === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>

        {/* TAB 1: History & Rollups */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Rollups Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Rollups & Syntheses (Section 12)
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  {(['day', 'week', 'month'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedPeriod(p)}
                      className={`px-2 py-0.5 rounded cursor-pointer uppercase ${
                        selectedPeriod === p
                          ? 'bg-[var(--bg-hover)] text-[var(--accent)] border border-[var(--border-strong)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {rollups.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)] text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
                  No {selectedPeriod}ly rollups generated yet. Rollups accumulate as you complete reflections.
                </div>
              ) : (
                <div className="space-y-3">
                  {(rollups || []).map((r) => {
                    const topicsList = Array.isArray(r.topics)
                      ? r.topics
                      : typeof r.topics === 'string'
                      ? JSON.parse(r.topics)
                      : [];

                    return (
                      <div
                        key={r.id}
                        className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] space-y-3"
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-faint)]">
                          <span className="text-[var(--text-primary)] font-medium">{r.period}</span>
                          <span>{(r.source || 'llm').toUpperCase()} SYNTHESIS</span>
                        </div>

                        <p className="text-[14px] leading-relaxed text-[var(--text-primary)]">
                          {r.text}
                        </p>

                        {topicsList.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
                            {topicsList.map((t: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-[var(--bg-raised)] border border-[var(--border-subtle)] rounded-[6px] text-[11px] font-mono text-[var(--text-tertiary)]"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Reflection Event Log */}
            <section className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                Recent Reflection Cards
              </div>

              <div className="space-y-2">
                {allReflections.map((ref) => (
                  <div
                    key={ref.id}
                    className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-[var(--bg-hover)] rounded text-[var(--accent)] border border-[var(--border-strong)]">
                          {ref.kind}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {ref.durationMin}m • {ref.category}
                        </span>
                      </div>
                      <div
                        className={`text-[13px] font-medium leading-snug ${
                          ref.status === 'done' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {ref.title}
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-[4px] shrink-0 ${
                        ref.status === 'done'
                          ? 'bg-[var(--green-dim)] text-[var(--green)] border border-[var(--green)]/30'
                          : ref.status === 'skipped'
                          ? 'bg-[#2a1e1e] text-[#f28b82] border border-[#f28b82]/30'
                          : ref.status === 'snoozed'
                          ? 'bg-[#2a261e] text-[var(--gold)] border border-[var(--gold)]/30'
                          : 'bg-[var(--bg-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {ref.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: Learning & Mutes (Section 10.4) */}
        {activeTab === 'learning' && (
          <div className="space-y-6">
            {/* Explanatory note */}
            <div className="p-4 bg-[var(--bg-accent-dim)] border border-[var(--border-accent)] rounded-[10px] space-y-1">
              <div className="text-[13px] font-medium text-[var(--accent)]">
                Transparent Local Learning
              </div>
              <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
                The Reflection Engine learns from your completions, skips, and feedback using Thompson sampling (Beta distributions) entirely inside your browser. No personal models or data leave your machine.
              </p>
            </div>

            {/* Mutes Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <VolumeX className="w-3.5 h-3.5 text-[#f28b82]" />
                  <span>Active Mutes ({mutes.length})</span>
                </div>
              </div>

              {mutes.length === 0 ? (
                <div className="p-6 text-center text-[var(--text-muted)] text-[13px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px]">
                  No active mutes. When you skip with "Not relevant" or "Not interested in topic", mutes will appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {mutes.map((m) => (
                    <div
                      key={m.id}
                      className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[10px] flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[13px] font-medium text-[var(--text-primary)]">
                          <span className="font-mono text-[var(--text-muted)] mr-2">[{m.scope.toUpperCase()}]</span>
                          {m.target_id}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                          Reason: {m.reason || 'manual'} • {m.until ? `Expires ${new Date(m.until).toLocaleDateString()}` : 'Indefinite'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnmute(m.id)}
                        className="px-2.5 py-1 bg-[var(--bg-hover)] hover:bg-[#2c2925] border border-[var(--border-strong)] text-[var(--text-primary)] rounded-[6px] text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Volume2 className="w-3 h-3 text-[var(--green)]" />
                        <span>Unmute</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Kind Preferences Table (Section 10.4) */}
            <section className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[var(--green)]" />
                <span>Kind Preferences & Completion Rates</span>
              </div>

              <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-[10px] bg-[var(--bg-surface)]">
                <table className="w-full text-left text-[12px] font-mono">
                  <thead className="bg-[var(--bg-raised)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Kind</th>
                      <th className="py-2.5 px-3 text-right">Shown</th>
                      <th className="py-2.5 px-3 text-right">Done</th>
                      <th className="py-2.5 px-3 text-right">Skipped</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--bg-hover)] text-[var(--text-primary)]">
                    {kindStats.map((k) => (
                      <tr key={k.kind} className="hover:bg-[var(--bg-hover)]/50">
                        <td className="py-2 px-3 font-medium text-[var(--accent)]">{k.kind}</td>
                        <td className="py-2 px-3 text-right text-[var(--text-muted)]">{k.shownCount}</td>
                        <td className="py-2 px-3 text-right text-[var(--green)]">{k.doneCount}</td>
                        <td className="py-2 px-3 text-right text-[#f28b82]">{k.skipCount}</td>
                        <td className="py-2 px-3 text-right font-medium">
                          {Math.round(k.doneRate * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Reset Learning Action (Section 10.4 & 16 RE-7) */}
            <section className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">Reset Learning</div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Restores all Beta preferences to (2, 2) and removes all active mutes.
                </p>
              </div>

              <button
                type="button"
                onClick={handleResetLearning}
                disabled={isResetting}
                className="px-3 py-1.5 bg-[#2a1e1e] hover:bg-[#3d2525] border border-[#f28b82]/40 text-[#f28b82] rounded-[6px] text-[12px] font-mono flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isResetting ? 'Resetting...' : 'Reset Learning'}</span>
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
