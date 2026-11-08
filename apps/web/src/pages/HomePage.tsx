import React, { useState, useEffect } from 'react';
import { Calendar, ChevronRight } from 'lucide-react';
import { NodeRecord } from '@hecate/core';
import { CaptureBar } from '@hecate/ui';
import { useWorkspaceStore } from '../store/workspaceStore';
import { OutlinerNode } from '../components/OutlinerNode';

export interface HomePageProps {
  onOpenNodePicker?: (nodeId: string) => void;
  onOpenTagPicker?: (nodeId: string) => void;
  onOpenFieldPicker?: (nodeId: string) => void;
  onEditSupertag?: (tagDefId: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenNodePicker,
  onOpenTagPicker,
  onOpenFieldPicker,
  onEditSupertag,
}) => {
  const store = useWorkspaceStore();
  const [todayNode, setTodayNode] = useState<NodeRecord | null>(null);
  const [todayChildren, setTodayChildren] = useState<NodeRecord[]>([]);
  const [openTasksCount, setOpenTasksCount] = useState<number>(0);
  const [referencesCount, setReferencesCount] = useState<number>(0);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<
    Array<{ id: string; name: string; color?: string; fieldCount?: number }>
  >([]);

  useEffect(() => {
    if (!store.db) return;
    store.db.tags.getAllTags().then((tags) => {
      setAvailableTags(
        tags.map((t) => ({
          id: t.id,
          name: t.content,
          color: (t.meta as any)?.color,
          fieldCount: (t.meta as any)?.fieldDefs?.length || 0,
        }))
      );
    });
  }, [store.db, store.version]);

  useEffect(() => {
    if (!store.db || !store.todayNodeId) return;
    let cancelled = false;

    async function load() {
      if (!store.db || !store.todayNodeId) return;
      const node = await store.db.nodes.getById(store.todayNodeId);
      const children = await store.db.nodes.getChildren(store.todayNodeId);
      const refs = await store.db.refs.getBacklinks(store.todayNodeId);

      // Count open tasks under today
      const openTasks = children.filter((c) => !c.done_at);

      if (!cancelled) {
        setTodayNode(node);
        setTodayChildren(children);
        setOpenTasksCount(openTasks.length);
        setReferencesCount(refs.length);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [store.todayNodeId, store.version, store.db]);

  const handleCapture = async (content: string) => {
    if (!store.db || !store.todayNodeId) return;

    // Detect any #tag tokens in the captured text
    const tagMatches = content.match(/#([a-zA-Z0-9_\-]+)/g);
    let cleanContent = content;
    const tagNames: string[] = [];
    if (tagMatches) {
      for (const m of tagMatches) {
        tagNames.push(m.slice(1));
        cleanContent = cleanContent.replace(m, '').trim();
      }
    }

    const created = await store.createNode({
      parent_id: store.todayNodeId,
      content: cleanContent || content,
    });

    for (const tName of tagNames) {
      let tagDef = await store.db.tags.getTagByName(tName);
      if (!tagDef) {
        tagDef = await store.db.tags.createTag(tName, {
          color: 'var(--accent)',
          showCheckbox: tName.toLowerCase() === 'task',
        });
      }
      if (tagDef) {
        await store.applyTag(created.id, tagDef.id);
      }
    }
  };

  // Format date header
  const today = new Date();
  const weekdayName = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const formattedDate = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="flex-1 overflow-y-auto px-8 py-6 font-sans text-[var(--text-primary)]">
      <div className="max-w-[760px] mx-auto space-y-6">
        {/* 3.4 Page Header (Date / Title) */}
        <div className="pb-4 border-b border-[var(--border-subtle)]">
          <div className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-muted)] mb-1 font-medium">
            {weekdayName}
          </div>
          <h1 className="text-[34px] font-semibold leading-[40px] tracking-[-0.01em] text-[var(--text-primary)] flex items-center space-x-2">
            <span>{todayNode?.content || formattedDate}</span>
          </h1>

          {/* One-line summary counts */}
          <div className="text-[13px] text-[var(--text-muted)] mt-2 flex items-center space-x-2">
            <span className="hover:text-[var(--accent)] cursor-pointer transition-colors">
              {openTasksCount} open tasks
            </span>
            <span>·</span>
            <span className="hover:text-[var(--accent)] cursor-pointer transition-colors">
              {referencesCount} note references today
            </span>
          </div>
        </div>

        {/* 3.9 Docked Capture Bar */}
        <div>
          <CaptureBar
            onCapture={handleCapture}
            availableTags={availableTags}
            placeholder="Capture anything…"
          />
        </div>

        {/* Outline Rows (Section 3.5 & Section 7 States Catalog) */}
        <div className="space-y-1 pt-2">
          {todayChildren.map((child) => (
            <OutlinerNode
              key={child.id}
              node={child}
              depth={0}
              focusedNodeId={focusedNodeId}
              onFocusNode={(id) => setFocusedNodeId(id)}
              onOpenNodePicker={onOpenNodePicker}
              onOpenTagPicker={onOpenTagPicker}
              onOpenFieldPicker={onOpenFieldPicker}
              onEditSupertag={onEditSupertag}
            />
          ))}

          {/* Empty day state (Section 7) */}
          {todayChildren.length === 0 && (
            <div className="p-8 border border-dashed border-[var(--border-subtle)] rounded-[10px] text-center text-[var(--text-muted)] text-[14px]">
              Start writing, or press <kbd className="font-mono text-[12px] bg-[var(--bg-raised)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border-subtle)] text-[var(--text-primary)]">C</kbd> to capture
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
