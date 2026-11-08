import React, { useState, useEffect } from 'react';
import { CalendarDays } from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { CalendarView } from '@hecate/ui';
import { useWorkspaceStore } from '../store/workspaceStore';

export const CalendarPage: React.FC = () => {
  const store = useWorkspaceStore();
  const [dayNodeByIso, setDayNodeByIso] = useState<Map<string, NodeRecord>>(new Map());
  const [dayChildren, setDayChildren] = useState<NodeRecord[]>([]);
  const [dateByNodeId, setDateByNodeId] = useState<Map<string, string>>(new Map());

  // Load all day notes and the nodes created under each day
  useEffect(() => {
    if (!store.db) return;
    async function load() {
      if (!store.db) return;
      const dayRows = await store.db.adapter.query<any>(
        "SELECT * FROM node WHERE kind = 'day' AND deleted_at IS NULL ORDER BY content ASC"
      );
      const childRows = await store.db.adapter.query<any>(
        `SELECT n.*, d.content AS day_iso
         FROM node n
         JOIN node d ON n.parent_id = d.id
         WHERE d.kind = 'day' AND n.deleted_at IS NULL AND d.deleted_at IS NULL
         ORDER BY n.position ASC`
      );

      const byIso = new Map<string, NodeRecord>();
      for (const row of dayRows) {
        byIso.set(row.content, row as NodeRecord);
      }

      const dateMap = new Map<string, string>();
      for (const row of childRows) {
        dateMap.set(row.id, row.day_iso);
      }

      setDayNodeByIso(byIso);
      setDayChildren(childRows as NodeRecord[]);
      setDateByNodeId(dateMap);
    }
    load();
  }, [store.db, store.version]);

  const handleDayClick = async (dateIso: string) => {
    if (!store.db) return;
    const existing = dayNodeByIso.get(dateIso);
    const dayNode = existing ?? (await store.db.nodes.getOrCreateDayNode(dateIso));
    store.openNode(dayNode.id);
  };

  const totalDays = dayNodeByIso.size;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-[960px] mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-[var(--border-subtle)] flex items-end justify-between">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-1 font-medium">
              Daily Notes
            </div>
            <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)]">
              Calendar
            </h1>
          </div>

          <div className="flex items-center space-x-2 text-[12px] text-[var(--text-faint)]">
            <CalendarDays className="w-3.5 h-3.5" strokeWidth={2} />
            <span>
              {totalDays} {totalDays === 1 ? 'day' : 'days'} with notes
            </span>
          </div>
        </div>

        {/* Month grid — click a day to open its daily note, click a chip to open that node */}
        <CalendarView
          nodes={dayChildren}
          getNodeDate={(n) => dateByNodeId.get(n.id) ?? null}
          onDayClick={handleDayClick}
          onNodeClick={(id) => store.openNode(id)}
        />

        <div className="text-[12px] text-[var(--text-faint)]">
          Click any day to open its daily note in a panel. Chips show nodes added that day.
        </div>
      </div>
    </div>
  );
};
