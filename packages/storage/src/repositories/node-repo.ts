/**
 * Node Repository
 * Handles all node CRUD, tree hierarchy, cycle prevention, and reference synchronization.
 */

import {
  NodeRecord,
  ulid,
  wouldCauseCycle,
  extractReferencedNodeIds,
  convertReferencesToSnapshot,
  isUntitledOrEmpty,
} from '@hecate/core';
import { StorageAdapter } from '../adapters/storage-adapter';

export class NodeRepository {
  constructor(private adapter: StorageAdapter) {}

  private parseRow(row: any): NodeRecord {
    return {
      id: row.id,
      parent_id: row.parent_id,
      position: row.position,
      kind: row.kind,
      content: row.content || '',
      collapsed: Number(row.collapsed || 0),
      done_at: row.done_at ? Number(row.done_at) : null,
      created_at: Number(row.created_at),
      updated_at: Number(row.updated_at),
      deleted_at: row.deleted_at ? Number(row.deleted_at) : null,
      meta: row.meta ? JSON.parse(row.meta) : null,
    };
  }

  async getById(id: string): Promise<NodeRecord | null> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM node WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows.length > 0 ? this.parseRow(rows[0]) : null;
  }

  async getChildren(parentId: string | null): Promise<NodeRecord[]> {
    const query = parentId === null
      ? 'SELECT * FROM node WHERE parent_id IS NULL AND deleted_at IS NULL ORDER BY position ASC'
      : 'SELECT * FROM node WHERE parent_id = ? AND deleted_at IS NULL ORDER BY position ASC';
    const params = parentId === null ? [] : [parentId];

    const rows = await this.adapter.query<any>(query, params);
    return rows.map((r) => this.parseRow(r));
  }

  async create(node: Partial<NodeRecord>): Promise<NodeRecord> {
    const now = Date.now();
    const id = node.id || ulid(now);
    const parentId = node.parent_id ?? null;
    const position = node.position || 'a0';
    const kind = node.kind || 'content';
    const content = node.content || '';
    const collapsed = node.collapsed ?? 0;
    const doneAt = node.done_at ?? null;
    const metaStr = node.meta ? JSON.stringify(node.meta) : null;

    await this.adapter.execute(
      `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, deleted_at, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [id, parentId, position, kind, content, collapsed, doneAt, now, now, metaStr]
    );

    // Sync references if present
    await this.syncReferences(id, content);

    return {
      id,
      parent_id: parentId,
      position,
      kind,
      content,
      collapsed,
      done_at: doneAt,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      meta: node.meta || null,
    };
  }

  async updateContent(id: string, content: string): Promise<void> {
    const now = Date.now();
    await this.adapter.execute(
      'UPDATE node SET content = ?, updated_at = ? WHERE id = ?',
      [content, now, id]
    );
    await this.syncReferences(id, content);
  }

  async updateCollapsed(id: string, collapsed: boolean): Promise<void> {
    const now = Date.now();
    await this.adapter.execute(
      'UPDATE node SET collapsed = ?, updated_at = ? WHERE id = ?',
      [collapsed ? 1 : 0, now, id]
    );
  }

  async updateDone(id: string, done: boolean): Promise<void> {
    const now = Date.now();
    const doneAt = done ? now : null;
    await this.adapter.execute(
      'UPDATE node SET done_at = ?, updated_at = ? WHERE id = ?',
      [doneAt, now, id]
    );
  }

  async moveNode(nodeId: string, newParentId: string | null, newPosition: string): Promise<void> {
    // Check cycle invariant
    const allNodes = await this.adapter.query<{ id: string; parent_id: string | null }>(
      'SELECT id, parent_id FROM node WHERE deleted_at IS NULL'
    );
    const parentMap = new Map<string, string | null>();
    for (const n of allNodes) {
      parentMap.set(n.id, n.parent_id);
    }

    if (wouldCauseCycle(nodeId, newParentId, (id) => parentMap.get(id))) {
      throw new Error(`Cycle detected: cannot move node ${nodeId} under ancestor ${newParentId}`);
    }

    const now = Date.now();
    await this.adapter.execute(
      'UPDATE node SET parent_id = ?, position = ?, updated_at = ? WHERE id = ?',
      [newParentId, newPosition, now, nodeId]
    );
  }

  /**
   * Fetch raw node by ID whether soft-deleted or not.
   */
  async getNodeRaw(id: string): Promise<NodeRecord | null> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM node WHERE id = ?',
      [id]
    );
    if (rows.length === 0) return null;
    return this.parseRow(rows[0]);
  }

  /**
   * Helper to retrieve all descendant IDs of a node recursively.
   */
  async getDescendantIds(nodeId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = await this.adapter.query<{ id: string }>(
        'SELECT id FROM node WHERE parent_id = ?',
        [current]
      );
      for (const c of children) {
        descendants.push(c.id);
        queue.push(c.id);
      }
    }
    return descendants;
  }

  /**
   * Permanently delete a node and its descendants from SQLite (bypasses trash).
   */
  async permanentlyDeleteNode(nodeId: string): Promise<void> {
    const allIds = [nodeId, ...(await this.getDescendantIds(nodeId))];
    const now = Date.now();

    for (const id of allIds) {
      // Find incoming references and snapshot them before permanent deletion
      const refs = await this.adapter.query<{ source_node_id: string }>(
        'SELECT source_node_id FROM ref WHERE target_node_id = ?',
        [id]
      );
      const target = await this.getNodeRaw(id);
      for (const r of refs) {
        if (allIds.includes(r.source_node_id)) continue;
        const source = await this.getNodeRaw(r.source_node_id);
        if (source && source.content) {
          const updated = convertReferencesToSnapshot(
            source.content,
            id,
            target?.content || '[Deleted]'
          );
          if (updated !== source.content) {
            await this.adapter.execute(
              'UPDATE node SET content = ?, updated_at = ? WHERE id = ?',
              [updated, now, source.id]
            );
          }
        }
      }

      // Remove from ref, node_tag, and node tables
      await this.adapter.execute(
        'DELETE FROM ref WHERE target_node_id = ? OR source_node_id = ?',
        [id, id]
      );
      await this.adapter.execute('DELETE FROM node_tag WHERE node_id = ?', [id]);
      await this.adapter.execute('DELETE FROM node WHERE id = ?', [id]);
    }
  }

  async deleteNode(nodeId: string): Promise<{ refCount: number; permanentlyDeleted: boolean }> {
    const target = await this.getNodeRaw(nodeId);
    if (!target) return { refCount: 0, permanentlyDeleted: false };

    // If untitled entry with no content is deleted then permanently delete and don't store in trash
    if (isUntitledOrEmpty(target.content)) {
      await this.permanentlyDeleteNode(nodeId);
      return { refCount: 0, permanentlyDeleted: true };
    }

    const now = Date.now();

    // Find all incoming references
    const refs = await this.adapter.query<{ source_node_id: string }>(
      'SELECT source_node_id FROM ref WHERE target_node_id = ?',
      [nodeId]
    );
    const refCount = refs.length;

    // Convert references to plain text snapshots per REQ-3.3 Invariant 2
    for (const r of refs) {
      const source = await this.getById(r.source_node_id);
      if (source && source.content) {
        const updated = convertReferencesToSnapshot(
          source.content,
          nodeId,
          target.content || '[Deleted]'
        );
        if (updated !== source.content) {
          await this.adapter.execute(
            'UPDATE node SET content = ?, updated_at = ? WHERE id = ?',
            [updated, now, source.id]
          );
        }
      }
    }

    // Clean up ref table
    await this.adapter.execute('DELETE FROM ref WHERE target_node_id = ? OR source_node_id = ?', [
      nodeId,
      nodeId,
    ]);

    // Soft delete target node and its subtrees to trash
    const allIds = [nodeId, ...(await this.getDescendantIds(nodeId))];
    for (const id of allIds) {
      await this.adapter.execute(
        'UPDATE node SET deleted_at = ?, updated_at = ? WHERE id = ?',
        [now, now, id]
      );
    }

    return { refCount, permanentlyDeleted: false };
  }

  async getTrash(): Promise<NodeRecord[]> {
    const rows = await this.adapter.query<any>(
      'SELECT * FROM node WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    );
    return rows.map((r) => this.parseRow(r));
  }

  async restoreNode(nodeId: string): Promise<void> {
    const now = Date.now();
    const allIds = [nodeId, ...(await this.getDescendantIds(nodeId))];
    for (const id of allIds) {
      await this.adapter.execute(
        'UPDATE node SET deleted_at = NULL, updated_at = ? WHERE id = ?',
        [now, id]
      );
    }
  }

  async emptyTrash(): Promise<void> {
    const trash = await this.getTrash();
    for (const item of trash) {
      await this.permanentlyDeleteNode(item.id);
    }
  }

  async getOrCreateDayNode(dateIso: string): Promise<NodeRecord> {
    const rows = await this.adapter.query<any>(
      "SELECT * FROM node WHERE kind = 'day' AND content = ? AND deleted_at IS NULL",
      [dateIso]
    );
    if (rows.length > 0) {
      return this.parseRow(rows[0]);
    }

    // Find or create Calendar root
    let calendarRootId: string;
    const calRows = await this.adapter.query<any>(
      "SELECT id FROM node WHERE kind = 'workspace' AND content = 'Calendar' AND deleted_at IS NULL"
    );
    if (calRows.length > 0) {
      calendarRootId = calRows[0].id;
    } else {
      const now = Date.now();
      calendarRootId = ulid(now);
      await this.adapter.execute(
        `INSERT INTO node (id, parent_id, position, kind, content, collapsed, done_at, created_at, updated_at, meta)
         VALUES (?, NULL, 'a0', 'workspace', 'Calendar', 0, NULL, ?, ?, NULL)`,
        [calendarRootId, now, now]
      );
    }

    return this.create({
      parent_id: calendarRootId,
      kind: 'day',
      content: dateIso,
      position: dateIso,
    });
  }

  private async syncReferences(nodeId: string, content: string): Promise<void> {
    await this.adapter.execute('DELETE FROM ref WHERE source_node_id = ? AND kind = ?', [
      nodeId,
      'inline',
    ]);
    const targetIds = extractReferencedNodeIds(content);
    for (const targetId of targetIds) {
      await this.adapter.execute(
        'INSERT OR IGNORE INTO ref (source_node_id, target_node_id, kind) VALUES (?, ?, ?)',
        [nodeId, targetId, 'inline']
      );
    }
  }
}
