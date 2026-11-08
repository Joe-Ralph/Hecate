import { StorageAdapter } from '@hecate/storage';
import { EligibilityChecker } from './eligibility';
import { computeMaturityRung, NodeStructureInfo } from './maturity';
import { computeStalenessDays } from './staleness';
import { computeImportance } from './importance';
import { inferCategoryFromTags } from './balance';
import { EngineConfig, DEFAULT_CONFIG } from '../config';

export class SignalCoordinator {
  private eligibility: EligibilityChecker;

  constructor(
    private adapter: StorageAdapter,
    private config: EngineConfig = DEFAULT_CONFIG
  ) {
    this.eligibility = new EligibilityChecker(adapter);
  }

  async markDirty(nodeId: string): Promise<void> {
    await this.adapter.execute('UPDATE node_signal SET dirty = 1 WHERE node_id = ?', [nodeId]);
  }

  async markOpened(nodeId: string, now: number = Date.now()): Promise<void> {
    await this.adapter.execute(
      `INSERT INTO node_signal (node_id, last_opened_at, dirty)
       VALUES (?, ?, 1)
       ON CONFLICT(node_id) DO UPDATE SET last_opened_at = excluded.last_opened_at, dirty = 1`,
      [nodeId, now]
    );
  }

  /**
   * Recomputes dirty nodes (Section 5) in batches
   */
  async recomputeDirty(batchSize = 200, now: number = Date.now()): Promise<number> {
    await this.eligibility.refresh();

    // 1. Find dirty nodes or nodes not yet in node_signal
    const dirtyRows = await this.adapter.query<{ id: string }>(
      `SELECT n.id FROM node n
       LEFT JOIN node_signal ns ON ns.node_id = n.id
       WHERE n.deleted_at IS NULL AND (ns.node_id IS NULL OR ns.dirty = 1)
       LIMIT ?`,
      [batchSize]
    );

    if (dirtyRows.length === 0) return 0;

    const trackedTags = new Set(this.config.trackedTags.map((t) => t.toLowerCase().replace(/^#/, '')));

    // Get tracked tag IDs
    const tagDefs = await this.adapter.query<{ id: string; content: string }>(
      "SELECT id, content FROM node WHERE kind = 'tagDef' AND deleted_at IS NULL"
    );
    const trackedTagIds = new Set<string>();
    for (const t of tagDefs) {
      if (trackedTags.has(t.content.toLowerCase().replace(/^#/, ''))) {
        trackedTagIds.add(t.id);
      }
    }

    for (const { id } of dirtyRows) {
      // Ineligible check: if not eligible, ensure deleted from node_signal
      if (!this.eligibility.isEligible(id)) {
        await this.adapter.execute('DELETE FROM node_signal WHERE node_id = ?', [id]);
        continue;
      }

      // Fetch node details
      const nodeRow = (
        await this.adapter.query<any>('SELECT * FROM node WHERE id = ? AND deleted_at IS NULL', [id])
      )[0];
      if (!nodeRow) {
        await this.adapter.execute('DELETE FROM node_signal WHERE node_id = ?', [id]);
        continue;
      }

      // Check tags
      const tagRows = await this.adapter.query<{ tag_def_id: string; content: string }>(
        `SELECT nt.tag_def_id, n.content FROM node_tag nt
         JOIN node n ON n.id = nt.tag_def_id
         WHERE nt.node_id = ? AND n.deleted_at IS NULL`,
        [id]
      );
      const tagContents = tagRows.map((r) => r.content);
      const hasTrackedTag = tagRows.some((r) => trackedTagIds.has(r.tag_def_id));

      // Fetch children
      const childRows = await this.adapter.query<any>(
        'SELECT * FROM node WHERE parent_id = ? AND deleted_at IS NULL',
        [id]
      );

      // Check actionable / done children
      const structuredChildren: NodeStructureInfo['children'] = [];
      let fieldCount = 0;
      let filledFieldCount = 0;
      let statusFieldValue: string | undefined;

      for (const c of childRows) {
        if (c.kind === 'field') {
          fieldCount++;
          // check value child
          const valChild = (
            await this.adapter.query<any>(
              'SELECT content FROM node WHERE parent_id = ? AND deleted_at IS NULL LIMIT 1',
              [c.id]
            )
          )[0];
          if (valChild && valChild.content?.trim() && valChild.content.trim().toLowerCase() !== 'empty') {
            filledFieldCount++;
            if (c.content?.toLowerCase() === 'status') {
              statusFieldValue = valChild.content.trim();
            }
          }
        } else {
          // Actionable if checkbox or task tag
          const cTags = await this.adapter.query<any>(
            `SELECT n.content FROM node_tag nt
             JOIN node n ON n.id = nt.tag_def_id
             WHERE nt.node_id = ? AND lower(n.content) = 'task'`,
            [c.id]
          );
          const isActionable = Boolean(c.kind === 'day' || cTags.length > 0 || c.done_at !== null);
          const isDone = Boolean(c.done_at !== null);
          structuredChildren.push({
            id: c.id,
            content: c.content || '',
            isActionable,
            isDone,
          });
        }
      }

      let meta: any = {};
      try {
        meta = nodeRow.meta ? JSON.parse(nodeRow.meta) : {};
      } catch {}

      const rung = computeMaturityRung({
        id: nodeRow.id,
        content: nodeRow.content || '',
        done_at: nodeRow.done_at ? Number(nodeRow.done_at) : null,
        meta,
        hasTrackedTag,
        fieldCount,
        filledFieldCount,
        statusFieldValue: statusFieldValue || meta.status,
        children: structuredChildren,
      });

      // Descendants max updated_at for activity
      const maxUpdatedRows = await this.adapter.query<{ max_up: number }>(
        'SELECT max(updated_at) as max_up FROM node WHERE (id = ? OR parent_id = ?) AND deleted_at IS NULL',
        [id, id]
      );
      const lastActivityAt = Number(maxUpdatedRows[0]?.max_up || nodeRow.updated_at || now);

      // Ref count
      const refRows = await this.adapter.query<{ count: number }>(
        'SELECT count(*) as count FROM ref WHERE target_node_id = ?',
        [id]
      );
      const refCount = Number(refRows[0]?.count || 0);

      const importance = computeImportance({
        isPinned: Boolean(meta.pinned),
        refCount,
        priority: meta.priority,
        createdAt: Number(nodeRow.created_at || now),
        now,
      });

      const category = inferCategoryFromTags(tagContents);

      // Upsert into node_signal
      await this.adapter.execute(
        `INSERT INTO node_signal (
          node_id, rung, last_activity_at, child_count, actionable_child_count,
          done_child_count, ref_count, importance, category, computed_at, dirty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(node_id) DO UPDATE SET
          rung = excluded.rung,
          last_activity_at = excluded.last_activity_at,
          child_count = excluded.child_count,
          actionable_child_count = excluded.actionable_child_count,
          done_child_count = excluded.done_child_count,
          ref_count = excluded.ref_count,
          importance = excluded.importance,
          category = excluded.category,
          computed_at = excluded.computed_at,
          dirty = 0`,
        [
          id,
          rung,
          lastActivityAt,
          structuredChildren.length,
          structuredChildren.filter((c) => c.isActionable).length,
          structuredChildren.filter((c) => c.isActionable && c.isDone).length,
          refCount,
          importance,
          category,
          now,
        ]
      );
    }

    return dirtyRows.length;
  }
}
