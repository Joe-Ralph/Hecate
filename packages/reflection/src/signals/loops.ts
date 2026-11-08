import { StorageAdapter } from '@hecate/storage';
import { formatDate } from '@hecate/core';

export interface OpenLoopItem {
  id: string;
  content: string;
  kind: string;
  dueIso?: string;
  status?: string;
  created_at: number;
  reason: 'overdue' | 'stale_inbox';
}

/**
 * S3 Open Loops (Section 5)
 */
export async function getOpenLoops(adapter: StorageAdapter, now: number = Date.now()): Promise<OpenLoopItem[]> {
  const todayIso = formatDate(new Date(now));
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  // 1. Overdue actionable items (content matching [[date:YYYY-MM-DD]] or child field value with due date < today)
  const rows = await adapter.query<any>(
    `SELECT n.id, n.content, n.kind, n.created_at, n.meta
     FROM node n
     WHERE n.deleted_at IS NULL AND n.done_at IS NULL AND n.kind != 'field' AND n.kind != 'workspace'`
  );

  const loops: OpenLoopItem[] = [];

  for (const r of rows) {
    const content = r.content || '';
    const dateMatch = content.match(/\[\[date:(\d{4}-\d{2}-\d{2})\]\]/);
    if (dateMatch) {
      const dueIso = dateMatch[1];
      if (dueIso < todayIso) {
        loops.push({
          id: r.id,
          content,
          kind: r.kind,
          dueIso,
          created_at: r.created_at,
          reason: 'overdue',
        });
        continue;
      }
    }

    // Check child fields for Due date
    const dueFieldRows = await adapter.query<any>(
      `SELECT fv.content FROM node f
       JOIN node fv ON fv.parent_id = f.id
       WHERE f.parent_id = ? AND f.kind = 'field' AND f.deleted_at IS NULL AND fv.deleted_at IS NULL`,
      [r.id]
    );
    for (const df of dueFieldRows) {
      const dueVal = (df.content || '').trim();
      const valMatch = dueVal.match(/^(\d{4}-\d{2}-\d{2})/);
      if (valMatch && valMatch[1] < todayIso) {
        loops.push({
          id: r.id,
          content,
          kind: r.kind,
          dueIso: valMatch[1],
          created_at: r.created_at,
          reason: 'overdue',
        });
        break;
      }
    }

    // Check meta or status
    let meta: any = {};
    try {
      meta = r.meta ? JSON.parse(r.meta) : {};
    } catch {}

    if (meta.status?.toLowerCase() === 'inbox' && r.created_at < sevenDaysAgo) {
      loops.push({
        id: r.id,
        content,
        kind: r.kind,
        status: meta.status,
        created_at: r.created_at,
        reason: 'stale_inbox',
      });
    }
  }

  return loops;
}
