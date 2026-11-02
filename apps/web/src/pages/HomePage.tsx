import React, { useState, useEffect } from 'react';
import { Sparkles, Calendar, Clock, RefreshCw } from 'lucide-react';
import { NodeRecord, MiniTaskRecord } from '@hecate/core';
import { MiniTaskCard, AppLoader } from '@hecate/ui';
import { useWorkspaceStore } from '../store/workspaceStore';
import { OutlinerNode } from '../components/OutlinerNode';

export const HomePage: React.FC = () => {
  const store = useWorkspaceStore();
  const [todayNode, setTodayNode] = useState<NodeRecord | null>(null);
  const [todayChildren, setTodayChildren] = useState<NodeRecord[]>([]);
  const [recentNodes, setRecentNodes] = useState<NodeRecord[]>([]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!store.db || !store.todayNodeId) return;
    let cancelled = false;

    async function load() {
      if (!store.db || !store.todayNodeId) return;
      const node = await store.db.nodes.getById(store.todayNodeId);
      const children = await store.db.nodes.getChildren(store.todayNodeId);
      const recents = await store.db.adapter.query<any>(
        `SELECT * FROM node
         WHERE kind = 'content' AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 8`
      );

      if (!cancelled) {
        setTodayNode(node);
        setTodayChildren(children);
        setRecentNodes(recents);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [store.todayNodeId, store.version, store.db]);

  const activeTasks = store.todayMiniTasks.filter(
    (t) => t.status === 'suggested' || t.status === 'started'
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto font-sans text-[#ffffff]">
      {/* Date Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-[#222222]">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-1">
            DAILY NOTE & COACH CONSOLE
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-[#ffffff]">
            {todayNode?.content || 'Today'}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => store.runAiCoaching()}
          disabled={store.isAiRunning}
          className="h-8 px-3 flex items-center space-x-1.5 bg-[#111111] border border-[#333333] hover:border-[#ffffff] text-[#888888] hover:text-[#ffffff] text-[11px] font-mono uppercase tracking-[1px] cursor-pointer transition-colors duration-100"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#eab308]" strokeWidth={2} />
          <span>{store.isAiRunning ? 'ANALYZING...' : 'REFRESH COACH'}</span>
        </button>
      </div>

      {/* Hero Mini-Tasks Section */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-[10px] font-mono uppercase tracking-[2px] text-[#888888]">
            <Sparkles className="w-3.5 h-3.5 text-[#eab308]" strokeWidth={2} />
            <span>TODAY'S MINI-TASKS</span>
          </div>

          {store.lastDigestPayload && (
            <button
              type="button"
              onClick={() => store.setDigestInspectOpen(true)}
              className="text-[10px] font-mono text-[#555555] hover:text-[#888888] underline cursor-pointer"
            >
              What was sent?
            </button>
          )}
        </div>

        {store.isAiRunning ? (
          <div className="p-8 bg-[#111111] border border-[#222222] flex items-center justify-center">
            <AppLoader mode="cursor" label="SYNTHESIZING KNOWLEDGE DIGEST" />
          </div>
        ) : activeTasks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeTasks.slice(0, 4).map((task) => (
              <MiniTaskCard
                key={task.id}
                task={task}
                onStartTimer={() => store.updateMiniTaskStatus(task.id, 'started')}
                onDone={() => store.updateMiniTaskStatus(task.id, 'done')}
                onSnooze={() => store.updateMiniTaskStatus(task.id, 'snoozed')}
                onDismiss={() => store.updateMiniTaskStatus(task.id, 'dismissed')}
                onSaveAsNode={(t) => store.saveMiniTaskAsNode(t)}
              />
            ))}
          </div>
        ) : (
          <div className="p-6 bg-[#111111] border border-[#222222] flex items-center justify-between">
            <div className="text-[12px] text-[#888888]">
              No active mini-tasks for today. Capture notes or click refresh to generate recommendations.
            </div>
            <button
              type="button"
              onClick={() => store.runAiCoaching()}
              className="h-7 px-3 bg-[#ffffff] text-[#000000] text-[10px] font-medium uppercase tracking-[1px] hover:bg-[#e0e0e0] cursor-pointer"
            >
              GENERATE
            </button>
          </div>
        )}
      </section>

      {/* Today's Daily Outliner Section */}
      <section className="mb-12">
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-3">
          OUTLINER NOTES
        </div>
        <div className="bg-[#0e0e0e] border border-[#222222] p-4 space-y-0.5">
          {todayChildren.map((child) => (
            <OutlinerNode
              key={child.id}
              node={child}
              focusedNodeId={focusedNodeId}
              onFocusNode={setFocusedNodeId}
            />
          ))}

          <div className="pt-2">
            <button
              type="button"
              onClick={() =>
                store
                  .createChildNode(store.todayNodeId!)
                  .then((c) => setFocusedNodeId(c.id))
              }
              className="text-[12px] font-mono text-[#555555] hover:text-[#ffffff] cursor-pointer uppercase tracking-[1px]"
            >
              + Add note to today
            </button>
          </div>
        </div>
      </section>

      {/* Recently Edited Nodes */}
      <section>
        <div className="text-[10px] font-mono uppercase tracking-[2px] text-[#555555] mb-3">
          RECENTLY EDITED
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {recentNodes.map((n) => (
            <div
              key={n.id}
              onClick={() => store.openNode(n.id)}
              className="p-3 bg-[#111111] border border-[#222222] hover:border-[#444444] cursor-pointer flex items-center justify-between text-[13px] transition-colors duration-100"
            >
              <span className="font-medium text-[#ffffff] truncate">
                {n.content || 'Untitled'}
              </span>
              <span className="text-[10px] font-mono text-[#555555]">
                {new Date(n.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
