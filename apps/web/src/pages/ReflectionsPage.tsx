import React, { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, History, BarChart3, Clock } from 'lucide-react';
import { AiSummaryRecord, MiniTaskRecord } from '@hecate/core';
import { useWorkspaceStore } from '../store/workspaceStore';

export const ReflectionsPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [summaries, setSummaries] = useState<AiSummaryRecord[]>([]);
  const [recentTasks, setRecentTasks] = useState<MiniTaskRecord[]>([]);
  const [categoryStats, setCategoryStats] = useState<Record<string, { done: number; snoozed: number; dismissed: number }>>({});

  useEffect(() => {
    if (!store.db) return;
    async function load() {
      if (!store.db) return;
      const sumList = await store.db.ai.getSummaries();
      const taskList = await store.db.ai.getRecentTasks(14);
      const stats = await store.db.ai.getCategoryStats();

      setSummaries(sumList);
      setRecentTasks(taskList);
      setCategoryStats(stats);
    }
    load();
  }, [store.version, store.db]);

  const totalCompleted = recentTasks.filter((t) => t.status === 'done').length;

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto font-sans text-[#ffffff]">
      <div className="mb-8 pb-4 border-b border-[#222222]">
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-1">
          COACH REFLECTIONS & METRICS
        </div>
        <h1 className="text-3xl font-medium tracking-tight text-[#ffffff]">Reflections</h1>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
        <div className="p-4 bg-[#111111] border border-[#222222]">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555] mb-1">
            COMPLETED MINI-TASKS
          </div>
          <div className="text-3xl font-medium text-[#22c55e] font-mono">
            {totalCompleted}
          </div>
        </div>

        <div className="p-4 bg-[#111111] border border-[#222222]">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555] mb-1">
            DIGEST SUMMARIES
          </div>
          <div className="text-3xl font-medium text-[#ffffff] font-mono">
            {summaries.length}
          </div>
        </div>

        <div className="p-4 bg-[#111111] border border-[#222222]">
          <div className="text-[10px] font-mono uppercase tracking-[1.5px] text-[#555555] mb-1">
            ACTIVE CATEGORIES
          </div>
          <div className="text-3xl font-medium text-[#3b82f6] font-mono">
            {Object.keys(categoryStats).length}
          </div>
        </div>
      </div>

      {/* Recent Summaries */}
      <section className="mb-12">
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-3">
          SYNTHESIZED SUMMARIES
        </div>

        {summaries.length === 0 ? (
          <div className="p-8 text-center text-[#555555] font-mono text-[12px] bg-[#111111] border border-[#222222]">
            No reflections recorded yet. Run the AI coach from the Home screen.
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((s) => (
              <div key={s.id} className="p-5 bg-[#111111] border border-[#222222]">
                <div className="flex items-center justify-between mb-3 text-[10px] font-mono text-[#555555]">
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  <span>{s.node_count} nodes analyzed</span>
                </div>

                <p className="text-[14px] leading-relaxed text-[#ffffff] mb-4">
                  {s.text}
                </p>

                {/* Topic Chips */}
                {s.topics && s.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#222222]">
                    {s.topics.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-[#161616] border border-[#333333] text-[10px] font-mono text-[#888888]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Task History */}
      <section>
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-3">
          TASK HISTORY (LAST 14 DAYS)
        </div>

        <div className="space-y-1.5">
          {recentTasks.map((t) => (
            <div
              key={t.id}
              className="p-3 bg-[#111111] border border-[#222222] flex items-center justify-between text-[13px]"
            >
              <div className="flex items-center space-x-3">
                {t.status === 'done' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#22c55e]" strokeWidth={2} />
                ) : (
                  <Clock className="w-4 h-4 text-[#555555]" strokeWidth={2} />
                )}
                <span className={`font-medium ${t.status === 'done' ? 'line-through text-[#888888]' : 'text-[#ffffff]'}`}>
                  {t.title}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono text-[#555555] uppercase tracking-[1px]">
                  {t.category}
                </span>
                <span className="text-[10px] font-mono text-[#888888]">
                  {t.duration_min}m
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
